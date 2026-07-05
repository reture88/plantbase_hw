import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JsonlLogger } from '../logging/jsonl-logger'

const createMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: createMock } }
  }),
}))

const { askAgent } = await import('./ask-agent')

beforeEach(() => {
  createMock.mockReset()
})

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

    const requestArgs = createMock.mock.calls[0][0] as { tools?: { name: string }[] }
    expect(requestArgs.tools?.map((tool) => tool.name)).toEqual(['runSql', 'listCategories', 'web_search'])
  })

  it('should resend and continue when a server-side tool (web_search) pauses the turn', async () => {
    const fakePool = { query: vi.fn() } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    createMock
      .mockResolvedValueOnce({
        stop_reason: 'pause_turn',
        content: [
          { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'pozsgás gondozása télen' } },
        ],
        usage: { input_tokens: 30, output_tokens: 15 },
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Télen ritkábban öntözd, fényes helyre tedd.' }],
        usage: { input_tokens: 20, output_tokens: 12 },
      })

    const result = await askAgent('hogyan gondozzam a pozsgásaimat télen?', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(createMock).toHaveBeenCalledTimes(2)
    expect(result.answer).toBe('Télen ritkábban öntözd, fényes helyre tedd.')
    expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 27, totalTokens: 77 })
  })

  it('should run the listCategories tool and feed the result back for a final answer', async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ category: 'kaktusz' }, { category: 'pozsgás' }, { category: 'szobanövény' }],
      rowCount: 3,
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
            name: 'listCategories',
            input: {},
          },
        ],
        usage: { input_tokens: 18, output_tokens: 9 },
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'A következő kategóriák érhetők el: kaktusz, pozsgás, szobanövény.' }],
        usage: { input_tokens: 12, output_tokens: 6 },
      })

    const result = await askAgent('milyen kategóriák vannak?', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(queryMock).toHaveBeenCalledWith('SELECT DISTINCT category FROM products ORDER BY category')
    expect(result.answer).toBe('A következő kategóriák érhetők el: kaktusz, pozsgás, szobanövény.')
    const toolCalls = (logger.entries[0] as { toolCalls: { tool: string; resultRowCount?: number }[] }).toolCalls
    expect(toolCalls[0].tool).toBe('listCategories')
    expect(toolCalls[0].resultRowCount).toBe(3)
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
