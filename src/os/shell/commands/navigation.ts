import { formatMode } from '../../permissions'
import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'

function homeOf(ctx: ShellContext): string {
  return ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
}

function renderTree(ctx: ShellContext, absPath: string, prefix: string, out: string[]): { dirs: number; files: number } {
  const node = ctx.vfs.stat(absPath)
  if (!node || node.type !== 'dir') return { dirs: 0, files: 0 }

  const names = ctx.vfs.list(absPath).filter((n) => !n.startsWith('.'))
  let dirs = 0
  let files = 0

  names.forEach((name, i) => {
    const isLast = i === names.length - 1
    const childPath = absPath === '/' ? `/${name}` : `${absPath}/${name}`
    const child = ctx.vfs.stat(childPath)!
    out.push(`${prefix}${isLast ? '└── ' : '├── '}${name}${child.type === 'dir' ? '/' : ''}`)
    if (child.type === 'dir') {
      dirs++
      const counts = renderTree(ctx, childPath, `${prefix}${isLast ? '    ' : '│   '}`, out)
      dirs += counts.dirs
      files += counts.files
    } else {
      files++
    }
  })

  return { dirs, files }
}

/** PLAN.md phase 4.1 — Navigation: pwd, ls, ls -la, tree, cd, pushd, popd. */
export function registerNavigationCommands(registry: CommandRegistry): void {
  registry.register('pwd', (_args, ctx) => ok(ctx.cwd))

  registry.register('cd', (args, ctx) => {
    const home = homeOf(ctx)
    const target = args[0] ?? '~'
    const abs = ctx.vfs.resolve(target, ctx.cwd, home)
    const node = ctx.vfs.stat(abs)
    if (!node) return fail(`bash: cd: ${target}: No such file or directory`)
    if (node.type !== 'dir') return fail(`bash: cd: ${target}: Not a directory`)
    ctx.cwd = abs
    return ok()
  })

  registry.register('ls', (args, ctx) => {
    const home = homeOf(ctx)
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
          const size = child.type === 'file' ? child.content.length : child.type === 'symlink' ? child.target.length : 0
          const label = child.type === 'symlink' ? `${n} -> ${child.target}` : n
          return `${formatMode(child.mode, child.type)} ${child.owner.padEnd(8)} ${child.group.padEnd(8)} ${String(size).padStart(6)} ${label}`
        })
        .join('\n')
    }

    const rendered = paths.map((p) => (paths.length > 1 ? `${p}:\n${renderOne(p)}` : renderOne(p)))
    return ok(rendered.join('\n\n'))
  })

  registry.register('tree', (args, ctx) => {
    const home = homeOf(ctx)
    const target = args.find((a) => !a.startsWith('-')) ?? '.'
    const abs = ctx.vfs.resolve(target, ctx.cwd, home)
    const node = ctx.vfs.stat(abs)
    if (!node) return fail(`tree: ${target}: No such file or directory`)
    if (node.type !== 'dir') return fail(`tree: ${target}: not a directory`)

    const out = [abs]
    const { dirs, files } = renderTree(ctx, abs, '', out)
    out.push('', `${dirs} directories, ${files} files`)
    return ok(out.join('\n'))
  })

  registry.register('pushd', (args, ctx) => {
    const home = homeOf(ctx)
    if (!args[0]) {
      if (ctx.dirStack.length === 0) return fail('pushd: no other directory')
      const swap = ctx.dirStack[0]
      ctx.dirStack[0] = ctx.cwd
      ctx.cwd = swap
      return ok([ctx.cwd, ...ctx.dirStack].join(' '))
    }

    const abs = ctx.vfs.resolve(args[0], ctx.cwd, home)
    const node = ctx.vfs.stat(abs)
    if (!node || node.type !== 'dir') return fail(`pushd: ${args[0]}: No such file or directory`)

    ctx.dirStack.unshift(ctx.cwd)
    ctx.cwd = abs
    return ok([ctx.cwd, ...ctx.dirStack].join(' '))
  })

  registry.register('popd', (_args, ctx) => {
    if (ctx.dirStack.length === 0) return fail('popd: directory stack empty')
    ctx.cwd = ctx.dirStack.shift()!
    return ok([ctx.cwd, ...ctx.dirStack].join(' '))
  })
}
