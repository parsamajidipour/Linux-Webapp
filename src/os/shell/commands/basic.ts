import type { CommandRegistry } from '../registry'
import { fail, ok } from '../types'

/**
 * Cross-phase seed commands not yet organized under their own PLAN.md sub-phase file:
 * whoami/id belong to 4.5 (user) but were seeded early since they're needed almost everywhere.
 * echo/wc moved to `text.ts` once 4.12 (text processing) implemented them for real.
 */
export function registerBasicCommands(registry: CommandRegistry): void {
  registry.register('whoami', (_args, ctx) => ok(ctx.currentUser))

  registry.register('id', (_args, ctx) => {
    const user = ctx.users.findByName(ctx.currentUser)
    if (!user) return fail('id: no such user')
    const groups = user.groups
      .map((g) => `${ctx.users.listGroups().find((gr) => gr.name === g)?.gid ?? 0}(${g})`)
      .join(',')
    return ok(`uid=${user.uid}(${user.username}) gid=${user.gid}(${user.groups[0] ?? user.username}) groups=${groups}`)
  })

  registry.register('true', () => ok())
  registry.register('false', () => fail('', 1))
}
