import { describe, expect, it } from 'vitest'
import { Vfs, AlreadyExistsError, NotEmptyError, NotFoundError, PermissionError } from './Vfs'

function makeVfs() {
  const vfs = new Vfs()
  vfs.mkdir('/home', { owner: 'root', group: 'root' })
  vfs.mkdir('/home/bitx', { owner: 'bitx', group: 'bitx' })
  return vfs
}

describe('Vfs', () => {
  it('creates directories and lists them', () => {
    const vfs = makeVfs()
    vfs.mkdir('/home/bitx/Documents', { owner: 'bitx', group: 'bitx' })
    expect(vfs.list('/home/bitx')).toEqual(['Documents'])
  })

  it('supports mkdir -p for nested paths', () => {
    const vfs = makeVfs()
    vfs.mkdir('/home/bitx/a/b/c', { parents: true, owner: 'bitx', group: 'bitx' })
    expect(vfs.exists('/home/bitx/a/b/c')).toBe(true)
  })

  it('throws when creating a dir that already exists without -p', () => {
    const vfs = makeVfs()
    expect(() => vfs.mkdir('/home/bitx', { owner: 'bitx', group: 'bitx' })).toThrow(AlreadyExistsError)
  })

  it('writes and reads file content', () => {
    const vfs = makeVfs()
    vfs.writeFile('/home/bitx/notes.txt', 'hello', { owner: 'bitx', group: 'bitx' })
    expect(vfs.readFile('/home/bitx/notes.txt')).toBe('hello')
  })

  it('appends when append:true', () => {
    const vfs = makeVfs()
    vfs.writeFile('/home/bitx/notes.txt', 'hello', { owner: 'bitx', group: 'bitx' })
    vfs.writeFile('/home/bitx/notes.txt', ' world', { owner: 'bitx', group: 'bitx', append: true })
    expect(vfs.readFile('/home/bitx/notes.txt')).toBe('hello world')
  })

  it('removes files and rejects non-empty dirs without recursive', () => {
    const vfs = makeVfs()
    vfs.writeFile('/home/bitx/notes.txt', 'x', { owner: 'bitx', group: 'bitx' })
    vfs.remove('/home/bitx/notes.txt')
    expect(vfs.exists('/home/bitx/notes.txt')).toBe(false)

    vfs.mkdir('/home/bitx/dir', { owner: 'bitx', group: 'bitx' })
    vfs.writeFile('/home/bitx/dir/f.txt', 'x', { owner: 'bitx', group: 'bitx' })
    expect(() => vfs.remove('/home/bitx/dir')).toThrow(NotEmptyError)
    vfs.remove('/home/bitx/dir', { recursive: true })
    expect(vfs.exists('/home/bitx/dir')).toBe(false)
  })

  it('moves and copies files', () => {
    const vfs = makeVfs()
    vfs.writeFile('/home/bitx/a.txt', 'content', { owner: 'bitx', group: 'bitx' })
    vfs.move('/home/bitx/a.txt', '/home/bitx/b.txt')
    expect(vfs.exists('/home/bitx/a.txt')).toBe(false)
    expect(vfs.readFile('/home/bitx/b.txt')).toBe('content')

    vfs.copy('/home/bitx/b.txt', '/home/bitx/c.txt')
    expect(vfs.readFile('/home/bitx/c.txt')).toBe('content')
    expect(vfs.readFile('/home/bitx/b.txt')).toBe('content')
  })

  it('copies directories recursively', () => {
    const vfs = makeVfs()
    vfs.mkdir('/home/bitx/src', { owner: 'bitx', group: 'bitx' })
    vfs.writeFile('/home/bitx/src/f.txt', 'x', { owner: 'bitx', group: 'bitx' })
    vfs.copy('/home/bitx/src', '/home/bitx/dest', { recursive: true })
    expect(vfs.readFile('/home/bitx/dest/f.txt')).toBe('x')
  })

  it('throws NotFoundError for missing paths', () => {
    const vfs = makeVfs()
    expect(() => vfs.readFile('/nope')).toThrow(NotFoundError)
  })

  it('enforces permission checks when an actor is passed', () => {
    const vfs = makeVfs()
    vfs.writeFile('/home/bitx/secret.txt', 'shh', { owner: 'bitx', group: 'bitx' })
    vfs.chmod('/home/bitx/secret.txt', 0o600)

    const other = { username: 'guest', uid: 1001, gid: 1001, groups: ['guest'] }
    expect(() => vfs.readFile('/home/bitx/secret.txt', { actor: other })).toThrow(PermissionError)

    const root = { username: 'root', uid: 0, gid: 0, groups: ['root'] }
    expect(() => vfs.readFile('/home/bitx/secret.txt', { actor: root })).not.toThrow()
  })

  it('computes recursive size via sizeOf', () => {
    const vfs = makeVfs()
    vfs.writeFile('/home/bitx/a.txt', '12345', { owner: 'bitx', group: 'bitx' })
    vfs.writeFile('/home/bitx/b.txt', '123', { owner: 'bitx', group: 'bitx' })
    expect(vfs.sizeOf('/home/bitx')).toBe(8)
  })

  it('resolves relative paths, .., and ~', () => {
    const vfs = makeVfs()
    expect(vfs.resolve('..', '/home/bitx', '/home/bitx')).toBe('/home')
    expect(vfs.resolve('./x', '/home/bitx', '/home/bitx')).toBe('/home/bitx/x')
    expect(vfs.resolve('~/Documents', '/', '/home/bitx')).toBe('/home/bitx/Documents')
  })
})
