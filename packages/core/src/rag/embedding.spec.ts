import { MockEmbeddingModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { createEmbedder } from './embedding'

describe('createEmbedder', () => {
  it('embeds all provided values and returns one vector per value', async () => {
    const doEmbedMock = vi.fn().mockResolvedValueOnce({
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    })
    const model = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 10, doEmbed: doEmbedMock })
    const embed = createEmbedder(model)

    const result = await embed(['fényigény kérdés', 'öntözés kérdés'])

    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ])
    expect(doEmbedMock).toHaveBeenCalledTimes(1)
  })

  it('returns an empty array without calling the model when there are no values', async () => {
    const doEmbedMock = vi.fn()
    const model = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 10, doEmbed: doEmbedMock })
    const embed = createEmbedder(model)

    const result = await embed([])

    expect(result).toEqual([])
    expect(doEmbedMock).not.toHaveBeenCalled()
  })

  it('batches large inputs into multiple calls', async () => {
    const doEmbedMock = vi
      .fn()
      .mockResolvedValueOnce({ embeddings: Array.from({ length: 100 }, () => [1]) })
      .mockResolvedValueOnce({ embeddings: [[2]] })
    const model = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 1000, doEmbed: doEmbedMock })
    const embed = createEmbedder(model)

    const values = Array.from({ length: 101 }, (_, i) => `érték ${i}`)
    const result = await embed(values)

    expect(result).toHaveLength(101)
    expect(doEmbedMock).toHaveBeenCalledTimes(2)
  })
})
