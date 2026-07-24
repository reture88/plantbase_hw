import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
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
const NO_ANSWER_TEXT = 'A növényápolási tudásbázis nem tartalmaz elég információt ehhez a kérdéshez.'

const GROUNDED_SYSTEM_PROMPT = `<role>
Egy növényápolási szakértő asszisztens vagy, aki KIZÁRÓLAG a lenti <context> tartalma alapján válaszol a felhasználó kérdésére.
</role>
<rules>
- Csak a <context>-ben szereplő információt használd. NE használj általános világtudást, NE találj ki semmit, NE egészíts ki hiányzó részleteket feltételezéssel.
- Ha a <context> nem tartalmaz elég információt a kérdés megválaszolásához, a válaszod PONTOSAN ez legyen, semmi más: ${NO_ANSWER_MARKER}
- Ha van elég információ, adj természetes nyelvű, közérthető választ magyarul.
- Ha a felhasználó fájlba mentést/exportot (pl. PDF-et) kért: erről ne nyilatkozz — sem azt, hogy megcsináltad, sem azt, hogy nem tudod megcsinálni. Ez egy tőled független, automatikus lépés, ami a válaszod után történik.
</rules>`

export type AskRagConfig = {
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  embeddingModel: string
  /** Olcsó "helper" modell a rerankhez (a HyDE tudatosan `anthropicModel`-t használja, nem ezt). */
  helperModel: string
  pool: Pool
  logger?: RagJsonlLogger
}

export type RagStream = {
  /** Csak a ténylegesen kiküldhető szöveget adja — elutasítás esetén üres (lásd `result.answer`). */
  textStream: AsyncIterable<string>
  result: Promise<RagAnswer>
}

function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks.map((c) => `<chunk title="${c.title}" source="${c.source}">${c.content}</chunk>`).join('\n')
}

function uniqueSources(chunks: RetrievedChunk[]): RagAnswer['sources'] {
  return [...new Map(chunks.map((c) => [c.source, { title: c.title, source: c.source }])).values()]
}

/**
 * A HyDE → keresés → rerank lépések (nem felhasználó-néző szöveg, nincs
 * értelme streamelni) — `askRag` és `streamAskRag` is ugyanezt futtatja.
 */
async function retrieveRerankedChunks(parsedQuestion: string, config: AskRagConfig) {
  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey })
  const model = anthropic(config.anthropicModel)
  const openai = createOpenAI({ apiKey: config.openaiApiKey })
  const embeddingModel = openai.textEmbeddingModel(config.embeddingModel)
  const helperModel = openai(config.helperModel)

  // A HyDE (hipotetikus válasz generálása) tudatosan Claude Haiku-n marad —
  // csak a rerank (ítéleti/relevancia-döntés) került át az olcsóbb helper-modellre.
  const generateHyde = createHydeGenerator(model)
  const embed = createEmbedder(embeddingModel)
  const rerank = createReranker(helperModel, RERANK_TOP_K)

  const hypotheticalAnswer = await generateHyde(parsedQuestion)
  const [hypotheticalEmbedding] = await embed([hypotheticalAnswer])
  const retrieved = await searchSimilarChunks(config.pool, hypotheticalEmbedding, RETRIEVE_LIMIT)
  const reranked = await rerank(parsedQuestion, retrieved)

  return { model, hypotheticalAnswer, retrieved, reranked }
}

/**
 * A modell a `NO_ANSWER_MARKER`-t egyetlen, rövid tokensorozatként adja
 * vissza (a system prompt szerint semmi mást) — ezért elég a marker
 * hosszáig pufferelni: amint a puffer biztosan nem lehet a marker prefixe
 * (vagy hosszabb nála), tudjuk, hogy valódi válasz jön, és onnantól minden
 * további delta azonnal továbbmegy. Enélkül a kliens élőben látná a nyers
 * "NINCS_ELEG_INFORMACIO" jelzőt streamelődni, mielőtt elutasításra váltanánk.
 */
