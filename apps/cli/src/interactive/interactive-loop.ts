import { createInterface } from 'node:readline'
import { askAgent, type JsonlLogger } from '@plantbase/core'
import type { Pool } from 'pg'
import type { AgentConfig } from '../config/agent-config'
import { saveQuoteIfRequested } from '../export/quote-export'

export function startInteractiveLoop(agentConfig: AgentConfig, logger: JsonlLogger, runSqlPool: Pool): void {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'plantbase> ',
  })

  console.log('Plantbase interaktív mód. Írd be a kérdésed, vagy "exit" a kilépéshez.')
  rl.prompt()

  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (trimmed === 'exit') {
      rl.close()
      return
    }

    rl.pause()
    void (async () => {
      try {
        const result = await askAgent(trimmed, { ...agentConfig, logger, runSqlPool })
        console.log(result.answer)
        await saveQuoteIfRequested(result.answer, result.wantsFileExport, agentConfig)
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Ismeretlen hiba történt.')
      } finally {
        rl.resume()
        rl.prompt()
      }
    })()
  })

  rl.on('close', () => {
    console.log('Viszlát!')
    process.exit(0)
  })
}
