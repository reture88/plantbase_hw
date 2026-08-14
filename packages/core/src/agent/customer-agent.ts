import type { Pool } from 'pg'
import type { JsonlLogger } from '../logging/jsonl-logger'
import type { RagJsonlLogger } from '../logging/rag-jsonl-logger'
import { streamAskAgent } from './ask-agent'
import { classifyRequest } from './request-classifier'
import { streamAskRag } from '../rag/rag-agent'
import { createEscalation } from '../support/escalation-repository'

const ESCALATION_NOTICE =
  'A növényápolási tudásbázisunk alapján erre most nem tudok biztos választ adni, ezért egy kollégánk átnézi a kérdésed, és hamarosan válaszol.'

export type CustomerChatSource = 'catalog' | 'knowledge_base' | 'escalated'

export type CustomerChatEvent =
  | { type: 'notice'; text: string }
  | { type: 'text-delta'; text: string }
  | { type: 'escalated'; escalationId: number }

export type CustomerChatResult = {
  answer: string
  source: CustomerChatSource
  wantsFileExport: boolean
  sources?: { title: string; source: string }[]
  escalationId?: number
}

export type CustomerChatStream = {
  /**
   * A hívónak végig kell iterálnia ezt, MIELŐTT a `result`-ot várja —
   * ugyanaz a kontraktus, mint a `unified-agent.ts` `events`/`result`
   * párosánál.
   */
  events: AsyncIterable<CustomerChatEvent>
  result: Promise<CustomerChatResult>
}

export type CustomerChatConfig = {
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  embeddingModel: string
  helperModel: string
  /** Readonly pool a runSql/listCategories ÉS a RAG vektor-keresés futtatásához. */
  pool: Pool
  /** Írható pool az eszkalációk rögzítéséhez (külön a readonly poolól). */
  escalationPool: Pool
  logger?: JsonlLogger
  ragLogger?: RagJsonlLogger
}

async function* mapToTextDeltaEvents(textStream: AsyncIterable<string>): AsyncGenerator<CustomerChatEvent> {
  for await (const text of textStream) {
    yield { type: 'text-delta', text }
  }
}

function streamCatalogChat(
  question: string,
  config: CustomerChatConfig,
  classification: { intent: 'catalog' | 'knowledge_base'; wantsFileExport: boolean; usage: { inputTokens: number; outputTokens: number } },
): Promise<CustomerChatStream> {
  return streamAskAgent(question, {
    apiKey: config.anthropicApiKey,
    model: config.anthropicModel,
    logger: config.logger,
    runSqlPool: config.pool,
    classification,
  }).then((agentStream) => ({
    events: mapToTextDeltaEvents(agentStream.textStream),
    result: agentStream.result.then(
      (r): CustomerChatResult => ({ answer: r.answer, source: 'catalog', wantsFileExport: classification.wantsFileExport }),
    ),
  }))
}

/**
 * A tudásbázis-ág ügyfélirányú változata: ha a RAG nem tud grounded választ
 * adni, a rendszer NEM esik vissza `web_search`-re (ellenőrizetlen,
 * internetes infót nem adunk ki a cég nevében ügyfélnek) — helyette egyetlen
 * emberi jóváhagyási pontra fut: `createEscalation` rögzíti az esetet, egy
 * munkatárs oldja fel a belső nézeten (lásd `docs/final_hw/`).
 */
async function streamKnowledgeChatWithEscalation(question: string, config: CustomerChatConfig, wantsFileExport: boolean): Promise<CustomerChatStream> {
  const ragStream = await streamAskRag(question, {
    anthropicApiKey: config.anthropicApiKey,
    anthropicModel: config.anthropicModel,
    openaiApiKey: config.openaiApiKey,
    embeddingModel: config.embeddingModel,
    helperModel: config.helperModel,
    pool: config.pool,
    logger: config.ragLogger,
  })

  let resolveResult!: (value: CustomerChatResult) => void
  let rejectResult!: (error: unknown) => void
  const result = new Promise<CustomerChatResult>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  async function* events(): AsyncGenerator<CustomerChatEvent> {
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

      const escalation = await createEscalation(config.escalationPool, {
        question,
        contextSnapshot: 'A tudásbázis nem tartalmazott elég releváns forrást a kérdés megválaszolásához (grounded: false).',
        reason: 'nem grounded',
      })
      yield { type: 'notice', text: ESCALATION_NOTICE }
      yield { type: 'escalated', escalationId: escalation.id }
      resolveResult({ answer: ESCALATION_NOTICE, source: 'escalated', wantsFileExport: false, escalationId: escalation.id })
    } catch (error) {
      rejectResult(error)
      throw error
    }
  }

  return { events: events(), result }
}

/**
 * Az ügyfélirányú chat-orchestrátor — az `unified-agent.ts` klasszifikációját
 * és katalógus-ágát VÁLTOZATLANUL újrahasználja; az egyetlen eltérés a
 * tudásbázis-ág bizonytalanság-kezelése: `web_search` helyett emberi
 * eszkaláció (lásd `streamKnowledgeChatWithEscalation`).
 */
export async function streamCustomerChat(question: string, config: CustomerChatConfig): Promise<CustomerChatStream> {
  const classification = await classifyRequest(question, { apiKey: config.anthropicApiKey, model: config.anthropicModel })

  if (classification.intent === 'catalog') {
    return streamCatalogChat(question, config, classification)
  }

  return streamKnowledgeChatWithEscalation(question, config, classification.wantsFileExport)
}
