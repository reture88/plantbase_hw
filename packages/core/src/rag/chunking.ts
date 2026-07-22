import type { ParsedKnowledgeDocument, RawParagraph } from './types'

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const HEADING_PATTERN = /^#{1,6}\s+(.*)$/
const MIN_PARAGRAPH_LENGTH = 20

/**
 * A scrapelt cikkek végén marketing-lábléc van ("Perfect Pairings For Your
 * Plants" termékajánló blokk + "Words By The Sill" szerkesztőségi szöveg) —
 * ez nem cikktartalom, chunkolás előtt le kell vágni, különben minden cikk
 * vége termékreklámmal szennyezi a keresési találatokat.
 */
const BOILERPLATE_MARKERS = ['## Perfect Pairings For Your Plants']

function stripFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const match = raw.match(FRONTMATTER_PATTERN)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    frontmatter[key] = value
  }

  return { frontmatter, body: raw.slice(match[0].length) }
}

function stripBoilerplate(body: string): string {
  let cutIndex = body.length
  for (const marker of BOILERPLATE_MARKERS) {
    const markerIndex = body.indexOf(marker)
    if (markerIndex !== -1) {
      cutIndex = Math.min(cutIndex, markerIndex)
    }
  }
  return body.slice(0, cutIndex)
}

function splitIntoParagraphs(body: string): RawParagraph[] {
  const paragraphs: RawParagraph[] = []
  let currentHeading: string | null = null
  let buffer: string[] = []

  const flush = () => {
    const content = buffer.join(' ').trim()
    buffer = []
    if (content.length < MIN_PARAGRAPH_LENGTH) return
    paragraphs.push({ heading: currentHeading, content })
  }

  for (const line of body.split(/\r?\n/)) {
    const headingMatch = line.match(HEADING_PATTERN)
    if (headingMatch) {
      flush()
      currentHeading = headingMatch[1].replace(/[*_]/g, '').trim()
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    buffer.push(line.trim())
  }
  flush()

  return paragraphs
}

/**
 * `filename` a `seed/knowledge/`-beli fájl neve kiterjesztés nélkül
 * (pl. `ask-the-sill__best-low-light-plant`) — ez lesz a `KnowledgeDocument.slug`,
 * mert a fájlnév-konvenció már eleve egyedi, ember-olvasható azonosító.
 */
export function parseKnowledgeMarkdown(filename: string, raw: string): ParsedKnowledgeDocument {
  const { frontmatter, body } = stripFrontmatter(raw)
  const withoutBoilerplate = stripBoilerplate(body)
  const paragraphs = splitIntoParagraphs(withoutBoilerplate)

  return {
    slug: filename,
    title: frontmatter['title'] ?? filename,
    source: frontmatter['source'] ?? '',
    category: frontmatter['category'] ?? '',
    paragraphs,
  }
}
