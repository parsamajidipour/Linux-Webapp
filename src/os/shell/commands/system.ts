import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'
import { flagChars, homeOf } from './util'

function envLines(ctx: ShellContext): string[] {
  return Object.entries(ctx.env)
    .filter(([k]) => k !== '?')
    .map(([k, v]) => `${k}=${v}`)
}

function renderCal(year: number, month: number): string {
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const header = `${first.toLocaleString('en-US', { month: 'long' })} ${year}`

  const rows: string[] = []
  let row = '   '.repeat(startDay)
  for (let d = 1; d <= daysInMonth; d++) {
    row += String(d).padStart(2) + ' '
    if ((startDay + d) % 7 === 0) {
      rows.push(row.trimEnd())
      row = ''
    }
  }
  if (row.trim()) rows.push(row.trimEnd())

  const width = 'Su Mo Tu We Th Fr Sa'.length
  const pad = Math.max(0, Math.floor((width - header.length) / 2))
  return [' '.repeat(pad) + header, 'Su Mo Tu We Th Fr Sa', ...rows].join('\n')
}

/** PLAN.md phase 4.10 — System: uname, hostname, uptime, date, cal, history, alias, env, printenv, export. */
export function registerSystemCommands(registry: CommandRegistry): void {
  registry.register('uname', (args, ctx) => {
    const flags = flagChars(args)
    const hostname = ctx.vfs.readFile('/etc/hostname').trim()
    if (flags.includes('a')) {
      return ok(`Linux ${hostname} 6.11.0-generic #24-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux`)
    }
    if (flags.includes('r')) return ok('6.11.0-generic')
    if (flags.includes('n')) return ok(hostname)
    if (flags.includes('m')) return ok('x86_64')
    return ok('Linux')
  })

  registry.register('hostname', (args, ctx) => {
    const newName = args.find((a) => !a.startsWith('-'))
    if (!newName) return ok(ctx.vfs.readFile('/etc/hostname').trim())
    if (ctx.currentUser !== 'root') return fail('hostname: you must be root to change the host name')
    ctx.vfs.writeFile('/etc/hostname', `${newName}\n`, {
      owner: 'root',
      group: 'root',
      actor: ctx.users.toSubject(ctx.currentUser),
    })
    return ok()
  })

  registry.register('uptime', (_args, ctx) => {
    const secs = ctx.processes.uptimeSeconds()
    const mins = Math.floor(secs / 60)
    const label = mins < 1 ? `${secs} seconds` : mins === 1 ? '1 minute' : `${mins} minutes`
    const now = new Date().toLocaleTimeString('en-GB', { hour12: false })
    return ok(` ${now} up ${label},  1 user,  load average: 0.15, 0.10, 0.05`)
  })

  registry.register('date', () => ok(new Date().toString()))

  registry.register('cal', () => {
    const now = new Date()
    return ok(renderCal(now.getFullYear(), now.getMonth()))
  })

  registry.register('history', (args, ctx) => {
    const path = `${homeOf(ctx)}/.bash_history`
    if (args.includes('-c')) {
      try {
        ctx.vfs.writeFile(path, '', { actor: ctx.users.toSubject(ctx.currentUser) })
      } catch {
        // nothing to clear yet
      }
      return ok()
    }

    let content = ''
    try {
      content = ctx.vfs.readFile(path)
    } catch {
      return ok('')
    }
    const lines = content.split('\n').filter(Boolean)
    return ok(lines.map((l, i) => `${String(i + 1).padStart(5)}  ${l}`).join('\n'))
  })

  registry.register('alias', (args, ctx) => {
    if (!args.length) {
      return ok(
        Object.entries(ctx.aliases)
          .map(([name, value]) => `alias ${name}='${value}'`)
          .join('\n'),
      )
    }

    const lines: string[] = []
    for (const a of args) {
      const eq = a.indexOf('=')
      if (eq === -1) {
        if (ctx.aliases[a] === undefined) return fail(`bash: alias: ${a}: not found`)
        lines.push(`alias ${a}='${ctx.aliases[a]}'`)
        continue
      }
      const name = a.slice(0, eq)
      const value = a.slice(eq + 1).replace(/^['"]|['"]$/g, '')
      ctx.aliases[name] = value
    }
    return ok(lines.join('\n'))
  })

  registry.register('unalias', (args, ctx) => {
    const name = args[0]
    if (!name) return fail('usage: unalias NAME')
    if (ctx.aliases[name] === undefined) return fail(`bash: unalias: ${name}: not found`)
    delete ctx.aliases[name]
    return ok()
  })

  registry.register('env', (_args, ctx) => ok(envLines(ctx).join('\n')))

  registry.register('printenv', (args, ctx) => {
    if (!args.length) return ok(envLines(ctx).join('\n'))
    const name = args[0]
    return name !== '?' && name in ctx.env ? ok(ctx.env[name]) : fail('', 1)
  })

  registry.register('export', (args, ctx) => {
    if (!args.length) {
      return ok(
        Object.entries(ctx.env)
          .filter(([k]) => k !== '?')
          .map(([k, v]) => `declare -x ${k}="${v}"`)
          .join('\n'),
      )
    }

    for (const a of args) {
      const eq = a.indexOf('=')
      if (eq === -1) {
        if (!(a in ctx.env)) ctx.env[a] = ''
        continue
      }
      ctx.env[a.slice(0, eq)] = a.slice(eq + 1)
    }
    return ok()
  })
}
