import { MockEmbeddingModelV4, MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doGenerateMock = vi.fn()
const mockLanguageModel = new MockLanguageModelV4({ doGenerate: doGenerateMock })
const doEmbedMock = vi.fn()
const mockEmbeddingModel = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 10, doEmbed: doEmbedMock })
const getDocumentContentHashMock = vi.fn()
const upsertDocumentMock = vi.fn()

vi.mock('@ai-sdk/openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/openai')>()
  return {
    ...actual,
    createOpenAI: () => Object.assign(() => mockLanguageModel, { textEmbeddingModel: () => mockEmbeddingModel }),
  }
})

vi.mock('./knowledge-repository', () => ({
  getDocumentContentHash: getDocumentContentHashMock,
  upsertDocument: upsertDocumentMock,
}))

const { createKnowledgeIngestionPipeline } = await import('./ingest')

function objectResponse(json: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(json) }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: { inputTokens: { total: 30, noCache: 30, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } },
    warnings: [],
  }
}

const SAMPLE_MD = `---
title: Snake Plant
source: https://example.com/snake-plant
category: plants-101
---

### Milyen fényt igényel?

A kardliliom tűri a gyenge fényt is, de gyorsabban nő fényesebb helyen.
`

const config = { openaiApiKey: 'o', pool: {} as never }

beforeEach(() => {
  doGenerateMock.mockReset()
  doEmbedMock.mockReset()
  getDocumentContentHashMock.mockReset()
  upsertDocumentMock.mockReset()
  doEmbedMock.mockResolvedValue({ embeddings: [[0.1, 0.2]] })
})

describe('createKnowledgeIngestionPipeline', () => {
  it('skips ingestion when the content hash is unchanged, without calling the model or upserting', async () => {
    getDocumentContentHashMock.mockResolvedValueOnce('same-hash-as-content')
    const pipeline = createKnowledgeIngestionPipeline(config)

    // A teszt nem ismeri előre a tényleges sha256-ot, ezért a mock-hash-t
    // közvetlenül a bemenő tartalomból számoljuk ki, hogy garantáltan egyezzen.
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(SAMPLE_MD).digest('hex')
    getDocumentContentHashMock.mockReset()
    getDocumentContentHashMock.mockResolvedValueOnce(hash)

    const result = await pipeline.ingestFile('snake-plant.md', SAMPLE_MD)

    expect(result).toEqual({ slug: 'snake-plant', skipped: true, chunkCount: 0 })
    expect(doGenerateMock).not.toHaveBeenCalled()
    expect(upsertDocumentMock).not.toHaveBeenCalled()
  })

  it('chunks, embeds and upserts the document when the content hash changed', async () => {
    getDocumentContentHashMock.mockResolvedValueOnce('outdated-hash')
    doGenerateMock.mockResolvedValueOnce(objectResponse({ chunks: ['A kardliliom tűri a gyenge fényt is, de gyorsabban nő fényesebb helyen.'] }))

    const pipeline = createKnowledgeIngestionPipeline(config)
    const result = await pipeline.ingestFile('snake-plant.md', SAMPLE_MD)

    expect(result.skipped).toBe(false)
    expect(result.slug).toBe('snake-plant')
    expect(result.chunkCount).toBe(1)
    expect(upsertDocumentMock).toHaveBeenCalledTimes(1)

    const [, doc, embeddings] = upsertDocumentMock.mock.calls[0] as [unknown, { title: string; chunks: { heading: string | null; content: string }[] }, number[][]]
    expect(doc.title).toBe('Snake Plant')
    expect(doc.chunks[0].heading).toBe('Milyen fényt igényel?')
    expect(embeddings).toHaveLength(1)
  })
})
