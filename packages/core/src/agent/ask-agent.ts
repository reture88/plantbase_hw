import { createAnthropic } from '@ai-sdk/anthropic'
import { isStepCount, streamText, type ModelMessage, type ToolSet } from 'ai'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { JsonlLogger, ToolCallLogEntry } from '../logging/jsonl-logger'
import { createListCategoriesTool, LIST_CATEGORIES_TOOL_NAME } from './list-categories-tool'
import { classifyRequest, type RequestClassification } from './request-classifier'
import { createRunSqlTool, RUN_SQL_TOOL_NAME } from './run-sql-tool'
import { SQL_AGENT_SYSTEM_PROMPT } from './schema-context'
import { SIMPLE_SYSTEM_PROMPT } from './simple-system-prompt'

const QuestionSchema = z.string().min(1, 'A kérdés nem lehet üres.')

const MAX_TOOL_USE_TURNS = 8
const MAX_TOKENS = 1024

export type Usage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type AskAgentConfig = {
  apiKey: string
  model: string
  logger?: JsonlLogger
  /** Ha meg van adva, a runSql/listCategories tool bekapcsol és a teljes SQL-agent system prompt aktiválódik. */
  runSqlPool?: Pool
  /**
   * Ha az egységes chat-orchestrátor (`unified-agent.ts`) már lefuttatta a
   * klasszifikációt (intent + wantsFileExport), azt ideadva `askAgent` nem
   * hívja meg még egyszer feleslegesen — a CLI-hívásoknál ez üres marad, ott
   * `askAgent` maga végzi el a klasszifikációt, mint eddig.
   */
  classification?: RequestClassification
}

export type AskAgentResult = {
  answer: string
  systemPrompt: string
  messages: ModelMessage[]
  usage: Usage
  /** Az előszűrés (`request-classifier`) szerint a felhasználó kért-e explicit fájl-exportot. */
  wantsFileExport: boolean
}

function addUsage(total: Usage, tokens: { inputTokens: number; outputTokens: number }): Usage {
  return {
    inputTokens: total.inputTokens + tokens.inputTokens,
    outputTokens: total.outputTokens + tokens.outputTokens,
    totalTokens: total.totalTokens + tokens.inputTokens + tokens.outputTokens,
  }
}

export type AskAgentStream = {
  /** Szöveg-deltákat ad, ahogy a modell generálja őket — a HTTP réteg (apps/api) ezt streameli a kliensnek. */
  textStream: AsyncIterable<string>
  /** A teljes eredmény, csak a stream végén oldódik fel — ekkor íródik a napló is. */
  result: Promise<AskAgentResult>
}

/**
 * A validáció, klasszifikáció és tool-összeállítás közös, megosztott lépése
 * `askAgent` (teljes válaszra vár) és `streamAskAgent` (a kliensnek élőben
 * streamel) között — mindkettő ugyanazt a `streamText`-hívást indítja el,
 * csak eltérően fogyasztja a visszakapott streamet.
 */
