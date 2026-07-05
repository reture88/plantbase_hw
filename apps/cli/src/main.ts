process.loadEnvFile()

import { Command } from 'commander'
import { createJsonlLogger } from '@plantbase/core'
import { registerAskCommand } from './commands/ask.command'
import { loadAgentConfigFromEnv } from './config/agent-config'
import { startInteractiveLoop } from './interactive/interactive-loop'

const program = new Command()

program.name('plantbase').description('Plantbase — AI agent a növény-katalógushoz').version('0.1.0')

const agentConfig = loadAgentConfigFromEnv()
const logger = createJsonlLogger()

registerAskCommand(program, agentConfig, logger)

if (process.argv.length <= 2) {
  startInteractiveLoop(agentConfig, logger)
} else {
  program.parseAsync()
}
