import type { UserStore } from './users/Users'
import type { Vfs } from './vfs/Vfs'

/**
 * Minimal boot tree — just enough for the phase-0 kernel smoke test to have somewhere to `mkdir`/`ls`.
 * The full `/bin /etc /proc /var/log ...` filesystem is built in PLAN.md phase 3.
 */
export function seedMinimalTree(vfs: Vfs, users: UserStore): void {
  if (vfs.exists('/home')) return // already seeded (e.g. loaded from persistence)

  vfs.mkdir('/home', { parents: true, owner: 'root', group: 'root' })
  vfs.mkdir('/root', { parents: true, owner: 'root', group: 'root' })
  vfs.mkdir('/tmp', { parents: true, owner: 'root', group: 'root' })
  vfs.chmod('/tmp', 0o777)
  vfs.mkdir('/etc', { parents: true, owner: 'root', group: 'root' })
  vfs.mkdir('/var/log', { parents: true, owner: 'root', group: 'root' })

  for (const user of users.list()) {
    if (user.home === '/root') continue
    vfs.mkdir(user.home, { parents: true, owner: user.username, group: user.username })
    for (const dir of ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos']) {
      vfs.mkdir(`${user.home}/${dir}`, { owner: user.username, group: user.username })
    }
  }

  vfs.writeFile('/etc/hostname', 'ubuntu\n', { owner: 'root', group: 'root' })
  vfs.writeFile(
    '/home/bitx/Documents/welcome.txt',
    'Welcome to Ubuntu Web Desktop!\n\nThis entire desktop environment runs in your browser.\n',
    { owner: 'bitx', group: 'bitx' },
  )
}
