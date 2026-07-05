import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type ToolCallLogEntry = {
  tool: string
  input: unknown
  resultRowCount?: number
  resultSample?: unknown
  durationMs: number
  error?: string
}

export type InteractionLogEntry = {
  timestamp: string
  question: string
  systemPrompt: string
  messages: unknown
  toolCalls: ToolCallLogEntry[]
  finalAnswer: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  durationMs: number
  error?: string
}

export type JsonlLogger = {
  readonly filePath: string
  append(entry: InteractionLogEntry): void
}

export function createJsonlLogger(logsDir = 'logs'): JsonlLogger {
  mkdirSync(logsDir, { recursive: true })
  const filePath = join(logsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)

  return {
    filePath,
    append(entry) {
      appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
    },
  }
}
