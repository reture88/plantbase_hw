import { getEscalation, listOpenEscalations, resolveEscalation } from '@plantbase/core'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { ApiEnv } from '../config/env'

const ResolveEscalationSchema = z.object({ reply: z.string().min(1) })

/**
 * Nincs teljes auth-rendszer (ez egy PoC), de a belső eszkalációs
 * végpontokat sem hagyjuk teljesen nyitva — egy megosztott, env-ből jövő
 * tokent várunk `Authorization: Bearer <token>` fejlécben. Ez a konkrét,
 * kódolt válasz a "ki fér hozzá a naplózott adathoz" kötekedő kérdésre.
 */
function checkInternalToken(env: ApiEnv, authorizationHeader: string | undefined): boolean {
  return authorizationHeader === `Bearer ${env.internalToken}`
}

export function registerEscalationsRoute(app: FastifyInstance, env: ApiEnv, escalationPool: Pool): void {
  app.get('/api/internal/escalations', async (request, reply) => {
    if (!checkInternalToken(env, request.headers.authorization)) {
      return reply.status(401).send({ error: 'Érvénytelen vagy hiányzó belső token.' })
    }
    const escalations = await listOpenEscalations(escalationPool)
    return reply.send({ escalations })
  })

  app.post<{ Params: { id: string } }>('/api/internal/escalations/:id/resolve', async (request, reply) => {
    if (!checkInternalToken(env, request.headers.authorization)) {
      return reply.status(401).send({ error: 'Érvénytelen vagy hiányzó belső token.' })
    }
    const parsed = ResolveEscalationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'A "reply" mező kötelező.' })
    }
    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: 'Érvénytelen eszkaláció-azonosító.' })
    }

    const resolved = await resolveEscalation(escalationPool, id, parsed.data.reply)
    if (!resolved) {
      return reply.status(404).send({ error: 'Az eszkaláció nem található.' })
    }
    return reply.send({ escalation: resolved })
  })

  // Az ügyfél-widget ezt pollozza, amíg egy munkatárs fel nem oldja az esetet
  // — nincs autentikáció rajta, mert csak a saját (előzőleg kapott)
  // escalationId-jét kérdezheti le vele, más ügyfél adatát nem éri el.
  app.get<{ Params: { id: string } }>('/api/customer/escalations/:id', async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: 'Érvénytelen eszkaláció-azonosító.' })
    }
    const escalation = await getEscalation(escalationPool, id)
    if (!escalation) {
      return reply.status(404).send({ error: 'Az eszkaláció nem található.' })
    }
    return reply.send({ status: escalation.status, reply: escalation.reply })
  })
}
