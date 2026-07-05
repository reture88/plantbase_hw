import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { downloadQuoteDocument, generateQuoteDocument } from '@plantbase/core'
import type { AgentConfig } from '../config/agent-config'

const QUOTES_DIR = 'quotes'

/**
 * Csak akkor generál és ment Excel árajánlatot, ha a request-classifier
 * (lásd `packages/core/src/agent/request-classifier.ts`) explicit
 * export-szándékot észlelt az üzenetben — a válasz szövege önmagában
 * sosem elég indok fájl létrehozására.
 */
export async function saveQuoteIfRequested(answer: string, wantsFileExport: boolean, agentConfig: AgentConfig): Promise<void> {
  if (!wantsFileExport) {
    return
  }

  console.log('\nExcel árajánlat generálása...')
  const quote = await generateQuoteDocument(answer, agentConfig)
  const fileBuffer = await downloadQuoteDocument(quote.fileId, agentConfig)

  await mkdir(QUOTES_DIR, { recursive: true })
  const outputPath = join(QUOTES_DIR, quote.filename)
  await writeFile(outputPath, fileBuffer)

  console.log(`Árajánlat elmentve: ${outputPath}`)
}
