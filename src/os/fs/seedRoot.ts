import { binariesFor } from '../packages/binaries'
import type { PackageManager } from '../packages/PackageManager'
import type { UserStore } from '../users/Users'
import type { Vfs } from '../vfs/Vfs'
import { renderGroup, renderPasswd, renderShadow } from './etcFiles'
import { PROC_CPUINFO, PROC_MOUNTS, PROC_VERSION, renderProcMeminfo, renderProcUptime } from './procFiles'

const HOME_SUBDIRS = ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos', 'Projects', 'Notes', 'Public', 'Templates']

const ROOT_SKELETON = [
  '/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/lib64', '/media', '/mnt',
  '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var',
]

const OS_RELEASE = `PRETTY_NAME="Ubuntu 24.04.2 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.2 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
UBUNTU_CODENAME=noble
`

const SUDOERS = `# /etc/sudoers
root    ALL=(ALL:ALL) ALL
%sudo   ALL=(ALL:ALL) ALL
`


function seedHome(vfs: Vfs, username: string, home: string, desktopDirs: boolean): void {
  vfs.mkdir(home, { parents: true, owner: username, group: username })
  if (desktopDirs) {
    for (const dir of HOME_SUBDIRS) {
      vfs.mkdir(`${home}/${dir}`, { owner: username, group: username })
    }
  }
  vfs.mkdir(`${home}/.ssh`, { owner: username, group: username })
  vfs.chmod(`${home}/.ssh`, 0o700)
  for (const dir of ['.config', '.local', '.cache']) {
    vfs.mkdir(`${home}/${dir}`, { owner: username, group: username })
  }
  vfs.writeFile(`${home}/.bashrc`, '# ~/.bashrc\nexport PS1="\\u@\\h:\\w$ "\nalias ll="ls -alF"\n', {
    owner: username,
    group: username,
  })
  vfs.writeFile(`${home}/.profile`, '# ~/.profile\n[ -n "$BASH_VERSION" ] && [ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"\n', {
    owner: username,
    group: username,
  })
}

/** Builds the full root filesystem tree (PLAN.md phase 3). Idempotent — no-ops if `/etc/passwd` already exists. */
export function seedRootFilesystem(vfs: Vfs, users: UserStore, packages: PackageManager): void {
  if (vfs.exists('/etc/passwd')) return

  for (const dir of ROOT_SKELETON) {
    vfs.mkdir(dir, { parents: true, owner: 'root', group: 'root' })
  }
  vfs.chmod('/tmp', 0o777)

  for (const user of users.list()) {
    seedHome(vfs, user.username, user.home, user.username !== 'root')
  }
  vfs.writeFile(
    '/home/bitx/Documents/welcome.txt',
    'Welcome to Ubuntu Web Desktop!\n\nThis entire desktop environment runs in your browser.\n',
    { owner: 'bitx', group: 'bitx' },
  )

  // /etc — generated from the live user/group tables, not hardcoded strings.
  vfs.writeFile('/etc/passwd', renderPasswd(users.list()), { owner: 'root', group: 'root' })
  vfs.writeFile('/etc/shadow', renderShadow(users.list()), { owner: 'root', group: 'root' })
  vfs.chmod('/etc/shadow', 0o600)
  vfs.writeFile('/etc/group', renderGroup(users.listGroups()), { owner: 'root', group: 'root' })
  vfs.writeFile('/etc/hostname', 'ubuntu\n', { owner: 'root', group: 'root' })
  vfs.writeFile(
    '/etc/hosts',
    '127.0.0.1\tlocalhost\n127.0.1.1\tubuntu\n::1\t\tlocalhost ip6-localhost ip6-loopback\n',
    { owner: 'root', group: 'root' },
  )
  vfs.writeFile('/etc/resolv.conf', 'nameserver 127.0.0.53\noptions edns0 trust-ad\n', { owner: 'root', group: 'root' })
  vfs.writeFile(
    '/etc/fstab',
    '# <file system> <mount point> <type> <options> <dump> <pass>\n/dev/sda1\t/\text4\terrors=remount-ro\t0\t1\n',
    { owner: 'root', group: 'root' },
  )
  vfs.writeFile('/etc/os-release', OS_RELEASE, { owner: 'root', group: 'root' })
  vfs.writeFile('/etc/issue', 'Ubuntu 24.04.2 LTS \\n \\l\n\n', { owner: 'root', group: 'root' })
  vfs.writeFile('/etc/sudoers', SUDOERS, { owner: 'root', group: 'root' })
  vfs.chmod('/etc/sudoers', 0o440)
  vfs.mkdir('/etc/ssh', { owner: 'root', group: 'root' })
  vfs.writeFile('/etc/ssh/sshd_config', 'Port 22\nPermitRootLogin no\nPasswordAuthentication yes\n', {
    owner: 'root',
    group: 'root',
  })
  vfs.mkdir('/etc/systemd', { owner: 'root', group: 'root' })
  vfs.mkdir('/etc/nginx', { owner: 'root', group: 'root' })

  // /var/log
  vfs.mkdir('/var/log', { parents: true, owner: 'root', group: 'root' })
  vfs.writeFile('/var/log/auth.log', '', { owner: 'root', group: 'root' })
  vfs.writeFile('/var/log/syslog', '', { owner: 'root', group: 'root' })
  vfs.writeFile('/var/log/kern.log', '', { owner: 'root', group: 'root' })
  vfs.mkdir('/var/log/nginx', { owner: 'root', group: 'root' })
  vfs.mkdir('/var/log/apache2', { owner: 'root', group: 'root' })
  vfs.mkdir('/var/log/journal', { owner: 'root', group: 'root' })

  // /proc — static seed content; live values are wired via vfs.registerDynamic() by the Kernel.
  vfs.writeFile('/proc/cpuinfo', PROC_CPUINFO, { owner: 'root', group: 'root' })
  vfs.writeFile('/proc/meminfo', renderProcMeminfo(), { owner: 'root', group: 'root' })
  vfs.writeFile('/proc/uptime', renderProcUptime(0), { owner: 'root', group: 'root' })
  vfs.writeFile('/proc/version', PROC_VERSION, { owner: 'root', group: 'root' })
  vfs.writeFile('/proc/mounts', PROC_MOUNTS, { owner: 'root', group: 'root' })

  // /usr
  vfs.mkdir('/usr/bin', { parents: true, owner: 'root', group: 'root' })
  vfs.mkdir('/usr/share', { owner: 'root', group: 'root' })
  vfs.mkdir('/usr/local', { owner: 'root', group: 'root' })
  for (const pkg of packages.list()) {
    const binaries = binariesFor(pkg.name)
    for (const bin of binaries) {
      vfs.writeFile(`/usr/bin/${bin}`, `[fake binary for package ${pkg.name} ${pkg.version}]`, {
        owner: 'root',
        group: 'root',
      })
      vfs.chmod(`/usr/bin/${bin}`, 0o755)
    }
  }
}
