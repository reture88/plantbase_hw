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

/** A tudásbázis-ingestion írja ezzel a kapcsolattal a knowledge_documents/knowledge_chunks táblákat. */
export function loadWritableDatabaseUrlFromEnv(): string {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Hiányzik a DATABASE_URL környezeti változó (.env).')
  }

  return databaseUrl
}

/** Az embedding-modell (OpenAI) API-kulcsa — csak az `ingest-knowledge` parancshoz és a RAG-kereséshez kell. */
export function loadOpenAiApiKeyFromEnv(): string {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Hiányzik az OPENAI_API_KEY környezeti változó (.env) — ez az embedding-modellhez szükséges.')
  }

  return apiKey
}
