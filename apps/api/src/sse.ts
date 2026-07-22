import type { FastifyReply } from 'fastify'

/**
 * `reply.hijack()` mondja meg Fastify-nak, hogy a választ mostantól kézzel
 * kezeljük (`reply.raw`-on) — enélkül Fastify a route-handler visszatérése
 * után megpróbálná lezárni/felülírni a választ, ami eltörné a streamet.
 */
export function startSse(reply: FastifyReply): (event: unknown) => void {
  reply.hijack()
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  return (event: unknown) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
  }
}

export function endSse(reply: FastifyReply): void {
  reply.raw.end()
}
