import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

const CLASSIFIER_MAX_TOKENS = 20

const CLASSIFIER_SYSTEM_PROMPT = `
Egy növény-webshop AI asszisztense elé érkező felhasználói üzenetet szűrsz elő. KIZÁRÓLAG az alábbi két sorral válaszolj, semmi mást ne írj:

SZANDEK: KATALOGUS vagy TUDASBAZIS — a kérdés konkrét termékadatra vonatkozik-e (ár, készlet, kategória, egy adott növény elérhetősége a boltban) [KATALOGUS], vagy általános növényápolási/egyéb, a katalógustól független információra [TUDASBAZIS]?
EXPORT: IGEN vagy NEM — a felhasználó kifejezetten kérte-e, hogy a választ/listát mentsd el fájlba, exportáld valamilyen formában? (Önmagában a lista/összehasonlítás kérése NEM elég — konkrét fájlba mentési/exportálási szándéknak is szerepelnie kell.)
`.trim()

export type RequestClassification = {
  intent: 'catalog' | 'knowledge_base'
  wantsFileExport: boolean
  usage: { inputTokens: number; outputTokens: number }
}

function parseIntent(text: string): RequestClassification['intent'] {
  const match = /SZANDEK\s*:\s*(KATALOGUS|TUDASBAZIS)/i.exec(text)
  return match?.[1].toUpperCase() === 'TUDASBAZIS' ? 'knowledge_base' : 'catalog'
}

function parseExport(text: string): boolean {
  const match = /EXPORT\s*:\s*(IGEN|NEM)/i.exec(text)
  return match?.[1].toUpperCase() === 'IGEN'
}

export type ClassifierConfig = {
  apiKey: string
  model: string
}

/**
 * Előszűrés a fő válaszadás előtt: eldönti, hogy a kérdés konkrét
 * katalógusadatra vonatkozik-e (runSql-ág) vagy általános növényápolási
 * infóra (tudásbázis-ág), és hogy a felhasználó kért-e explicit
 * fájl-exportot. Hiba esetén "fail closed": `intent: 'catalog'` (nincs
 * web_search-fallback ezen az ágon) és `wantsFileExport: false`.
 */
export async function classifyRequest(question: string, config: ClassifierConfig): Promise<RequestClassification> {
  try {
    const anthropic = createAnthropic({ apiKey: config.apiKey })
    const result = await generateText({
      model: anthropic(config.model),
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: question,
      maxOutputTokens: CLASSIFIER_MAX_TOKENS,
    })

    return {
      intent: parseIntent(result.text),
      wantsFileExport: parseExport(result.text),
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 },
    }
  } catch {
    return { intent: 'catalog', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } }
  }
}
