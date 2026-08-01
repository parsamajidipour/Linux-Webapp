import type { CommandRegistry } from '../registry'
import { fail, ok } from '../types'
import { errMsg, flagChars, homeOf } from './util'

/** Applies one `chmod`-style symbolic clause (e.g. `u+x`, `go-w`, `a=r`) to a mode. Returns null if unparseable. */
function applySymbolicClause(mode: number, clause: string): number | null {
  const m = clause.match(/^([ugoa]*)([+\-=])([rwx]*)$/)
  if (!m) return null
  const [, whoRaw, op, permsRaw] = m
  const who = whoRaw || 'a'
  const targets = who.includes('a') ? ['u', 'g', 'o'] : [...new Set(who.split(''))]

  let bits = 0
  if (permsRaw.includes('r')) bits |= 4
  if (permsRaw.includes('w')) bits |= 2
  if (permsRaw.includes('x')) bits |= 1

  let result = mode
  for (const t of targets) {
    const shift = t === 'u' ? 6 : t === 'g' ? 3 : 0
    if (op === '+') result |= bits << shift
    else if (op === '-') result &= ~(bits << shift)
    else result = (result & ~(7 << shift)) | (bits << shift)
  }
  return result
}

function parseMode(spec: string, currentMode: number): number | null {
  if (/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8)

  let mode = currentMode
  for (const clause of spec.split(',')) {
    const next = applySymbolicClause(mode, clause)
    if (next === null) return null
    mode = next
  }
  return mode
}

/** PLAN.md phase 4.4 — Permission: chmod, chown, chgrp, umask. */
export function registerPermissionCommands(registry: CommandRegistry): void {
  registry.register('chmod', (args, ctx) => {
    const home = homeOf(ctx)
    const recursive = flagChars(args).includes('R')
    const [modeSpec, ...targets] = args.filter((a) => !a.startsWith('-'))
    if (!modeSpec || !targets.length) return fail('usage: chmod MODE FILE...')

    const actor = ctx.users.toSubject(ctx.currentUser)

    const applyOne = (abs: string): string | null => {
      const node = ctx.vfs.stat(abs)
      if (!node) return `chmod: cannot access '${abs}': No such file or directory`

      const newMode = parseMode(modeSpec, node.mode)
      if (newMode === null) return `chmod: invalid mode: '${modeSpec}'`

      try {
        ctx.vfs.chmod(abs, newMode, { actor })
      } catch (e) {
        return `chmod: ${errMsg(e)}`
      }

      if (recursive && node.type === 'dir') {
        for (const name of ctx.vfs.list(abs)) {
          const err = applyOne(abs === '/' ? `/${name}` : `${abs}/${name}`)
          if (err) return err
        }
      }
      return null
    }

    for (const t of targets) {
      const err = applyOne(ctx.vfs.resolve(t, ctx.cwd, home))
      if (err) return fail(err)
    }
    return ok()
  })

  registry.register('chown', (args, ctx) => {
    const home = homeOf(ctx)
    const [spec, ...targets] = args
    if (!spec || !targets.length) return fail('usage: chown OWNER[:GROUP] FILE...')

    const [owner, group] = spec.split(':')
    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of targets) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      try {
        ctx.vfs.chown(abs, owner, group, { actor })
      } catch (e) {
        return fail(`chown: ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('chgrp', (args, ctx) => {
    const home = homeOf(ctx)
    const [group, ...targets] = args
    if (!group || !targets.length) return fail('usage: chgrp GROUP FILE...')

    const actor = ctx.users.toSubject(ctx.currentUser)
    for (const t of targets) {
      const abs = ctx.vfs.resolve(t, ctx.cwd, home)
      const node = ctx.vfs.stat(abs)
      if (!node) return fail(`chgrp: cannot access '${t}': No such file or directory`)
      try {
        ctx.vfs.chown(abs, node.owner, group, { actor })
      } catch (e) {
        return fail(`chgrp: ${errMsg(e)}`)
      }
    }
    return ok()
  })

  registry.register('umask', (args, ctx) => {
    if (!args.length) return ok(ctx.env.UMASK ?? '0022')
    if (!/^[0-7]{3,4}$/.test(args[0])) return fail(`umask: ${args[0]}: octal number required`)
    ctx.env.UMASK = args[0].padStart(4, '0')
    return ok()
  })
}
