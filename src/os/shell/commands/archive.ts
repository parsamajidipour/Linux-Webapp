import { buildArchive, extractArchive, gunzipUnwrap, gzipWrap, isArchive, isGzipped, parseArchive } from '../../archive/archive'
import type { CommandRegistry } from '../registry'
import { fail, ok, type CommandResult, type ShellContext } from '../types'
import { errMsg, flagChars, homeOf } from './util'

interface TarInvocation {
  mode: 'c' | 'x' | 't'
  gzip: boolean
  verbose: boolean
  archive?: string
  destDir?: string
  files: string[]
}

function parseTar(args: string[]): TarInvocation | null {
  if (!args.length) return null
  const flagsToken = args[0].replace(/^-/, '')
  const mode = flagsToken.includes('c') ? 'c' : flagsToken.includes('x') ? 'x' : flagsToken.includes('t') ? 't' : null
  if (!mode) return null

  let i = 1
  let archive: string | undefined
  if (flagsToken.includes('f')) {
    archive = args[i]
    i++
  }

  let destDir: string | undefined
  const files: string[] = []
  while (i < args.length) {
    if (args[i] === '-C') {
      destDir = args[i + 1]
      i += 2
      continue
    }
    files.push(args[i])
    i++
  }

  return { mode, gzip: flagsToken.includes('z'), verbose: flagsToken.includes('v'), archive, files, destDir }
}

/** PLAN.md phase 4.11 — Archive: zip, unzip, tar, gzip, gunzip.
 * Real zip/tar/gzip are binary formats; our VFS stores content as text. All of these commands
 * share one JSON-based archive serialization (see `os/archive/archive.ts`) instead of faking
 * real bytes — they actually create/read files in the VFS, just not byte-compatible with a
 * real unzip/tar binary. */
