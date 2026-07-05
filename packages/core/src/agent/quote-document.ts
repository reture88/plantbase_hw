import Anthropic from '@anthropic-ai/sdk'

// Anthropic hivatalos Skill (xlsx) + code_execution tool — a dokumentum a
// szerver-oldali konténerben generálódik, nem saját fejlesztésű logika.
const QUOTE_DOCUMENT_BETAS: Array<'code-execution-2025-08-25' | 'skills-2025-10-02'> = [
  'code-execution-2025-08-25',
  'skills-2025-10-02',
]
// A hivatalos Skills-példák 16000 max_tokens-szel dolgoznak — az xlsx-generálás
// több kód-végrehajtási körből állhat (csomagtelepítés, szkript írása/futtatása),
// egy alacsonyabb korlát a fájl elkészülte előtt vághatja el a választ.
const QUOTE_MAX_TOKENS = 16000
// A code_execution szerver-oldali tool a web_search-höz hasonlóan `pause_turn`-nel
// állhat meg a saját belső lépés-limitje miatt; ilyenkor újra kell küldeni az eddigi
// üzeneteket a folytatáshoz. Ez a korlát a végtelen ciklus elleni védelem.
const QUOTE_MAX_TURNS = 5

export type QuoteDocumentConfig = {
  apiKey: string
  model: string
}

export type QuoteDocumentResult = {
  fileId: string
  filename: string
}

function findGeneratedFileId(content: Anthropic.Beta.BetaContentBlock[]): string | undefined {
  for (const block of content) {
    if (block.type === 'bash_code_execution_tool_result' && block.content.type === 'bash_code_execution_result') {
      const output = block.content.content.find((item) => item.type === 'bash_code_execution_output')
      if (output) {
        return output.file_id
      }
    }
  }
  return undefined
}

export async function generateQuoteDocument(
  recommendationText: string,
  config: QuoteDocumentConfig,
): Promise<QuoteDocumentResult> {
  const client = new Anthropic({ apiKey: config.apiKey })

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Készíts egy formázott, magyar nyelvű Excel árajánlatot (.xlsx fájl) az alábbi növény-ajánlás alapján. A táblázat tartalmazzon tételes listát (növény neve, mennyiség, egységár Ft, részösszeg Ft) és egy végösszeg sort.\n\nAjánlás:\n${recommendationText}`,
    },
  ]

  for (let turn = 0; turn < QUOTE_MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: QUOTE_MAX_TOKENS,
      betas: QUOTE_DOCUMENT_BETAS,
      container: {
        skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }],
      },
      tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
      messages,
    })

    const fileId = findGeneratedFileId(response.content)
    if (fileId) {
      const metadata = await client.beta.files.retrieveMetadata(fileId)
      return { fileId, filename: metadata.filename }
    }

    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content })
      continue
    }

    throw new Error(
      `Nem sikerült árajánlat-dokumentumot generálni: nem érkezett fájl a válaszban (stop_reason: ${response.stop_reason}).`,
    )
  }

  throw new Error(
    `Nem sikerült árajánlat-dokumentumot generálni: a megengedett lépésszámon (${QUOTE_MAX_TURNS}) belül nem készült fájl.`,
  )
}

export async function downloadQuoteDocument(fileId: string, config: QuoteDocumentConfig): Promise<Buffer> {
  const client = new Anthropic({ apiKey: config.apiKey })
  const response = await client.beta.files.download(fileId)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
