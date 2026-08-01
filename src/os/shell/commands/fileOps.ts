import { formatMode } from '../../permissions'
import type { CommandRegistry } from '../registry'
import { fail, ok, type CommandResult, type ShellContext } from '../types'

function homeOf(ctx: ShellContext): string {
  return ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function readTarget(ctx: ShellContext, target: string): string {
  const abs = ctx.vfs.resolve(target, ctx.cwd, homeOf(ctx))
  return ctx.vfs.readFile(abs, { actor: ctx.users.toSubject(ctx.currentUser) })
}

function parseCountFlag(args: string[]): { n: number; target?: string } {
  let n = 10
  let target: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-n') {
      n = parseInt(args[i + 1] ?? '10', 10) || 10
      i++
      continue
    }
    if (/^-\d+$/.test(a)) {
      n = parseInt(a.slice(1), 10)
      continue
    }
    if (!a.startsWith('-')) target = a
  }
  return { n, target }
}

function dumpFile(args: string[], ctx: ShellContext, stdin: string): CommandResult {
  const home = homeOf(ctx)
  if (!args.length) return ok(stdin)

  const actor = ctx.users.toSubject(ctx.currentUser)
  const parts: string[] = []
  for (const t of args) {
    const abs = ctx.vfs.resolve(t, ctx.cwd, home)
    try {
      parts.push(ctx.vfs.readFile(abs, { actor }))
    } catch (e) {
      return fail(`cat: ${t}: ${errMsg(e)}`)
    }
  }
  return ok(parts.join(''))
}

