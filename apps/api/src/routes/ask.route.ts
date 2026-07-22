import { askAgent, saveGeneratedQuote, type JsonlLogger } from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'

const AskRequestSchema = z.object({ question: z.string().min(1) })

export function registerAskRoute(app: FastifyInstance, env: ApiEnv, logger: JsonlLogger, runSqlPool: Pool): void {
  app.post('/api/ask', async (request, reply) => {
    const parsed = AskRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "question" mező kötelező.' })
    }

    const agentConfig = { apiKey: env.anthropicApiKey, model: env.anthropicModel }
    const result = await askAgent(parsed.data.question, { ...agentConfig, logger, runSqlPool })
    const savedQuote = await saveGeneratedQuote(result.answer, result.wantsFileExport, agentConfig)

    return reply.send({
      answer: result.answer,
      quoteUrl: savedQuote ? `/api/quotes/${encodeURIComponent(savedQuote.filename)}` : undefined,
    })
  })
}
