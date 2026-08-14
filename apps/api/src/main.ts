process.loadEnvFile()

import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { createJsonlLogger, createRagJsonlLogger, createReadonlyPool, createWritePool } from '@plantbase/core'
import Fastify from 'fastify'
import { loadApiEnvFromEnv } from './config/env'
import { registerChatRoute } from './routes/chat.route'
import { registerCustomerChatRoute } from './routes/customer-chat.route'
import { registerEscalationsRoute } from './routes/escalations.route'
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

  // Az ügyfélirányú chat + a hozzá tartozó eszkalációs végpontok csak akkor
  // regisztrálódnak, ha a kill-switch bekapcsolva van — kikapcsolva ezek a
  // route-ok TÉNYLEGESEN nem is léteznek (nem csak "el vannak rejtve").
  if (env.customerChatEnabled) {
    // Az eszkalációk saját, írható DB-poolon futnak (nem a runSql/RAG readonly poolján).
    const escalationPool = createWritePool(env.databaseUrl)

    // A nyilvános, hitelesítés nélküli végpont kap rate limitet (bárki hívhatja).
    await app.register(async (customerScope) => {
      await customerScope.register(rateLimit, { max: 20, timeWindow: '10 minutes' })
      registerCustomerChatRoute(customerScope, env, pool, escalationPool, logger, ragLogger)
    })
    // A belső (token-védett) eszkalációs végpontok NEM osztoznak a nyilvános
    // limiten — egy forgalmas customer-chat ne tudja kizárni a munkatársat
    // a saját sorának kezeléséből.
    registerEscalationsRoute(app, env, escalationPool)
  }

  app.get('/health', async () => ({ status: 'ok' }))

  await app.listen({ port: env.port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
