import type { PersistenceAdapter } from '../persistence/PersistenceAdapter'
import type { PackageRecord } from './types'

const PERSIST_KEY = 'packages-installed'

const CATALOG: PackageRecord[] = [
  { name: 'coreutils', version: '9.4-3ubuntu6', description: 'GNU core utilities' },
  { name: 'bash', version: '5.2.21-2ubuntu4', description: 'GNU Bourne Again SHell' },
  { name: 'apt', version: '2.7.14', description: 'commandline package manager' },
  { name: 'dpkg', version: '1.22.6ubuntu6', description: 'Debian package management system' },
  { name: 'systemd', version: '255.4-1ubuntu8', description: 'system and service manager' },
  { name: 'vim', version: '9.1.0016-1ubuntu7', description: 'Vi IMproved - enhanced vi editor' },
  { name: 'git', version: '1:2.43.0-1ubuntu7', description: 'fast, scalable, distributed revision control system' },
  { name: 'curl', version: '8.5.0-2ubuntu10', description: 'command line tool for transferring data with URL syntax' },
  { name: 'wget', version: '1.21.4-1ubuntu4', description: 'retrieves files from the web' },
  { name: 'htop', version: '3.3.0-4build1', description: 'interactive processes viewer' },
  { name: 'tree', version: '2.1.1-2', description: 'displays an indented directory tree' },
  { name: 'neofetch', version: '7.1.0-4', description: 'fast, highly customizable system info script' },
  { name: 'python3', version: '3.12.3-0ubuntu2', description: 'interactive high-level object-oriented language' },
  { name: 'nodejs', version: '18.19.1+dfsg-6ubuntu5', description: 'evented I/O for V8 JavaScript' },
  { name: 'docker.io', version: '24.0.7-0ubuntu4', description: 'Linux container runtime' },
  { name: 'nginx', version: '1.24.0-2ubuntu7', description: 'small, powerful, scalable web/proxy server' },
  { name: 'openssh-server', version: '1:9.6p1-3ubuntu13', description: 'secure shell (SSH) server' },
]

const PREINSTALLED = ['coreutils', 'bash', 'apt', 'dpkg', 'systemd', 'openssh-server']

export class PackageManager {
  private installed = new Map<string, PackageRecord>()
  private persistence?: PersistenceAdapter

  constructor(persistence?: PersistenceAdapter, seedDefaults = true) {
    this.persistence = persistence
    if (seedDefaults) {
      for (const name of PREINSTALLED) {
        const pkg = CATALOG.find((p) => p.name === name)
        if (pkg) this.installed.set(name, { ...pkg, installedAt: Date.now() })
      }
    }
  }

  async load(): Promise<void> {
    if (!this.persistence) return
    const saved = await this.persistence.load<PackageRecord[]>(PERSIST_KEY)
    if (saved) this.installed = new Map(saved.map((p) => [p.name, p]))
  }

  async save(): Promise<void> {
    if (!this.persistence) return
    await this.persistence.save(PERSIST_KEY, [...this.installed.values()])
  }

  search(query: string): PackageRecord[] {
    const q = query.toLowerCase()
    return CATALOG.filter((p) => p.name.includes(q) || p.description.toLowerCase().includes(q))
  }

  list(): PackageRecord[] {
    return [...this.installed.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  isInstalled(name: string): boolean {
    return this.installed.has(name)
  }

  install(name: string): { ok: boolean; message: string } {
    if (this.installed.has(name)) return { ok: true, message: `${name} is already the newest version.` }
    const pkg = CATALOG.find((p) => p.name === name)
    if (!pkg) return { ok: false, message: `E: Unable to locate package ${name}` }
    this.installed.set(name, { ...pkg, installedAt: Date.now() })
    return { ok: true, message: `Setting up ${name} (${pkg.version}) ...` }
  }

  remove(name: string): { ok: boolean; message: string } {
    if (!this.installed.has(name)) return { ok: false, message: `E: Package '${name}' is not installed, so not removed` }
    if (PREINSTALLED.includes(name)) return { ok: false, message: `E: '${name}' is essential and cannot be removed` }
    this.installed.delete(name)
    return { ok: true, message: `Removing ${name} ...` }
  }
}
