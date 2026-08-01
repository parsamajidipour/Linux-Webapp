import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.9 — disk commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('df reports real usage that grows as files are written', async () => {
    const usedBefore = kernel.vfs.sizeOf('/')
    await kernel.shell.run(`echo "${'x'.repeat(5000)}" > /home/bitx/big.txt`, ctx)
    const usedAfter = kernel.vfs.sizeOf('/')
    expect(usedAfter).toBeGreaterThan(usedBefore)

    const result = await kernel.shell.run('df', ctx)
    const reportedUsedKb = parseInt(result.stdout.split('\n')[1].trim().split(/\s+/)[2], 10)
    expect(reportedUsedKb).toBe(Math.round(usedAfter / 1024))
  })

  it('df -h prints human-readable sizes', async () => {
    const result = await kernel.shell.run('df -h', ctx)
    expect(result.stdout).toMatch(/\d+(\.\d+)?[KMGT]/)
  })

  it('du -s reports the total size of a directory', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/proj && echo hello > /home/bitx/proj/a.txt', ctx)
    const result = await kernel.shell.run('du -s /home/bitx/proj', ctx)
    expect(result.stdout).toContain('/home/bitx/proj')
    const kb = parseInt(result.stdout.split('\t')[0], 10)
    expect(kb).toBeGreaterThanOrEqual(1)
  })

  it('du -sh (combined short flags) applies both -s and -h, not neither', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/proj2 && echo hello > /home/bitx/proj2/a.txt', ctx)
    const result = await kernel.shell.run('du -sh /home/bitx/proj2', ctx)
    const lines = result.stdout.split('\n')
    expect(lines).toHaveLength(1) // -s: summary only, not the full recursive listing
    expect(lines[0]).toMatch(/^\d+(\.\d+)?[KMGT]?B?\t\/home\/bitx\/proj2$/) // -h: human-readable size
  })

  it('du (no -s) lists nested directories before the target itself', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/proj/src && echo x > /home/bitx/proj/src/f.txt', ctx)
    const result = await kernel.shell.run('du /home/bitx/proj', ctx)
    const lines = result.stdout.split('\n')
    expect(lines[lines.length - 1]).toContain('/home/bitx/proj')
    expect(lines.some((l) => l.includes('/home/bitx/proj/src'))).toBe(true)
  })

  it('lsblk shows a root device sized consistently with df', async () => {
    const result = await kernel.shell.run('lsblk', ctx)
    expect(result.stdout).toContain('sda1')
    expect(result.stdout).toContain('20.0G') // matches df's fake TOTAL_DISK_BYTES
  })

  it('mount with no args reflects /proc/mounts seeded in phase 3', async () => {
    const result = await kernel.shell.run('mount', ctx)
    expect(result.stdout).toContain('on / type ext4')
  })

  it('mount/umount require root', async () => {
    const mount = await kernel.shell.run('mount /dev/sdb1 /mnt', ctx)
    expect(mount.exitCode).not.toBe(0)

    const umount = await kernel.shell.run('umount /tmp', ctx)
    expect(umount.exitCode).not.toBe(0)

    const asRoot = await kernel.shell.run('sudo umount /tmp', ctx)
    expect(asRoot.exitCode).toBe(0)
  })
})
