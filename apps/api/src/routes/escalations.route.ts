import { listOpenEscalations, resolveEscalation } from '@plantbase/core'
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

/**
 * Kizárólag a belső (staff) nézetnek — a numerikus `id`-t itt biztonságos
 * kulcsként használni, mert a hozzáférést a token-ellenőrzés adja, nem az
 * azonosító kitalálhatatlansága. Az ügyfél-oldali pollozó végpont (amihez
 * NINCS hitelesítés) emiatt NEM itt van, hanem `customer-chat.route.ts`-ben,
 * és külön, opaque tokent használ (lásd `escalation-repository.ts`).
 */
export function registerInternalEscalationsRoute(app: FastifyInstance, env: ApiEnv, escalationPool: Pool): void {
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
}