/** PLAN.md phase 4.2 — File: touch, mkdir, rmdir, rm, cp, mv, ln, cat, less, head, tail, file, stat. */
export function registerFileCommands(registry: CommandRegistry): void {
  registry.register('mkdir', (args, ctx) => {
    const home = homeOf(ctx)
    const parents = args.includes('-p')
    const targets = args.filter((a) => a !== '-p')
    if (!targets.length) return fail('mkdir: missing operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of targets) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.mkdir(abs, { parents, actor })
      } catch (e) {
        return fail(`mkdir: cannot create directory '${t}': ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('rmdir', (args, ctx) => {
    const home = homeOf(ctx)
    if (!args.length) return fail('rmdir: missing operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of args) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      const node = ctx.vfs.stat(abs)
      if (!node) return fail(`rmdir: failed to remove '${t}': No such file or directory`)
      if (node.type !== 'dir') return fail(`rmdir: failed to remove '${t}': Not a directory`)
      try {
        ctx.vfs.remove(abs, { actor })
      } catch (e) {
        return fail(`rmdir: failed to remove '${t}': ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('touch', (args, ctx) => {
    const home = homeOf(ctx)
    if (!args.length) return fail('touch: missing file operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of args) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.touch(abs, { actor })
      } catch (e) {
        return fail(`touch: cannot touch '${t}': ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('rm', (args, ctx) => {
    const home = homeOf(ctx)
    const recursive = args.some((a) => a.startsWith('-') && a.includes('r'))
    const targets = args.filter((a) => !a.startsWith('-'))
    if (!targets.length) return fail('rm: missing operand')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of targets) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.remove(abs, { recursive, actor })
      } catch (e) {
        return fail(`rm: cannot remove '${t}': ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('cp', (args, ctx) => {
    const home = homeOf(ctx)
    const recursive = args.some((a) => a.startsWith('-') && /[rR]/.test(a))
    const paths = args.filter((a) => !a.startsWith('-'))
    if (paths.length < 2) return fail('cp: missing file operand')

    const dest = paths[paths.length - 1]
    const sources = paths.slice(0, -1)
    const actor = ctx.users.toSubject(ctx.currentUser)
    const absDest = ctx.vfs.resolve(dest, ctx.cwd, home)

    for (const src of sources) {
      const absSrc = ctx.vfs.resolve(src, ctx.cwd, home)
      try {
        ctx.vfs.copy(absSrc, absDest, { recursive, actor })
      } catch (e) {
        return fail(`cp: cannot copy '${src}': ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('mv', (args, ctx) => {
    const home = homeOf(ctx)
    const paths = args.filter((a) => !a.startsWith('-'))
    if (paths.length < 2) return fail('mv: missing file operand')

    const dest = paths[paths.length - 1]
    const sources = paths.slice(0, -1)
    const actor = ctx.users.toSubject(ctx.currentUser)
    const absDest = ctx.vfs.resolve(dest, ctx.cwd, home)

    for (const src of sources) {
      const absSrc = ctx.vfs.resolve(src, ctx.cwd, home)
      try {
        ctx.vfs.move(absSrc, absDest, { actor })
      } catch (e) {
        return fail(`mv: cannot move '${src}': ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('ln', (args, ctx) => {
    const home = homeOf(ctx)
    const symbolic = args.includes('-s')
    const paths = args.filter((a) => !a.startsWith('-'))
    if (paths.length < 2) return fail('ln: missing file operand')
    if (!symbolic) return fail('ln: hard links are not supported in this simulated filesystem — use -s')

    const [target, linkPath] = paths
    const absLink = ctx.vfs.resolve(linkPath, ctx.cwd, home)
    const actor = ctx.users.toSubject(ctx.currentUser)
    try {
      ctx.vfs.symlink(target, absLink, { actor })
    } catch (e) {
      return fail(`ln: failed to create symbolic link '${linkPath}': ${errMsg(e)}`)
    }
    return ok()
  })

  registry.register('cat', dumpFile)
  // No pager in a terminal window — `less` just dumps the file, same as `cat`.
  registry.register('less', dumpFile)

  registry.register('head', (args, ctx, stdin) => {
    const { n, target } = parseCountFlag(args)
    let content: string
    if (target) {
      try {
        content = readTarget(ctx, target)
      } catch (e) {
        return fail(`head: cannot open '${target}': ${errMsg(e)}`)
      }
    } else {
      content = stdin
    }
    return ok(content.split('\n').slice(0, n).join('\n'))
  })

  registry.register('tail', (args, ctx, stdin) => {
    const { n, target } = parseCountFlag(args)
    let content: string
    if (target) {
      try {
        content = readTarget(ctx, target)
      } catch (e) {
        return fail(`tail: cannot open '${target}': ${errMsg(e)}`)
      }
    } else {
      content = stdin
    }
    const lines = content.split('\n')
    return ok(lines.slice(Math.max(0, lines.length - n)).join('\n'))
  })

  registry.register('file', (args, ctx) => {
    const home = homeOf(ctx)
    if (!args.length) return fail('file: missing operand')

    const lines = args.map((t) => {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      const node = ctx.vfs.stat(abs)
      if (!node) return `${t}: cannot open '${t}' (No such file or directory)`
      if (node.type === 'dir') return `${t}: directory`
      if (node.type === 'symlink') return `${t}: symbolic link to ${node.target}`
      return `${t}: ${node.content.length === 0 ? 'empty' : 'ASCII text'}`
    })
    return ok(lines.join('\n'))
  })

  registry.register('stat', (args, ctx) => {
    const home = homeOf(ctx)
    if (!args.length) return fail('stat: missing operand')

    const blocks = args.map((t) => {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      const node = ctx.vfs.stat(abs)
      if (!node) return `stat: cannot statx '${t}': No such file or directory`

      const size = node.type === 'file' ? node.content.length : node.type === 'symlink' ? node.target.length : 0
      const typeName = node.type === 'dir' ? 'directory' : node.type === 'symlink' ? 'symbolic link' : 'regular file'
      return [
        `  File: ${t}${node.type === 'symlink' ? ` -> ${node.target}` : ''}`,
        `  Size: ${size}\tType: ${typeName}`,
        `Access: (${node.mode.toString(8)}/${formatMode(node.mode, node.type)})  Uid: (${node.owner})  Gid: (${node.group})`,
        `Modify: ${new Date(node.mtime).toISOString()}`,
      ].join('\n')
    })
    return ok(blocks.join('\n\n'))
  })
}
