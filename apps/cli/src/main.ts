import { Command } from 'commander'
import { registerAskCommand } from './commands/ask.command'
import { startInteractiveLoop } from './interactive/interactive-loop'

const program = new Command()

program.name('plantbase').description('Plantbase — AI agent a növény-katalógushoz').version('0.1.0')

registerAskCommand(program)

if (process.argv.length <= 2) {
  startInteractiveLoop()
} else {
  program.parse()
}
