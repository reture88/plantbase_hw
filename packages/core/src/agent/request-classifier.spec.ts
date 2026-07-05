import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: createMock } }
  }),
}))

const { classifyRequest } = await import('./request-classifier')

beforeEach(() => {
  createMock.mockReset()
})

describe('classifyRequest', () => {
  it('should detect a plant-related question with no export intent', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'NÖVÉNY: IGEN\nEXPORT: NEM' }],
      usage: { input_tokens: 12, output_tokens: 6 },
    })

    const result = await classifyRequest('van kaktuszunk 5000 ft alatt?', { apiKey: 'test-key', model: 'claude-test' })

    expect(result).toEqual({
      isPlantRelated: true,
      wantsFileExport: false,
      usage: { inputTokens: 12, outputTokens: 6 },
    })
  })

  it('should detect an explicit file export instruction', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'NÖVÉNY: IGEN\nEXPORT: IGEN' }],
      usage: { input_tokens: 14, output_tokens: 6 },
    })

    const result = await classifyRequest('Van e kaktusz 5000Ft-ért? ha igen a listát mentsd ki fileba', {
      apiKey: 'test-key',
      model: 'claude-test',
    })

    expect(result.isPlantRelated).toBe(true)
    expect(result.wantsFileExport).toBe(true)
  })

  it('should classify an off-topic question as not plant-related', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'NÖVÉNY: NEM\nEXPORT: NEM' }],
      usage: { input_tokens: 10, output_tokens: 6 },
    })

    const result = await classifyRequest('mi Franciaország fővárosa?', { apiKey: 'test-key', model: 'claude-test' })

    expect(result.isPlantRelated).toBe(false)
    expect(result.wantsFileExport).toBe(false)
  })

  it('should fail closed (no web_search, no export) when the classifier call throws', async () => {
    createMock.mockRejectedValueOnce(new Error('rate limited'))

    const result = await classifyRequest('van pozsgásunk?', { apiKey: 'test-key', model: 'claude-test' })

    expect(result).toEqual({ isPlantRelated: false, wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
  })
})
