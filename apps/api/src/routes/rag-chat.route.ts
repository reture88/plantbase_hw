import { askRag, createReadonlyPool, EMBEDDING_MODEL_ID, type RagJsonlLogger } from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'

const RagChatRequestSchema = z.object({ question: z.string().min(1) })

export function registerRagChatRoute(app: FastifyInstance, env: ApiEnv, logger: RagJsonlLogger): void {
  const pool = createReadonlyPool(env.databaseUrlReadonly)

  app.post('/api/rag/chat', async (request, reply) => {
    const parsed = RagChatRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "question" mező kötelező.' })
    }

    const result = await askRag(parsed.data.question, {
      anthropicApiKey: env.anthropicApiKey,
      anthropicModel: env.anthropicModel,
      openaiApiKey: env.openaiApiKey,
      embeddingModel: EMBEDDING_MODEL_ID,
      pool,
      logger,
    })

    return reply.send(result)
  })
}
