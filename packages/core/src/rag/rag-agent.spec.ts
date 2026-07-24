import { MockEmbeddingModelV4, MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RagJsonlLogger } from '../logging/rag-jsonl-logger'
import type { RetrievedChunk } from './types'

// Anthropic: HyDE (generateText) + a grounded válaszadás (streamText).
const doGenerateMock = vi.fn()
const doStreamMock = vi.fn()
const mockAnthropicModel = new MockLanguageModelV4({ doGenerate: doGenerateMock, doStream: doStreamMock })

// OpenAI: a helper-modell (rerank, generateObject → doGenerate) + az embedding-modell — külön mock,
// hogy a tesztek ténylegesen ellenőrizhessék, melyik hívás melyik providerre megy.
const helperDoGenerateMock = vi.fn()
const mockHelperModel = new MockLanguageModelV4({ doGenerate: helperDoGenerateMock })
const doEmbedMock = vi.fn()
const mockEmbeddingModel = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 10, doEmbed: doEmbedMock })

const searchSimilarChunksMock = vi.fn()

vi.mock('@ai-sdk/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/anthropic')>()
  return { ...actual, createAnthropic: () => () => mockAnthropicModel }
})

vi.mock('@ai-sdk/openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/openai')>()
  return {
    ...actual,
    createOpenAI: () => Object.assign(() => mockHelperModel, { textEmbeddingModel: () => mockEmbeddingModel }),
  }
})

vi.mock('./knowledge-repository', () => ({
  searchSimilarChunks: searchSimilarChunksMock,
}))

const { askRag, streamAskRag } = await import('./rag-agent')

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

// Grounded válaszadás: streamText → doStream.
function textStreamResponse(text: string) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: '1' },
        { type: 'text-delta' as const, id: '1', delta: text },
        { type: 'text-end' as const, id: '1' },
        {
          type: 'finish' as const,
          finishReason: { unified: 'stop' as const, raw: undefined },
          usage: { inputTokens: { total: 40, noCache: 40, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
        },
      ],
    }),
  }
}

function candidate(id: number, content: string, source = 'https://example.com/cikk'): RetrievedChunk {
  return { id, documentSlug: `doc-${id}`, title: `Cím ${id}`, source, heading: null, content, distance: 0.05 * id }
}

function fakeLogger(): RagJsonlLogger & { entries: unknown[] } {
  const entries: unknown[] = []
  return { filePath: 'fake.jsonl', entries, append: (e) => entries.push(e) }
}

const config = {
  anthropicApiKey: 'test-anthropic',
  anthropicModel: 'claude-test',
  openaiApiKey: 'test-openai',
  embeddingModel: 'text-embedding-3-small',
  helperModel: 'gpt-5.4-mini',
  pool: {} as never,
}

beforeEach(() => {
  doGenerateMock.mockReset()
  doStreamMock.mockReset()
  helperDoGenerateMock.mockReset()
  doEmbedMock.mockReset()
  searchSimilarChunksMock.mockReset()
  doEmbedMock.mockResolvedValue({ embeddings: [[0.1, 0.2]] })
})

