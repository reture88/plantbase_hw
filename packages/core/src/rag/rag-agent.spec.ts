import { MockEmbeddingModelV4, MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RagJsonlLogger } from '../logging/rag-jsonl-logger'
import type { RetrievedChunk } from './types'

const doGenerateMock = vi.fn()
const mockLanguageModel = new MockLanguageModelV4({ doGenerate: doGenerateMock })
const doEmbedMock = vi.fn()
const mockEmbeddingModel = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 10, doEmbed: doEmbedMock })
const searchSimilarChunksMock = vi.fn()

vi.mock('@ai-sdk/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/anthropic')>()
  return { ...actual, createAnthropic: () => () => mockLanguageModel }
})

vi.mock('@ai-sdk/openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/openai')>()
  return { ...actual, createOpenAI: () => ({ textEmbeddingModel: () => mockEmbeddingModel }) }
})

vi.mock('./knowledge-repository', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}))

const { askRag } = await import('./rag-agent')

function textResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: { inputTokens: { total: 40, noCache: 40, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
    warnings: [],
  }
}

function objectResponse(json: unknown) {
  return textResponse(JSON.stringify(json))
}

function candidate(id: number, content: string, source = 'https://example.com/cikk'): RetrievedChunk {
  return { id, documentSlug: `doc-${id}`, title: `Cím ${id}`, source, heading: null, content, distance: 0.05 * id }
}

function fakeLogger(): RagJsonlLogger & { entries: unknown[] } {
  const entries: unknown[] = []
  return { filePath: 'fake.jsonl', entries, append: (e) => entries.push(e) }
}

const config = { anthropicApiKey: 'test-anthropic', anthropicModel: 'claude-test', openaiApiKey: 'test-openai', embeddingModel: 'text-embedding-3-small', pool: {} as never }

beforeEach(() => {
  doGenerateMock.mockReset()
  doEmbedMock.mockReset()
  searchSimilarChunksMock.mockReset()
  doEmbedMock.mockResolvedValue({ embeddings: [[0.1, 0.2]] })
})

describe('askRag', () => {
  it('answers using the reranked, retrieved context and lists deduplicated sources', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([candidate(1, 'aloe vera öntözés'), candidate(2, 'aloe vera fény', 'https://example.com/cikk2')])
    doGenerateMock
      .mockResolvedValueOnce(textResponse('Az aloe vera ritkán igényel öntözést.')) // HyDE
      .mockResolvedValueOnce(objectResponse({ rankedChunkIds: [1, 2] })) // rerank
      .mockResolvedValueOnce(textResponse('Az aloe vera-t ritkán kell öntözni.')) // grounded answer

    const logger = fakeLogger()
    const result = await askRag('Milyen gyakran öntözzem az aloe verát?', { ...config, logger })

    expect(result.grounded).toBe(true)
    expect(result.answer).toBe('Az aloe vera-t ritkán kell öntözni.')
    expect(result.sources).toEqual([
      { title: 'Cím 1', source: 'https://example.com/cikk' },
      { title: 'Cím 2', source: 'https://example.com/cikk2' },
    ])
    expect(logger.entries).toHaveLength(1)
  })

  it('refuses without calling the answer model when nothing is retrieved', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([])
    doGenerateMock.mockResolvedValueOnce(textResponse('hipotetikus válasz')) // HyDE only

    const result = await askRag('Van-e a boltban repülő növény?', config)

    expect(result.grounded).toBe(false)
    expect(result.sources).toEqual([])
    expect(doGenerateMock).toHaveBeenCalledTimes(1)
  })

  it('refuses when the grounded model explicitly signals it cannot answer from the context', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([candidate(1, 'irreleváns tartalom')])
    doGenerateMock
      .mockResolvedValueOnce(textResponse('hipotetikus válasz'))
      .mockResolvedValueOnce(objectResponse({ rankedChunkIds: [1] }))
      .mockResolvedValueOnce(textResponse('NINCS_ELEG_INFORMACIO'))

    const result = await askRag('Mennyi a föld átlagos súlya egy cserépben grammban?', config)

    expect(result.grounded).toBe(false)
    expect(result.sources).toEqual([])
    expect(result.answer).toContain('nem tartalmaz elég információt')
  })
})
