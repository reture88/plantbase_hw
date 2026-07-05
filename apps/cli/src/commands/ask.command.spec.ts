import { Command } from 'commander'
import { describe, expect, it, vi } from 'vitest'

const askAgentMock = vi.fn()

vi.mock('@plantbase/core', () => ({
  askAgent: askAgentMock,
}))

const { registerAskCommand } = await import('./ask.command')

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
