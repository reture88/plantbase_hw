import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doStreamMock = vi.fn()
const mockModel = new MockLanguageModelV4({ doStream: doStreamMock })

vi.mock('@ai-sdk/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/anthropic')>()
  return { ...actual, createAnthropic: () => () => mockModel }
})

const { streamWebFallbackAnswer } = await import('./web-fallback-agent')

function usagePart(inputTokens: number, outputTokens: number) {
  return {
    inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
  }
}

beforeEach(() => {
  doStreamMock.mockReset()
})

describe('streamWebFallbackAnswer', () => {
  it('offers the web_search tool and streams the resulting answer', async () => {
    doStreamMock.mockResolvedValueOnce({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'tool-call' as const,
            toolCallId: 'srv_1',
            toolName: 'web_search',
            input: JSON.stringify({ query: 'pozsgás gondozása télen' }),
            providerExecuted: true,
          },
          {
            type: 'tool-result' as const,
            toolCallId: 'srv_1',
            toolName: 'web_search',
            result: [{ type: 'web_search_result', url: 'https://example.com', title: 'Pozsgások télen', pageAge: null }],
            providerExecuted: true,
          },
          { type: 'text-start' as const, id: '1' },
          { type: 'text-delta' as const, id: '1', delta: 'Télen ritkábban öntözd, fényes helyre tedd.' },
          { type: 'text-end' as const, id: '1' },
          { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: undefined }, usage: usagePart(30, 15) },
        ],
      }),
    })

    const stream = await streamWebFallbackAnswer('hogyan gondozzam a pozsgásaimat télen?', { apiKey: 'test-key', model: 'claude-test' })

    const chunks: string[] = []
    for await (const chunk of stream.textStream) chunks.push(chunk)
    const result = await stream.result

    expect(chunks.join('')).toBe('Télen ritkábban öntözd, fényes helyre tedd.')
    expect(result.answer).toBe('Télen ritkábban öntözd, fényes helyre tedd.')

    const requestArgs = doStreamMock.mock.calls[0][0] as { tools?: { name: string }[] }
    expect(requestArgs.tools?.map((t) => t.name)).toEqual(['web_search'])
  })
})
