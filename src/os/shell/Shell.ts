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
    this.recordHistory(line, ctx)

    const statements = parseLine(tokenize(line))
    let last: CommandResult = ok()

    for (const stmt of statements) {
      if (stmt.op === 'and' && last.exitCode !== 0) continue
      if (stmt.op === 'or' && last.exitCode === 0) continue

      const result = await this.runStatement(stmt, ctx)

      if (stmt.background) {
        // No real async backgrounding — the command already ran to completion above.
        // We still record it as a job so `jobs`/`fg` have something honest to report.
        const commandText = stmt.commands.map((cmd) => cmd.map((t) => t.value).join(' ')).join(' | ')
        const pid = ctx.processes.spawn(commandText, ctx.currentUser).pid
        const id = ctx.jobs.length ? Math.max(...ctx.jobs.map((j) => j.id)) + 1 : 1
        ctx.jobs.push({ id, pid, command: commandText, status: 'done', result })
        last = ok(`[${id}] ${pid}`)
      } else {
        last = result
      }

      ctx.env['?'] = String(last.exitCode)
    }

    return last
  }

  /** Real bash persists every entered line to `~/.bash_history` — we get that for free by
   * writing through the same VFS everything else uses, so it survives a page reload too. */
  private recordHistory(line: string, ctx: ShellContext): void {
    if (!line.trim()) return
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    try {
      ctx.vfs.writeFile(`${home}/.bash_history`, `${line}\n`, {
        append: true,
        actor: ctx.users.toSubject(ctx.currentUser),
      })
    } catch {
      // home directory not seeded yet (e.g. very first boot tick) — safe to skip.
    }
  }

  private expandAlias(words: string[], ctx: ShellContext): string[] {
    const seen = new Set<string>()
    let current = words
    while (current.length && ctx.aliases[current[0]] && !seen.has(current[0])) {
      seen.add(current[0])
      const expansion = this.expandWords(tokenize(ctx.aliases[current[0]]), ctx)
      current = [...expansion, ...current.slice(1)]
    }
    return current
  }

  private async runStatement(stmt: Statement, ctx: ShellContext): Promise<CommandResult> {
    let stdin = ''
    let result: CommandResult = ok()

    for (const cmdTokens of stmt.commands) {
      let words = this.expandWords(cmdTokens, ctx)
      if (words.length === 0) continue
      words = this.expandAlias(words, ctx)

      // `sudo` isn't a registered command — like real sudo, it elevates for one invocation
      // only (the process re-execs as root), it's not a shell builtin.
      let elevate = false
      if (words[0] === 'sudo') {
        elevate = true
        words = words.slice(1)
        if (!ctx.users.isSudoer(ctx.currentUser)) {
          result = fail(`${ctx.currentUser} is not in the sudoers file.  This incident will be reported.`, 1)
          break
        }
      }

      const [name, ...args] = words
      if (elevate && !name) {
        result = fail('usage: sudo command', 1)
        break
      }

      const handler = this.registry.get(name)
      if (!handler) {
        result = fail(`bash: ${name}: command not found`, 127)
        break
      }

      const actingUser = ctx.currentUser
      if (elevate) ctx.currentUser = 'root'
      try {
        result = await handler(args, ctx, stdin)
      } catch (e) {
        result = fail(e instanceof Error ? e.message : String(e), 1)
      } finally {
        if (elevate) ctx.currentUser = actingUser
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
