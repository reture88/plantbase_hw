import { EMBEDDING_MODEL_ID, getEscalationByToken, HELPER_MODEL_ID, saveGeneratedDocument, streamCustomerChat, type JsonlLogger, type RagJsonlLogger } from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'
import { endSse, startSse } from '../sse'

// Ügyfélirányú kérdés — hosszkorlátozva (a belső /api/chat-en nincs ilyen),
// mert ide bárki írhat a böngészőből, rate limittel együtt ez a két olcsó
// védelem a visszaélés/túlterhelés ellen.
const CustomerChatRequestSchema = z.object({ question: z.string().min(1).max(500) })

export function registerCustomerChatRoute(app: FastifyInstance, env: ApiEnv, pool: Pool, escalationPool: Pool, logger: JsonlLogger, ragLogger: RagJsonlLogger): void {
  app.post('/api/customer/chat', async (request, reply) => {
    const parsed = CustomerChatRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "question" mező kötelező, legfeljebb 500 karakter.' })
    }

    const chatConfig = {
      anthropicApiKey: env.anthropicApiKey,
      anthropicModel: env.anthropicModel,
      openaiApiKey: env.openaiApiKey,
      embeddingModel: EMBEDDING_MODEL_ID,
      helperModel: HELPER_MODEL_ID,
      pool,
      escalationPool,
      logger,
      ragLogger,
    }

    let stream: Awaited<ReturnType<typeof streamCustomerChat>>
    try {
      stream = await streamCustomerChat(parsed.data.question, chatConfig)
    } catch (error) {
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    }

    const send = startSse(reply)
    try {
      for await (const event of stream.events) {
        send(event)
      }
      const result = await stream.result

      // Excel-export ügyfél-ágon nincs (belső, katalógus-adminisztrációs
      // formátum) — csak grounded tudásbázis-válaszhoz kínálunk PDF-et.
      const savedDocument =
        result.source === 'knowledge_base'
          ? await saveGeneratedDocument(result.answer, 'pdf', result.wantsFileExport, { apiKey: env.anthropicApiKey, model: env.anthropicModel })
          : undefined

      send({
        type: 'done',
        source: result.source,
        sources: result.sources,
        escalationToken: result.escalationToken,
        fileUrl: savedDocument ? `/api/quotes/${encodeURIComponent(savedDocument.filename)}` : undefined,
        fileFormat: savedDocument ? 'pdf' : undefined,
      })
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' })
    } finally {
      endSse(reply)
    }
  })

  // A widget ezt pollozza, amíg egy munkatárs fel nem oldja az esetet.
  // Szándékosan NINCS hitelesítés rajta (nincs ügyfél-fiók/session, amihez
  // köthetnénk) — a védelmet a kitalálhatatlan, csak a saját eszkalációjához
  // kapott `token` adja (lásd `escalation-repository.ts` `getEscalationByToken`),
  // NEM a sorszámozott id (az kitalálható/végigszámolható lenne — IDOR).
  // Ugyanabban a rate-limitelt scope-ban fut, mint a POST /api/customer/chat.
  app.get<{ Params: { token: string } }>('/api/customer/escalations/:token', async (request, reply) => {
    const escalation = await getEscalationByToken(escalationPool, request.params.token)
    if (!escalation) {
      return reply.status(404).send({ error: 'Az eszkaláció nem található.' })
    }
    return reply.send({ status: escalation.status, reply: escalation.reply })
  })
}
