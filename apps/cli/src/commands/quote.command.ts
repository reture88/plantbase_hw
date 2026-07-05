import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Command } from 'commander'
import { askAgent, downloadQuoteDocument, generateQuoteDocument, type JsonlLogger } from '@plantbase/core'
import type { Pool } from 'pg'
import type { AgentConfig } from '../config/agent-config'

const QUOTES_DIR = 'quotes'

export function registerQuoteCommand(
  program: Command,
  agentConfig: AgentConfig,
  logger: JsonlLogger,
  runSqlPool: Pool,
): void {
  program
    .command('quote')
    .description('Növénycsomag-ajánlás összeállítása, majd Excel árajánlat generálása')
    .argument('<need>', 'az ügyfél igénye')
    .action(async (need: string) => {
      console.log('Ajánlás összeállítása...')
      const recommendation = await askAgent(need, { ...agentConfig, logger, runSqlPool })
      console.log(recommendation.answer)

      console.log('\nExcel árajánlat generálása...')
      const quote = await generateQuoteDocument(recommendation.answer, agentConfig)
      const fileBuffer = await downloadQuoteDocument(quote.fileId, agentConfig)

      await mkdir(QUOTES_DIR, { recursive: true })
      const outputPath = join(QUOTES_DIR, quote.filename)
      await writeFile(outputPath, fileBuffer)

      console.log(`\nÁrajánlat elmentve: ${outputPath}`)
    })
}
