import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const QUOTES_DIR = 'quotes'

export function registerQuotesRoute(app: FastifyInstance): void {
  app.get<{ Params: { filename: string } }>('/api/quotes/:filename', async (request, reply) => {
    // `basename` levágja az esetleges elérési út-részeket a paraméterből,
    // hogy a kérés ne tudjon a quotes/ mappán kívülre mutatni (path traversal).
    const safeFilename = basename(request.params.filename)

    try {
      const fileBuffer = await readFile(join(QUOTES_DIR, safeFilename))
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${safeFilename}"`)
        .send(fileBuffer)
    } catch {
      return reply.status(404).send({ error: 'A fájl nem található.' })
    }
  })
}
