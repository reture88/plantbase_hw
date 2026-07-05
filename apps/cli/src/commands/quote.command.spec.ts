import { join } from 'node:path'
import { Command } from 'commander'
import { describe, expect, it, vi } from 'vitest'

const askAgentMock = vi.fn()
const generateQuoteDocumentMock = vi.fn()
const downloadQuoteDocumentMock = vi.fn()
const mkdirMock = vi.fn()
const writeFileMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  askAgent: askAgentMock,
  generateQuoteDocument: generateQuoteDocumentMock,
  downloadQuoteDocument: downloadQuoteDocumentMock,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  default: { mkdir: mkdirMock, writeFile: writeFileMock },
}))

const { registerQuoteCommand } = await import('./quote.command')

const fakePool = {} as import('pg').Pool

describe('quote command', () => {
  it('should build a recommendation, generate an xlsx quote and save it to disk', async () => {
    askAgentMock.mockResolvedValueOnce({
      answer: 'Ajánlott csomag: Aloe vera (2 500 Ft) + Pénzfa (2 900 Ft), összesen 5 400 Ft.',
      systemPrompt: 'rendszerprompt',
      messages: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    })
    generateQuoteDocumentMock.mockResolvedValueOnce({ fileId: 'file_abc123', filename: 'arajanlat.xlsx' })
    downloadQuoteDocumentMock.mockResolvedValueOnce(Buffer.from('fake-xlsx-content'))

    const program = new Command()
    registerQuoteCommand(
      program,
      { apiKey: 'test-key', model: 'claude-test' },
      { filePath: 'fake.jsonl', append: vi.fn() },
      fakePool,
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await program.parseAsync(['quote', 'napos nappali, kis büdzsé'], { from: 'user' })

    expect(askAgentMock).toHaveBeenCalledWith(
      'napos nappali, kis büdzsé',
      expect.objectContaining({ apiKey: 'test-key' }),
    )
    expect(generateQuoteDocumentMock).toHaveBeenCalledWith(
      'Ajánlott csomag: Aloe vera (2 500 Ft) + Pénzfa (2 900 Ft), összesen 5 400 Ft.',
      { apiKey: 'test-key', model: 'claude-test' },
    )
    expect(downloadQuoteDocumentMock).toHaveBeenCalledWith('file_abc123', { apiKey: 'test-key', model: 'claude-test' })
    expect(mkdirMock).toHaveBeenCalledWith('quotes', { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(join('quotes', 'arajanlat.xlsx'), expect.any(Buffer))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('arajanlat.xlsx'))

    logSpy.mockRestore()
  })
})
