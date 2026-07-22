import { generateText, type LanguageModel } from 'ai'

const SYSTEM_PROMPT = `<role>
Egy növényápolási szakértő vagy. A feladatod NEM az, hogy a felhasználónak válaszolj — hanem hogy megírd, milyen egy IDEÁLIS, jól megírt válasz lenne a kérdésére.
</role>
<rules>
- Írj egy hipotetikus, magabiztos, ténybeli válasz-bekezdést, mintha egy növényápolási cikkből származna.
- Ha nem tudod biztosan a választ, akkor is írj egy plauzibilis, jellegzetes szakmai választ — ez csak keresési célt szolgál, nem kerül a felhasználó elé.
- Rövid legyen (2-4 mondat).
</rules>`

export type HydeGenerator = (question: string) => Promise<string>

/**
 * HyDE (Hypothetical Document Embeddings): a nyers kérdés helyett egy
 * hipotetikus "ideális válasz" embeddingjével keresünk — ez jellemzően
 * közelebb esik a tudásbázisban tényleg meglévő válasz-szerű
 * szövegekhez, mint maga a kérdés.
 */
export function createHydeGenerator(model: LanguageModel): HydeGenerator {
  return async (question: string): Promise<string> => {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `<question>${question}</question>`,
      maxOutputTokens: 300,
    })
    return result.text
  }
}
