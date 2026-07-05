import { createInterface } from 'node:readline'
import { echo } from '@plantbase/core'

export function startInteractiveLoop(): void {
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
    console.log(echo(trimmed))
    rl.prompt()
  })

  rl.on('close', () => {
    console.log('Viszlát!')
    process.exit(0)
  })
}
