import type { CommandHandler } from './types'

export class CommandRegistry {
  private commands = new Map<string, CommandHandler>()

  register(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler)
  }

  get(name: string): CommandHandler | undefined {
    return this.commands.get(name)
  }

  has(name: string): boolean {
    return this.commands.has(name)
  }

  list(): string[] {
    return [...this.commands.keys()].sort()
  }
}
