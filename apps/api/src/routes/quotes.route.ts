import { readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const QUOTES_DIR = 'quotes'

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
}
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

export function registerQuotesRoute(app: FastifyInstance): void {
  app.get<{ Params: { filename: string } }>('/api/quotes/:filename', async (request, reply) => {
    // `basename` levágja az esetleges elérési út-részeket a paraméterből,
    // hogy a kérés ne tudjon a quotes/ mappán kívülre mutatni (path traversal).
    const safeFilename = basename(request.params.filename)
    const contentType = CONTENT_TYPE_BY_EXTENSION[extname(safeFilename).toLowerCase()] ?? DEFAULT_CONTENT_TYPE

    try {
      const fileBuffer = await readFile(join(QUOTES_DIR, safeFilename))
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${safeFilename}"`)
        .send(fileBuffer)
    } catch {
      return reply.status(404).send({ error: 'A fájl nem található.' })
    }
  })
}
