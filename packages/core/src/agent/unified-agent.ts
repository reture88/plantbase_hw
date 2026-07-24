import type { Pool } from 'pg'
import type { JsonlLogger } from '../logging/jsonl-logger'
import type { RagJsonlLogger } from '../logging/rag-jsonl-logger'
import { streamAskAgent } from './ask-agent'
import { classifyRequest } from './request-classifier'
import { streamAskRag } from '../rag/rag-agent'
import { streamWebFallbackAnswer } from './web-fallback-agent'

const FALLBACK_NOTICE =
  'A növényápolási tudásbázisunk alapján erre nem találtam választ, ezért megpróbálom interneten (web_search) kikeresni…'

export type UnifiedChatSource = 'catalog' | 'knowledge_base' | 'web_search'

export type UnifiedChatEvent = { type: 'notice'; text: string } | { type: 'text-delta'; text: string }

export type UnifiedChatResult = {
  answer: string
  source: UnifiedChatSource
  wantsFileExport: boolean
  sources?: { title: string; source: string }[]
}

export type UnifiedChatStream = {
  /**
   * A hívónak végig kell iterálnia ezt, MIELŐTT a `result`-ot várja — a
   * `knowledge_base`-ágon a `result` csak az `events` generátor lefutása
   * közben (a végén) oldódik fel, ugyanúgy, mint a `rag-agent.ts`
   * `bufferAgainstMarker`-jénél.
   */
  events: AsyncIterable<UnifiedChatEvent>
  result: Promise<UnifiedChatResult>
}

export type UnifiedChatConfig = {
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  embeddingModel: string
  helperModel: string
  /** Egyetlen readonly pool — ezen fut a runSql/listCategories ÉS a RAG vektor-keresés is. */
  pool: Pool
  logger?: JsonlLogger
  ragLogger?: RagJsonlLogger
}

async function* mapToTextDeltaEvents(textStream: AsyncIterable<string>): AsyncGenerator<UnifiedChatEvent> {
  for await (const text of textStream) {
    yield { type: 'text-delta', text }
  }
}

function streamCatalogChat(
  question: string,
  config: UnifiedChatConfig,
  classification: { intent: 'catalog' | 'knowledge_base'; wantsFileExport: boolean; usage: { inputTokens: number; outputTokens: number } },
): Promise<UnifiedChatStream> {
  return streamAskAgent(question, {
    apiKey: config.anthropicApiKey,
    model: config.anthropicModel,
    logger: config.logger,
    runSqlPool: config.pool,
    classification,
  }).then((agentStream) => ({
    events: mapToTextDeltaEvents(agentStream.textStream),
    result: agentStream.result.then(
      (r): UnifiedChatResult => ({ answer: r.answer, source: 'catalog', wantsFileExport: classification.wantsFileExport }),
    ),
  }))
}

async function streamKnowledgeChatWithFallback(question: string, config: UnifiedChatConfig, wantsFileExport: boolean): Promise<UnifiedChatStream> {
  const ragStream = await streamAskRag(question, {
    anthropicApiKey: config.anthropicApiKey,
    anthropicModel: config.anthropicModel,
    openaiApiKey: config.openaiApiKey,
    embeddingModel: config.embeddingModel,
    helperModel: config.helperModel,
    pool: config.pool,
    logger: config.ragLogger,
  })

  let resolveResult!: (value: UnifiedChatResult) => void
  let rejectResult!: (error: unknown) => void
  const result = new Promise<UnifiedChatResult>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  async function* events(): AsyncGenerator<UnifiedChatEvent> {
    try {
      let sawAnyText = false
      for await (const delta of ragStream.textStream) {
        sawAnyText = true
        yield { type: 'text-delta', text: delta }
      }
      const ragResult = await ragStream.result

      if (sawAnyText && ragResult.grounded) {
        resolveResult({ answer: ragResult.answer, source: 'knowledge_base', wantsFileExport, sources: ragResult.sources })
        return
      }

      yield { type: 'notice', text: FALLBACK_NOTICE }
      const fallback = await streamWebFallbackAnswer(question, { apiKey: config.anthropicApiKey, model: config.anthropicModel })
      for await (const delta of fallback.textStream) {
        yield { type: 'text-delta', text: delta }
      }
      const fallbackResult = await fallback.result
      resolveResult({ answer: fallbackResult.answer, source: 'web_search', wantsFileExport })
    } catch (error) {
      rejectResult(error)
      throw error
    }
  }

  return { events: events(), result }
}

/**
 * Az egységes chat-orchestrátor: egyetlen klasszifikáció dönti el, hogy egy
 * beérkező kérdés katalógus-adatra (runSql-ág, `ask-agent.ts`) vagy általános
 * növényápolási/egyéb infóra (tudásbázis-ág, `rag-agent.ts`) vonatkozik-e. A
 * tudásbázis-ágon, ha a RAG nem tud grounded választ adni, a chat egy
 * feltűnő `notice` eseményt küld, majd `web-fallback-agent.ts`-szel
 * (web_search) próbál választ adni — a web_search tehát mostantól KIZÁRÓLAG
 * ez a fallback-lépés, nem a katalógus-agent egyik toolja.
 */
export async function streamUnifiedChat(question: string, config: UnifiedChatConfig): Promise<UnifiedChatStream> {
  const classification = await classifyRequest(question, { apiKey: config.anthropicApiKey, model: config.anthropicModel })

  if (classification.intent === 'catalog') {
    return streamCatalogChat(question, config, classification)
  }

  return streamKnowledgeChatWithFallback(question, config, classification.wantsFileExport)
}
