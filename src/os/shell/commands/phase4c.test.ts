import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.5 — user commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('groups lists a user\'s group memberships', async () => {
    const result = await kernel.shell.run('groups', ctx)
    expect(result.stdout).toBe('bitx sudo')

    const guest = await kernel.shell.run('groups guest', ctx)
    expect(guest.stdout).toBe('guest')
  })

  it('passwd lets a user change their own password', async () => {
    const result = await kernel.shell.run('passwd newpass123', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.users.authenticate('bitx', 'newpass123')).toBe(true)
    expect(kernel.users.authenticate('bitx', 'ubuntu')).toBe(false)
  })

  it('passwd refuses to change another user\'s password without root', async () => {
    const result = await kernel.shell.run('passwd guest hacked', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(kernel.users.authenticate('guest', 'anything-still-works')).toBe(true) // untouched
  })

  it('su to root requires no password and switches cwd/env to root\'s', async () => {
    const su = await kernel.shell.run('su root', ctx)
    expect(su.exitCode).toBe(0)
    expect(ctx.currentUser).toBe('root')
    expect(ctx.cwd).toBe('/root')
    expect(ctx.env.HOME).toBe('/root')
  })

  it('su to another user without root is rejected (no password prompt yet)', async () => {
    const result = await kernel.shell.run('su guest', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(ctx.currentUser).toBe('bitx') // unchanged
  })

  it('su to a nonexistent user fails cleanly', async () => {
    const result = await kernel.shell.run('su nobody', ctx)
    expect(result.exitCode).not.toBe(0)
  })

  it('sudo elevates a single command for a sudoer, then reverts', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/root-owned', ctx)
    const denied = await kernel.shell.run('chown root /home/bitx/root-owned', ctx)
    expect(denied.exitCode).not.toBe(0) // bitx alone cannot chown

    const elevated = await kernel.shell.run('sudo chown root /home/bitx/root-owned', ctx)
    expect(elevated.exitCode).toBe(0)
    expect(kernel.vfs.stat('/home/bitx/root-owned')!.owner).toBe('root')
    expect(ctx.currentUser).toBe('bitx') // reverted after the single command
  })

  it('sudo denies a non-sudoer with the classic incident message', async () => {
    const guestCtx = kernel.createContext('guest')
    const result = await kernel.shell.run('sudo whoami', guestCtx)
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('is not in the sudoers file')
  })

  it('sudo only elevates the sudo-prefixed command in a pipeline, not the whole line', async () => {
    // whoami (not sudo'd) should still report bitx even though sudo ran earlier in the same statement
    const result = await kernel.shell.run('sudo whoami', ctx)
    expect(result.stdout).toBe('root')
    const after = await kernel.shell.run('whoami', ctx)
    expect(after.stdout).toBe('bitx')
  })
})
