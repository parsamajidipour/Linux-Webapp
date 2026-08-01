import { globToRegExp } from '../glob'
import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'
import { flagChars, homeOf } from './util'

function walkAll(ctx: ShellContext, absPath: string, out: string[]): void {
  const node = ctx.vfs.stat(absPath)
  if (!node) return
  out.push(absPath)
  if (node.type !== 'dir') return
  for (const name of ctx.vfs.list(absPath)) {
    walkAll(ctx, absPath === '/' ? `/${name}` : `${absPath}/${name}`, out)
  }
}

function pathDirs(ctx: ShellContext): string[] {
  return (ctx.env.PATH ?? '').split(':').filter(Boolean)
}

/** PLAN.md phase 4.3 — Search: find, locate, grep(already in basic.ts), which, whereis, type. */
export function registerSearchCommands(registry: CommandRegistry): void {
  registry.register('find', (args, ctx) => {
    const home = homeOf(ctx)
    let namePattern: string | null = null
    let typeFilter: 'f' | 'd' | null = null
    const positional: string[] = []

    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === '-name') namePattern = args[++i] ?? null
      else if (a === '-type') {
        const t = args[++i]
        if (t === 'f' || t === 'd') typeFilter = t
      } else positional.push(a)
    }

    const searchPath = positional[0] ?? '.'
    const abs = ctx.vfs.resolve(searchPath, ctx.cwd, home)
    if (!ctx.vfs.exists(abs)) return fail(`find: '${searchPath}': No such file or directory`)

    const all: string[] = []
    walkAll(ctx, abs, all)

    const nameRe = namePattern ? globToRegExp(namePattern) : null
    const results = all.filter((p) => {
      const node = ctx.vfs.stat(p)!
      if (typeFilter === 'f' && node.type !== 'file') return false
      if (typeFilter === 'd' && node.type !== 'dir') return false
      if (nameRe && !nameRe.test(node.name)) return false
      return true
    })
    return ok(results.join('\n'))
  })

  registry.register('locate', (args, ctx) => {
    const query = args[0]
    if (!query) return fail('usage: locate PATTERN')

    const all: string[] = []
    walkAll(ctx, '/', all)
    const matches = all.filter((p) => p.includes(query))
    return matches.length ? ok(matches.join('\n')) : fail('', 1)
  })

  registry.register('which', (args, ctx) => {
    if (!args.length) return fail('usage: which COMMAND...')
    const dirs = pathDirs(ctx)
    const outLines: string[] = []
    const errLines: string[] = []

    for (const name of args) {
      const hit = dirs.map((d) => `${d}/${name}`).find((p) => ctx.vfs.stat(p)?.type === 'file')
      if (hit) outLines.push(hit)
      else errLines.push(`which: no ${name} in (${dirs.join(':')})`)
    }
    return { stdout: outLines.join('\n'), stderr: errLines.join('\n'), exitCode: errLines.length ? 1 : 0 }
  })

  registry.register('whereis', (args, ctx) => {
    if (!args.length) return fail('usage: whereis COMMAND...')
    const lines = args.map((name) => {
      const p = `/usr/bin/${name}`
      return ctx.vfs.stat(p)?.type === 'file' ? `${name}: ${p}` : `${name}:`
    })
    return ok(lines.join('\n'))
  })

  registry.register('grep', (args, _ctx, stdin) => {
    const pattern = args.find((a) => !a.startsWith('-'))
    if (!pattern) return fail('usage: grep [-i] pattern')
    const ignoreCase = flagChars(args).includes('i')

    let re: RegExp
    try {
      re = new RegExp(pattern, ignoreCase ? 'i' : '')
    } catch {
      return fail(`grep: invalid pattern: ${pattern}`)
    }

    const lines = stdin.split('\n').filter((l) => re.test(l))
    return { stdout: lines.join('\n'), stderr: '', exitCode: lines.length ? 0 : 1 }
  })

  registry.register('type', (args, ctx) => {
    if (!args.length) return fail('usage: type NAME...')
    const dirs = pathDirs(ctx)
    let anyMissing = false

    const lines = args.map((name) => {
      const hit = dirs.map((d) => `${d}/${name}`).find((p) => ctx.vfs.stat(p)?.type === 'file')
      if (hit) return `${name} is ${hit}`
      if (ctx.registry.has(name)) return `${name} is a shell builtin`
      anyMissing = true
      return `bash: type: ${name}: not found`
    })
    return { stdout: lines.join('\n'), stderr: '', exitCode: anyMissing ? 1 : 0 }
  })
}
