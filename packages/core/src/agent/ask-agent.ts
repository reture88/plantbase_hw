import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, isStepCount, type ModelMessage, type ToolSet } from 'ai'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { JsonlLogger, ToolCallLogEntry } from '../logging/jsonl-logger'
import { createListCategoriesTool, LIST_CATEGORIES_TOOL_NAME } from './list-categories-tool'
import { classifyRequest, type RequestClassification } from './request-classifier'
import { createRunSqlTool, RUN_SQL_TOOL_NAME } from './run-sql-tool'
import { SQL_AGENT_SYSTEM_PROMPT } from './schema-context'
import { SIMPLE_SYSTEM_PROMPT } from './simple-system-prompt'
import { WEB_SEARCH_TOOL_NAME, webSearchTool } from './web-search-tool'

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

export async function askAgent(question: string, config: AskAgentConfig): Promise<AskAgentResult> {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  const anthropic = createAnthropic({ apiKey: config.apiKey })
  const model = anthropic(config.model)
  const useSqlAgent = Boolean(config.runSqlPool)
  const systemPrompt = useSqlAgent ? SQL_AGENT_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT

  // Előszűrés a fő tool-use hívás előtt: dönti el, hogy a web_search tool egyáltalán
  // felajánlásra kerüljön-e (csak növény-témájú kérdésnél), és hogy a
  // felhasználó kért-e explicit fájl-exportot. Lásd docs/architektura.md.
  const classification: RequestClassification = config.runSqlPool
    ? await classifyRequest(parsedQuestion, { apiKey: config.apiKey, model: config.model })
    : { isPlantRelated: false, wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } }

  const toolCalls: ToolCallLogEntry[] = []
  let messages: ModelMessage[] = [{ role: 'user', content: parsedQuestion }]
  let answer = ''
  let usage: Usage = addUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }, classification.usage)
  let errorMessage: string | undefined

  try {
    const tools: ToolSet | undefined = config.runSqlPool
      ? {
          [RUN_SQL_TOOL_NAME]: createRunSqlTool(config.runSqlPool, toolCalls),
          [LIST_CATEGORIES_TOOL_NAME]: createListCategoriesTool(config.runSqlPool, toolCalls),
          ...(classification.isPlantRelated ? { [WEB_SEARCH_TOOL_NAME]: webSearchTool } : {}),
        }
      : undefined

    // A hivatalos loop-mechanikára (generateText + stopWhen) bízzuk a többlépéses
    // tool-hívást — beleértve a web_search szerver-oldali tool saját belső
    // folytatását is, amit korábban nekünk kellett kézzel figyelnünk (pause_turn).
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: parsedQuestion,
      maxOutputTokens: MAX_TOKENS,
      ...(tools ? { tools, stopWhen: isStepCount(MAX_TOOL_USE_TURNS) } : {}),
    })

    usage = addUsage(usage, {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    })
    messages = [{ role: 'user', content: parsedQuestion }, ...result.responseMessages]
    answer = result.text || 'Nem sikerült választ generálni a megengedett lépésszámon belül.'

    return { answer, systemPrompt, messages, usage, wantsFileExport: classification.wantsFileExport }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba történt.'
    throw error
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
      classification: { isPlantRelated: classification.isPlantRelated, wantsFileExport: classification.wantsFileExport },
    })
  }
}