async function beginAskAgentTurn(question: string, config: AskAgentConfig) {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  const anthropic = createAnthropic({ apiKey: config.apiKey })
  const model = anthropic(config.model)
  const useSqlAgent = Boolean(config.runSqlPool)
  const systemPrompt = useSqlAgent ? SQL_AGENT_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT

  // Csak a wantsFileExport-hoz kell (a CLI ebből dönti el, hívjon-e exportot) —
  // az intent-alapú útvonalválasztást az egységes chat-orchestrátor végzi, nem
  // askAgent, ezért ha kapott már kész klasszifikációt, nem fut le újra.
  const classification: RequestClassification =
    config.classification ??
    (config.runSqlPool
      ? await classifyRequest(parsedQuestion, { apiKey: config.apiKey, model: config.model })
      : { intent: 'catalog', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })

  const toolCalls: ToolCallLogEntry[] = []
  const tools: ToolSet | undefined = config.runSqlPool
    ? {
        [RUN_SQL_TOOL_NAME]: createRunSqlTool(config.runSqlPool, toolCalls),
        [LIST_CATEGORIES_TOOL_NAME]: createListCategoriesTool(config.runSqlPool, toolCalls),
      }
    : undefined

  // Ha a `doStream` hívás elindulás előtt hibázik (pl. érvénytelen API kulcs), a
  // streamText a `.text`/`.usage` promise-okon egy általános "No output generated"
  // hibát ad vissza, elveszítve az eredeti okot — az `onError` callback ezt még az
  // eredeti hibaüzenettel kapja meg, ezt használjuk a naplózáshoz/hívóhoz.
  let streamError: unknown

  // A hivatalos loop-mechanikára (streamText + stopWhen) bízzuk a többlépéses
  // tool-hívást — beleértve a web_search szerver-oldali tool saját belső
  // folytatását is, amit korábban nekünk kellett kézzel figyelnünk (pause_turn).
  const streamResult = streamText({
    model,
    system: systemPrompt,
    prompt: parsedQuestion,
    maxOutputTokens: MAX_TOKENS,
    onError: (event) => {
      streamError = event.error
    },
    ...(tools ? { tools, stopWhen: isStepCount(MAX_TOOL_USE_TURNS) } : {}),
  })

  return { parsedQuestion, systemPrompt, classification, toolCalls, streamResult, startedAt, getStreamError: () => streamError }
}

/**
 * A `streamResult` promise-alapú mezői (`.text`, `.usage`, `.responseMessages`)
 * a dokumentáció szerint automatikusan fogyasztják a streamet, ha még senki
 * nem olvasta — ezért ez biztonságosan meghívható attól függetlenül, hogy a
 * hívó előtte élőben olvasta-e a `textStream`-et, vagy sem.
 */
async function finalizeAskAgentTurn(
  turn: Awaited<ReturnType<typeof beginAskAgentTurn>>,
  config: AskAgentConfig,
): Promise<AskAgentResult> {
  const { parsedQuestion, systemPrompt, classification, toolCalls, streamResult, startedAt, getStreamError } = turn

  let messages: ModelMessage[] = [{ role: 'user', content: parsedQuestion }]
  let answer = ''
  let usage: Usage = addUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }, classification.usage)
  let errorMessage: string | undefined

  try {
    const [text, streamUsage, responseMessages] = await Promise.all([
      streamResult.text,
      streamResult.usage,
      streamResult.responseMessages,
    ])

    usage = addUsage(usage, {
      inputTokens: streamUsage.inputTokens ?? 0,
      outputTokens: streamUsage.outputTokens ?? 0,
    })
    messages = [{ role: 'user', content: parsedQuestion }, ...responseMessages]
    answer = text || 'Nem sikerült választ generálni a megengedett lépésszámon belül.'

    return { answer, systemPrompt, messages, usage, wantsFileExport: classification.wantsFileExport }
  } catch (error) {
    const actualError = getStreamError() ?? error
    errorMessage = actualError instanceof Error ? actualError.message : 'Ismeretlen hiba történt.'
    throw actualError
  } finally {
    config.logger?.append({
      timestamp: new Date().toISOString(),
      question: parsedQuestion,
      systemPrompt,
      messages,
      toolCalls,
      finalAnswer: answer,
      usage,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
      classification: { intent: classification.intent, wantsFileExport: classification.wantsFileExport },
    })
  }
}

/** A teljes válaszra vár (CLI-használatra) — a mögöttes hívás ugyanaz a `streamText`, mint `streamAskAgent`-nél. */
export async function askAgent(question: string, config: AskAgentConfig): Promise<AskAgentResult> {
  const turn = await beginAskAgentTurn(question, config)
  return finalizeAskAgentTurn(turn, config)
}

/** Élő token-streamre (HTTP réteghez) — a `result` csak a stream végén oldódik fel, addig a napló sem íródik. */
export async function streamAskAgent(question: string, config: AskAgentConfig): Promise<AskAgentStream> {
  const turn = await beginAskAgentTurn(question, config)
  return {
    textStream: turn.streamResult.textStream,
    result: finalizeAskAgentTurn(turn, config),
  }
}
