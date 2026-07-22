import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { createSemanticChunkSplitter } from './semantic-chunk-splitter'

function objectResponse(json: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(json) }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: 50, noCache: 50, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 20, text: 20, reasoning: undefined },
    },
    warnings: [],
  }
}

describe('createSemanticChunkSplitter', () => {
  it('returns the chunks produced by the model', async () => {
    const doGenerateMock = vi
      .fn()
      .mockResolvedValueOnce(objectResponse({ chunks: ['A snake plant needs bright, indirect light.', 'Water it only every two to three weeks.'] }))
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const split = createSemanticChunkSplitter(model)

    const chunks = await split('A snake plant needs bright, indirect light. Water it only every two to three weeks.')

    expect(chunks).toEqual(['A snake plant needs bright, indirect light.', 'Water it only every two to three weeks.'])
    expect(doGenerateMock).toHaveBeenCalledTimes(1)
  })

  it('returns a single chunk unchanged when the model finds no meaning-shift', async () => {
    const doGenerateMock = vi.fn().mockResolvedValueOnce(objectResponse({ chunks: ['Egyetlen, összefüggő gondolat.'] }))
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const split = createSemanticChunkSplitter(model)

    const chunks = await split('Egyetlen, összefüggő gondolat.')

    expect(chunks).toEqual(['Egyetlen, összefüggő gondolat.'])
  })

  it('falls back to the original paragraph as a single chunk when the model call fails', async () => {
    const doGenerateMock = vi.fn().mockRejectedValueOnce(new Error('modell hiba'))
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const split = createSemanticChunkSplitter(model)

    const chunks = await split('Egy bekezdés, amit nem sikerült elemezni.')

    expect(chunks).toEqual(['Egy bekezdés, amit nem sikerült elemezni.'])
  })
})
