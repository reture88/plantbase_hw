import { describe, expect, it } from 'vitest'
import { parseKnowledgeMarkdown } from './chunking'

const SAMPLE_MD = `---
title: How to Care for a Snake Plant
source: https://www.thesill.com/blogs/ask-the-sill/how-to-care-for-a-snake-plant
category: plants-101
---

# How to Care for a Snake Plant

By The Sill

### What kind of light does a snake plant need?

Snake plants tolerate low light well, but grow fastest in bright, indirect light. Avoid direct, harsh afternoon sun, which can scorch the leaves.

### How often should I water my snake plant?

Water only when the soil is completely dry, roughly every two to three weeks. Snake plants are highly drought-tolerant succulents and overwatering is the most common cause of death.

## Perfect Pairings For Your Plants

* ### Premium Potting Mix
  From $19
  Best Seller

##### Words By The Sill

Empowering all people to be plant people.
`

describe('parseKnowledgeMarkdown', () => {
  it('extracts frontmatter metadata and uses the filename as slug', () => {
    const result = parseKnowledgeMarkdown('ask-the-sill__snake-plant', SAMPLE_MD)

    expect(result.slug).toBe('ask-the-sill__snake-plant')
    expect(result.title).toBe('How to Care for a Snake Plant')
    expect(result.source).toBe('https://www.thesill.com/blogs/ask-the-sill/how-to-care-for-a-snake-plant')
    expect(result.category).toBe('plants-101')
  })

  it('splits the body into paragraphs tagged with the nearest preceding heading', () => {
    const result = parseKnowledgeMarkdown('ask-the-sill__snake-plant', SAMPLE_MD)

    const headings = result.paragraphs.map((p) => p.heading)
    expect(headings).toContain('What kind of light does a snake plant need?')
    expect(headings).toContain('How often should I water my snake plant?')

    const lightParagraph = result.paragraphs.find((p) => p.heading === 'What kind of light does a snake plant need?')
    expect(lightParagraph?.content).toContain('bright, indirect light')
  })

  it('strips the marketing boilerplate footer so it never becomes a chunk', () => {
    const result = parseKnowledgeMarkdown('ask-the-sill__snake-plant', SAMPLE_MD)

    const allContent = result.paragraphs.map((p) => p.content).join(' ')
    expect(allContent).not.toContain('Premium Potting Mix')
    expect(allContent).not.toContain('Words By The Sill')
  })

  it('drops trivial short lines (bylines, stray markers) that are not real content', () => {
    const result = parseKnowledgeMarkdown('ask-the-sill__snake-plant', SAMPLE_MD)

    const allContent = result.paragraphs.map((p) => p.content)
    expect(allContent).not.toContain('By The Sill')
  })

  it('falls back to an empty paragraph list and filename-derived metadata when there is no frontmatter', () => {
    const result = parseKnowledgeMarkdown('no-frontmatter', '# Just a title\n\nSome short text.')

    expect(result.title).toBe('no-frontmatter')
    expect(result.source).toBe('')
    expect(result.category).toBe('')
  })
})
