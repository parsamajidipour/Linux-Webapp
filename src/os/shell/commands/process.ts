import type { ProcessRecord } from '../../process/types'
import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'

function renderSnapshot(ctx: ShellContext): string {
  const list = [...ctx.processes.list()].sort((a, b) => b.cpu - a.cpu)
  const header = `top - uptime ${ctx.processes.uptimeSeconds()}s, ${list.length} processes\n  PID USER      %CPU %MEM COMMAND`
  const rows = list.map(
    (p) => `${String(p.pid).padStart(5)} ${p.user.padEnd(9)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${p.command}`,
  )
  return [header, ...rows].join('\n')
}

function parseSignal(flag: string): string {
  return flag.replace(/^-+/, '').replace(/^SIG/i, '').toUpperCase()
}

/** PLAN.md phase 4.6 — Process: ps, top, htop, kill, killall, jobs, bg, fg, nohup. */
export function registerProcessCommands(registry: CommandRegistry): void {
  registry.register('ps', (args, ctx) => {
    const full = args.some((a) => a === 'aux' || a === '-ef' || a === '-e' || a === '-a' || a === 'ax')
    let list: ProcessRecord[] = ctx.processes.list()

    if (!full) {
      list = list.filter((p) => p.user === ctx.currentUser)
      const rows = list.map((p) => `${String(p.pid).padStart(5)} pts/0    00:00:00 ${p.command.replace(/^-/, '')}`)
      return ok(['  PID TTY          TIME CMD', ...rows].join('\n'))
    }

    const rows = list.map(
      (p) => `${p.user.padEnd(10)} ${String(p.pid).padStart(5)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${p.command}`,
    )
    return ok(['USER       PID %CPU %MEM COMMAND', ...rows].join('\n'))
  })

  registry.register('top', (_args, ctx) =>
    ok(`${renderSnapshot(ctx)}\n\n(one-shot snapshot — this terminal has no raw-mode live view yet)`),
  )
  registry.register('htop', (_args, ctx) => ok(renderSnapshot(ctx)))

  registry.register('kill', (args, ctx) => {
    let signal = 'TERM'
    const pidArgs: string[] = []
    for (const a of args) {
      if (a.startsWith('-')) signal = parseSignal(a)
      else pidArgs.push(a)
    }
    if (!pidArgs.length) return fail('usage: kill [-SIGNAL] PID...')

    for (const raw of pidArgs) {
      const pid = parseInt(raw, 10)
      if (Number.isNaN(pid)) return fail(`kill: ${raw}: arguments must be process or job IDs`)
      const proc = ctx.processes.get(pid)
      if (!proc) return fail(`kill: (${pid}) - No such process`)
      if (proc.user !== ctx.currentUser && ctx.currentUser !== 'root') {
        return fail(`kill: (${pid}) - Operation not permitted`)
      }
      if (!ctx.processes.kill(pid, signal)) return fail(`kill: (${pid}) - Operation not permitted`)
    }
    return ok()
  })

  registry.register('killall', (args, ctx) => {
    const name = args.find((a) => !a.startsWith('-'))
    if (!name) return fail('usage: killall NAME')

    const matches = ctx.processes.list().filter((p) => p.command.includes(name))
    if (!matches.length) return fail(`killall: ${name}: no process found`, 1)

    for (const p of matches) {
      if (p.user !== ctx.currentUser && ctx.currentUser !== 'root') {
        return fail(`killall: (${p.command}) - Operation not permitted`)
      }
    }
    for (const p of matches) ctx.processes.kill(p.pid)
    return ok()
  })

  registry.register('jobs', (_args, ctx) => {
    if (!ctx.jobs.length) return ok('')
    const lines = ctx.jobs.map((j, i) => {
      const marker = i === ctx.jobs.length - 1 ? '+' : '-'
      const status = j.status === 'done' ? 'Done' : 'Running'
      return `[${j.id}]${marker}  ${status.padEnd(24)}${j.command}`
    })
    return ok(lines.join('\n'))
  })

  registry.register('bg', (args, ctx) => {
    const id = args[0] ? parseInt(args[0].replace('%', ''), 10) : ctx.jobs.at(-1)?.id
    if (id === undefined) return fail('bash: bg: no current job')
    const job = ctx.jobs.find((j) => j.id === id)
    if (!job) return fail(`bash: bg: %${id}: no such job`)
    return fail(`bash: bg: job ${id} already completed`)
  })

  registry.register('fg', (args, ctx) => {
    const id = args[0] ? parseInt(args[0].replace('%', ''), 10) : ctx.jobs.at(-1)?.id
    if (id === undefined) return fail('bash: fg: no current job')
    const idx = ctx.jobs.findIndex((j) => j.id === id)
    if (idx === -1) return fail(`bash: fg: %${id}: no such job`)

    const [job] = ctx.jobs.splice(idx, 1)
    return job.result
  })

  registry.register('nohup', async (args, ctx, stdin) => {
    const [name, ...rest] = args
    if (!name) return fail('usage: nohup COMMAND [ARGS]...')
    const handler = registry.get(name)
    if (!handler) return fail(`nohup: failed to run command '${name}': No such file or directory`, 127)

    const result = await handler(rest, ctx, stdin)
    const notice = "nohup: ignoring input and appending output to 'nohup.out'\n"
    return { stdout: notice + result.stdout, stderr: result.stderr, exitCode: result.exitCode }
  })
}
