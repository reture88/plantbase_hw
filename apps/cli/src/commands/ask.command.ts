import type { Command } from 'commander'
import { askAgent, type JsonlLogger } from '@plantbase/core'
import type { Pool } from 'pg'
import type { AgentConfig } from '../config/agent-config'

export function registerAskCommand(
  program: Command,
  agentConfig: AgentConfig,
  logger: JsonlLogger,
  runSqlPool: Pool,
): void {
  program
    .command('ask')
    .description('Egyszeri kérdés feltevése az agensnek')
    .argument('<question>', 'a kérdésed')
    .option('--show-prompt', 'a teljes system prompt és üzenetlista kiírása')
    .action(async (question: string, options: { showPrompt?: boolean }) => {
      const result = await askAgent(question, { ...agentConfig, logger, runSqlPool })

      if (options.showPrompt) {
        console.log('--- system prompt ---')
        console.log(result.systemPrompt)
        console.log('--- messages ---')
        console.log(JSON.stringify(result.messages, null, 2))
        console.log('--- válasz ---')
      }

      console.log(result.answer)
    })
}
