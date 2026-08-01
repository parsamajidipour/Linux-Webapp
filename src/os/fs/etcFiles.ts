import type { GroupRecord, UserRecord } from '../users/types'

/** Renders `/etc/passwd` from live UserStore records — not a static string. */
export function renderPasswd(users: UserRecord[]): string {
  return users.map((u) => `${u.username}:x:${u.uid}:${u.gid}:${u.fullName}:${u.home}:${u.shell}`).join('\n') + '\n'
}

/** Renders `/etc/shadow` from live UserStore records. `!` marks a locked (passwordless-login-only) account. */
export function renderShadow(users: UserRecord[]): string {
  return users.map((u) => `${u.username}:${u.passwordHash ?? '!'}:19849:0:99999:7:::`).join('\n') + '\n'
}

/** Renders `/etc/group` from live UserStore records. */
export function renderGroup(groups: GroupRecord[]): string {
  return groups.map((g) => `${g.name}:x:${g.gid}:${g.members.join(',')}`).join('\n') + '\n'
}
