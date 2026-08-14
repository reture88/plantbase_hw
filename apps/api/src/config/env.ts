export type ApiEnv = {
  port: number
  corsOrigin: string
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  databaseUrlReadonly: string
  databaseUrl: string
  /**
   * Kill-switch: az ügyfélirányú chat és a hozzá tartozó eszkalációs
   * route-ok csak akkor regisztrálódnak, ha ez `true` — false esetén a
   * végpontok ténylegesen nem is léteznek, nem csak "el vannak rejtve".
   * Ez a konkrét, kódolt válasz a kérdéslap "visszavehetőség" kérdésére.
   */
  customerChatEnabled: boolean
  internalToken: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Hiányzik a(z) ${name} környezeti változó (.env).`)
  }
  return value
}

export function loadApiEnvFromEnv(): ApiEnv {
  const customerChatEnabled = (process.env.CUSTOMER_CHAT_ENABLED ?? 'true') !== 'false'

  return {
    port: Number(process.env.PORT ?? 3333),
    corsOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
    anthropicModel: requireEnv('ANTHROPIC_MODEL'),
    openaiApiKey: requireEnv('OPENAI_API_KEY'),
    databaseUrlReadonly: requireEnv('DATABASE_URL_READONLY'),
    databaseUrl: requireEnv('DATABASE_URL'),
    customerChatEnabled,
    // Csak akkor kötelező, ha az ügyfél-ág ténylegesen fut — kikapcsolt
    // állapotban (demó/teszt) ne kelljen beállítani.
    internalToken: customerChatEnabled ? requireEnv('INTERNAL_TOKEN') : (process.env.INTERNAL_TOKEN ?? ''),
  }
}
