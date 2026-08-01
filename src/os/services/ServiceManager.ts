import type { Vfs } from '../vfs/Vfs'
import type { ServiceRecord, ServiceStatus } from './types'

const DEFAULT_SERVICES: ServiceRecord[] = [
  { name: 'NetworkManager', description: 'network connection manager', status: 'active' },
  { name: 'ssh', description: 'OpenBSD Secure Shell server', status: 'active' },
  { name: 'cron', description: 'regular background program processing daemon', status: 'active' },
  { name: 'systemd-journald', description: 'journal service', status: 'active' },
  { name: 'systemd-logind', description: 'login manager', status: 'active' },
  { name: 'bluetooth', description: 'bluetooth service', status: 'active' },
  { name: 'cups', description: 'CUPS scheduler', status: 'active' },
  { name: 'docker', description: 'Docker Application Container Engine', status: 'inactive' },
  { name: 'nginx', description: 'A high performance web server', status: 'inactive' },
]

export class ServiceManager {
  private services = new Map<string, ServiceRecord>()

  constructor(seedDefaults = true) {
    if (seedDefaults) {
      for (const svc of DEFAULT_SERVICES) this.services.set(svc.name, { ...svc })
    }
  }

  list(): ServiceRecord[] {
    return [...this.services.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  get(name: string): ServiceRecord | undefined {
    return this.services.get(name)
  }

  private setStatus(name: string, status: ServiceStatus): boolean {
    const svc = this.services.get(name)
    if (!svc) return false
    svc.status = status
    return true
  }

  start(name: string): boolean {
    return this.setStatus(name, 'active')
  }

  stop(name: string): boolean {
    return this.setStatus(name, 'inactive')
  }

  /** Appends a syslog-style line to /var/log/syslog (and creates it if missing). No-ops without a VFS. */
  log(vfs: Vfs | undefined, message: string): void {
    if (!vfs) return
    const line = `${new Date().toISOString()} ubuntu ${message}\n`
    try {
      vfs.writeFile('/var/log/syslog', line, { append: true, owner: 'root', group: 'root' })
    } catch {
      // /var/log not seeded yet — safe to ignore, full tree lands in phase 3.
    }
  }
}
