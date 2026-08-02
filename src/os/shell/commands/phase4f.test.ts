import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.8 — package commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('a regular user cannot apt install without root', async () => {
    const result = await kernel.shell.run('apt install htop', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(kernel.packages.isInstalled('htop')).toBe(false)
  })

  it('sudo apt install actually installs the package AND creates its /usr/bin binary', async () => {
    expect(kernel.vfs.exists('/usr/bin/htop')).toBe(false)
    const result = await kernel.shell.run('sudo apt install htop', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.packages.isInstalled('htop')).toBe(true)
    expect(kernel.vfs.exists('/usr/bin/htop')).toBe(true)
    expect(kernel.vfs.stat('/usr/bin/htop')!.mode).toBe(0o755)
  })

  it('apt install on an unknown package fails without touching the filesystem', async () => {
    const result = await kernel.shell.run('sudo apt install not-a-real-package', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(kernel.vfs.exists('/usr/bin/not-a-real-package')).toBe(false)
  })

  it('apt remove uninstalls the package and deletes its /usr/bin binaries', async () => {
    await kernel.shell.run('sudo apt install tree', ctx)
    expect(kernel.vfs.exists('/usr/bin/tree')).toBe(true)

    const result = await kernel.shell.run('sudo apt remove tree', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.packages.isInstalled('tree')).toBe(false)
    expect(kernel.vfs.exists('/usr/bin/tree')).toBe(false)
  })

  it('apt remove refuses to remove an essential preinstalled package', async () => {
    const result = await kernel.shell.run('sudo apt remove bash', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(kernel.packages.isInstalled('bash')).toBe(true)
    expect(kernel.vfs.exists('/usr/bin/bash')).toBe(true) // untouched
  })

  it('a successful install emits a real notification event, but a no-op re-install does not', async () => {
    const seen: string[] = []
    const unsubscribe = kernel.notifications.subscribe((n) => seen.push(n.title))

    await kernel.shell.run('sudo apt install tree', ctx)
    expect(seen).toEqual(['Package installed'])

    await kernel.shell.run('sudo apt install tree', ctx) // already installed — no new event
    expect(seen).toEqual(['Package installed'])

    await kernel.shell.run('sudo apt remove tree', ctx)
    expect(seen).toEqual(['Package installed', 'Package removed'])
    unsubscribe()
  })

  it('apt search finds catalog matches without requiring root', async () => {
    const result = await kernel.shell.run('apt search docker', ctx)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('docker.io')
  })

  it('dpkg -l lists installed packages and dpkg -L lists their files', async () => {
    const list = await kernel.shell.run('dpkg -l', ctx)
    expect(list.stdout).toContain('bash')

    const files = await kernel.shell.run('dpkg -L bash', ctx)
    expect(files.stdout).toContain('/usr/bin/bash')

    const notInstalled = await kernel.shell.run('dpkg -L htop', ctx)
    expect(notInstalled.exitCode).not.toBe(0)
  })
})
