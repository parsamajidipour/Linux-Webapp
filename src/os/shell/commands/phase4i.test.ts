import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.11 — archive commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
    await kernel.shell.run('mkdir -p /home/bitx/proj/sub', ctx)
    await kernel.shell.run('echo one > /home/bitx/proj/a.txt', ctx)
    await kernel.shell.run('echo two > /home/bitx/proj/sub/b.txt', ctx)
  })

  it('tar -czf creates a real file, and -tf lists members without extracting', async () => {
    const created = await kernel.shell.run('tar -czf backup.tar.gz proj', ctx)
    expect(created.exitCode).toBe(0)
    expect(kernel.vfs.exists('/home/bitx/backup.tar.gz')).toBe(true)

    const listing = await kernel.shell.run('tar -tf backup.tar.gz', ctx)
    expect(listing.stdout).toContain('proj')
    expect(listing.stdout).toContain('proj/a.txt')
    expect(listing.stdout).toContain('proj/sub/b.txt')
    expect(kernel.vfs.exists('/home/bitx/proj_restored')).toBe(false)
  })

  it('tar round-trips content through create then extract into a fresh directory', async () => {
    await kernel.shell.run('tar -czf backup.tar.gz proj', ctx)
    await kernel.shell.run('mkdir restored', ctx)
    const extracted = await kernel.shell.run('tar -xzf backup.tar.gz -C restored', ctx)
    expect(extracted.exitCode).toBe(0)
    expect(kernel.vfs.readFile('/home/bitx/restored/proj/a.txt')).toBe('one')
    expect(kernel.vfs.readFile('/home/bitx/restored/proj/sub/b.txt')).toBe('two')
  })

  it('gzip compresses a single file (renames to .gz, removes the original) and gunzip reverses it', async () => {
    const gz = await kernel.shell.run('gzip proj/a.txt', ctx)
    expect(gz.exitCode).toBe(0)
    expect(kernel.vfs.exists('/home/bitx/proj/a.txt')).toBe(false)
    expect(kernel.vfs.exists('/home/bitx/proj/a.txt.gz')).toBe(true)

    const gunzip = await kernel.shell.run('gunzip proj/a.txt.gz', ctx)
    expect(gunzip.exitCode).toBe(0)
    expect(kernel.vfs.exists('/home/bitx/proj/a.txt.gz')).toBe(false)
    expect(kernel.vfs.readFile('/home/bitx/proj/a.txt')).toBe('one')
  })

  it('gzip -k keeps the original file alongside the .gz', async () => {
    await kernel.shell.run('gzip -k proj/a.txt', ctx)
    expect(kernel.vfs.exists('/home/bitx/proj/a.txt')).toBe(true)
    expect(kernel.vfs.exists('/home/bitx/proj/a.txt.gz')).toBe(true)
  })

  it('zip creates an archive of multiple files and unzip -l lists without extracting', async () => {
    const zipped = await kernel.shell.run('zip proj.zip proj/a.txt proj/sub/b.txt', ctx)
    expect(zipped.exitCode).toBe(0)
    expect(kernel.vfs.exists('/home/bitx/proj.zip')).toBe(true)

    const listing = await kernel.shell.run('unzip -l proj.zip', ctx)
    expect(listing.stdout).toContain('a.txt')
    expect(listing.stdout).toContain('b.txt')
  })

  it('unzip extracts into -d target directory, preserving file content', async () => {
    await kernel.shell.run('zip proj.zip proj/a.txt', ctx)
    await kernel.shell.run('mkdir out', ctx)
    const result = await kernel.shell.run('unzip proj.zip -d out', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.vfs.readFile('/home/bitx/out/a.txt')).toBe('one')
  })

  it('rejects extracting a file that is not one of our archives', async () => {
    const result = await kernel.shell.run('tar -tf proj/a.txt', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('not in our archive format')
  })
})
