import Anthropic from '@anthropic-ai/sdk'

// Anthropic hivatalos Skill (xlsx) + code_execution tool — a dokumentum a
// szerver-oldali konténerben generálódik, nem saját fejlesztésű logika.
const QUOTE_DOCUMENT_BETAS: Array<'code-execution-2025-08-25' | 'skills-2025-10-02'> = [
  'code-execution-2025-08-25',
  'skills-2025-10-02',
]
const QUOTE_MAX_TOKENS = 4096

export type QuoteDocumentConfig = {
  apiKey: string
  model: string
}

export type QuoteDocumentResult = {
  fileId: string
  filename: string
}

export async function generateQuoteDocument(
  recommendationText: string,
  config: QuoteDocumentConfig,
): Promise<QuoteDocumentResult> {
  const client = new Anthropic({ apiKey: config.apiKey })

  const response = await client.beta.messages.create({
    model: config.model,
    max_tokens: QUOTE_MAX_TOKENS,
    betas: QUOTE_DOCUMENT_BETAS,
    container: {
      skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }],
    },
    tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
    messages: [
      {
        role: 'user',
        content: `Készíts egy formázott, magyar nyelvű Excel árajánlatot (.xlsx fájl) az alábbi növény-ajánlás alapján. A táblázat tartalmazzon tételes listát (növény neve, mennyiség, egységár Ft, részösszeg Ft) és egy végösszeg sort.\n\nAjánlás:\n${recommendationText}`,
      },
    ],
  })

  for (const block of response.content) {
    if (block.type === 'bash_code_execution_tool_result' && block.content.type === 'bash_code_execution_result') {
      const output = block.content.content.find((item) => item.type === 'bash_code_execution_output')
      if (output) {
        const metadata = await client.beta.files.retrieveMetadata(output.file_id)
        return { fileId: output.file_id, filename: metadata.filename }
      }
    }
  }

  throw new Error('Nem sikerült árajánlat-dokumentumot generálni: nem érkezett fájl a válaszban.')
}

export async function downloadQuoteDocument(fileId: string, config: QuoteDocumentConfig): Promise<Buffer> {
  const client = new Anthropic({ apiKey: config.apiKey })
  const response = await client.beta.files.download(fileId)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
