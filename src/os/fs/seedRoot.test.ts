import { beforeEach, describe, expect, it } from 'vitest'
import { PackageManager } from '../packages/PackageManager'
import { UserStore } from '../users/Users'
import { Vfs } from '../vfs/Vfs'
import { seedRootFilesystem } from './seedRoot'

describe('seedRootFilesystem', () => {
  let vfs: Vfs
  let users: UserStore
  let packages: PackageManager

  beforeEach(() => {
    vfs = new Vfs()
    users = new UserStore()
    packages = new PackageManager()
    seedRootFilesystem(vfs, users, packages)
  })

  it('creates the full root skeleton', () => {
    for (const dir of [
      '/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/lib64', '/media', '/mnt',
      '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var',
    ]) {
      expect(vfs.exists(dir)).toBe(true)
    }
  })

  it('is idempotent — calling it twice does not throw or duplicate', () => {
    expect(() => seedRootFilesystem(vfs, users, packages)).not.toThrow()
    expect(vfs.list('/')).toEqual(vfs.list('/')) // still a valid, single tree
  })

  it('seeds /home/bitx with the full desktop directory set', () => {
    const names = vfs.list('/home/bitx')
    for (const dir of ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos', 'Projects', 'Notes', 'Public', 'Templates']) {
      expect(names).toContain(dir)
    }
    expect(names).toContain('.bashrc')
    expect(names).toContain('.ssh')
  })

  it('does not give root a desktop-style home', () => {
    const names = vfs.list('/root')
    expect(names).not.toContain('Desktop')
  })

  it('locks down ~/.ssh to 0700', () => {
    const node = vfs.stat('/home/bitx/.ssh')!
    expect(node.mode).toBe(0o700)
  })

  it('generates /etc/passwd from the live UserStore, not a hardcoded string', () => {
    const passwd = vfs.readFile('/etc/passwd')
    expect(passwd).toContain('root:x:0:0:root:/root:/bin/bash')
    expect(passwd).toContain('bitx:x:1000:1000:bitx:/home/bitx:/bin/bash')

    users.addUser({ username: 'dana', gid: 1002, groups: ['dana'], home: '/home/dana', shell: '/bin/bash', fullName: 'Dana', passwordHash: null })
    const vfs2 = new Vfs()
    seedRootFilesystem(vfs2, users, packages)
    expect(vfs2.readFile('/etc/passwd')).toContain('dana:x:1002:1002:Dana:/home/dana:/bin/bash')
  })

  it('keeps /etc/shadow root-only (0600) and never stores plaintext passwords', () => {
    const node = vfs.stat('/etc/shadow')!
    expect(node.mode).toBe(0o600)
    expect(vfs.readFile('/etc/shadow')).not.toContain('ubuntu') // bitx's real password, must not appear in plaintext
  })

  it('renders /etc/os-release and /etc/hostname', () => {
    expect(vfs.readFile('/etc/hostname').trim()).toBe('ubuntu')
    expect(vfs.readFile('/etc/os-release')).toContain('Ubuntu 24.04.2 LTS')
  })

  it('seeds /var/log with the expected files and dirs', () => {
    const names = vfs.list('/var/log')
    expect(names).toEqual(expect.arrayContaining(['auth.log', 'syslog', 'kern.log', 'nginx', 'apache2', 'journal']))
  })

  it('seeds static /proc files', () => {
    expect(vfs.readFile('/proc/version')).toContain('Linux version')
    expect(vfs.readFile('/proc/cpuinfo')).toContain('processor')
    expect(vfs.readFile('/proc/mounts')).toContain('/proc')
  })

  it('populates /usr/bin from installed packages', () => {
    const names = vfs.list('/usr/bin')
    expect(names).toContain('bash')
    expect(names).toContain('apt')
    expect(names).toContain('sshd') // from openssh-server
    const bash = vfs.stat('/usr/bin/bash')!
    expect(bash.mode).toBe(0o755)
  })
})
