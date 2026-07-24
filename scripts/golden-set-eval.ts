process.loadEnvFile()

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createEmbedder, createReadonlyPool, EMBEDDING_MODEL_ID, HELPER_MODEL_ID, searchSimilarChunks, askRag } from '@plantbase/core'
import { createHydeGenerator } from '../packages/core/src/rag/hyde'
import { createReranker } from '../packages/core/src/rag/rerank'
import type { RetrievedChunk } from '../packages/core/src/rag/types'

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL as string
const TOP_K = 5

type GoldenQuestion = { question: string; negative?: boolean }

const GOLDEN_SET: GoldenQuestion[] = [
  { question: 'Milyen gyakran öntözzem az aloe verát?' },
  { question: 'Hogyan gondozzam a kardliliomot (snake plant)?' },
  { question: 'Milyen fényt igényel a gumífa (rubber tree)?' },
  { question: 'Hogyan segítsek az orchideámnak újra virágozni?' },
  { question: 'Miért nincsenek lyukak a monstera levelein?' },
  { question: 'Milyen szobanövények biztonságosak macskáknak?' },
  { question: 'Hogyan öntözzem a kaktuszaimat télen?' },
  { question: 'Hogyan tudok aranyat bányászni otthon egy virágcserépben?', negative: true },
]

function snippet(text: string, length = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > length ? `${clean.slice(0, length)}…` : clean
}

function formatList(chunks: RetrievedChunk[]): string {
  return chunks.map((c, i) => `  ${i + 1}. [id=${c.id}, d=${c.distance.toFixed(4)}] "${c.title}" — ${snippet(c.content)}`).join('\n')
}

async function main() {
  const databaseUrlReadonly = process.env.DATABASE_URL_READONLY as string
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY as string
  const openaiApiKey = process.env.OPENAI_API_KEY as string

  const pool = createReadonlyPool(databaseUrlReadonly)
  const anthropic = createAnthropic({ apiKey: anthropicApiKey })
  const model = anthropic(ANTHROPIC_MODEL)
  const openai = createOpenAI({ apiKey: openaiApiKey })
  const embeddingModel = openai.textEmbeddingModel(EMBEDDING_MODEL_ID)
  const helperModel = openai(HELPER_MODEL_ID)

  const embed = createEmbedder(embeddingModel)
  const generateHyde = createHydeGenerator(model)
  const rerank = createReranker(helperModel, TOP_K)

  for (const { question, negative } of GOLDEN_SET) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`KÉRDÉS: ${question}${negative ? '  [NEGATÍV TESZT]' : ''}`)
    console.log('='.repeat(80))

    // (a) nyers vektorkeresés — a kérdés közvetlen embeddingje, HyDE nélkül
    const [rawEmbedding] = await embed([question])
    const rawTop = await searchSimilarChunks(pool, rawEmbedding, TOP_K)
    console.log('\n-- (a) NYERS VEKTORKERESÉS (top-5, HyDE nélkül) --')
    console.log(formatList(rawTop))

    // (b) teljes pipeline — HyDE + top-20 + rerank -> top-5
    const hypotheticalAnswer = await generateHyde(question)
    const [hydeEmbedding] = await embed([hypotheticalAnswer])
    const top20 = await searchSimilarChunks(pool, hydeEmbedding, 20)
    const reranked = await rerank(question, top20)
    console.log(`\n-- HyDE hipotetikus válasz --\n  "${snippet(hypotheticalAnswer, 200)}"`)
    console.log('\n-- (b) TELJES PIPELINE (HyDE + rerank, top-5) --')
    console.log(formatList(reranked))

    const rawIds = rawTop.map((c) => c.id)
    const rerankedIds = reranked.map((c) => c.id)
    const reordered = JSON.stringify(rawIds) !== JSON.stringify(rerankedIds)
    console.log(`\n-- ÁTRENDEZÉS: ${reordered ? 'IGEN — a sorrend/tartalom eltér' : 'NEM — azonos top-5 azonos sorrendben'} --`)

    if (negative) {
      const ragAnswer = await askRag(question, {
        anthropicApiKey,
        anthropicModel: ANTHROPIC_MODEL,
        openaiApiKey,
        embeddingModel: EMBEDDING_MODEL_ID,
        helperModel: HELPER_MODEL_ID,
        pool,
      })
      console.log('\n-- TELJES askRag VÁLASZ (negatív teszt) --')
      console.log(`  grounded: ${ragAnswer.grounded}`)
      console.log(`  answer: "${ragAnswer.answer}"`)
    }
  }

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
