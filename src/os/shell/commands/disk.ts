import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'
import { flagChars, homeOf } from './util'

/** No real block devices exist — one fake 20G root disk and a 2G tmpfs, sized consistently
 * across df/lsblk. Usage numbers are NOT fake, though: they come from `Vfs.sizeOf()`. */
const TOTAL_DISK_BYTES = 20 * 1024 * 1024 * 1024
const TMPFS_BYTES = 2 * 1024 * 1024 * 1024

function humanBytes(bytes: number): string {
  const units = ['B', 'K', 'M', 'G', 'T']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)}${units[i]}`
}

function collectDu(ctx: ShellContext, absPath: string, human: boolean, lines: string[]): void {
  const node = ctx.vfs.stat(absPath)
  if (!node || node.type !== 'dir') return

  for (const name of ctx.vfs.list(absPath)) {
    const child = absPath === '/' ? `/${name}` : `${absPath}/${name}`
    if (ctx.vfs.stat(child)?.type === 'dir') collectDu(ctx, child, human, lines)
  }

  const size = ctx.vfs.sizeOf(absPath)
  const rendered = human ? humanBytes(size) : String(Math.ceil(size / 1024))
  lines.push(`${rendered}\t${absPath}`)
}

/** PLAN.md phase 4.9 — Disk: df, du, mount, umount, lsblk. */
export function registerDiskCommands(registry: CommandRegistry): void {
  registry.register('df', (args, ctx) => {
    const human = flagChars(args).includes('h')
    const rows = [
      { fs: '/dev/sda1', total: TOTAL_DISK_BYTES, used: ctx.vfs.sizeOf('/'), mount: '/' },
      { fs: 'tmpfs', total: TMPFS_BYTES, used: ctx.vfs.exists('/tmp') ? ctx.vfs.sizeOf('/tmp') : 0, mount: '/tmp' },
    ]

    const fmt = (n: number) => (human ? humanBytes(n) : String(Math.round(n / 1024)))
    const header = human
      ? 'Filesystem      Size  Used Avail Use% Mounted on'
      : 'Filesystem     1K-blocks    Used Available Use% Mounted on'

    const lines = rows.map((r) => {
      const avail = r.total - r.used
      const pct = `${Math.round((r.used / r.total) * 100)}%`
      return `${r.fs.padEnd(15)}${fmt(r.total).padStart(6)} ${fmt(r.used).padStart(6)} ${fmt(avail).padStart(6)} ${pct.padStart(4)} ${r.mount}`
    })
    return ok([header, ...lines].join('\n'))
  })

  registry.register('du', (args, ctx) => {
    const flags = flagChars(args)
    const human = flags.includes('h')
    const summary = flags.includes('s')
    const home = homeOf(ctx)
    const target = args.find((a) => !a.startsWith('-')) ?? '.'
    const abs = ctx.vfs.resolve(target, ctx.cwd, home)
    if (!ctx.vfs.exists(abs)) return fail(`du: cannot access '${target}': No such file or directory`)

    const size = ctx.vfs.sizeOf(abs)
    if (summary) return ok(`${human ? humanBytes(size) : Math.ceil(size / 1024)}\t${abs}`)

    const lines: string[] = []
    collectDu(ctx, abs, human, lines)
    return ok(lines.join('\n'))
  })

  registry.register('lsblk', (_args, ctx) => {
    const size = humanBytes(TOTAL_DISK_BYTES)
    return ok(
      [
        'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT',
        `sda      8:0    0 ${size.padStart(5)}  0 disk`,
        `└─sda1   8:1    0 ${size.padStart(5)}  0 part /`,
        ...(ctx.vfs.exists('/tmp') ? [`tmpfs    0:1    0 ${humanBytes(TMPFS_BYTES).padStart(5)}  0 tmpfs /tmp`] : []),
      ].join('\n'),
    )
  })

  registry.register('mount', (args, ctx) => {
    const positional = args.filter((a) => !a.startsWith('-'))
    if (positional.length === 0) {
      const content = ctx.vfs.readFile('/proc/mounts')
      const lines = content
        .trim()
        .split('\n')
        .map((line) => {
          const [device, mountpoint, type, options] = line.split(' ')
          return `${device} on ${mountpoint} type ${type} (${options})`
        })
      return ok(lines.join('\n'))
    }

    if (ctx.currentUser !== 'root') return fail('mount: only root can mount filesystems')
    const target = positional[positional.length - 1]
    if (!ctx.vfs.exists(target)) return fail(`mount: mount point ${target} does not exist`)
    return ok()
  })

  registry.register('umount', (args, ctx) => {
    const target = args.find((a) => !a.startsWith('-'))
    if (!target) return fail('usage: umount DIR')
    if (ctx.currentUser !== 'root') return fail('umount: only root can unmount filesystems')

    const abs = ctx.vfs.resolve(target, ctx.cwd, homeOf(ctx))
    if (abs === '/') return fail('umount: / cannot be unmounted')
    if (!ctx.vfs.exists(abs)) return fail(`umount: ${target}: not found`)
    return ok()
  })
}
