import { EMBEDDING_MODEL_ID, createReadonlyPool, streamAskRag, type RagJsonlLogger } from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'
import { endSse, startSse } from '../sse'

const RagChatRequestSchema = z.object({ question: z.string().min(1) })

export function registerRagChatRoute(app: FastifyInstance, env: ApiEnv, logger: RagJsonlLogger): void {
  const pool = createReadonlyPool(env.databaseUrlReadonly)

  app.post('/api/rag/chat', async (request, reply) => {
    const parsed = RagChatRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "question" mező kötelező.' })
    }

    let stream: Awaited<ReturnType<typeof streamAskRag>>
    try {
      stream = await streamAskRag(parsed.data.question, {
        anthropicApiKey: env.anthropicApiKey,
        anthropicModel: env.anthropicModel,
        openaiApiKey: env.openaiApiKey,
        embeddingModel: EMBEDDING_MODEL_ID,
        pool,
        logger,
      })
    } catch (error) {
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    }

    const send = startSse(reply)
    try {
      for await (const delta of stream.textStream) {
        send({ type: 'text-delta', text: delta })
      }
      const result = await stream.result
      // `answer` mindig szerepel: ha elutasítás történt, a textStream üres volt, és
      // ez az egyetlen hely, ahol a kliens megkapja az elutasító üzenetet.
      send({ type: 'done', answer: result.answer, grounded: result.grounded, sources: result.sources })
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    } finally {
      endSse(reply)
    }
  })
}
