import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadQuoteDocument, generatePdfDocument, generateQuoteDocument, type QuoteDocumentConfig } from './quote-document'

export type SavedQuote = {
  filename: string
  filePath: string
}

export type DocumentFormat = 'xlsx' | 'pdf'

/**
 * Közös segédfüggvény az `apps/api` egységes chat-route-jának — csak akkor
 * generál és ment dokumentumot, ha a klasszifikáció explicit export-szándékot
 * észlelt (`wantsFileExport`), a válasz szövege önmagában sosem elég indok.
 * A formátumot a hívó adja meg (`xlsx` katalógus-válaszhoz, `pdf`
 * tudásbázis/web_search-válaszhoz — lásd `unified-agent.ts` `source` mezőjét).
 */
export async function saveGeneratedDocument(
  content: string,
  format: DocumentFormat,
  wantsFileExport: boolean,
  config: QuoteDocumentConfig,
  outputDir = 'quotes',
): Promise<SavedQuote | undefined> {
  if (!wantsFileExport) {
    return undefined
  }

  const generate = format === 'xlsx' ? generateQuoteDocument : generatePdfDocument
  const doc = await generate(content, config)
  const fileBuffer = await downloadQuoteDocument(doc.fileId, config)

  await mkdir(outputDir, { recursive: true })
  const filePath = join(outputDir, doc.filename)
  await writeFile(filePath, fileBuffer)

  return { filename: doc.filename, filePath }
}
