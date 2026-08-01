import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.1 — navigation commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('tree lists nested files with a directory/file summary', async () => {
    await kernel.shell.run('mkdir -p /home/bitx/proj/src', ctx)
    await kernel.shell.run('touch /home/bitx/proj/src/a.ts /home/bitx/proj/README.md', ctx)
    const result = await kernel.shell.run('tree /home/bitx/proj', ctx)
    expect(result.stdout).toContain('README.md')
    expect(result.stdout).toContain('src/')
    expect(result.stdout).toContain('a.ts')
    expect(result.stdout).toMatch(/\d+ directories, \d+ files/)
  })

  it('pushd/popd round-trip the working directory', async () => {
    ctx.cwd = '/home/bitx'
    await kernel.shell.run('pushd /home/bitx/Documents', ctx)
    expect(ctx.cwd).toBe('/home/bitx/Documents')
    expect(ctx.dirStack).toEqual(['/home/bitx'])

    await kernel.shell.run('popd', ctx)
    expect(ctx.cwd).toBe('/home/bitx')
    expect(ctx.dirStack).toEqual([])
  })

  it('popd on an empty stack fails cleanly', async () => {
    const result = await kernel.shell.run('popd', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('directory stack empty')
  })
})

describe('phase 4.2 — file commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('rmdir removes an empty dir but refuses a non-empty one', async () => {
    await kernel.shell.run('mkdir /home/bitx/empty', ctx)
    const ok1 = await kernel.shell.run('rmdir /home/bitx/empty', ctx)
    expect(ok1.exitCode).toBe(0)
    expect(kernel.vfs.exists('/home/bitx/empty')).toBe(false)

    await kernel.shell.run('mkdir /home/bitx/full && touch /home/bitx/full/f.txt', ctx)
    const fails = await kernel.shell.run('rmdir /home/bitx/full', ctx)
    expect(fails.exitCode).not.toBe(0)
  })

  it('cp copies a single file and a directory recursively', async () => {
    await kernel.shell.run('echo hi > /home/bitx/a.txt', ctx)
    await kernel.shell.run('cp /home/bitx/a.txt /home/bitx/b.txt', ctx)
    expect(kernel.vfs.readFile('/home/bitx/b.txt')).toBe('hi')

    await kernel.shell.run('mkdir /home/bitx/src && echo x > /home/bitx/src/f.txt', ctx)
    const result = await kernel.shell.run('cp -r /home/bitx/src /home/bitx/dst', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.vfs.readFile('/home/bitx/dst/f.txt')).toBe('x')
  })

  it('cp with multiple sources copies into a destination directory', async () => {
    await kernel.shell.run('mkdir /home/bitx/bucket', ctx)
    await kernel.shell.run('touch /home/bitx/x.txt /home/bitx/y.txt', ctx)
    const result = await kernel.shell.run('cp /home/bitx/x.txt /home/bitx/y.txt /home/bitx/bucket', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.vfs.list('/home/bitx/bucket').sort()).toEqual(['x.txt', 'y.txt'])
  })

  it('mv renames and moves files', async () => {
    await kernel.shell.run('touch /home/bitx/old.txt', ctx)
    await kernel.shell.run('mv /home/bitx/old.txt /home/bitx/new.txt', ctx)
    expect(kernel.vfs.exists('/home/bitx/old.txt')).toBe(false)
    expect(kernel.vfs.exists('/home/bitx/new.txt')).toBe(true)
  })

  it('ln -s creates a symlink visible in ls -l; plain ln is rejected', async () => {
    await kernel.shell.run('touch /home/bitx/target.txt', ctx)
    const linked = await kernel.shell.run('ln -s /home/bitx/target.txt /home/bitx/link.txt', ctx)
    expect(linked.exitCode).toBe(0)

    const lsOut = await kernel.shell.run('ls -l /home/bitx', ctx)
    expect(lsOut.stdout).toContain('link.txt -> /home/bitx/target.txt')

    const hardLink = await kernel.shell.run('ln /home/bitx/target.txt /home/bitx/hard.txt', ctx)
    expect(hardLink.exitCode).not.toBe(0)
    expect(hardLink.stderr).toContain('-s')
  })

  it('cat with no args echoes stdin (works in a pipeline)', async () => {
    const result = await kernel.shell.run('echo piped | cat', ctx)
    expect(result.stdout).toBe('piped')
  })

  it('less behaves the same as cat for a real file', async () => {
    await kernel.shell.run('echo content > /home/bitx/f.txt', ctx)
    const result = await kernel.shell.run('less /home/bitx/f.txt', ctx)
    expect(result.stdout).toBe('content')
  })

  it('head and tail respect -n', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n')
    await kernel.shell.run(`echo "${lines}" > /home/bitx/many.txt`, ctx)

    const head = await kernel.shell.run('head -n 3 /home/bitx/many.txt', ctx)
    expect(head.stdout.split('\n')).toEqual(['line1', 'line2', 'line3'])

    const tail = await kernel.shell.run('tail -n 2 /home/bitx/many.txt', ctx)
    expect(tail.stdout.split('\n')).toEqual(['line19', 'line20'])
  })

  it('file identifies directories, symlinks, and text files', async () => {
    await kernel.shell.run('touch /home/bitx/note.txt', ctx)
    const result = await kernel.shell.run('file /home/bitx/note.txt /home/bitx/Documents', ctx)
    expect(result.stdout).toContain('note.txt: empty')
    expect(result.stdout).toContain('Documents: directory')
  })

  it('stat reports size, type, and owner', async () => {
    await kernel.shell.run('echo hello > /home/bitx/s.txt', ctx)
    const result = await kernel.shell.run('stat /home/bitx/s.txt', ctx)
    expect(result.stdout).toContain('Type: regular file')
    expect(result.stdout).toContain('Uid: (bitx)')
  })
})
