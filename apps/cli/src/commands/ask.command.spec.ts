import { Command } from 'commander'
import { describe, expect, it, vi } from 'vitest'
import { registerAskCommand } from './ask.command'

describe('ask command', () => {
  it('should echo the question back to the console', () => {
    const program = new Command()
    registerAskCommand(program)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    program.parse(['ask', 'szia'], { from: 'user' })

    expect(logSpy).toHaveBeenCalledWith('szia')
    logSpy.mockRestore()
  })
})
