import { describe, expect, it, vi } from 'vitest'
import type { JsonlLogger } from '../logging/jsonl-logger'

const createMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: createMock } }
  }),
}))

const { askAgent } = await import('./ask-agent')

function createFakeLogger(): JsonlLogger & { entries: unknown[] } {
  const entries: unknown[] = []
  return {
    filePath: 'fake.jsonl',
    entries,
    append(entry) {
      entries.push(entry)
    },
  }
}

describe('askAgent', () => {
  it('should return the answer text and token usage from the Anthropic response', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Szia! Miben segíthetek?' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const logger = createFakeLogger()

    const result = await askAgent('szia', { apiKey: 'test-key', model: 'claude-test', logger })

    expect(result.answer).toBe('Szia! Miben segíthetek?')
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 })
    expect(logger.entries).toHaveLength(1)
  })

  it('should reject an empty question before calling the Anthropic client', async () => {
    await expect(askAgent('', { apiKey: 'test-key', model: 'claude-test' })).rejects.toThrow()
  })

  it('should log the error and rethrow when the Anthropic call fails', async () => {
    createMock.mockRejectedValueOnce(new Error('API kulcs érvénytelen'))
    const logger = createFakeLogger()

    await expect(askAgent('szia', { apiKey: 'bad-key', model: 'claude-test', logger })).rejects.toThrow(
      'API kulcs érvénytelen',
    )
    expect(logger.entries).toHaveLength(1)
  })

  it('should run the runSql tool and feed the result back for a final answer', async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ name: 'Aloe vera', stock: 35 }],
      rowCount: 1,
    })
    const fakePool = { query: queryMock } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    createMock
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'runSql',
            input: { query: "SELECT name, stock FROM products WHERE name ILIKE '%aloe%'" },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Van Aloe vera, 35 darab raktáron.' }],
        usage: { input_tokens: 15, output_tokens: 8 },
      })

    const result = await askAgent('van aloe vera raktáron?', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(queryMock).toHaveBeenCalledWith("SELECT name, stock FROM products WHERE name ILIKE '%aloe%' LIMIT 50")
    expect(result.answer).toBe('Van Aloe vera, 35 darab raktáron.')
    expect(result.usage).toEqual({ inputTokens: 35, outputTokens: 18, totalTokens: 53 })
    expect(logger.entries).toHaveLength(1)
    expect((logger.entries[0] as { toolCalls: unknown[] }).toolCalls).toHaveLength(1)
  })

  it('should reject a write attempt from the model and report it as a tool error, not a crash', async () => {
    const queryMock = vi.fn()
    const fakePool = { query: queryMock } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    createMock
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'runSql',
            input: { query: 'DELETE FROM products' },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Nem tudom törölni az adatot, csak olvasni férek hozzá.' }],
        usage: { input_tokens: 15, output_tokens: 8 },
      })

    const result = await askAgent('töröld a raktárkészletet', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(queryMock).not.toHaveBeenCalled()
    expect(result.answer).toBe('Nem tudom törölni az adatot, csak olvasni férek hozzá.')
    const toolCalls = (logger.entries[0] as { toolCalls: { error?: string }[] }).toolCalls
    expect(toolCalls[0].error).toBeDefined()
  })
})