describe('askRag', () => {
  it('answers using the reranked, retrieved context and lists deduplicated sources', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([candidate(1, 'aloe vera öntözés'), candidate(2, 'aloe vera fény', 'https://example.com/cikk2')])
    doGenerateMock.mockResolvedValueOnce(textResponse('Az aloe vera ritkán igényel öntözést.')) // HyDE (Anthropic)
    helperDoGenerateMock.mockResolvedValueOnce(objectResponse({ rankedChunkIds: [1, 2] })) // rerank (OpenAI helper)
    doStreamMock.mockResolvedValueOnce(textStreamResponse('Az aloe vera-t ritkán kell öntözni.')) // grounded answer (Anthropic)

    const logger = fakeLogger()
    const result = await askRag('Milyen gyakran öntözzem az aloe verát?', { ...config, logger })

    expect(result.grounded).toBe(true)
    expect(result.answer).toBe('Az aloe vera-t ritkán kell öntözni.')
    expect(result.sources).toEqual([
      { title: 'Cím 1', source: 'https://example.com/cikk' },
      { title: 'Cím 2', source: 'https://example.com/cikk2' },
    ])
    expect(logger.entries).toHaveLength(1)
    expect(doGenerateMock).toHaveBeenCalledTimes(1)
    expect(helperDoGenerateMock).toHaveBeenCalledTimes(1)
  })

  it('refuses without calling the rerank or answer model when nothing is retrieved', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([])
    doGenerateMock.mockResolvedValueOnce(textResponse('hipotetikus válasz')) // HyDE only

    const result = await askRag('Van-e a boltban repülő növény?', config)

    expect(result.grounded).toBe(false)
    expect(result.sources).toEqual([])
    expect(doGenerateMock).toHaveBeenCalledTimes(1)
    expect(helperDoGenerateMock).not.toHaveBeenCalled()
    expect(doStreamMock).not.toHaveBeenCalled()
  })

  it('refuses when the grounded model explicitly signals it cannot answer from the context', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([candidate(1, 'irreleváns tartalom')])
    doGenerateMock.mockResolvedValueOnce(textResponse('hipotetikus válasz'))
    helperDoGenerateMock.mockResolvedValueOnce(objectResponse({ rankedChunkIds: [1] }))
    doStreamMock.mockResolvedValueOnce(textStreamResponse('NINCS_ELEG_INFORMACIO'))

    const result = await askRag('Mennyi a föld átlagos súlya egy cserépben grammban?', config)

    expect(result.grounded).toBe(false)
    expect(result.sources).toEqual([])
    expect(result.answer).toContain('nem tartalmaz elég információt')
  })
})

describe('streamAskRag', () => {
  it('streams the grounded answer text live once it is safely past the refusal marker', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([candidate(1, 'aloe vera öntözés')])
    doGenerateMock.mockResolvedValueOnce(textResponse('hipotetikus válasz'))
    helperDoGenerateMock.mockResolvedValueOnce(objectResponse({ rankedChunkIds: [1] }))
    doStreamMock.mockResolvedValueOnce(textStreamResponse('Az aloe vera-t ritkán kell öntözni.'))
    const logger = fakeLogger()

    const stream = await streamAskRag('Milyen gyakran öntözzem az aloe verát?', { ...config, logger })
    const chunks: string[] = []
    for await (const chunk of stream.textStream) chunks.push(chunk)
    const result = await stream.result

    expect(chunks.join('')).toBe('Az aloe vera-t ritkán kell öntözni.')
    expect(result.grounded).toBe(true)
    expect(result.answer).toBe('Az aloe vera-t ritkán kell öntözni.')
    expect(logger.entries).toHaveLength(1)
  })

  it('yields no text at all when the model signals a refusal, so the raw marker never reaches the client', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([candidate(1, 'irreleváns tartalom')])
    doGenerateMock.mockResolvedValueOnce(textResponse('hipotetikus válasz'))
    helperDoGenerateMock.mockResolvedValueOnce(objectResponse({ rankedChunkIds: [1] }))
    doStreamMock.mockResolvedValueOnce(textStreamResponse('NINCS_ELEG_INFORMACIO'))

    const stream = await streamAskRag('Mennyi a föld átlagos súlya egy cserépben grammban?', config)
    const chunks: string[] = []
    for await (const chunk of stream.textStream) chunks.push(chunk)
    const result = await stream.result

    expect(chunks).toEqual([])
    expect(result.grounded).toBe(false)
    expect(result.answer).toContain('nem tartalmaz elég információt')
  })

  it('yields an immediately-empty stream when nothing is retrieved, without calling the answer model', async () => {
    searchSimilarChunksMock.mockResolvedValueOnce([])
    doGenerateMock.mockResolvedValueOnce(textResponse('hipotetikus válasz'))

    const stream = await streamAskRag('Van-e a boltban repülő növény?', config)
    const chunks: string[] = []
    for await (const chunk of stream.textStream) chunks.push(chunk)
    const result = await stream.result

    expect(chunks).toEqual([])
    expect(result.grounded).toBe(false)
    expect(doStreamMock).not.toHaveBeenCalled()
  })
})
