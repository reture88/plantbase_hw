import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { createHydeGenerator } from './hyde'

function textResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: 40, noCache: 40, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 30, text: 30, reasoning: undefined },
    },
    warnings: [],
  }
}

describe('createHydeGenerator', () => {
  it('returns the hypothetical answer text produced by the model', async () => {
    const doGenerateMock = vi.fn().mockResolvedValueOnce(textResponse('A kaktuszok ritka öntözést igényelnek.'))
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const generateHyde = createHydeGenerator(model)

    const result = await generateHyde('Milyen gyakran öntözzem a kaktuszomat?')

    expect(result).toBe('A kaktuszok ritka öntözést igényelnek.')
    expect(doGenerateMock).toHaveBeenCalledTimes(1)
    const requestArgs = doGenerateMock.mock.calls[0][0] as { prompt?: unknown }
    expect(JSON.stringify(requestArgs.prompt)).toContain('Milyen gyakran öntözzem a kaktuszomat?')
  })
})
