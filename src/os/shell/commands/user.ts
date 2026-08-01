import type { CommandRegistry } from '../registry'
import { fail, ok } from '../types'

/**
 * PLAN.md phase 4.5 — User: whoami/id already live in basic.ts; groups/passwd/su here.
 * `sudo` is deliberately NOT a registry command — it's handled as a shell-level prefix in
 * Shell.ts, the same way real sudo isn't a builtin either (it re-execs a process as root).
 */
export function registerUserCommands(registry: CommandRegistry): void {
  registry.register('groups', (args, ctx) => {
    const username = args[0] ?? ctx.currentUser
    const user = ctx.users.findByName(username)
    if (!user) return fail(`groups: '${username}': no such user`)
    return ok(user.groups.join(' '))
  })

  registry.register('passwd', (args, ctx) => {
    // Real passwd prompts twice with hidden input. This terminal has no multi-turn masked
    // prompt yet, so the new password is taken as a plain trailing argument for now.
    const target = args.length >= 2 ? args[0] : ctx.currentUser
    const newPassword = args.length >= 2 ? args[1] : args[0]

    if (!newPassword) return fail('usage: passwd [username] newpassword')
    if (target !== ctx.currentUser && ctx.currentUser !== 'root') {
      return fail('passwd: Permission denied')
    }
    if (!ctx.users.findByName(target)) return fail(`passwd: user '${target}' does not exist`)

    ctx.users.setPassword(target, newPassword)
    return ok(`passwd: password updated successfully for ${target}`)
  })

  registry.register('su', (args, ctx) => {
    const target = args[0] ?? 'root'
    const user = ctx.users.findByName(target)
    if (!user) return fail(`su: user ${target} does not exist`)

    // No interactive password prompt yet, so authority is derived from trust already
    // established elsewhere: you can always "su" to yourself, root can become anyone,
    // and a sudoer can become root (the same trust boundary `sudo` already grants).
    const alreadyThem = target === ctx.currentUser
    const isRootActor = ctx.currentUser === 'root'
    const sudoerBecomingRoot = target === 'root' && ctx.users.isSudoer(ctx.currentUser)
    if (!alreadyThem && !isRootActor && !sudoerBecomingRoot) {
      return fail('su: Authentication failure')
    }

    ctx.currentUser = target
    ctx.cwd = user.home
    ctx.env.HOME = user.home
    ctx.env.USER = target
    return ok()
  })
}
