// Anthropic hivatalos, szerver-oldali tool — nincs kliens-oldali handler, a keresés
// Anthropic infrastruktúráján fut, az eredmény ugyanabban a válaszban érkezik vissza.
export const WEB_SEARCH_TOOL_NAME = 'web_search'

export const webSearchToolDefinition = {
  type: 'web_search_20260209',
  name: WEB_SEARCH_TOOL_NAME,
} as const
