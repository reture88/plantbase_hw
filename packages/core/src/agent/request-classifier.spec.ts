import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doGenerateMock = vi.fn()
const mockModel = new MockLanguageModelV4({ doGenerate: doGenerateMock })

vi.mock('@ai-sdk/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/anthropic')>()
  return {
    ...actual,
    createAnthropic: () => () => mockModel,
  }
})

const { classifyRequest } = await import('./request-classifier')

function mockTextResponse(text: string, inputTokens: number, outputTokens: number) {
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

beforeEach(() => {
  doGenerateMock.mockReset()
})

describe('classifyRequest', () => {
  it('should detect a plant-related question with no export intent', async () => {
    doGenerateMock.mockResolvedValueOnce(mockTextResponse('NÖVÉNY: IGEN\nEXPORT: NEM', 12, 6))

    const result = await classifyRequest('van kaktuszunk 5000 ft alatt?', { apiKey: 'test-key', model: 'claude-test' })

    expect(result).toEqual({
      isPlantRelated: true,
      wantsFileExport: false,
      usage: { inputTokens: 12, outputTokens: 6 },
    })
  })

  it('should detect an explicit file export instruction', async () => {
    doGenerateMock.mockResolvedValueOnce(mockTextResponse('NÖVÉNY: IGEN\nEXPORT: IGEN', 14, 6))

    const result = await classifyRequest('Van e kaktusz 5000Ft-ért? ha igen a listát mentsd ki fileba', {
      apiKey: 'test-key',
      model: 'claude-test',
    })

    expect(result.isPlantRelated).toBe(true)
    expect(result.wantsFileExport).toBe(true)
  })

  it('should classify an off-topic question as not plant-related', async () => {
    doGenerateMock.mockResolvedValueOnce(mockTextResponse('NÖVÉNY: NEM\nEXPORT: NEM', 10, 6))

    const result = await classifyRequest('mi Franciaország fővárosa?', { apiKey: 'test-key', model: 'claude-test' })

    expect(result.isPlantRelated).toBe(false)
    expect(result.wantsFileExport).toBe(false)
  })

  it('should fail closed (no web_search, no export) when the classifier call throws', async () => {
    doGenerateMock.mockRejectedValueOnce(new Error('rate limited'))

    const result = await classifyRequest('van pozsgásunk?', { apiKey: 'test-key', model: 'claude-test' })

    expect(result).toEqual({ isPlantRelated: false, wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
  })
})
