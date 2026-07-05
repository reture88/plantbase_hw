import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// @prisma/client is intentionally a ROOT-only dependency (not also declared in
// packages/db/package.json): the prisma-client-js generator requires @prisma/client
// to resolve as a sibling of the `prisma` CLI package. A local copy in packages/db
// would shadow the root one during Node's directory walk and break `prisma generate`.
export default defineConfig({
  schema: 'packages/db/prisma/schema.prisma',
  migrations: {
    path: 'packages/db/prisma/migrations',
    seed: 'tsx packages/db/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
