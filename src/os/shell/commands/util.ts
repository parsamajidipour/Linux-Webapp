import type { ShellContext } from '../types'

export function homeOf(ctx: ShellContext): string {
  return ctx.users.findByName(ctx.currentUser)?.home ?? '/root'
}

/** Resolves `target` against cwd/home and reads it through the VFS with the current user as actor. */
export function readFileArg(ctx: ShellContext, target: string): string {
  const abs = ctx.vfs.resolve(target, ctx.cwd, homeOf(ctx))
  return ctx.vfs.readFile(abs, { actor: ctx.users.toSubject(ctx.currentUser) })
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Applies the shell's current umask (`ctx.env.UMASK`, octal) to a default creation mode. */
export function modeWithUmask(defaultMode: number, ctx: ShellContext): number {
  const umask = parseInt(ctx.env.UMASK ?? '0022', 8)
  return defaultMode & ~umask
}

/** Joins every `-`-prefixed arg into one string so combined short flags (`-sh` = `-s -h`) work. */
export function flagChars(args: string[]): string {
  return args.filter((a) => a.startsWith('-') && !a.startsWith('--')).join('')
}
