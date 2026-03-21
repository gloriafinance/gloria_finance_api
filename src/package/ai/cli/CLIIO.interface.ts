import { createInterface } from "node:readline/promises"
import { stdin, stdout, stderr } from "node:process"

export type CLIIO = {
  writeLine(message: string): void
  writeError(message: string): void
  prompt(message: string): Promise<string>
  close?(): void
}

export const createNodeCLIIO = (): CLIIO => {
  const readline = createInterface({ input: stdin, output: stdout })

  return {
    writeLine(message: string) {
      stdout.write(`${message}\n`)
    },
    writeError(message: string) {
      stderr.write(`${message}\n`)
    },
    async prompt(message: string): Promise<string> {
      return readline.question(message)
    },
    close() {
      readline.close()
    },
  }
}
