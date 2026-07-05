import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.fn()
const retrieveMetadataMock = vi.fn()
const downloadMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return {
      beta: {
        messages: { create: createMock },
        files: { retrieveMetadata: retrieveMetadataMock, download: downloadMock },
      },
    }
  }),
}))

const { generateQuoteDocument, downloadQuoteDocument } = await import('./quote-document')

beforeEach(() => {
  createMock.mockReset()
  retrieveMetadataMock.mockReset()
  downloadMock.mockReset()
})

describe('generateQuoteDocument', () => {
  it('should extract the generated file id and filename from the code execution result', async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: 'bash_code_execution_tool_result',
          tool_use_id: 'srv_1',
          content: {
            type: 'bash_code_execution_result',
            stdout: '',
            stderr: '',
            return_code: 0,
            content: [{ type: 'bash_code_execution_output', file_id: 'file_abc123' }],
          },
        },
      ],
    })
    retrieveMetadataMock.mockResolvedValueOnce({ id: 'file_abc123', filename: 'arajanlat.xlsx' })

    const result = await generateQuoteDocument('Aloe vera x2, Pénzfa x1', {
      apiKey: 'test-key',
      model: 'claude-test',
    })

    expect(result).toEqual({ fileId: 'file_abc123', filename: 'arajanlat.xlsx' })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        betas: ['code-execution-2025-08-25', 'skills-2025-10-02'],
        container: { skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }] },
      }),
    )
  })

  it('should throw if no generated file is found in the response', async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Nem tudtam fájlt generálni.' }] })

    await expect(
      generateQuoteDocument('Aloe vera x2', { apiKey: 'test-key', model: 'claude-test' }),
    ).rejects.toThrow('Nem sikerült árajánlat-dokumentumot generálni')
  })
})

describe('downloadQuoteDocument', () => {
  it('should return the file content as a Buffer', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    downloadMock.mockResolvedValueOnce({ arrayBuffer: async () => bytes.buffer })

    const buffer = await downloadQuoteDocument('file_abc123', { apiKey: 'test-key', model: 'claude-test' })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect([...buffer]).toEqual([1, 2, 3])
    expect(downloadMock).toHaveBeenCalledWith('file_abc123')
  })
})
