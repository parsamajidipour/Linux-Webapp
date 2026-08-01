import { describe, expect, it } from 'vitest'
import { UserStore } from './Users'

describe('UserStore', () => {
  it('seeds root, bitx and a passwordless guest', () => {
    const users = new UserStore()
    expect(users.findByName('root')?.uid).toBe(0)
    expect(users.findByName('bitx')?.uid).toBe(1000)
    expect(users.findByName('guest')?.passwordHash).toBeNull()
  })

  it('authenticates against the seeded password', () => {
    const users = new UserStore()
    expect(users.authenticate('bitx', 'ubuntu')).toBe(true)
    expect(users.authenticate('bitx', 'wrong')).toBe(false)
  })

  it('guest logs in with any password', () => {
    const users = new UserStore()
    expect(users.authenticate('guest', 'anything')).toBe(true)
  })

  it('setPassword changes future authentication', () => {
    const users = new UserStore()
    users.setPassword('bitx', 'new-pass')
    expect(users.authenticate('bitx', 'ubuntu')).toBe(false)
    expect(users.authenticate('bitx', 'new-pass')).toBe(true)
  })

  it('recognizes sudoers via the sudo group', () => {
    const users = new UserStore()
    expect(users.isSudoer('bitx')).toBe(true)
    expect(users.isSudoer('guest')).toBe(false)
    expect(users.isSudoer('root')).toBe(true)
  })

  it('adds and removes users', () => {
    const users = new UserStore()
    users.addUser({ username: 'alice', gid: 1002, groups: ['alice'], home: '/home/alice', shell: '/bin/bash', fullName: 'Alice', passwordHash: null })
    expect(users.findByName('alice')).toBeDefined()
    users.removeUser('alice')
    expect(users.findByName('alice')).toBeUndefined()
  })

  it('refuses to remove root', () => {
    const users = new UserStore()
    expect(() => users.removeUser('root')).toThrow()
  })

  it('toSubject produces a permission subject matching the user record', () => {
    const users = new UserStore()
    const subject = users.toSubject('bitx')
    expect(subject).toEqual({ username: 'bitx', uid: 1000, gid: 1000, groups: ['bitx', 'sudo'] })
  })
})
