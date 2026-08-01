import type { PackageManager } from '../packages/PackageManager'
import type { ProcessManager } from '../process/ProcessManager'
import type { ServiceManager } from '../services/ServiceManager'
import type { SettingsStore } from '../settings/SettingsStore'
import type { UserStore } from '../users/Users'
import type { Vfs } from '../vfs/Vfs'

export interface ShellContext {
  vfs: Vfs
  users: UserStore
  processes: ProcessManager
  packages: PackageManager
  services: ServiceManager
  settings: SettingsStore
  /** Mutable — commands like `su` update this directly. */
  currentUser: string
  /** Mutable — `cd` updates this directly. */
  cwd: string
  /** Mutable — `pushd`/`popd` update this directly. Does not include `cwd` itself. */
  dirStack: string[]
  /** Mutable — `export` updates this directly. `$?` is kept here too. */
  env: Record<string, string>
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export type CommandHandler = (args: string[], ctx: ShellContext, stdin: string) => CommandResult | Promise<CommandResult>

export function ok(stdout = ''): CommandResult {
  return { stdout, stderr: '', exitCode: 0 }
}

export function fail(stderr: string, exitCode = 1): CommandResult {
  return { stdout: '', stderr, exitCode }
}
