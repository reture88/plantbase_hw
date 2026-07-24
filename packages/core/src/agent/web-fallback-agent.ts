import { createAnthropic } from '@ai-sdk/anthropic'
import { isStepCount, streamText } from 'ai'
import { WEB_SEARCH_TOOL_NAME, webSearchTool } from './web-search-tool'

const MAX_TOKENS = 1024
const MAX_TOOL_USE_TURNS = 5

const WEB_FALLBACK_SYSTEM_PROMPT = `<role>
Egy növényápolási szakértő asszisztens vagy. Ezt a kérdést a saját növényápolási tudásbázisunk NEM tudta megválaszolni — most a web_search eszközzel próbálsz meg hiteles választ találni rá az interneten.
</role>
<rules>
- Használd a web_search eszközt a kérdés megválaszolásához.
- Válaszolj természetes, közérthető magyar nyelven.
- Ha a webes keresés sem ad megbízható választ, mondd ki őszintén, hogy erre sem sikerült választ találnod — ne találj ki semmit.
</rules>`

export type WebFallbackConfig = {
  apiKey: string
  model: string
}

export type WebFallbackResult = {
  answer: string
}

export type WebFallbackStream = {
  textStream: AsyncIterable<string>
  result: Promise<WebFallbackResult>
}

/**
 * Az egységes chat-orchestrátor (`unified-agent.ts`) csak akkor hívja ezt,
 * amikor a tudásbázis (RAG) már bizonyítottan nem tudott válaszolni — ez NEM
 * a katalógus-agent egyik toolja, hanem egy önálló, utolsó lépésként induló
 * generálás, kifejezetten web_search-csel.
 */
export function streamWebFallbackAnswer(question: string, config: WebFallbackConfig): WebFallbackStream {
  const anthropic = createAnthropic({ apiKey: config.apiKey })

  let streamError: unknown
  const streamResult = streamText({
    model: anthropic(config.model),
    system: WEB_FALLBACK_SYSTEM_PROMPT,
    prompt: question,
    maxOutputTokens: MAX_TOKENS,
    tools: { [WEB_SEARCH_TOOL_NAME]: webSearchTool },
    stopWhen: isStepCount(MAX_TOOL_USE_TURNS),
    onError: (event) => {
      streamError = event.error
    },
  })

  const result = (async (): Promise<WebFallbackResult> => {
    try {
      const text = await streamResult.text
      return { answer: text || 'Nem sikerült választ találnom erre a kérdésre.' }
    } catch (error) {
      throw streamError ?? error
    }
  })()

  return { textStream: streamResult.textStream, result }
}
