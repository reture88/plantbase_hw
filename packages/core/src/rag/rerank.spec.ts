import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { createReranker } from './rerank'
import type { RetrievedChunk } from './types'

function objectResponse(json: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(json) }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: 60, noCache: 60, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 15, text: 15, reasoning: undefined },
    },
    warnings: [],
  }
}

function candidate(id: number, content: string): RetrievedChunk {
  return { id, documentSlug: `doc-${id}`, title: `Cím ${id}`, source: `https://example.com/${id}`, heading: null, content, distance: 0.1 * id }
}

describe('createReranker', () => {
  it('reorders candidates according to the model-produced ranking and caps at topK', async () => {
    const doGenerateMock = vi.fn().mockResolvedValueOnce(objectResponse({ rankedChunkIds: [3, 1] }))
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const rerank = createReranker(model, 2)

    const result = await rerank('kérdés', [candidate(1, 'egy'), candidate(2, 'kettő'), candidate(3, 'három')])

    expect(result.map((c) => c.id)).toEqual([3, 1])
  })

  it('returns an empty array immediately for no candidates, without calling the model', async () => {
    const doGenerateMock = vi.fn()
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const rerank = createReranker(model, 5)

    const result = await rerank('kérdés', [])

    expect(result).toEqual([])
    expect(doGenerateMock).not.toHaveBeenCalled()
  })

  it('falls back to the original (vector-similarity) order, capped at topK, when the model call fails', async () => {
    const doGenerateMock = vi.fn().mockRejectedValueOnce(new Error('modell hiba'))
    const model = new MockLanguageModelV4({ doGenerate: doGenerateMock })
    const rerank = createReranker(model, 1)

    const result = await rerank('kérdés', [candidate(1, 'egy'), candidate(2, 'kettő')])

    expect(result.map((c) => c.id)).toEqual([1])
  })
})
