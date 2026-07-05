import Anthropic from '@anthropic-ai/sdk'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { JsonlLogger, ToolCallLogEntry } from '../logging/jsonl-logger'
import { createListCategoriesHandler, LIST_CATEGORIES_TOOL_NAME, listCategoriesToolDefinition } from './list-categories-tool'
import { classifyRequest, type RequestClassification } from './request-classifier'
import { createRunSqlHandler, RUN_SQL_TOOL_NAME, runSqlToolDefinition } from './run-sql-tool'
import { SQL_AGENT_SYSTEM_PROMPT } from './schema-context'
import { SIMPLE_SYSTEM_PROMPT } from './simple-system-prompt'
import { webSearchToolDefinition } from './web-search-tool'

const QuestionSchema = z.string().min(1, 'A kérdés nem lehet üres.')

const MAX_TOOL_USE_TURNS = 8
const MAX_TOKENS = 1024
const TOOL_RESULT_SAMPLE_SIZE = 5

export type Usage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type AskAgentConfig = {
  apiKey: string
  model: string
  logger?: JsonlLogger
  /** Ha meg van adva, a runSql tool bekapcsol és a teljes SQL-agent system prompt aktiválódik. */
  runSqlPool?: Pool
}

export type AskAgentResult = {
  answer: string
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  usage: Usage
  /** Az előszűrés (`request-classifier`) szerint a felhasználó kért-e explicit fájl-exportot. */
  wantsFileExport: boolean
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
}

function addUsage(total: Usage, tokens: { inputTokens: number; outputTokens: number }): Usage {
  return {
    inputTokens: total.inputTokens + tokens.inputTokens,
    outputTokens: total.outputTokens + tokens.outputTokens,
    totalTokens: total.totalTokens + tokens.inputTokens + tokens.outputTokens,
  }
}

function addResponseUsage(total: Usage, response: Anthropic.Message): Usage {
  return addUsage(total, { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens })
}

export async function askAgent(question: string, config: AskAgentConfig): Promise<AskAgentResult> {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  const client = new Anthropic({ apiKey: config.apiKey })
  const useSqlAgent = Boolean(config.runSqlPool)
  const systemPrompt = useSqlAgent ? SQL_AGENT_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT
  const runSqlHandler = config.runSqlPool ? createRunSqlHandler(config.runSqlPool) : undefined
  const listCategoriesHandler = config.runSqlPool ? createListCategoriesHandler(config.runSqlPool) : undefined

  // Előszűrés a fő loop előtt: dönti el, hogy a web_search tool egyáltalán
  // felajánlásra kerüljön-e (csak növény-témájú kérdésnél), és hogy a
  // felhasználó kért-e explicit fájl-exportot. Lásd docs/architektura.md.
  const classification: RequestClassification = runSqlHandler
    ? await classifyRequest(parsedQuestion, { apiKey: config.apiKey, model: config.model })
    : { isPlantRelated: false, wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } }

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: parsedQuestion }]
  const toolCalls: ToolCallLogEntry[] = []

  let answer = ''
  let usage: Usage = addUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }, classification.usage)
  let errorMessage: string | undefined

  try {
    for (let turn = 0; turn < MAX_TOOL_USE_TURNS; turn++) {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
        ...(runSqlHandler
          ? {
              tools: [
                runSqlToolDefinition,
                listCategoriesToolDefinition,
                ...(classification.isPlantRelated ? [webSearchToolDefinition] : []),
              ],
            }
          : {}),
      })

      usage = addResponseUsage(usage, response)
      messages.push({ role: 'assistant', content: response.content })

      // A web_search szerver-oldali tool a saját belső iterációs limitjét elérve
      // pause_turn-nel áll meg; ilyenkor csak újra kell küldeni az eddigi üzeneteket.
      if (response.stop_reason === 'pause_turn') {
        continue
      }

      if (response.stop_reason !== 'tool_use' || !runSqlHandler) {
        answer = extractText(response.content)
        break
      }

      const toolResultContent: Anthropic.ContentBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const toolCallStartedAt = Date.now()
        try {
          let resultContent: unknown
          let resultRowCount: number
          let resultSample: unknown

          if (block.name === RUN_SQL_TOOL_NAME) {
            const result = await runSqlHandler(block.input)
            resultContent = result.rows
            resultRowCount = result.rowCount
            resultSample = result.rows.slice(0, TOOL_RESULT_SAMPLE_SIZE)
          } else if (block.name === LIST_CATEGORIES_TOOL_NAME && listCategoriesHandler) {
            const result = await listCategoriesHandler()
            resultContent = result.categories
            resultRowCount = result.categories.length
            resultSample = result.categories
          } else {
            throw new Error(`Ismeretlen vagy nem elérhető tool: ${block.name}`)
          }

          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(resultContent),
          })
          toolCalls.push({
            tool: block.name,
            input: block.input,
            resultRowCount,
            resultSample,
            durationMs: Date.now() - toolCallStartedAt,
          })
        } catch (toolError) {
          const toolErrorMessage = toolError instanceof Error ? toolError.message : 'Ismeretlen hiba.'
          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolErrorMessage,
            is_error: true,
          })
          toolCalls.push({
            tool: block.name,
            input: block.input,
            durationMs: Date.now() - toolCallStartedAt,
            error: toolErrorMessage,
          })
        }
      }

      messages.push({ role: 'user', content: toolResultContent })
    }

    if (!answer) {
      answer = 'Nem sikerült választ generálni a megengedett lépésszámon belül.'
    }

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
