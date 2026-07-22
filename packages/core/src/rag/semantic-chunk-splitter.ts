import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'

const SplitResultSchema = z.object({
  chunks: z.array(z.string().min(1)).min(1),
})

const SYSTEM_PROMPT = `<role>
Egy szövegdaraboló asszisztens vagy, ami egyetlen bekezdést vizsgál meg egy növényápolási cikkből.
</role>
<rules>
- Ha a bekezdés egyetlen, összefüggő gondolatot fejt ki, add vissza változatlanul, egyetlen elemű tömbként.
- Ha a bekezdés több, jelentésében egymástól elváló mondatcsoportot tartalmaz (pl. világítás + öntözés egy bekezdésbe zsúfolva), bontsd szét külön elemekre, mondatcsoportonként — minden elem önmagában is érthető maradjon.
- Ne fogalmazz át, ne rövidíts, ne adj hozzá információt — csak vágd szét a meglévő mondatokat.
- A tömb elemeinek összefűzve (szóközzel) az eredeti szöveg tartalmát kell lefedniük.
</rules>`

export type SemanticChunkSplitter = (paragraph: string) => Promise<string[]>

export function createSemanticChunkSplitter(model: LanguageModel): SemanticChunkSplitter {
  return async (paragraph: string): Promise<string[]> => {
    try {
      const result = await generateObject({
        model,
        system: SYSTEM_PROMPT,
        prompt: `<paragraph>${paragraph}</paragraph>`,
        schema: SplitResultSchema,
        maxOutputTokens: 1024,
      })
      return result.object.chunks
    } catch {
      // Fail-safe: ha az elemzés meghiúsul, a bekezdés egyetlen chunkként megy tovább —
      // ez sosem rosszabb, mint a jelenlegi (nem finomított) bekezdés-szintű chunkolás.
      return [paragraph]
    }
  }
}
