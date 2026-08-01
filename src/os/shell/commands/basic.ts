import type { CommandRegistry } from '../registry'
import { fail, ok } from '../types'

/**
 * Cross-phase seed commands not yet organized under their own PLAN.md sub-phase file:
 * echo/grep/wc belong to 4.12 (text processing), whoami/id to 4.5 (user). They'll move
 * into dedicated files once those sub-phases are implemented for real.
 */
export function registerBasicCommands(registry: CommandRegistry): void {
  registry.register('whoami', (_args, ctx) => ok(ctx.currentUser))

  registry.register('id', (_args, ctx) => {
    const user = ctx.users.findByName(ctx.currentUser)
    if (!user) return fail('id: no such user')
    const groups = user.groups
      .map((g) => `${ctx.users.listGroups().find((gr) => gr.name === g)?.gid ?? 0}(${g})`)
      .join(',')
    return ok(`uid=${user.uid}(${user.username}) gid=${user.gid}(${user.groups[0] ?? user.username}) groups=${groups}`)
  })

  registry.register('echo', (args) => ok(args.join(' ')))

  registry.register('grep', (args, _ctx, stdin) => {
    const pattern = args.find((a) => !a.startsWith('-'))
    if (!pattern) return fail('usage: grep [-i] pattern')
    const ignoreCase = args.includes('-i')

    let re: RegExp
    try {
      re = new RegExp(pattern, ignoreCase ? 'i' : '')
    } catch {
      return fail(`grep: invalid pattern: ${pattern}`)
    }

    const lines = stdin.split('\n').filter((l) => re.test(l))
    return { stdout: lines.join('\n'), stderr: '', exitCode: lines.length ? 0 : 1 }
  })

  registry.register('wc', (args, _ctx, stdin) => {
    const lineCount = stdin.length ? stdin.split('\n').length - (stdin.endsWith('\n') ? 1 : 0) : 0
    const wordCount = stdin.split(/\s+/).filter(Boolean).length
    const charCount = stdin.length

    if (args.includes('-l')) return ok(String(lineCount))
    if (args.includes('-w')) return ok(String(wordCount))
    if (args.includes('-c')) return ok(String(charCount))
    return ok(`${lineCount} ${wordCount} ${charCount}`)
  })

  registry.register('true', () => ok())
  registry.register('false', () => fail('', 1))
}
