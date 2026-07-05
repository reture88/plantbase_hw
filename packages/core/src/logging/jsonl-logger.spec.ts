import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createJsonlLogger } from './jsonl-logger'

describe('createJsonlLogger', () => {
  const testDirs: string[] = []

  afterEach(() => {
    for (const dir of testDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('should create the logs directory and append entries as JSON lines', () => {
    const logsDir = join(tmpdir(), `plantbase-logs-test-${Date.now()}`)
    testDirs.push(logsDir)

    const logger = createJsonlLogger(logsDir)
    expect(existsSync(logger.filePath)).toBe(false)

    logger.append({
      timestamp: new Date().toISOString(),
      question: 'szia',
      systemPrompt: 'rendszerprompt',
      messages: [{ role: 'user', content: 'szia' }],
      toolCalls: [],
      finalAnswer: 'szia!',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      durationMs: 12,
    })
    logger.append({
      timestamp: new Date().toISOString(),
      question: 'mizu',
      systemPrompt: 'rendszerprompt',
      messages: [{ role: 'user', content: 'mizu' }],
      toolCalls: [],
      finalAnswer: 'minden ok',
      usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 },
      durationMs: 8,
    })

    const lines = readFileSync(logger.filePath, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).question).toBe('szia')
    expect(JSON.parse(lines[1]).question).toBe('mizu')
  })
})
