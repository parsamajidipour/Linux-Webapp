import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from './Kernel'
import { MemoryAdapter } from './persistence/MemoryAdapter'
import type { ShellContext } from './shell/types'

describe('Kernel (phase 0 integration)', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel() // no persistence adapters => pure in-memory, deterministic per test
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('boots with a seeded home directory and active services logged to /var/log/syslog', async () => {
    expect(kernel.vfs.exists('/home/bitx')).toBe(true)
    const syslog = kernel.vfs.readFile('/var/log/syslog')
    expect(syslog).toContain('NetworkManager')
  })

  it('serves a live /proc/uptime that actually advances', async () => {
    const first = kernel.vfs.readFile('/proc/uptime')
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const second = kernel.vfs.readFile('/proc/uptime')
    expect(Number(second.split(' ')[0])).toBeGreaterThan(Number(first.split(' ')[0]))
  })

  it('reads the full root tree through the shell, not just the kernel API', async () => {
    const result = await kernel.shell.run('cat /etc/os-release', ctx)
    expect(result.stdout).toContain('Ubuntu')
  })

  it('runs the phase-0 smoke test from PLAN.md: mkdir && ls', async () => {
    const result = await kernel.shell.run('mkdir /home/bitx/test && ls /home/bitx', ctx)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test')
  })

  it('supports cd updating the shared context', async () => {
    await kernel.shell.run('cd /home/bitx/Documents', ctx)
    expect(ctx.cwd).toBe('/home/bitx/Documents')
    const pwd = await kernel.shell.run('pwd', ctx)
    expect(pwd.stdout).toBe('/home/bitx/Documents')
  })

  it('pipes output between commands', async () => {
    await kernel.shell.run('echo "line one nginx" > /home/bitx/log.txt', ctx)
    await kernel.shell.run('echo "line two" >> /home/bitx/log.txt', ctx)
    const result = await kernel.shell.run('cat /home/bitx/log.txt | grep nginx | wc -l', ctx)
    expect(result.stdout.trim()).toBe('1')
  })

  it('redirects with > (overwrite) and >> (append)', async () => {
    await kernel.shell.run('echo hello > /home/bitx/f.txt', ctx)
    expect(kernel.vfs.readFile('/home/bitx/f.txt')).toBe('hello')
    await kernel.shell.run('echo world >> /home/bitx/f.txt', ctx)
    expect(kernel.vfs.readFile('/home/bitx/f.txt')).toBe('helloworld')
  })

  it('expands wildcards against the VFS', async () => {
    await kernel.shell.run('touch /home/bitx/a.txt /home/bitx/b.txt /home/bitx/c.md', ctx)
    const result = await kernel.shell.run('ls /home/bitx/*.txt', ctx)
    expect(result.stdout.split('\n\n')).toHaveLength(2)
  })

  it('expands $HOME and other env vars', async () => {
    const result = await kernel.shell.run('echo $HOME', ctx)
    expect(result.stdout).toBe('/home/bitx')
  })

  it('does not expand variables inside single quotes', async () => {
    const result = await kernel.shell.run("echo '$HOME'", ctx)
    expect(result.stdout).toBe('$HOME')
  })

  it('tracks exit code in $? and short-circuits && / ||', async () => {
    const bad = await kernel.shell.run('cat /does/not/exist', ctx)
    expect(bad.exitCode).not.toBe(0)
    expect(ctx.env['?']).toBe(String(bad.exitCode))

    const result = await kernel.shell.run('cat /does/not/exist && echo should-not-print || echo fallback', ctx)
    expect(result.stdout).toBe('fallback')
  })

  it('reports command not found with exit code 127', async () => {
    const result = await kernel.shell.run('notarealcommand', ctx)
    expect(result.exitCode).toBe(127)
    expect(result.stderr).toContain('not found')
  })

  it('enforces file permissions between users', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/private', ctx)
    await kernel.shell.run('echo secret > /home/bitx/private/f.txt', ctx)
    kernel.vfs.chmod('/home/bitx/private/f.txt', 0o600, { actor: kernel.users.toSubject('bitx') })

    const guestCtx = kernel.createContext('guest')
    const result = await kernel.shell.run('cat /home/bitx/private/f.txt', guestCtx)
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('Permission denied')
  })

  it('package manager install/remove round-trips', () => {
    expect(kernel.packages.isInstalled('htop')).toBe(false)
    expect(kernel.packages.install('htop').ok).toBe(true)
    expect(kernel.packages.isInstalled('htop')).toBe(true)
    expect(kernel.packages.remove('htop').ok).toBe(true)
    expect(kernel.packages.isInstalled('htop')).toBe(false)
  })

  it('process manager seeds baseline processes and supports kill', () => {
    const list = kernel.processes.list()
    expect(list.length).toBeGreaterThan(0)
    expect(kernel.processes.kill(1)).toBe(false) // init is unkillable
    const pid = list[list.length - 1].pid
    expect(kernel.processes.kill(pid)).toBe(true)
    expect(kernel.processes.get(pid)).toBeUndefined()
  })

  it('settings store persists patches and notifies subscribers', () => {
    let seen: string | undefined
    const unsubscribe = kernel.settings.subscribe((s) => {
      seen = s.theme
    })
    kernel.settings.set({ theme: 'light' })
    expect(seen).toBe('light')
    expect(kernel.settings.get().theme).toBe('light')
    unsubscribe()
  })

  it('running a shell command survives a full reload — regression test for the missing autosave wiring found in phase 4.10', async () => {
    // Two Kernel *instances* sharing the same backing store, simulating a page reload:
    // the first is the tab before refresh, the second is the fresh tab after.
    const vfsStore = new MemoryAdapter()
    const usersStore = new MemoryAdapter()
    const packagesStore = new MemoryAdapter()

    const before = new Kernel({ vfs: vfsStore, users: usersStore, packages: packagesStore })
    await before.boot()
    const beforeCtx = before.createContext('bitx')
    await before.shell.run('echo hello > /home/bitx/note.txt', beforeCtx)
    await before.shell.run('pwd', beforeCtx) // exercises Shell.run's per-command persist path

    const after = new Kernel({ vfs: vfsStore, users: usersStore, packages: packagesStore })
    await after.boot()
    expect(after.vfs.readFile('/home/bitx/note.txt')).toBe('hello')
    expect(after.vfs.readFile('/home/bitx/.bash_history')).toContain('pwd')
  })

  it('notifies settings subscribers once persisted settings finish loading — regression test for phase 1.2', async () => {
    // A UI component (DesktopContext) subscribes *before* boot() resolves, the same order
    // React effects run in relative to the async KernelProvider boot. Without notifying
    // listeners inside load(), a subscriber attached this early would never see the
    // persisted value — it'd be stuck showing DEFAULT_SETTINGS forever.
    const settingsStore = new MemoryAdapter()

    const before = new Kernel({ settings: settingsStore })
    await before.boot()
    before.settings.set({ wallpaper: 'ocean' })

    const after = new Kernel({ settings: settingsStore })
    let seenWallpaper: string | undefined
    after.settings.subscribe((s) => {
      seenWallpaper = s.wallpaper
    })
    await after.boot()
    expect(seenWallpaper).toBe('ocean')
    expect(after.settings.get().wallpaper).toBe('ocean')
  })
})
