import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateQuoteDocumentMock = vi.fn()
const downloadQuoteDocumentMock = vi.fn()
const mkdirMock = vi.fn()
const writeFileMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  generateQuoteDocument: generateQuoteDocumentMock,
  downloadQuoteDocument: downloadQuoteDocumentMock,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  default: { mkdir: mkdirMock, writeFile: writeFileMock },
}))

const { saveQuoteIfRequested } = await import('./quote-export')

beforeEach(() => {
  generateQuoteDocumentMock.mockReset()
  downloadQuoteDocumentMock.mockReset()
  mkdirMock.mockReset()
  writeFileMock.mockReset()
})

describe('saveQuoteIfRequested', () => {
  it('should do nothing when the classifier did not detect an export instruction', async () => {
    await saveQuoteIfRequested('Van kaktuszunk 3500 Ft-ért.', false, { apiKey: 'test-key', model: 'claude-test' })

    expect(generateQuoteDocumentMock).not.toHaveBeenCalled()
    expect(downloadQuoteDocumentMock).not.toHaveBeenCalled()
    expect(mkdirMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('should generate and save an xlsx quote when an export instruction was detected', async () => {
    generateQuoteDocumentMock.mockResolvedValueOnce({ fileId: 'file_abc123', filename: 'arajanlat.xlsx' })
    downloadQuoteDocumentMock.mockResolvedValueOnce(Buffer.from('fake-xlsx-content'))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await saveQuoteIfRequested('Van kaktuszunk 3500 Ft-ért.', true, { apiKey: 'test-key', model: 'claude-test' })

    expect(generateQuoteDocumentMock).toHaveBeenCalledWith('Van kaktuszunk 3500 Ft-ért.', {
      apiKey: 'test-key',
      model: 'claude-test',
    })
    expect(downloadQuoteDocumentMock).toHaveBeenCalledWith('file_abc123', { apiKey: 'test-key', model: 'claude-test' })
    expect(mkdirMock).toHaveBeenCalledWith('quotes', { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(join('quotes', 'arajanlat.xlsx'), expect.any(Buffer))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('arajanlat.xlsx'))

    logSpy.mockRestore()
  })
})
