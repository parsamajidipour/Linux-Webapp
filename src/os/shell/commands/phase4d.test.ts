import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.6 — process commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('ps (bare) lists only the current user\'s processes', async () => {
    const result = await kernel.shell.run('ps', ctx)
    expect(result.stdout).toContain('bash') // login shell is stored as "-bash", ps strips the leading dash
    expect(result.stdout).not.toContain('systemd-journald') // owned by root, not bitx
  })

  it('ps aux lists every process, including root\'s', async () => {
    const result = await kernel.shell.run('ps aux', ctx)
    expect(result.stdout).toContain('systemd-journald')
    expect(result.stdout).toContain('gnome-shell')
  })

  it('top and htop print a snapshot with a PID column', async () => {
    const top = await kernel.shell.run('top', ctx)
    expect(top.stdout).toContain('PID USER')
    expect(top.stdout).toContain('one-shot snapshot')

    const htop = await kernel.shell.run('htop', ctx)
    expect(htop.stdout).toContain('PID USER')
  })

  it('kill removes a process bitx owns, but not one root owns', async () => {
    const mine = kernel.processes.list().find((p) => p.user === 'bitx')!
    const killMine = await kernel.shell.run(`kill ${mine.pid}`, ctx)
    expect(killMine.exitCode).toBe(0)
    expect(kernel.processes.get(mine.pid)).toBeUndefined()

    const rootProc = kernel.processes.list().find((p) => p.user === 'root' && p.pid !== 1)! // pid 1 (init) can never be killed
    const killRoot = await kernel.shell.run(`kill ${rootProc.pid}`, ctx)
    expect(killRoot.exitCode).not.toBe(0)
    expect(kernel.processes.get(rootProc.pid)).toBeDefined() // untouched

    const asRoot = await kernel.shell.run(`sudo kill ${rootProc.pid}`, ctx)
    expect(asRoot.exitCode).toBe(0)
    expect(kernel.processes.get(rootProc.pid)).toBeUndefined()
  })

  it('killall matches by command substring', async () => {
    const result = await kernel.shell.run('killall bash', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.processes.list().some((p) => p.command.includes('bash'))).toBe(false)
  })

  it('backgrounding a command with & reports a job id and pid instead of its output', async () => {
    const result = await kernel.shell.run('echo hi &', ctx)
    expect(result.stdout).toMatch(/^\[1\] \d+$/)
    expect(ctx.jobs).toHaveLength(1)
    expect(ctx.jobs[0].command).toBe('echo hi')
    expect(ctx.jobs[0].result.stdout).toBe('hi')
  })

  it('jobs lists backgrounded work; fg brings it to the foreground and removes it', async () => {
    await kernel.shell.run('echo one &', ctx)
    await kernel.shell.run('echo two &', ctx)

    const listed = await kernel.shell.run('jobs', ctx)
    expect(listed.stdout).toContain('echo one')
    expect(listed.stdout).toContain('echo two')

    const fg = await kernel.shell.run('fg %1', ctx)
    expect(fg.stdout).toBe('one')
    expect(ctx.jobs.map((j) => j.id)).toEqual([2]) // job 1 removed after fg
  })

  it('bg reports an already-completed job honestly (no real backgrounding yet)', async () => {
    await kernel.shell.run('echo hi &', ctx)
    const result = await kernel.shell.run('bg %1', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('already completed')
  })

  it('nohup runs the wrapped command and prefixes the standard notice', async () => {
    const result = await kernel.shell.run('nohup whoami', ctx)
    expect(result.stdout).toContain("nohup: ignoring input")
    expect(result.stdout).toContain('bitx')
  })
})
