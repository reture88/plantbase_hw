import { anthropic } from '@ai-sdk/anthropic'
import type { Tool } from 'ai'

export const WEB_SEARCH_TOOL_NAME = 'web_search'

/**
 * Anthropic hivatalos, szerver-oldali web_search toolja — a `@ai-sdk/anthropic`
 * providerben beépített, konfigurálható tool-factory adja (nem kell saját
 * tool-definíciót írnunk hozzá, mint a runSql/listCategories esetén).
 */
export const webSearchTool: Tool = anthropic.tools.webSearch_20260209()
