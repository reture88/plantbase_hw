import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadQuoteDocument, generateQuoteDocument, type QuoteDocumentConfig } from './quote-document'

export type SavedQuote = {
  filename: string
  filePath: string
}

/**
 * Közös segédfüggvény, amit az `apps/cli` (`quote-export.ts`) és az
 * `apps/api` (`/api/ask` route) is használ — csak akkor generál és ment
 * Excel árajánlatot, ha a request-classifier explicit export-szándékot
 * észlelt (`wantsFileExport`), a válasz szövege önmagában sosem elég indok.
 */
export async function saveGeneratedQuote(
  answer: string,
  wantsFileExport: boolean,
  config: QuoteDocumentConfig,
  outputDir = 'quotes',
): Promise<SavedQuote | undefined> {
  if (!wantsFileExport) {
    return undefined
  }

  const quote = await generateQuoteDocument(answer, config)
  const fileBuffer = await downloadQuoteDocument(quote.fileId, config)

  await mkdir(outputDir, { recursive: true })
  const filePath = join(outputDir, quote.filename)
  await writeFile(filePath, fileBuffer)

  return { filename: quote.filename, filePath }
}
