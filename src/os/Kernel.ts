import { seedRootFilesystem } from './fs/seedRoot'
import { renderProcMeminfo, renderProcUptime } from './fs/procFiles'
import { PackageManager } from './packages/PackageManager'
import type { PersistenceAdapter } from './persistence/PersistenceAdapter'
import { ProcessManager } from './process/ProcessManager'
import { ServiceManager } from './services/ServiceManager'
import { registerArchiveCommands } from './shell/commands/archive'
import { registerBasicCommands } from './shell/commands/basic'
import { registerFileCommands } from './shell/commands/fileOps'
import { registerNavigationCommands } from './shell/commands/navigation'
import { registerDiskCommands } from './shell/commands/disk'
import { registerNetworkCommands } from './shell/commands/network'
import { registerPackageCommands } from './shell/commands/packages'
import { registerPermissionCommands } from './shell/commands/permissions'
import { registerProcessCommands } from './shell/commands/process'
import { registerSearchCommands } from './shell/commands/search'
import { registerSystemCommands } from './shell/commands/system'
import { registerUserCommands } from './shell/commands/user'
import { CommandRegistry } from './shell/registry'
import { Shell } from './shell/Shell'
import type { ShellContext } from './shell/types'
import { SettingsStore } from './settings/SettingsStore'
import { UserStore } from './users/Users'
import { Vfs } from './vfs/Vfs'

export interface KernelPersistence {
  vfs?: PersistenceAdapter
  users?: PersistenceAdapter
  packages?: PersistenceAdapter
  settings?: PersistenceAdapter
}

/** Wires every OS subsystem together and boots them from persistence (or seeds fresh state). */
export class Kernel {
  readonly vfs: Vfs
  readonly users: UserStore
  readonly processes: ProcessManager
  readonly packages: PackageManager
  readonly services: ServiceManager
  readonly settings: SettingsStore
  readonly registry: CommandRegistry
  readonly shell: Shell

  readonly bootTime = Date.now()
  booted = false

  private readonly hasPersistence: boolean
  private autosaveTimer: ReturnType<typeof setInterval> | null = null

  constructor(persistence: KernelPersistence = {}) {
    this.hasPersistence = Boolean(persistence.vfs || persistence.users || persistence.packages)
    this.vfs = new Vfs(persistence.vfs)
    this.users = new UserStore(persistence.users)
    this.processes = new ProcessManager()
    this.packages = new PackageManager(persistence.packages)
    this.services = new ServiceManager()
    this.settings = new SettingsStore(persistence.settings)

    this.registry = new CommandRegistry()
    registerNavigationCommands(this.registry)
    registerFileCommands(this.registry)
    registerSearchCommands(this.registry)
    registerPermissionCommands(this.registry)
    registerUserCommands(this.registry)
    registerProcessCommands(this.registry)
    registerNetworkCommands(this.registry)
    registerPackageCommands(this.registry)
    registerDiskCommands(this.registry)
    registerSystemCommands(this.registry)
    registerArchiveCommands(this.registry)
    registerBasicCommands(this.registry)
    this.shell = new Shell(this.registry)
  }

  async boot(): Promise<void> {
    await Promise.all([this.vfs.load(), this.users.load(), this.packages.load(), this.settings.load()])
    seedRootFilesystem(this.vfs, this.users, this.packages)

    this.vfs.registerDynamic('/proc/uptime', () => renderProcUptime(this.processes.uptimeSeconds()))
    this.vfs.registerDynamic('/proc/meminfo', () => renderProcMeminfo())

    for (const svc of this.services.list()) {
      if (svc.status === 'active') this.services.log(this.vfs, `${svc.name}[1]: Started ${svc.description}.`)
    }

    // Belt-and-suspenders: Shell.run() already persists after every command, but future
    // subsystems that mutate state outside the shell (GUI apps) won't go through that path.
    if (this.hasPersistence) {
      this.autosaveTimer = setInterval(() => void this.persist(), 4000)
    }

    this.booted = true
  }

  async persist(): Promise<void> {
    await Promise.all([this.vfs.save(), this.users.save(), this.packages.save()])
  }

  dispose(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer)
  }

  createContext(username: string): ShellContext {
    const home = this.users.findByName(username)?.home ?? '/root'
    return {
      vfs: this.vfs,
      users: this.users,
      processes: this.processes,
      packages: this.packages,
      services: this.services,
      settings: this.settings,
      registry: this.registry,
      currentUser: username,
      cwd: home,
      dirStack: [],
      jobs: [],
      aliases: {},
      env: {
        HOME: home,
        USER: username,
        PATH: '/usr/local/bin:/usr/bin:/bin',
        LANG: 'en_US.UTF-8',
        SHELL: '/bin/bash',
        UMASK: '0022',
        '?': '0',
      },
    }
  }
}
