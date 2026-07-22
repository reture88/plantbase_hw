import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type RagQueryLogEntry = {
  timestamp: string
  question: string
  hypotheticalAnswer: string
  retrievedChunkIds: number[]
  rerankedChunkIds: number[]
  grounded: boolean
  answer: string
  durationMs: number
  error?: string
}

export type RagJsonlLogger = {
  readonly filePath: string
  append(entry: RagQueryLogEntry): void
}

/**
 * Külön logger-típus a `createJsonlLogger`-től (jsonl-logger.ts), mert más a
 * felelőssége: a RAG-pipeline lépéseit (HyDE, retrieval, rerank, grounded
 * döntés) naplózza, nem a katalógus-agent tool-hívásait — konvenciok.md:
 * "egy fájl, egy felelősség".
 */
export function createRagJsonlLogger(logsDir = 'logs/rag'): RagJsonlLogger {
  mkdirSync(logsDir, { recursive: true })
  const filePath = join(logsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)

  return {
    filePath,
    append(entry) {
      appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
    },
  }
}
