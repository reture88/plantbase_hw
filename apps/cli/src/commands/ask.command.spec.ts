import { Command } from 'commander'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const askAgentMock = vi.fn()
const saveQuoteIfRequestedMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  askAgent: askAgentMock,
}))

vi.mock('../export/quote-export', () => ({
  saveQuoteIfRequested: saveQuoteIfRequestedMock,
}))

const { registerAskCommand } = await import('./ask.command')

beforeEach(() => {
  saveQuoteIfRequestedMock.mockReset()
})

const fakePool = {} as import('pg').Pool

describe('ask command', () => {
  it('should print the agent answer to the console', async () => {
    askAgentMock.mockResolvedValueOnce({
      answer: 'Szia! Miben segíthetek?',
      systemPrompt: 'rendszerprompt',
      messages: [{ role: 'user', content: 'szia' }],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    })
    const program = new Command()
    registerAskCommand(
      program,
      { apiKey: 'test-key', model: 'claude-test' },
      { filePath: 'fake.jsonl', append: vi.fn() },
      fakePool,
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await program.parseAsync(['ask', 'szia'], { from: 'user' })

    expect(askAgentMock).toHaveBeenCalledWith('szia', expect.objectContaining({ apiKey: 'test-key' }))
    expect(logSpy).toHaveBeenCalledWith('Szia! Miben segíthetek?')
    logSpy.mockRestore()
  })

  it('should ask the shared export helper to save a quote when the classifier detected an export instruction', async () => {
    askAgentMock.mockResolvedValueOnce({
      answer: 'Van kaktuszunk 3500 Ft-ért.',
      systemPrompt: 'rendszerprompt',
      messages: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      wantsFileExport: true,
    })
    const program = new Command()
    registerAskCommand(
      program,
      { apiKey: 'test-key', model: 'claude-test' },
      { filePath: 'fake.jsonl', append: vi.fn() },
      fakePool,
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await program.parseAsync(['ask', 'Van e kaktusz 5000Ft-ért? ha igen a listát mentsd ki fileba'], { from: 'user' })

    expect(saveQuoteIfRequestedMock).toHaveBeenCalledWith('Van kaktuszunk 3500 Ft-ért.', true, {
      apiKey: 'test-key',
      model: 'claude-test',
    })
    logSpy.mockRestore()
  })

  it('should print the system prompt and messages when --show-prompt is passed', async () => {
    askAgentMock.mockResolvedValueOnce({
      answer: 'Szia!',
      systemPrompt: 'rendszerprompt',
      messages: [{ role: 'user', content: 'szia' }],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    })
    const program = new Command()
    registerAskCommand(
      program,
      { apiKey: 'test-key', model: 'claude-test' },
      { filePath: 'fake.jsonl', append: vi.fn() },
      fakePool,
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await program.parseAsync(['ask', 'szia', '--show-prompt'], { from: 'user' })

    expect(logSpy).toHaveBeenCalledWith('rendszerprompt')
    logSpy.mockRestore()
  })
})