async function* bufferAgainstMarker(rawTextStream: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = ''
  let disambiguated = false

  for await (const delta of rawTextStream) {
    if (disambiguated) {
      yield delta
      continue
    }
    buffer += delta
    if (buffer.length > NO_ANSWER_MARKER.length || !NO_ANSWER_MARKER.startsWith(buffer)) {
      disambiguated = true
      yield buffer
    }
  }

  if (!disambiguated && buffer.trim() !== NO_ANSWER_MARKER) {
    yield buffer
  }
}

/** A teljes válaszra vár (CLI/teszt-használatra). */
export async function askRag(question: string, config: AskRagConfig): Promise<RagAnswer> {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  let hypotheticalAnswer = ''
  let retrieved: RetrievedChunk[] = []
  let reranked: RetrievedChunk[] = []
  let answer = ''
  let grounded = false
  let errorMessage: string | undefined

  try {
    const retrieval = await retrieveRerankedChunks(parsedQuestion, config)
    hypotheticalAnswer = retrieval.hypotheticalAnswer
    retrieved = retrieval.retrieved
    reranked = retrieval.reranked

    if (reranked.length === 0) {
      answer = NO_ANSWER_TEXT
      grounded = false
      return { answer, grounded, sources: [] }
    }

    const result = await streamText({
      model: retrieval.model,
      system: GROUNDED_SYSTEM_PROMPT,
      prompt: `<context>\n${buildContextBlock(reranked)}\n</context>\n<question>${parsedQuestion}</question>`,
      maxOutputTokens: ANSWER_MAX_TOKENS,
    })
    const text = await result.text

    if (text.trim() === NO_ANSWER_MARKER) {
      answer = NO_ANSWER_TEXT
      grounded = false
      return { answer, grounded, sources: [] }
    }

    answer = text
    grounded = true
    return { answer, grounded, sources: uniqueSources(reranked) }
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

/** Élő token-streamre (HTTP réteghez) — elutasítás esetén a `textStream` üres, a válasz a `result.answer`-ben van. */
export async function streamAskRag(question: string, config: AskRagConfig): Promise<RagStream> {
  const parsedQuestion = QuestionSchema.parse(question)
  const startedAt = Date.now()

  let hypotheticalAnswer = ''
  let retrieved: RetrievedChunk[] = []
  let reranked: RetrievedChunk[] = []

  const retrieval = await retrieveRerankedChunks(parsedQuestion, config)
  hypotheticalAnswer = retrieval.hypotheticalAnswer
  retrieved = retrieval.retrieved
  reranked = retrieval.reranked

  const log = (answer: string, grounded: boolean, errorMessage: string | undefined) => {
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

  if (reranked.length === 0) {
    log(NO_ANSWER_TEXT, false, undefined)
    return {
      textStream: (async function* () {})(),
      result: Promise.resolve({ answer: NO_ANSWER_TEXT, grounded: false, sources: [] }),
    }
  }

  const streamResult = streamText({
    model: retrieval.model,
    system: GROUNDED_SYSTEM_PROMPT,
    prompt: `<context>\n${buildContextBlock(reranked)}\n</context>\n<question>${parsedQuestion}</question>`,
    maxOutputTokens: ANSWER_MAX_TOKENS,
  })

  const result = (async (): Promise<RagAnswer> => {
    let errorMessage: string | undefined
    try {
      const text = await streamResult.text
      if (text.trim() === NO_ANSWER_MARKER) {
        log(NO_ANSWER_TEXT, false, undefined)
        return { answer: NO_ANSWER_TEXT, grounded: false, sources: [] }
      }
      log(text, true, undefined)
      return { answer: text, grounded: true, sources: uniqueSources(reranked) }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba történt.'
      log('', false, errorMessage)
      throw error
    }
  })()

  return { textStream: bufferAgainstMarker(streamResult.textStream), result }
}
