import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateQuoteDocumentMock = vi.fn()
const generatePdfDocumentMock = vi.fn()
const downloadQuoteDocumentMock = vi.fn()
const mkdirMock = vi.fn()
const writeFileMock = vi.fn()

vi.mock('./quote-document', () => ({
  generateQuoteDocument: generateQuoteDocumentMock,
  generatePdfDocument: generatePdfDocumentMock,
  downloadQuoteDocument: downloadQuoteDocumentMock,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  default: { mkdir: mkdirMock, writeFile: writeFileMock },
}))

const { saveGeneratedDocument } = await import('./quote-export')

beforeEach(() => {
  generateQuoteDocumentMock.mockReset()
  generatePdfDocumentMock.mockReset()
  downloadQuoteDocumentMock.mockReset()
  mkdirMock.mockReset()
  writeFileMock.mockReset()
})

describe('saveGeneratedDocument', () => {
  it('does nothing when wantsFileExport is false, regardless of format', async () => {
    await saveGeneratedDocument('Van kaktuszunk.', 'xlsx', false, { apiKey: 'test-key', model: 'claude-test' })

    expect(generateQuoteDocumentMock).not.toHaveBeenCalled()
    expect(generatePdfDocumentMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('generates and saves an xlsx document for the "xlsx" format', async () => {
    generateQuoteDocumentMock.mockResolvedValueOnce({ fileId: 'file_abc', filename: 'arajanlat.xlsx' })
    downloadQuoteDocumentMock.mockResolvedValueOnce(Buffer.from('fake-xlsx'))

    const saved = await saveGeneratedDocument('Van kaktuszunk 3500 Ft-ért.', 'xlsx', true, { apiKey: 'test-key', model: 'claude-test' })

    expect(generateQuoteDocumentMock).toHaveBeenCalledWith('Van kaktuszunk 3500 Ft-ért.', { apiKey: 'test-key', model: 'claude-test' })
    expect(generatePdfDocumentMock).not.toHaveBeenCalled()
    expect(mkdirMock).toHaveBeenCalledWith('quotes', { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(join('quotes', 'arajanlat.xlsx'), expect.any(Buffer))
    expect(saved).toEqual({ filename: 'arajanlat.xlsx', filePath: join('quotes', 'arajanlat.xlsx') })
  })

  it('generates and saves a pdf document for the "pdf" format', async () => {
    generatePdfDocumentMock.mockResolvedValueOnce({ fileId: 'file_pdf', filename: 'valasz.pdf' })
    downloadQuoteDocumentMock.mockResolvedValueOnce(Buffer.from('fake-pdf'))

    const saved = await saveGeneratedDocument('Az aloe verát ritkán kell öntözni.', 'pdf', true, { apiKey: 'test-key', model: 'claude-test' })

    expect(generatePdfDocumentMock).toHaveBeenCalledWith('Az aloe verát ritkán kell öntözni.', { apiKey: 'test-key', model: 'claude-test' })
    expect(generateQuoteDocumentMock).not.toHaveBeenCalled()
    expect(saved).toEqual({ filename: 'valasz.pdf', filePath: join('quotes', 'valasz.pdf') })
  })
})