export function registerArchiveCommands(registry: CommandRegistry): void {
  registry.register('tar', (args, ctx): CommandResult => {
    const inv = parseTar(args)
    if (!inv) return fail('tar: you must specify one of the -ctx options\nusage: tar -czf archive.tar.gz files...')
    if (!inv.archive) return fail('tar: no archive name given (use -f)')

    const home = homeOf(ctx)
    const actor = ctx.users.toSubject(ctx.currentUser)
    const absArchive = ctx.vfs.resolve(inv.archive, ctx.cwd, home)

    if (inv.mode === 'c') {
      if (!inv.files.length) return fail('tar: cowardly refusing to create an empty archive')
      const absTargets = inv.files.map((f) => ctx.vfs.resolve(f, ctx.cwd, home))
      let content: string
      try {
        content = buildArchive(ctx.vfs, absTargets, actor)
      } catch (e) {
        return fail(`tar: ${errMsg(e)}`)
      }
      if (inv.gzip) content = gzipWrap(content)
      try {
        ctx.vfs.writeFile(absArchive, content, { actor })
      } catch (e) {
        return fail(`tar: cannot create ${inv.archive}: ${errMsg(e)}`)
      }
      return ok(inv.verbose ? inv.files.join('\n') : '')
    }

    let raw: string
    try {
      raw = ctx.vfs.readFile(absArchive, { actor })
    } catch (e) {
      return fail(`tar: ${inv.archive}: ${errMsg(e)}`)
    }
    if (isGzipped(raw)) raw = gunzipUnwrap(raw)
    if (!isArchive(raw)) return fail(`tar: ${inv.archive}: not in our archive format (foreign/corrupt archive)`)

    if (inv.mode === 't') {
      try {
        return ok(parseArchive(raw).map((e) => e.path).join('\n'))
      } catch (e) {
        return fail(`tar: ${errMsg(e)}`)
      }
    }

    const destAbs = ctx.vfs.resolve(inv.destDir ?? '.', ctx.cwd, home)
    try {
      const written = extractArchive(ctx.vfs, raw, destAbs, actor)
      return ok(inv.verbose ? written.join('\n') : '')
    } catch (e) {
      return fail(`tar: ${errMsg(e)}`)
    }
  })

  registry.register('gzip', (args, ctx): CommandResult => {
    const keep = flagChars(args).includes('k')
    const decompress = flagChars(args).includes('d')
    const target = args.find((a) => !a.startsWith('-'))
    if (!target) return fail('usage: gzip [-dk] FILE')

    const home = homeOf(ctx)
    const actor = ctx.users.toSubject(ctx.currentUser)
    const abs = ctx.vfs.resolve(target, ctx.cwd, home)
    if (decompress) return runGunzip(ctx, abs, target, keep)

    let content: string
    try {
      content = ctx.vfs.readFile(abs, { actor })
    } catch (e) {
      return fail(`gzip: ${target}: ${errMsg(e)}`)
    }
    if (isGzipped(content)) return fail(`gzip: ${target}: already has .gz suffix`)

    try {
      ctx.vfs.writeFile(`${abs}.gz`, gzipWrap(content), { actor })
      if (!keep) ctx.vfs.remove(abs, { actor })
    } catch (e) {
      return fail(`gzip: ${errMsg(e)}`)
    }
    return ok()
  })

  registry.register('gunzip', (args, ctx): CommandResult => {
    const keep = flagChars(args).includes('k')
    const target = args.find((a) => !a.startsWith('-'))
    if (!target) return fail('usage: gunzip FILE')
    const home = homeOf(ctx)
    const abs = ctx.vfs.resolve(target, ctx.cwd, home)
    return runGunzip(ctx, abs, target, keep)
  })

  registry.register('zip', (args, ctx): CommandResult => {
    const home = homeOf(ctx)
    const actor = ctx.users.toSubject(ctx.currentUser)
    const positional = args.filter((a) => !a.startsWith('-'))
    if (positional.length < 2) return fail('usage: zip archive.zip file...')

    const [archiveArg, ...files] = positional
    const archiveName = archiveArg.endsWith('.zip') ? archiveArg : `${archiveArg}.zip`
    const absArchive = ctx.vfs.resolve(archiveName, ctx.cwd, home)
    const absTargets = files.map((f) => ctx.vfs.resolve(f, ctx.cwd, home))

    let content: string
    try {
      content = buildArchive(ctx.vfs, absTargets, actor)
    } catch (e) {
      return fail(`zip: ${errMsg(e)}`)
    }
    try {
      ctx.vfs.writeFile(absArchive, content, { actor })
    } catch (e) {
      return fail(`zip: cannot create ${archiveName}: ${errMsg(e)}`)
    }
    return ok(`  adding: ${files.join(', ')}`)
  })

  registry.register('unzip', (args, ctx): CommandResult => {
    const home = homeOf(ctx)
    const actor = ctx.users.toSubject(ctx.currentUser)
    const flags = flagChars(args)
    const list = flags.includes('l')
    const positional = args.filter((a) => !a.startsWith('-'))

    let destDir: string | undefined
    const dIdx = args.indexOf('-d')
    if (dIdx !== -1) destDir = args[dIdx + 1]

    const archiveArg = positional[0]
    if (!archiveArg) return fail('usage: unzip archive.zip [-d dir]')
    const absArchive = ctx.vfs.resolve(archiveArg, ctx.cwd, home)

    let raw: string
    try {
      raw = ctx.vfs.readFile(absArchive, { actor })
    } catch (e) {
      return fail(`unzip: cannot find or open ${archiveArg}: ${errMsg(e)}`)
    }
    if (!isArchive(raw)) return fail(`unzip: ${archiveArg}: not in our archive format (foreign/corrupt archive)`)

    if (list) {
      try {
        return ok(parseArchive(raw).map((e) => e.path).join('\n'))
      } catch (e) {
        return fail(`unzip: ${errMsg(e)}`)
      }
    }

    const destAbs = ctx.vfs.resolve(destDir ?? '.', ctx.cwd, home)
    try {
      const written = extractArchive(ctx.vfs, raw, destAbs, actor)
      return ok(written.map((p) => `  inflating: ${p}`).join('\n'))
    } catch (e) {
      return fail(`unzip: ${errMsg(e)}`)
    }
  })
}

function runGunzip(ctx: ShellContext, abs: string, target: string, keep: boolean): CommandResult {
  const actor = ctx.users.toSubject(ctx.currentUser)
  if (!abs.endsWith('.gz')) return fail(`gunzip: ${target}: unknown suffix -- ignored`)

  let content: string
  try {
    content = ctx.vfs.readFile(abs, { actor })
  } catch (e) {
    return fail(`gunzip: ${target}: ${errMsg(e)}`)
  }
  if (!isGzipped(content)) return fail(`gunzip: ${target}: not in gzip format`)

  const dest = abs.slice(0, -3)
  try {
    ctx.vfs.writeFile(dest, gunzipUnwrap(content), { actor })
    if (!keep) ctx.vfs.remove(abs, { actor })
  } catch (e) {
    return fail(`gunzip: ${errMsg(e)}`)
  }
  return ok()
}
