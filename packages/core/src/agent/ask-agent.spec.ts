import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JsonlLogger } from '../logging/jsonl-logger'

const doGenerateMock = vi.fn()
const mockModel = new MockLanguageModelV4({ doGenerate: doGenerateMock })
const classifyRequestMock = vi.fn()

vi.mock('@ai-sdk/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/anthropic')>()
  return {
    ...actual,
    createAnthropic: () => () => mockModel,
  }
})

vi.mock('./request-classifier', () => ({
  classifyRequest: classifyRequestMock,
}))

const { askAgent } = await import('./ask-agent')

beforeEach(() => {
  doGenerateMock.mockReset()
  classifyRequestMock.mockReset()
  classifyRequestMock.mockResolvedValue({
    isPlantRelated: true,
    wantsFileExport: false,
    usage: { inputTokens: 0, outputTokens: 0 },
  })
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

function textResponse(text: string, inputTokens: number, outputTokens: number) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
    },
    warnings: [],
  }
}

function toolCallResponse(
  toolCallId: string,
  toolName: string,
  input: unknown,
  inputTokens: number,
  outputTokens: number,
) {
  return {
    content: [{ type: 'tool-call' as const, toolCallId, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: 'tool-calls' as const, raw: undefined },
    usage: {
      inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
    },
    warnings: [],
  }
}

describe('askAgent', () => {
  it('should return the answer text and token usage from the model response', async () => {
    doGenerateMock.mockResolvedValueOnce(textResponse('Szia! Miben segíthetek?', 10, 5))
    const logger = createFakeLogger()

    const result = await askAgent('szia', { apiKey: 'test-key', model: 'claude-test', logger })

    expect(result.answer).toBe('Szia! Miben segíthetek?')
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 })
    expect(logger.entries).toHaveLength(1)
    expect(classifyRequestMock).not.toHaveBeenCalled()
  })

  it('should reject an empty question before calling the model', async () => {
    await expect(askAgent('', { apiKey: 'test-key', model: 'claude-test' })).rejects.toThrow()
  })

  it('should log the error and rethrow when the model call fails', async () => {
    doGenerateMock.mockRejectedValueOnce(new Error('API kulcs érvénytelen'))
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

    doGenerateMock
      .mockResolvedValueOnce(
        toolCallResponse('call_1', 'runSql', { query: "SELECT name, stock FROM products WHERE name ILIKE '%aloe%'" }, 20, 10),
      )
      .mockResolvedValueOnce(textResponse('Van Aloe vera, 35 darab raktáron.', 15, 8))

    const result = await askAgent('van aloe vera raktáron?', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(queryMock).toHaveBeenCalledWith("SELECT name, stock FROM products WHERE name ILIKE '%aloe%' LIMIT 50")
    expect(result.answer).toBe('Van Aloe vera, 35 darab raktáron.')
    expect(result.usage).toEqual({ inputTokens: 35, outputTokens: 18, totalTokens: 53 })
    expect(result.wantsFileExport).toBe(false)
    expect(logger.entries).toHaveLength(1)
    expect((logger.entries[0] as { toolCalls: unknown[] }).toolCalls).toHaveLength(1)

    const requestArgs = doGenerateMock.mock.calls[0][0] as { tools?: { name: string }[] }
    expect(requestArgs.tools?.map((tool) => tool.name)).toEqual(['runSql', 'listCategories', 'web_search'])
  })

  it('should not offer web_search when the classifier says the question is not plant-related', async () => {
    classifyRequestMock.mockResolvedValueOnce({
      isPlantRelated: false,
      wantsFileExport: false,
      usage: { inputTokens: 5, outputTokens: 3 },
    })
    const fakePool = { query: vi.fn() } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    doGenerateMock.mockResolvedValueOnce(textResponse('Ez nem kapcsolódik a növény-katalógushoz.', 10, 6))

    const result = await askAgent('mi Franciaország fővárosa?', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    const requestArgs = doGenerateMock.mock.calls[0][0] as { tools?: { name: string }[] }
    expect(requestArgs.tools?.map((tool) => tool.name)).toEqual(['runSql', 'listCategories'])
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 9, totalTokens: 24 })
  })

  it('should surface wantsFileExport from the classifier so the CLI can decide to save a document', async () => {
    classifyRequestMock.mockResolvedValueOnce({
      isPlantRelated: true,
      wantsFileExport: true,
      usage: { inputTokens: 0, outputTokens: 0 },
    })
    const fakePool = { query: vi.fn() } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    doGenerateMock.mockResolvedValueOnce(textResponse('Van kaktuszunk 3500 Ft-ért.', 10, 6))

    const result = await askAgent('Van e kaktusz 5000Ft-ért? ha igen a listát mentsd ki fileba', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(result.wantsFileExport).toBe(true)
  })

  it('should use the web_search tool result (already resolved server-side) to produce the final answer', async () => {
    // A web_search egy provider-executed tool: Anthropic szerver-oldalán fut le, a
    // tool-call ÉS a tool-result is ugyanabban a modell-válaszban érkezik vissza,
    // a végleges szöveges válasszal együtt — nincs kliens-oldali execute-lépés.
    const fakePool = { query: vi.fn() } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    doGenerateMock.mockResolvedValueOnce({
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'srv_1',
          toolName: 'web_search',
          input: JSON.stringify({ query: 'pozsgás gondozása télen' }),
          providerExecuted: true,
        },
        {
          type: 'tool-result' as const,
          toolCallId: 'srv_1',
          toolName: 'web_search',
          result: [{ type: 'web_search_result', url: 'https://example.com', title: 'Pozsgások télen', pageAge: null }],
          providerExecuted: true,
        },
        { type: 'text' as const, text: 'Télen ritkábban öntözd, fényes helyre tedd.' },
      ],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: 30, noCache: 30, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 15, text: 15, reasoning: undefined },
      },
      warnings: [],
    })

    const result = await askAgent('hogyan gondozzam a pozsgásaimat télen?', {
      apiKey: 'test-key',
      model: 'claude-test',
      logger,
      runSqlPool: fakePool,
    })

    expect(doGenerateMock).toHaveBeenCalledTimes(1)
    expect(result.answer).toBe('Télen ritkábban öntözd, fényes helyre tedd.')
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 15, totalTokens: 45 })
  })

  it('should run the listCategories tool and feed the result back for a final answer', async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ category: 'kaktusz' }, { category: 'pozsgás' }, { category: 'szobanövény' }],
      rowCount: 3,
    })
    const fakePool = { query: queryMock } as unknown as import('pg').Pool
    const logger = createFakeLogger()

    doGenerateMock
      .mockResolvedValueOnce(toolCallResponse('call_1', 'listCategories', {}, 18, 9))
      .mockResolvedValueOnce(textResponse('A következő kategóriák érhetők el: kaktusz, pozsgás, szobanövény.', 12, 6))

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

    doGenerateMock
      .mockResolvedValueOnce(toolCallResponse('call_1', 'runSql', { query: 'DELETE FROM products' }, 20, 10))
      .mockResolvedValueOnce(textResponse('Nem tudom törölni az adatot, csak olvasni férek hozzá.', 15, 8))

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
