import type { PersistenceAdapter } from '../persistence/PersistenceAdapter'
import type { PermissionSubject } from '../permissions'
import { hashPassword } from './hash'
import type { GroupRecord, UserRecord } from './types'

const PERSIST_KEY = 'users-store'

interface SerializedState {
  users: UserRecord[]
  groups: GroupRecord[]
}

function defaultState(): SerializedState {
  return {
    users: [
      { username: 'root', uid: 0, gid: 0, groups: ['root'], home: '/root', shell: '/bin/bash', fullName: 'root', passwordHash: hashPassword('root') },
      { username: 'bitx', uid: 1000, gid: 1000, groups: ['bitx', 'sudo'], home: '/home/bitx', shell: '/bin/bash', fullName: 'bitx', passwordHash: hashPassword('ubuntu') },
      { username: 'guest', uid: 1001, gid: 1001, groups: ['guest'], home: '/home/guest', shell: '/bin/bash', fullName: 'Guest', passwordHash: null },
    ],
    groups: [
      { name: 'root', gid: 0, members: ['root'] },
      { name: 'sudo', gid: 27, members: ['bitx'] },
      { name: 'bitx', gid: 1000, members: ['bitx'] },
      { name: 'guest', gid: 1001, members: ['guest'] },
    ],
  }
}

export class UserStore {
  private users: UserRecord[]
  private groups: GroupRecord[]
  private persistence?: PersistenceAdapter

  constructor(persistence?: PersistenceAdapter) {
    this.persistence = persistence
    const state = defaultState()
    this.users = state.users
    this.groups = state.groups
  }

  async load(): Promise<void> {
    if (!this.persistence) return
    const saved = await this.persistence.load<SerializedState>(PERSIST_KEY)
    if (saved) {
      this.users = saved.users
      this.groups = saved.groups
    }
  }

  async save(): Promise<void> {
    if (!this.persistence) return
    await this.persistence.save<SerializedState>(PERSIST_KEY, { users: this.users, groups: this.groups })
  }

  list(): UserRecord[] {
    return this.users
  }

  listGroups(): GroupRecord[] {
    return this.groups
  }

  findByName(username: string): UserRecord | undefined {
    return this.users.find((u) => u.username === username)
  }

  findByUid(uid: number): UserRecord | undefined {
    return this.users.find((u) => u.uid === uid)
  }

  authenticate(username: string, password: string): boolean {
    const user = this.findByName(username)
    if (!user) return false
    if (user.passwordHash === null) return true
    return user.passwordHash === hashPassword(password)
  }

  setPassword(username: string, password: string): void {
    const user = this.findByName(username)
    if (!user) throw new Error(`No such user: ${username}`)
    user.passwordHash = hashPassword(password)
  }

  isInGroup(username: string, groupName: string): boolean {
    return this.groups.find((g) => g.name === groupName)?.members.includes(username) ?? false
  }

  isSudoer(username: string): boolean {
    return username === 'root' || this.isInGroup(username, 'sudo')
  }

  addUser(user: Omit<UserRecord, 'uid'> & { uid?: number }): UserRecord {
    if (this.findByName(user.username)) throw new Error(`User already exists: ${user.username}`)
    const uid = user.uid ?? Math.max(...this.users.map((u) => u.uid)) + 1
    const record: UserRecord = { ...user, uid }
    this.users.push(record)
    return record
  }

  removeUser(username: string): void {
    if (username === 'root') throw new Error('Cannot remove root')
    this.users = this.users.filter((u) => u.username !== username)
    for (const group of this.groups) {
      group.members = group.members.filter((m) => m !== username)
    }
  }

  toSubject(username: string): PermissionSubject {
    const user = this.findByName(username)
    if (!user) throw new Error(`No such user: ${username}`)
    return { username: user.username, uid: user.uid, gid: user.gid, groups: user.groups }
  }
}
