import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import { createEmbedder } from './embedding'
import { EMBEDDING_MODEL_ID } from './embedding'
import { getDocumentContentHash, upsertDocument } from './knowledge-repository'
import { parseKnowledgeMarkdown } from './chunking'
import { createSemanticChunkSplitter } from './semantic-chunk-splitter'
import type { KnowledgeChunkInput } from './types'

export type IngestConfig = {
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  pool: Pool
}

export type IngestFileResult = {
  slug: string
  skipped: boolean
  chunkCount: number
}

export type KnowledgeIngestionPipeline = {
  ingestFile(filename: string, raw: string): Promise<IngestFileResult>
}

/**
 * A providerek (Anthropic a szemantikus chunk-elemzéshez, OpenAI az
 * embeddinghez) egyszer épülnek fel, a hívó (`ingest-knowledge` CLI-parancs)
 * ezt a lezárást (closure) használja minden `seed/knowledge/*.md` fájlra —
 * ugyanaz a felépítés-egyszer-hívás-sokszor minta, mint `createEmbedder`/
 * `createReranker` esetén.
 */
export function createKnowledgeIngestionPipeline(config: IngestConfig): KnowledgeIngestionPipeline {
  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey })
  const splitParagraph = createSemanticChunkSplitter(anthropic(config.anthropicModel))
  const openai = createOpenAI({ apiKey: config.openaiApiKey })
  const embed = createEmbedder(openai.textEmbeddingModel(EMBEDDING_MODEL_ID))

  return {
    async ingestFile(filename: string, raw: string): Promise<IngestFileResult> {
      const slug = filename.replace(/\.md$/, '')
      const contentHash = createHash('sha256').update(raw).digest('hex')

      const existingHash = await getDocumentContentHash(config.pool, slug)
      if (existingHash === contentHash) {
        return { slug, skipped: true, chunkCount: 0 }
      }

      const parsed = parseKnowledgeMarkdown(slug, raw)

      const chunkContents: { heading: string | null; content: string }[] = []
      for (const paragraph of parsed.paragraphs) {
        const subChunks = await splitParagraph(paragraph.content)
        for (const content of subChunks) {
          chunkContents.push({ heading: paragraph.heading, content })
        }
      }

      const embeddings = await embed(chunkContents.map((c) => c.content))
      const chunks: KnowledgeChunkInput[] = chunkContents.map((c, index) => ({
        documentSlug: slug,
        title: parsed.title,
        source: parsed.source,
        category: parsed.category,
        heading: c.heading,
        chunkIndex: index,
        content: c.content,
      }))

      await upsertDocument(config.pool, { slug, title: parsed.title, source: parsed.source, category: parsed.category, contentHash, chunks }, embeddings)

      return { slug, skipped: false, chunkCount: chunks.length }
    },
  }
}
