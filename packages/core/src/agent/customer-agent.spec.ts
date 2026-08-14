import { beforeEach, describe, expect, it, vi } from 'vitest'

const classifyRequestMock = vi.fn()
const streamAskAgentMock = vi.fn()
const streamAskRagMock = vi.fn()
const createEscalationMock = vi.fn()

vi.mock('./request-classifier', () => ({ classifyRequest: classifyRequestMock }))
vi.mock('./ask-agent', () => ({ streamAskAgent: streamAskAgentMock }))
vi.mock('../rag/rag-agent', () => ({ streamAskRag: streamAskRagMock }))
vi.mock('../support/escalation-repository', () => ({ createEscalation: createEscalationMock }))

const { streamCustomerChat } = await import('./customer-agent')

async function* asyncIterable<T>(...values: T[]): AsyncGenerator<T> {
  for (const value of values) yield value
}

async function collectEvents(stream: Awaited<ReturnType<typeof streamCustomerChat>>) {
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
  escalationPool: {} as never,
}

beforeEach(() => {
  classifyRequestMock.mockReset()
  streamAskAgentMock.mockReset()
  streamAskRagMock.mockReset()
  createEscalationMock.mockReset()
})

describe('streamCustomerChat', () => {
  it('routes a catalog-intent question to streamAskAgent only, never touching RAG or escalation', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'catalog', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskAgentMock.mockResolvedValueOnce({
      textStream: asyncIterable('Van ', 'kaktuszunk.'),
      result: Promise.resolve({ answer: 'Van kaktuszunk.', wantsFileExport: false }),
    })

    const stream = await streamCustomerChat('Van kaktuszotok?', config)
    const { events, result } = await collectEvents(stream)

    expect(events).toEqual([
      { type: 'text-delta', text: 'Van ' },
      { type: 'text-delta', text: 'kaktuszunk.' },
    ])
    expect(result).toEqual({ answer: 'Van kaktuszunk.', source: 'catalog', wantsFileExport: false })
    expect(streamAskRagMock).not.toHaveBeenCalled()
    expect(createEscalationMock).not.toHaveBeenCalled()
  })

  it('routes a knowledge_base-intent question to the RAG stream, with no escalation, when it is grounded', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'knowledge_base', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskRagMock.mockResolvedValueOnce({
      textStream: asyncIterable('Az aloe vera-t ', 'ritkán kell öntözni.'),
      result: Promise.resolve({ answer: 'Az aloe vera-t ritkán kell öntözni.', grounded: true, sources: [{ title: 'Aloe', source: 'https://example.com' }] }),
    })

    const stream = await streamCustomerChat('Milyen gyakran öntözzem az aloe verát?', config)
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
    expect(createEscalationMock).not.toHaveBeenCalled()
  })

  it('creates an escalation and emits notice+escalated events when the RAG stream yields no text (refusal) — never calls web_search', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'knowledge_base', wantsFileExport: true, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskRagMock.mockResolvedValueOnce({
      textStream: asyncIterable(),
      result: Promise.resolve({ answer: 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.', grounded: false, sources: [] }),
    })
    createEscalationMock.mockResolvedValueOnce({
      id: 42,
      question: 'Mérgező-e a filodendron a macskámnak?',
      contextSnapshot: 'A tudásbázis nem tartalmazott elég releváns forrást a kérdés megválaszolásához (grounded: false).',
      reason: 'nem grounded',
      status: 'open',
      reply: null,
      createdAt: new Date(),
      resolvedAt: null,
    })

    const stream = await streamCustomerChat('Mérgező-e a filodendron a macskámnak?', config)
    const { events, result } = await collectEvents(stream)

    expect(createEscalationMock).toHaveBeenCalledWith(config.escalationPool, {
      question: 'Mérgező-e a filodendron a macskámnak?',
      contextSnapshot: 'A tudásbázis nem tartalmazott elég releváns forrást a kérdés megválaszolásához (grounded: false).',
      reason: 'nem grounded',
    })
    expect(events).toEqual([
      { type: 'notice', text: expect.stringContaining('kollégánk') },
      { type: 'escalated', escalationId: 42 },
    ])
    expect(result.source).toBe('escalated')
    expect(result.escalationId).toBe(42)
    expect(result.wantsFileExport).toBe(false)
  })

  it('also escalates when the RAG stream yielded text but the final result was not grounded', async () => {
    classifyRequestMock.mockResolvedValueOnce({ intent: 'knowledge_base', wantsFileExport: false, usage: { inputTokens: 0, outputTokens: 0 } })
    streamAskRagMock.mockResolvedValueOnce({
      textStream: asyncIterable('valami szöveg'),
      result: Promise.resolve({ answer: 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.', grounded: false, sources: [] }),
    })
    createEscalationMock.mockResolvedValueOnce({
      id: 7,
      question: 'q',
      contextSnapshot: 'x',
      reason: 'nem grounded',
      status: 'open',
      reply: null,
      createdAt: new Date(),
      resolvedAt: null,
    })

    const { result } = await collectEvents(await streamCustomerChat('q', config))

    expect(result.source).toBe('escalated')
    expect(createEscalationMock).toHaveBeenCalledTimes(1)
  })
})
