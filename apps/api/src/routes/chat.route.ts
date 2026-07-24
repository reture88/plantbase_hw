import {
  EMBEDDING_MODEL_ID,
  HELPER_MODEL_ID,
  saveGeneratedDocument,
  streamUnifiedChat,
  type JsonlLogger,
  type RagJsonlLogger,
} from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'
import { endSse, startSse } from '../sse'

const ChatRequestSchema = z.object({ question: z.string().min(1) })

export function registerChatRoute(app: FastifyInstance, env: ApiEnv, pool: Pool, logger: JsonlLogger, ragLogger: RagJsonlLogger): void {
  app.post('/api/chat', async (request, reply) => {
    const parsed = ChatRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "question" mező kötelező.' })
    }

    const chatConfig = {
      anthropicApiKey: env.anthropicApiKey,
      anthropicModel: env.anthropicModel,
      openaiApiKey: env.openaiApiKey,
      embeddingModel: EMBEDDING_MODEL_ID,
      helperModel: HELPER_MODEL_ID,
      pool,
      logger,
      ragLogger,
    }

    let stream: Awaited<ReturnType<typeof streamUnifiedChat>>
    try {
      stream = await streamUnifiedChat(parsed.data.question, chatConfig)
    } catch (error) {
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    }

    const send = startSse(reply)
    try {
      for await (const event of stream.events) {
        send(event)
      }
      const result = await stream.result

      const documentFormat = result.source === 'catalog' ? 'xlsx' : 'pdf'
      const savedDocument = await saveGeneratedDocument(result.answer, documentFormat, result.wantsFileExport, {
        apiKey: env.anthropicApiKey,
        model: env.anthropicModel,
      })

      send({
        type: 'done',
        source: result.source,
        sources: result.sources,
        fileUrl: savedDocument ? `/api/quotes/${encodeURIComponent(savedDocument.filename)}` : undefined,
        fileFormat: savedDocument ? documentFormat : undefined,
      })
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    } finally {
      endSse(reply)
    }
  })
}
