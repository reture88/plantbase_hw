import { anthropic, createAnthropic, type AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import { generateText, isStepCount } from 'ai'

// A hivatalos Skills-példák 16000 max_tokens-szel dolgoznak — az xlsx-generálás
// több kód-végrehajtási körből állhat (csomagtelepítés, szkript írása/futtatása),
// egy alacsonyabb korlát a fájl elkészülte előtt vághatja el a választ.
const QUOTE_MAX_TOKENS = 16000
// Több lépés is kellhet, mire a konténerben elkészül és visszaérkezik a fájl —
// ezt (a korábbi kézzel írt pause_turn-kezeléssel szemben) most a generateText
// saját stopWhen-mechanizmusa intézi.
const QUOTE_MAX_STEPS = 5

// Az AI SDK Files API-ja (`anthropic.files()`) jelenleg csak feltöltést tud
// (`uploadFile`), letöltést nem — a generált fájl bájtjaihoz és a
// metaadataihoz ezért közvetlenül, a hivatalos REST végpontokat hívjuk. A
// fejlécértékek (`anthropic-version`, `anthropic-beta`) a @ai-sdk/anthropic
// csomag saját, ugyanerre a Files API-ra használt értékeivel egyeznek.
const FILES_API_BASE_URL = 'https://api.anthropic.com/v1/files'
const ANTHROPIC_VERSION = '2023-06-01'
const FILES_API_BETA = 'files-api-2025-04-14'

export type QuoteDocumentConfig = {
  apiKey: string
  model: string
}

export type QuoteDocumentResult = {
  fileId: string
  filename: string
}

type CodeExecutionOutputContent = {
  content?: Array<{ type: string; file_id?: string }>
}

function findGeneratedFileId(toolResults: ReadonlyArray<{ output?: unknown }>): string | undefined {
  for (const toolResult of toolResults) {
    const output = toolResult.output as CodeExecutionOutputContent | undefined
    // A code_execution tool több, egymástól eltérő output-alakot ad vissza a
    // lépés fajtájától függően (szkript-írás, fájlnézegetés, bash-futtatás...) —
    // csak azokban van tömb a `content`-ben, amik ténylegesen fájlt generáltak.
    if (!Array.isArray(output?.content)) continue

    const fileEntry = output.content.find(
      (item) => item.type === 'code_execution_output' || item.type === 'bash_code_execution_output',
    )
    if (fileEntry?.file_id) {
      return fileEntry.file_id
    }
  }
  return undefined
}

function filesApiHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-beta': FILES_API_BETA,
  }
}

/**
 * Közös alap a Skills + code_execution mechanizmuson keresztüli
 * dokumentum-generáláshoz — az xlsx (`generateQuoteDocument`) és a pdf
 * (`generatePdfDocument`) export is ugyanezt hívja, csak eltérő prompttal
 * és `skillId`-vel (mindkettő Anthropic hivatalos Agent Skill, lásd
 * anthropics/skills repo: `xlsx`, `pdf`).
 */
async function generateDocumentViaSkill(
  prompt: string,
  skillId: 'xlsx' | 'pdf',
  config: QuoteDocumentConfig,
): Promise<QuoteDocumentResult> {
  const model = createAnthropic({ apiKey: config.apiKey })(config.model)

  const result = await generateText({
    model,
    maxOutputTokens: QUOTE_MAX_TOKENS,
    prompt,
    tools: { code_execution: anthropic.tools.codeExecution_20260120() },
    stopWhen: isStepCount(QUOTE_MAX_STEPS),
    providerOptions: {
      anthropic: {
        container: {
          skills: [{ type: 'anthropic', skillId, version: 'latest' }],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  })

  const fileId = findGeneratedFileId(result.toolResults)
  if (!fileId) {
    throw new Error(
      `Nem sikerült dokumentumot generálni: nem érkezett fájl a válaszban (finishReason: ${result.finishReason}).`,
    )
  }

  const metadataResponse = await fetch(`${FILES_API_BASE_URL}/${fileId}`, {
    headers: filesApiHeaders(config.apiKey),
  })
  if (!metadataResponse.ok) {
    throw new Error(`Nem sikerült lekérni a generált fájl metaadatait (HTTP ${metadataResponse.status}).`)
  }
  const metadata = (await metadataResponse.json()) as { filename?: string }

  return { fileId, filename: metadata.filename ?? `dokumentum-${fileId}.${skillId}` }
}

export async function generateQuoteDocument(
  recommendationText: string,
  config: QuoteDocumentConfig,
): Promise<QuoteDocumentResult> {
  const prompt = `Készíts egy formázott, magyar nyelvű Excel árajánlatot (.xlsx fájl) az alábbi növény-ajánlás alapján. A táblázat tartalmazzon tételes listát (növény neve, mennyiség, egységár Ft, részösszeg Ft) és egy végösszeg sort.\n\nAjánlás:\n${recommendationText}`
  return generateDocumentViaSkill(prompt, 'xlsx', config)
}

export async function generatePdfDocument(content: string, config: QuoteDocumentConfig): Promise<QuoteDocumentResult> {
  const prompt = `Készíts egy jól formázott, magyar nyelvű PDF dokumentumot az alábbi növényápolási válasz alapján. Legyen benne cím, jól tagolt bekezdések, és ha a válasz forrásokra hivatkozik, azok listázva a dokumentum végén.\n\nVálasz:\n${content}`
  return generateDocumentViaSkill(prompt, 'pdf', config)
}

export async function downloadQuoteDocument(fileId: string, config: QuoteDocumentConfig): Promise<Buffer> {
  const response = await fetch(`${FILES_API_BASE_URL}/${fileId}/content`, {
    headers: filesApiHeaders(config.apiKey),
  })
  if (!response.ok) {
    throw new Error(`Nem sikerült letölteni a generált fájlt (HTTP ${response.status}).`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
