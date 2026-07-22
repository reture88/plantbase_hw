import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doGenerateMock = vi.fn()
const mockModel = new MockLanguageModelV4({ doGenerate: doGenerateMock })
const fetchMock = vi.fn()

vi.mock('@ai-sdk/anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-sdk/anthropic')>()
  return {
    ...actual,
    createAnthropic: () => () => mockModel,
  }
})

vi.stubGlobal('fetch', fetchMock)

const { generateQuoteDocument, downloadQuoteDocument } = await import('./quote-document')

beforeEach(() => {
  doGenerateMock.mockReset()
  fetchMock.mockReset()
})

function codeExecutionResultResponse(fileId: string) {
  return {
    content: [
      // A code_execution tool a valóságban több, egymástól eltérő output-alakot ad
      // vissza lépésenként (pl. egy SKILL.md megnézése `content: string`-gel) —
      // ez a lépés itt szándékosan NEM tartalmaz fájlt, hogy lefedje azt az élesben
      // talált hibát, ahol a kód feltétel nélkül `.find()`-ot hívott a content-en.
      {
        type: 'tool-result' as const,
        toolCallId: 'srv_0',
        toolName: 'code_execution',
        result: {
          type: 'text_editor_code_execution_view_result',
          content: '---\nname: xlsx\n---\n...',
          file_type: 'text',
        },
      },
      {
        type: 'tool-result' as const,
        toolCallId: 'srv_1',
        toolName: 'code_execution',
        result: {
          type: 'code_execution_result',
          stdout: '',
          stderr: '',
          return_code: 0,
          content: [{ type: 'code_execution_output', file_id: fileId }],
        },
      },
    ],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 50, text: 50, reasoning: undefined },
    },
    warnings: [],
  }
}

describe('generateQuoteDocument', () => {
  it('should extract the generated file id and filename from the code execution result', async () => {
    doGenerateMock.mockResolvedValueOnce(codeExecutionResultResponse('file_abc123'))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ filename: 'arajanlat.xlsx' }),
    })

    const result = await generateQuoteDocument('Aloe vera x2, Pénzfa x1', {
      apiKey: 'test-key',
      model: 'claude-test',
    })

    expect(result).toEqual({ fileId: 'file_abc123', filename: 'arajanlat.xlsx' })
    expect(doGenerateMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/files/file_abc123',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'test-key', 'anthropic-beta': 'files-api-2025-04-14' }),
      }),
    )

    const requestArgs = doGenerateMock.mock.calls[0][0] as {
      tools?: { name: string }[]
      providerOptions?: { anthropic?: { container?: { skills?: unknown[] } } }
    }
    expect(requestArgs.tools?.map((tool) => tool.name)).toEqual(['code_execution'])
    expect(requestArgs.providerOptions?.anthropic?.container?.skills).toEqual([
      { type: 'anthropic', skillId: 'xlsx', version: 'latest' },
    ])
  })

  it('should throw an error including the finishReason if no generated file is found in the response', async () => {
    doGenerateMock.mockResolvedValueOnce({
      content: [{ type: 'text' as const, text: 'Nem tudtam fájlt generálni.' }],
      finishReason: { unified: 'length' as const, raw: undefined },
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 50, text: 50, reasoning: undefined },
      },
      warnings: [],
    })

    await expect(
      generateQuoteDocument('Aloe vera x2', { apiKey: 'test-key', model: 'claude-test' }),
    ).rejects.toThrow('finishReason: length')
  })
})

describe('downloadQuoteDocument', () => {
  it('should return the file content as a Buffer', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: async () => bytes.buffer })

    const buffer = await downloadQuoteDocument('file_abc123', { apiKey: 'test-key', model: 'claude-test' })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect([...buffer]).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/files/file_abc123/content',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-key' }) }),
    )
  })
})
