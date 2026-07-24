import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createKnowledgeIngestionPipeline, createWritePool, pruneRemovedDocuments } from '@plantbase/core'
import type { Command } from 'commander'
import { loadOpenAiApiKeyFromEnv, loadWritableDatabaseUrlFromEnv } from '../config/agent-config'

const KNOWLEDGE_DIR = 'seed/knowledge'

/**
 * A DATABASE_URL/OPENAI_API_KEY betöltése szándékosan az `action`-ön belül
 * történik, nem `main.ts` indulásakor — az `ask` parancsnak nincs szüksége
 * erre a két env-változóra, és a program indulásának nem szabad rajtuk
 * elhasalnia, ha valaki csak katalógus-kérdést tesz fel.
 */
export function registerIngestKnowledgeCommand(program: Command): void {
  program
    .command('ingest-knowledge')
    .description('A seed/knowledge/*.md növényápolási cikkek chunkolása, embeddelése és a tudásbázisba töltése')
    .action(async () => {
      const startedAt = Date.now()
      const pool = createWritePool(loadWritableDatabaseUrlFromEnv())

      try {
        const pipeline = createKnowledgeIngestionPipeline({
          openaiApiKey: loadOpenAiApiKeyFromEnv(),
          pool,
        })

        const files = (await readdir(KNOWLEDGE_DIR)).filter((f) => f.endsWith('.md'))
        const seenSlugs: string[] = []
        let processedCount = 0
        let skippedCount = 0
        let totalChunkCount = 0

        for (const file of files) {
          const raw = await readFile(join(KNOWLEDGE_DIR, file), 'utf8')
          const result = await pipeline.ingestFile(file, raw)
          seenSlugs.push(result.slug)

          if (result.skipped) {
            skippedCount++
            continue
          }
          processedCount++
          totalChunkCount += result.chunkCount
          console.log(`  ✓ ${result.slug} (${result.chunkCount} chunk)`)
        }

        const removedSlugs = await pruneRemovedDocuments(pool, seenSlugs)

        console.log('')
        console.log(`Feldolgozva: ${processedCount} dokumentum (${totalChunkCount} chunk), kihagyva (nem változott): ${skippedCount}.`)
        if (removedSlugs.length > 0) {
          console.log(`Törölve (már nincs forrásfájl): ${removedSlugs.join(', ')}`)
        }
        console.log(`Időtartam: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
      } finally {
        await pool.end()
      }
    })
}
