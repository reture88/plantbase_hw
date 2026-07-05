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
})
