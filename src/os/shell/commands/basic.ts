import { formatMode } from '../../permissions'
import type { CommandRegistry } from '../registry'
import { fail, ok } from '../types'

/**
 * A minimal seed set proving the kernel wiring (VFS + parser + pipes + redirects work end to end).
 * The full ~70-command surface from PLAN.md phase 4 is deliberately out of scope here.
 */
export function registerBasicCommands(registry: CommandRegistry): void {
  registry.register('pwd', (_args, ctx) => ok(ctx.cwd))

  registry.register('cd', (args, ctx) => {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    const target = args[0] ?? '~'
    const abs = ctx.vfs.resolve(target, ctx.cwd, home)
    const node = ctx.vfs.stat(abs)
    if (!node) return fail(`bash: cd: ${target}: No such file or directory`)
    if (node.type !== 'dir') return fail(`bash: cd: ${target}: Not a directory`)
    ctx.cwd = abs
    return ok()
  })

  registry.register('ls', (args, ctx) => {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    const flagStr = args.filter((a) => a.startsWith('-')).join('')
    const showAll = flagStr.includes('a')
    const long = flagStr.includes('l')
    const targets = args.filter((a) => !a.startsWith('-'))
    const paths = targets.length ? targets : ['.']

    const renderOne = (path: string): string => {
      const abs = ctx.vfs.resolve(path, ctx.cwd, home)
      const node = ctx.vfs.stat(abs)
      if (!node) return `ls: cannot access '${path}': No such file or directory`
      if (node.type !== 'dir') return node.name

      const names = ctx.vfs.list(abs).filter((n) => showAll || !n.startsWith('.'))
      if (!long) return names.join('  ')

      return names
        .map((n) => {
          const childPath = abs === '/' ? `/${n}` : `${abs}/${n}`
          const child = ctx.vfs.stat(childPath)!
          const size = child.type === 'file' ? child.content.length : 0
          return `${formatMode(child.mode, child.type)} ${child.owner.padEnd(8)} ${child.group.padEnd(8)} ${String(size).padStart(6)} ${n}`
        })
        .join('\n')
    }

    const rendered = paths.map((p) => (paths.length > 1 ? `${p}:\n${renderOne(p)}` : renderOne(p)))
    return ok(rendered.join('\n\n'))
  })

  registry.register('mkdir', (args, ctx) => {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    const parents = args.includes('-p')
    const targets = args.filter((a) => a !== '-p')
    if (!targets.length) return fail('mkdir: missing operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of targets) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.mkdir(abs, { parents, actor })
      } catch (e) {
        return fail(`mkdir: cannot create directory '${t}': ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return ok()
  })

  registry.register('touch', (args, ctx) => {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    if (!args.length) return fail('touch: missing file operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of args) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.touch(abs, { actor })
      } catch (e) {
        return fail(`touch: cannot touch '${t}': ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return ok()
  })

  registry.register('cat', (args, ctx) => {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    if (!args.length) return ok('')

    const actor = ctx.users.toSubject(ctx.currentUser)
    const parts: string[] = []
    for (const t of args) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        parts.push(ctx.vfs.readFile(abs, { actor }))
      } catch (e) {
        return fail(`cat: ${t}: ${e instanceof Error ? e.message : 'No such file or directory'}`)
      }
    }
    return ok(parts.join(''))
  })

  registry.register('echo', (args) => ok(args.join(' ')))

  registry.register('rm', (args, ctx) => {
    const home = ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
    const recursive = args.some((a) => a.startsWith('-') && a.includes('r'))
    const targets = args.filter((a) => !a.startsWith('-'))
    if (!targets.length) return fail('rm: missing operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of targets) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.remove(abs, { recursive, actor })
      } catch (e) {
        return fail(`rm: cannot remove '${t}': ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return ok()
  })

  registry.register('whoami', (_args, ctx) => ok(ctx.currentUser))

  registry.register('id', (_args, ctx) => {
    const user = ctx.users.findByName(ctx.currentUser)
    if (!user) return fail('id: no such user')
    const groups = user.groups
      .map((g) => `${ctx.users.listGroups().find((gr) => gr.name === g)?.gid ?? 0}(${g})`)
      .join(',')
    return ok(`uid=${user.uid}(${user.username}) gid=${user.gid}(${user.groups[0] ?? user.username}) groups=${groups}`)
  })

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
