process.loadEnvFile()

import cors from '@fastify/cors'
import { createJsonlLogger, createRagJsonlLogger, createReadonlyPool } from '@plantbase/core'
import Fastify from 'fastify'
import { loadApiEnvFromEnv } from './config/env'
import { registerChatRoute } from './routes/chat.route'
import { registerQuotesRoute } from './routes/quotes.route'

async function main(): Promise<void> {
  const env = loadApiEnvFromEnv()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: env.corsOrigin })

  const logger = createJsonlLogger()
  const ragLogger = createRagJsonlLogger()
  // Egyetlen readonly pool — ezen fut a runSql/listCategories ÉS a RAG vektor-keresés is.
  const pool = createReadonlyPool(env.databaseUrlReadonly)

  registerChatRoute(app, env, pool, logger, ragLogger)
  registerQuotesRoute(app)

  app.get('/health', async () => ({ status: 'ok' }))

  await app.listen({ port: env.port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
