import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.10 — system commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('uname -a reads the live hostname from /etc/hostname, not a hardcoded string', async () => {
    const before = await kernel.shell.run('uname -a', ctx)
    expect(before.stdout).toContain('ubuntu')

    const rootCtx = kernel.createContext('root')
    await kernel.shell.run('hostname myhost', rootCtx)
    const after = await kernel.shell.run('uname -a', ctx)
    expect(after.stdout).toContain('myhost')
  })

  it('hostname requires root to change, but anyone can read it', async () => {
    const denied = await kernel.shell.run('hostname newname', ctx)
    expect(denied.exitCode).not.toBe(0)
    expect(kernel.vfs.readFile('/etc/hostname').trim()).toBe('ubuntu')

    const ok = await kernel.shell.run('sudo hostname newname', ctx)
    expect(ok.exitCode).toBe(0)
    const read = await kernel.shell.run('hostname', ctx)
    expect(read.stdout).toBe('newname')
  })

  it('uptime and date produce non-empty, plausible output', async () => {
    const uptime = await kernel.shell.run('uptime', ctx)
    expect(uptime.stdout).toContain('up')

    const date = await kernel.shell.run('date', ctx)
    expect(date.stdout.length).toBeGreaterThan(10)
  })

  it('cal renders the current month with a weekday header', async () => {
    const result = await kernel.shell.run('cal', ctx)
    expect(result.stdout).toContain('Su Mo Tu We Th Fr Sa')
  })

  it('history persists to ~/.bash_history and lists numbered past commands', async () => {
    await kernel.shell.run('pwd', ctx)
    await kernel.shell.run('whoami', ctx)
    const result = await kernel.shell.run('history', ctx)
    const lines = result.stdout.split('\n')
    expect(lines.some((l) => l.includes('pwd'))).toBe(true)
    expect(lines.some((l) => l.includes('whoami'))).toBe(true)
    expect(lines.some((l) => l.includes('history'))).toBe(true) // history logs itself too, like real bash
  })

  it('history -c clears the persisted history file', async () => {
    await kernel.shell.run('pwd', ctx)
    await kernel.shell.run('history -c', ctx)
    const result = await kernel.shell.run('history', ctx)
    // only 'history -c' and this 'history' call itself remain
    expect(result.stdout.split('\n').some((l) => l.includes('pwd'))).toBe(false)
  })

  it('alias expands to its target command, including arguments', async () => {
    await kernel.shell.run("alias greet='echo hello there'", ctx)
    const result = await kernel.shell.run('greet', ctx)
    expect(result.stdout).toBe('hello there')
  })

  it('unalias removes a previously defined alias', async () => {
    await kernel.shell.run("alias hi='echo hello'", ctx)
    await kernel.shell.run('unalias hi', ctx)
    const result = await kernel.shell.run('hi', ctx)
    expect(result.exitCode).toBe(127) // command not found again
  })

  it('export sets an env var that later commands can read via $VAR', async () => {
    await kernel.shell.run('export GREETING=hello', ctx)
    const result = await kernel.shell.run('echo $GREETING', ctx)
    expect(result.stdout).toBe('hello')
  })

  it('env/printenv reflect the live environment, excluding the internal $?', async () => {
    const env = await kernel.shell.run('env', ctx)
    expect(env.stdout).toContain('HOME=/home/bitx')
    expect(env.stdout).not.toMatch(/^\?=/m)

    const printed = await kernel.shell.run('printenv HOME', ctx)
    expect(printed.stdout).toBe('/home/bitx')
  })
})
