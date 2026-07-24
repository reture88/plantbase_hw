import { anthropic } from '@ai-sdk/anthropic'
import type { Tool } from 'ai'

export const WEB_SEARCH_TOOL_NAME = 'web_search'

/**
 * Anthropic hivatalos, szerver-oldali web_search toolja — a `@ai-sdk/anthropic`
 * providerben beépített, konfigurálható tool-factory adja (nem kell saját
 * tool-definíciót írnunk hozzá, mint a runSql/listCategories esetén).
 *
 * A `webSearch_20260209` variáns az Anthropic API-oldalon alapértelmezetten
 * "programmatic tool calling"-ot igényel (`allowed_callers` a code_execution
 * hívóra is engedélyezett) — ezt a Haiku modellcsalád nem támogatja, és az
 * AI SDK erre a tool-verzióra jelenleg nem is enged `allowed_callers`
 * felülbírálást. A `webSearch_20250305` a régebbi, egyszerűbb tool-alak,
 * ami nincs ehhez a keretrendszerhez kötve — ugyanazt a keresési
 * funkcionalitást adja, modelltől függetlenül működik.
 */
export const webSearchTool: Tool = anthropic.tools.webSearch_20250305()
