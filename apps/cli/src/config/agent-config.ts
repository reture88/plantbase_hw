export type AgentConfig = {
  apiKey: string
  model: string
}

export function loadAgentConfigFromEnv(): AgentConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL

  if (!apiKey) {
    throw new Error('Hiányzik az ANTHROPIC_API_KEY környezeti változó (.env).')
  }
  if (!model) {
    throw new Error('Hiányzik az ANTHROPIC_MODEL környezeti változó (.env).')
  }

  return { apiKey, model }
}

export function loadReadonlyDatabaseUrlFromEnv(): string {
  const databaseUrlReadonly = process.env.DATABASE_URL_READONLY

  if (!databaseUrlReadonly) {
    throw new Error('Hiányzik a DATABASE_URL_READONLY környezeti változó (.env).')
  }

  return databaseUrlReadonly
}
