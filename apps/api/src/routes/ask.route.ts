import { saveGeneratedQuote, streamAskAgent, type JsonlLogger } from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'
import { endSse, startSse } from '../sse'

const AskRequestSchema = z.object({ question: z.string().min(1) })

export function registerAskRoute(app: FastifyInstance, env: ApiEnv, logger: JsonlLogger, runSqlPool: Pool): void {
  app.post('/api/ask', async (request, reply) => {
    const parsed = AskRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "question" mező kötelező.' })
    }

    const agentConfig = { apiKey: env.anthropicApiKey, model: env.anthropicModel }

    let stream: Awaited<ReturnType<typeof streamAskAgent>>
    try {
      stream = await streamAskAgent(parsed.data.question, { ...agentConfig, logger, runSqlPool })
    } catch (error) {
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    }

    const send = startSse(reply)
    try {
      for await (const delta of stream.textStream) {
        send({ type: 'text-delta', text: delta })
      }
      const result = await stream.result
      const savedQuote = await saveGeneratedQuote(result.answer, result.wantsFileExport, agentConfig)
      send({ type: 'done', quoteUrl: savedQuote ? `/api/quotes/${encodeURIComponent(savedQuote.filename)}` : undefined })
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    } finally {
      endSse(reply)
    }
  })
}
