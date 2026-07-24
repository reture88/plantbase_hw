import { createOpenAI } from '@ai-sdk/openai'
import { describe, expect, it } from 'vitest'
import { createSemanticChunkSplitter } from './semantic-chunk-splitter'
import { HELPER_MODEL_ID } from './model-ids'

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url))
} catch {
  // .env hiányozhat (pl. CI-ban) — ilyenkor az alábbi describe.skip lép életbe
}

const apiKey = process.env.OPENAI_API_KEY
const describeIfOpenAiKey = apiKey ? describe : describe.skip

/**
 * Ez a teszt a `HELPER_MODEL_ID` (gpt-5.4-mini) VALÓDI hívásával ellenőrzi,
 * hogy a szemantikus chunk-split stratégia ténylegesen működik — nem csak
 * azt, hogy a kód helyesen hívja meg a modellt (ezt a mockolt
 * `semantic-chunk-splitter.spec.ts` már lefedi). Költséghatékony: két rövid,
 * célzottan megválasztott bekezdéssel fut.
 */
describeIfOpenAiKey('createSemanticChunkSplitter (integration, real gpt-5.4-mini call)', () => {
  const openai = createOpenAI({ apiKey: apiKey as string })
  const split = createSemanticChunkSplitter(openai(HELPER_MODEL_ID))

  it('splits a paragraph that crams two topically distinct sentences together', async () => {
    // Két, egymástól független, önállóan is értelmes mondat egy bekezdésbe zsúfolva —
    // ez a valódi célesete a splitternek (nem egy nyelvtanilag összetartozó,
    // "X-szel szemben Y" jellegű összehasonlító mondat, amit a modell jogosan
    // egyben hagyhat, mert grammatikailag egyetlen gondolat).
    const paragraph =
      'A kaktuszok direkt napfényt igényelnek. Öntözni csak ritkán, néhány hetente kell őket. A páfrányok viszont árnyékos helyet szeretnek. A talajuknak mindig nedvesnek kell maradnia.'

    const chunks = await split(paragraph)

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.join(' ')).toContain('kaktusz')
    expect(chunks.join(' ')).toContain('páfrány')
  }, 30_000)

  it('keeps a single-topic paragraph as one chunk', async () => {
    const paragraph = 'Az aloe vera egy pozsgás növény, ami a direkt napfényt jól tűri, és csak akkor kell öntözni, ha a talaja teljesen kiszáradt.'

    const chunks = await split(paragraph)

    expect(chunks).toHaveLength(1)
  }, 30_000)
})
