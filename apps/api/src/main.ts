process.loadEnvFile()

import cors from '@fastify/cors'
import { createJsonlLogger, createRagJsonlLogger, createReadonlyPool } from '@plantbase/core'
import Fastify from 'fastify'
import { loadApiEnvFromEnv } from './config/env'
import { registerAskRoute } from './routes/ask.route'
import { registerQuotesRoute } from './routes/quotes.route'
import { registerRagChatRoute } from './routes/rag-chat.route'

async function main(): Promise<void> {
  const env = loadApiEnvFromEnv()
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: env.corsOrigin })

  const askLogger = createJsonlLogger()
  const ragLogger = createRagJsonlLogger()
  const runSqlPool = createReadonlyPool(env.databaseUrlReadonly)

  registerAskRoute(app, env, askLogger, runSqlPool)
  registerRagChatRoute(app, env, ragLogger)
  registerQuotesRoute(app)

  app.get('/health', async () => ({ status: 'ok' }))

  await app.listen({ port: env.port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
