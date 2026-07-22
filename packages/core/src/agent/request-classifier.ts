import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

const CLASSIFIER_MAX_TOKENS = 20

const CLASSIFIER_SYSTEM_PROMPT = `
Egy növény-webshop AI asszisztense elé érkező felhasználói üzenetet szűrsz elő. KIZÁRÓLAG az alábbi két sorral válaszolj, semmi mást ne írj:

NÖVÉNY: IGEN vagy NÖVÉNY: NEM — a kérdés egy konkrét növényhez, annak gondozásához, kiválasztásához vagy a növény-katalógushoz kapcsolódik-e (ideértve az általános növényápolási tanácsokat is)?
EXPORT: IGEN vagy EXPORT: NEM — a felhasználó kifejezetten kérte-e, hogy a választ/listát mentsd el fájlba, Excelbe, táblázatba, vagy exportáld valamilyen formában? (Önmagában a lista/összehasonlítás kérése NEM elég — konkrét fájlba mentési/exportálási szándéknak is szerepelnie kell.)
`.trim()

export type RequestClassification = {
  isPlantRelated: boolean
  wantsFileExport: boolean
  usage: { inputTokens: number; outputTokens: number }
}

function parseAnswer(text: string, label: string): boolean {
  const match = new RegExp(`${label}\\s*:\\s*(IGEN|NEM)`, 'i').exec(text)
  return match?.[1].toUpperCase() === 'IGEN'
}

export type ClassifierConfig = {
  apiKey: string
  model: string
}

/**
 * Előszűrés a fő tool-use loop előtt: eldönti, hogy a kérdés növény-témájú-e
 * (ez kapuzza, hogy a web_search tool egyáltalán felajánlásra kerüljön-e), és
 * hogy a felhasználó kért-e explicit fájl-exportot. Hiba esetén "fail closed":
 * sem web_search, sem fájl-export nem indul.
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
      isPlantRelated: parseAnswer(result.text, 'NÖVÉNY'),
      wantsFileExport: parseAnswer(result.text, 'EXPORT'),
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 },
    }
  } catch {
    return { isPlantRelated: false, wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } }
  }
}
