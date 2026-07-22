export type ApiEnv = {
  port: number
  corsOrigin: string
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  databaseUrlReadonly: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Hiányzik a(z) ${name} környezeti változó (.env).`)
  }
  return value
}

export function loadApiEnvFromEnv(): ApiEnv {
  return {
    port: Number(process.env.PORT ?? 3333),
    corsOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
    anthropicModel: requireEnv('ANTHROPIC_MODEL'),
    openaiApiKey: requireEnv('OPENAI_API_KEY'),
    databaseUrlReadonly: requireEnv('DATABASE_URL_READONLY'),
  }
}
