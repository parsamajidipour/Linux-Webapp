import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.3 — search commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('find locates files by -name pattern under a path', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/proj/src', ctx)
    await kernel.shell.run('touch /home/bitx/proj/src/a.ts /home/bitx/proj/src/b.js /home/bitx/proj/README.md', ctx)
    const result = await kernel.shell.run('find /home/bitx/proj -name *.ts', ctx)
    expect(result.stdout).toContain('/home/bitx/proj/src/a.ts')
    expect(result.stdout).not.toContain('b.js')
  })

  it('find -type d only returns directories', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/x/y && touch /home/bitx/x/f.txt', ctx)
    const result = await kernel.shell.run('find /home/bitx/x -type d', ctx)
    expect(result.stdout).toContain('/home/bitx/x/y')
    expect(result.stdout).not.toContain('f.txt')
  })

  it('locate finds a substring anywhere in the tree', async () => {
    await kernel.shell.run('touch /home/bitx/uniquename123.txt', ctx)
    const result = await kernel.shell.run('locate uniquename123', ctx)
    expect(result.stdout).toContain('uniquename123.txt')
  })

  it('which resolves a PATH-backed binary and fails for a shell builtin', async () => {
    const bash = await kernel.shell.run('which bash', ctx)
    expect(bash.stdout).toBe('/usr/bin/bash')

    const cd = await kernel.shell.run('which cd', ctx)
    expect(cd.exitCode).not.toBe(0)
  })

  it('whereis reports the binary path for a package-installed command', async () => {
    const result = await kernel.shell.run('whereis bash', ctx)
    expect(result.stdout).toBe('bash: /usr/bin/bash')
  })

  it('type distinguishes real binaries from shell builtins', async () => {
    const ls = await kernel.shell.run('type ls', ctx)
    expect(ls.stdout).toBe('ls is /usr/bin/ls') // coreutils seeded this into /usr/bin

    const cd = await kernel.shell.run('type cd', ctx)
    expect(cd.stdout).toBe('cd is a shell builtin')

    const missing = await kernel.shell.run('type nope_not_a_command', ctx)
    expect(missing.exitCode).not.toBe(0)
  })

  it('grep still works after moving into search.ts', async () => {
    const result = await kernel.shell.run('echo "hello world" | grep world', ctx)
    expect(result.exitCode).toBe(0)
  })
})

describe('phase 4.4 — permission commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('chmod accepts numeric modes', async () => {
    await kernel.shell.run('touch /home/bitx/f.txt', ctx)
    await kernel.shell.run('chmod 600 /home/bitx/f.txt', ctx)
    expect(kernel.vfs.stat('/home/bitx/f.txt')!.mode).toBe(0o600)
  })

  it('chmod accepts symbolic modes (u+x, go-w)', async () => {
    await kernel.shell.run('touch /home/bitx/g.txt', ctx) // starts at 0644
    await kernel.shell.run('chmod u+x /home/bitx/g.txt', ctx)
    expect(kernel.vfs.stat('/home/bitx/g.txt')!.mode).toBe(0o744)

    await kernel.shell.run('chmod go-r /home/bitx/g.txt', ctx)
    expect(kernel.vfs.stat('/home/bitx/g.txt')!.mode).toBe(0o700)
  })

  it('chmod -R applies recursively', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/d/sub && touch /home/bitx/d/sub/f.txt', ctx)
    await kernel.shell.run('chmod -R 700 /home/bitx/d', ctx)
    expect(kernel.vfs.stat('/home/bitx/d')!.mode).toBe(0o700)
    expect(kernel.vfs.stat('/home/bitx/d/sub')!.mode).toBe(0o700)
    expect(kernel.vfs.stat('/home/bitx/d/sub/f.txt')!.mode).toBe(0o700)
  })

  it('chown/chgrp require root — a regular user cannot give away their own file', async () => {
    await kernel.shell.run('touch /home/bitx/owned.txt', ctx)
    const result = await kernel.shell.run('chown root /home/bitx/owned.txt', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(kernel.vfs.stat('/home/bitx/owned.txt')!.owner).toBe('bitx')
  })

  it('chown and chgrp change ownership when run as root', async () => {
    const rootCtx = kernel.createContext('root')
    await kernel.shell.run('touch /home/bitx/owned.txt', ctx)
    await kernel.shell.run('chown root /home/bitx/owned.txt', rootCtx)
    expect(kernel.vfs.stat('/home/bitx/owned.txt')!.owner).toBe('root')

    await kernel.shell.run('chgrp guest /home/bitx/owned.txt', rootCtx)
    expect(kernel.vfs.stat('/home/bitx/owned.txt')!.group).toBe('guest')
  })

  it('chown accepts owner:group in one shot', async () => {
    const rootCtx = kernel.createContext('root')
    await kernel.shell.run('touch /home/bitx/both.txt', ctx)
    await kernel.shell.run('chown root:root /home/bitx/both.txt', rootCtx)
    const node = kernel.vfs.stat('/home/bitx/both.txt')!
    expect(node.owner).toBe('root')
    expect(node.group).toBe('root')
  })

  it('umask reports and updates the session default, affecting new files', async () => {
    const initial = await kernel.shell.run('umask', ctx)
    expect(initial.stdout).toBe('0022')

    await kernel.shell.run('touch /home/bitx/before.txt', ctx)
    expect(kernel.vfs.stat('/home/bitx/before.txt')!.mode).toBe(0o644) // 666 & ~022

    await kernel.shell.run('umask 077', ctx)
    await kernel.shell.run('touch /home/bitx/after.txt', ctx)
    expect(kernel.vfs.stat('/home/bitx/after.txt')!.mode).toBe(0o600) // 666 & ~077

    await kernel.shell.run('mkdir /home/bitx/secretdir', ctx)
    expect(kernel.vfs.stat('/home/bitx/secretdir')!.mode).toBe(0o700) // 777 & ~077
  })
})
