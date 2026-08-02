import type { NotificationBus } from '../notifications'
import type { PackageManager } from '../packages/PackageManager'
import type { ProcessManager } from '../process/ProcessManager'
import type { ServiceManager } from '../services/ServiceManager'
import type { SettingsStore } from '../settings/SettingsStore'
import type { UserStore } from '../users/Users'
import type { Vfs } from '../vfs/Vfs'
import type { CommandRegistry } from './registry'

export interface ShellContext {
  vfs: Vfs
  users: UserStore
  processes: ProcessManager
  packages: PackageManager
  services: ServiceManager
  settings: SettingsStore
  /** Commands emit real OS events here (package installed, service started) — the desktop
   * shell subscribes and turns them into notification toasts. */
  notifications: NotificationBus
  /** Read-only introspection for commands like `type`/`command -v`. */
  registry: CommandRegistry
  /** Mutable — commands like `su` update this directly. */
  currentUser: string
  /** Mutable — `cd` updates this directly. */
  cwd: string
  /** Mutable — `pushd`/`popd` update this directly. Does not include `cwd` itself. */
  dirStack: string[]
  /** Mutable — `export` updates this directly. `$?` is kept here too. */
  env: Record<string, string>
  /** Mutable — background (`cmd &`) jobs for this session; `jobs`/`bg`/`fg` read/pop from it. */
  jobs: Job[]
  /** Mutable — `alias`/`unalias` update this directly; the Shell expands the first word against it. */
  aliases: Record<string, string>
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface Job {
  id: number
  pid: number
  command: string
  status: 'running' | 'done'
  result: CommandResult
}

export type CommandHandler = (args: string[], ctx: ShellContext, stdin: string) => CommandResult | Promise<CommandResult>

export function ok(stdout = ''): CommandResult {
  return { stdout, stderr: '', exitCode: 0 }
}

export function fail(stderr: string, exitCode = 1): CommandResult {
  return { stdout: '', stderr, exitCode }
}
