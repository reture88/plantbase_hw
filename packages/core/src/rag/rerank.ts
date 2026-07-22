import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import type { RetrievedChunk } from './types'

const RerankResultSchema = z.object({
  rankedChunkIds: z.array(z.number()).describe('A chunk id-k relevancia szerint csökkenő sorrendben; irreleváns chunk id-t hagyd ki.'),
})

const SYSTEM_PROMPT = `<role>
Egy relevancia-rangsoroló asszisztens vagy. Egy felhasználói kérdéshez és jelölt szövegrészletekhez (chunkokhoz) kapsz — a vektor-keresés nem 100%-osan pontos, a te feladatod az ÉRDEMI relevancia szerint újrarendezni őket.
</role>
<rules>
- Csak azokat a chunk id-kat add vissza, amik ténylegesen segítenek megválaszolni a kérdést.
- A legrelevánsabb legyen elöl.
- Ha egyetlen chunk sem releváns, üres tömböt adj vissza.
</rules>`

export type Reranker = (question: string, candidates: RetrievedChunk[]) => Promise<RetrievedChunk[]>

export function createReranker(model: LanguageModel, topK: number): Reranker {
  return async (question: string, candidates: RetrievedChunk[]): Promise<RetrievedChunk[]> => {
    if (candidates.length === 0) return []

    const candidateList = candidates.map((c) => `<chunk id="${c.id}">${c.content}</chunk>`).join('\n')

    try {
      const result = await generateObject({
        model,
        system: SYSTEM_PROMPT,
        prompt: `<question>${question}</question>\n<candidates>\n${candidateList}\n</candidates>`,
        schema: RerankResultSchema,
        maxOutputTokens: 512,
      })

      const byId = new Map(candidates.map((c) => [c.id, c]))
      const ranked = result.object.rankedChunkIds.map((id) => byId.get(id)).filter((c): c is RetrievedChunk => c !== undefined)
      return ranked.slice(0, topK)
    } catch {
      // Fail-safe: ha a rerank meghiúsul, a vektor-hasonlóság szerinti sorrendet használjuk —
      // ez sosem rosszabb, mint rerank nélkül visszaadni a nyers találatokat.
      return candidates.slice(0, topK)
    }
  }
}
