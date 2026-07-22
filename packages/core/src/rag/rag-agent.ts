import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { RagJsonlLogger } from '../logging/rag-jsonl-logger'
import { createEmbedder } from './embedding'
import { createHydeGenerator } from './hyde'
import { searchSimilarChunks } from './knowledge-repository'
import { createReranker } from './rerank'
import type { RagAnswer, RetrievedChunk } from './types'

const QuestionSchema = z.string().min(1, 'A kérdés nem lehet üres.')

const RETRIEVE_LIMIT = 20
const RERANK_TOP_K = 5
const ANSWER_MAX_TOKENS = 1024

const NO_ANSWER_MARKER = 'NINCS_ELEG_INFORMACIO'

const GROUNDED_SYSTEM_PROMPT = `<role>
Egy növényápolási szakértő asszisztens vagy, aki KIZÁRÓLAG a lenti <context> tartalma alapján válaszol a felhasználó kérdésére.
</role>
<rules>
- Csak a <context>-ben szereplő információt használd. NE használj általános világtudást, NE találj ki semmit, NE egészíts ki hiányzó részleteket feltételezéssel.
- Ha a <context> nem tartalmaz elég információt a kérdés megválaszolásához, a válaszod PONTOSAN ez legyen, semmi más: ${NO_ANSWER_MARKER}
- Ha van elég információ, adj természetes nyelvű, közérthető választ magyarul.
</rules>`

export type AskRagConfig = {
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  embeddingModel: string
  pool: Pool
  logger?: RagJsonlLogger
}

function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks.map((c) => `<chunk title="${c.title}" source="${c.source}">${c.content}</chunk>`).join('\n')
}

export async function askRag(question: string, config: AskRagConfig): Promise<RagAnswer> {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey })
  const model = anthropic(config.anthropicModel)
  const openai = createOpenAI({ apiKey: config.openaiApiKey })
  const embeddingModel = openai.textEmbeddingModel(config.embeddingModel)

  const generateHyde = createHydeGenerator(model)
  const embed = createEmbedder(embeddingModel)
  const rerank = createReranker(model, RERANK_TOP_K)

  let hypotheticalAnswer = ''
  let retrieved: RetrievedChunk[] = []
  let reranked: RetrievedChunk[] = []
  let answer = ''
  let grounded = false
  let errorMessage: string | undefined

  try {
    hypotheticalAnswer = await generateHyde(parsedQuestion)
    const [hypotheticalEmbedding] = await embed([hypotheticalAnswer])

    retrieved = await searchSimilarChunks(config.pool, hypotheticalEmbedding, RETRIEVE_LIMIT)
    reranked = await rerank(parsedQuestion, retrieved)

    if (reranked.length === 0) {
      answer = 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.'
      grounded = false
      return { answer, grounded, sources: [] }
    }

    const result = await generateText({
      model,
      system: GROUNDED_SYSTEM_PROMPT,
      prompt: `<context>\n${buildContextBlock(reranked)}\n</context>\n<question>${parsedQuestion}</question>`,
      maxOutputTokens: ANSWER_MAX_TOKENS,
    })

    if (result.text.trim() === NO_ANSWER_MARKER) {
      answer = 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.'
      grounded = false
      return { answer, grounded, sources: [] }
    }

    answer = result.text
    grounded = true
    const sources = [...new Map(reranked.map((c) => [c.source, { title: c.title, source: c.source }])).values()]
    return { answer, grounded, sources }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba történt.'
    throw error
  } finally {
    config.logger?.append({
      timestamp: new Date().toISOString(),
      question: parsedQuestion,
      hypotheticalAnswer,
      retrievedChunkIds: retrieved.map((c) => c.id),
      rerankedChunkIds: reranked.map((c) => c.id),
      grounded,
      answer,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    })
  }
}
