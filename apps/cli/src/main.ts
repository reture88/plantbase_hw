process.loadEnvFile()

import { Command } from 'commander'
import { createJsonlLogger, createReadonlyPool } from '@plantbase/core'
import { registerAskCommand } from './commands/ask.command'
import { loadAgentConfigFromEnv, loadReadonlyDatabaseUrlFromEnv } from './config/agent-config'
import { startInteractiveLoop } from './interactive/interactive-loop'

const program = new Command()

program.name('plantbase').description('Plantbase — AI agent a növény-katalógushoz').version('0.1.0')

const agentConfig = loadAgentConfigFromEnv()
const logger = createJsonlLogger()
const runSqlPool = createReadonlyPool(loadReadonlyDatabaseUrlFromEnv())

registerAskCommand(program, agentConfig, logger, runSqlPool)

if (process.argv.length <= 2) {
  startInteractiveLoop(agentConfig, logger, runSqlPool)
} else {
  program.parseAsync()
}
