import type { Command } from 'commander'
import { echo } from '@plantbase/core'

export function registerAskCommand(program: Command): void {
  program
    .command('ask')
    .description('Egyszeri kérdés feltevése')
    .argument('<question>', 'a kérdésed')
    .action((question: string) => {
      console.log(echo(question))
    })
}
