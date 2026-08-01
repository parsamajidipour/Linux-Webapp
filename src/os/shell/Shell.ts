import { expandVariables } from './expand'
import { expandGlob } from './glob'
import { parseLine, tokenize, type Statement, type Token } from './parser'
import type { CommandRegistry } from './registry'
import { fail, ok, type CommandResult, type ShellContext } from './types'

export class Shell {
  private registry: CommandRegistry

  constructor(registry: CommandRegistry) {
    this.registry = registry
  }

  async run(line: string, ctx: ShellContext): Promise<CommandResult> {
    const statements = parseLine(tokenize(line))
    let last: CommandResult = ok()

    for (const stmt of statements) {
      if (stmt.op === 'and' && last.exitCode !== 0) continue
      if (stmt.op === 'or' && last.exitCode === 0) continue

      last = await this.runStatement(stmt, ctx)
      ctx.env['?'] = String(last.exitCode)
    }

    return last
  }

  private async runStatement(stmt: Statement, ctx: ShellContext): Promise<CommandResult> {
    let stdin = ''
    let result: CommandResult = ok()

    for (const cmdTokens of stmt.commands) {
      const words = this.expandWords(cmdTokens, ctx)
      if (words.length === 0) continue

      const [name, ...args] = words
      const handler = this.registry.get(name)
      if (!handler) {
        result = fail(`bash: ${name}: command not found`, 127)
        break
      }

      try {
        result = await handler(args, ctx, stdin)
      } catch (e) {
        result = fail(e instanceof Error ? e.message : String(e), 1)
      }
      stdin = result.stdout
    }

    if (stmt.redirect) {
      const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
      const path = expandVariables(stmt.redirect.path, ctx.env)
      const abs = ctx.vfs.resolve(path, ctx.cwd, home)
      try {
        ctx.vfs.writeFile(abs, result.stdout, {
          append: stmt.redirect.append,
          actor: ctx.users.toSubject(ctx.currentUser),
        })
        result = { stdout: '', stderr: result.stderr, exitCode: result.exitCode }
      } catch (e) {
        result = fail(e instanceof Error ? e.message : String(e), 1)
      }
    }

    return result
  }

  private expandWords(tokens: Token[], ctx: ShellContext): string[] {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    const out: string[] = []

    for (const t of tokens) {
      if (t.type !== 'word') continue
      const value = t.literal ? t.value : expandVariables(t.value, ctx.env)
      if (t.quoted) {
        out.push(value)
      } else {
        out.push(...expandGlob(value, ctx.vfs, ctx.cwd, home))
      }
    }

    return out
  }
}
