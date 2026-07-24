import { beforeEach, describe, expect, it, vi } from 'vitest'

const classifyRequestMock = vi.fn()
const streamAskAgentMock = vi.fn()
const streamAskRagMock = vi.fn()
const streamWebFallbackAnswerMock = vi.fn()

vi.mock('./request-classifier', () => ({ classifyRequest: classifyRequestMock }))
vi.mock('./ask-agent', () => ({ streamAskAgent: streamAskAgentMock }))
vi.mock('../rag/rag-agent', () => ({ streamAskRag: streamAskRagMock }))
vi.mock('./web-fallback-agent', () => ({ streamWebFallbackAnswer: streamWebFallbackAnswerMock }))

const { streamUnifiedChat } = await import('./unified-agent')

async function* asyncIterable<T>(...values: T[]): AsyncGenerator<T> {
  for (const value of values) yield value
}

async function collectEvents(stream: Awaited<ReturnType<typeof streamUnifiedChat>>) {
  const events: unknown[] = []
  for await (const event of stream.events) events.push(event)
  const result = await stream.result
  return { events, result }
}

const config = {
  anthropicApiKey: 'a',
  anthropicModel: 'claude-test',
  openaiApiKey: 'o',
  embeddingModel: 'text-embedding-3-small',
  helperModel: 'gpt-5.4-mini',
  pool: {} as never,
}

beforeEach(() => {
  classifyRequestMock.mockReset()
  streamAskAgentMock.mockReset()
  streamAskRagMock.mockReset()
  streamWebFallbackAnswerMock.mockReset()
})

describe('streamUnifiedChat', () => {
  it('routes a catalog-intent question to streamAskAgent only, never touching RAG or web_search', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'catalog', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskAgentMock.mockResolvedValueOnce({
      textStream: asyncIterable('Van ', 'kaktuszunk.'),
      result: Promise.resolve({ answer: 'Van kaktuszunk.', wantsFileExport: false }),
    })

    const stream = await streamUnifiedChat('Van kaktuszotok?', config)
    const { events, result } = await collectEvents(stream)

    expect(events).toEqual([
      { type: 'text-delta', text: 'Van ' },
      { type: 'text-delta', text: 'kaktuszunk.' },
    ])
    expect(result).toEqual({ answer: 'Van kaktuszunk.', source: 'catalog', wantsFileExport: false })
    expect(streamAskRagMock).not.toHaveBeenCalled()
    expect(streamWebFallbackAnswerMock).not.toHaveBeenCalled()
  })

  it('passes a pre-computed classification into streamAskAgent so it does not re-classify', async () => {
    const classification = { intent: 'catalog' as const, wantsFileExport: true, usage: { inputTokens: 0, outputTokens: 0 } }
    classifyRequestMock.mockResolvedValueOnce(classification)
    streamAskAgentMock.mockResolvedValueOnce({
      textStream: asyncIterable('ok'),
      result: Promise.resolve({ answer: 'ok', wantsFileExport: true }),
    })

    await collectEvents(await streamUnifiedChat('Mentsd ki fájlba a kaktuszokat', config))

    const passedConfig = streamAskAgentMock.mock.calls[0][1]
    expect(passedConfig.classification).toBe(classification)
  })

  it('routes a knowledge_base-intent question to the RAG stream, with no notice, when it is grounded', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'knowledge_base', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskRagMock.mockResolvedValueOnce({
      textStream: asyncIterable('Az aloe vera-t ', 'ritkán kell öntözni.'),
      result: Promise.resolve({ answer: 'Az aloe vera-t ritkán kell öntözni.', grounded: true, sources: [{ title: 'Aloe', source: 'https://example.com' }] }),
    })

    const stream = await streamUnifiedChat('Milyen gyakran öntözzem az aloe verát?', config)
    const { events, result } = await collectEvents(stream)

    expect(events).toEqual([
      { type: 'text-delta', text: 'Az aloe vera-t ' },
      { type: 'text-delta', text: 'ritkán kell öntözni.' },
    ])
    expect(result).toEqual({
      answer: 'Az aloe vera-t ritkán kell öntözni.',
      source: 'knowledge_base',
      wantsFileExport: false,
      sources: [{ title: 'Aloe', source: 'https://example.com' }],
    })
    expect(streamWebFallbackAnswerMock).not.toHaveBeenCalled()
  })

  it('emits a notice and falls back to web_search when the RAG stream yields no text (refusal)', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'knowledge_base', wantsFileExport: true, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskRagMock.mockResolvedValueOnce({
      textStream: asyncIterable(),
      result: Promise.resolve({ answer: 'A tudásbázis nem tartalmaz elég információt.', grounded: false, sources: [] }),
    })
    streamWebFallbackAnswerMock.mockResolvedValueOnce({
      textStream: asyncIterable('A Mars átmérője ', 'kb. 6779 km.'),
      result: Promise.resolve({ answer: 'A Mars átmérője kb. 6779 km.' }),
    })

    const stream = await streamUnifiedChat('Mekkora a Mars átmérője?', config)
    const { events, result } = await collectEvents(stream)

    expect(events[0]).toEqual({ type: 'notice', text: expect.stringContaining('nem találtam választ') })
    expect(events.slice(1)).toEqual([
      { type: 'text-delta', text: 'A Mars átmérője ' },
      { type: 'text-delta', text: 'kb. 6779 km.' },
    ])
    expect(result).toEqual({ answer: 'A Mars átmérője kb. 6779 km.', source: 'web_search', wantsFileExport: true })
  })
})
