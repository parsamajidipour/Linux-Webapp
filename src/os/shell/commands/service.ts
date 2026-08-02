import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'

function requireRoot(ctx: ShellContext, verb: string, name: string) {
  if (ctx.currentUser !== 'root') return `Failed to ${verb} ${name}.service: Access denied`
  return null
}

/** PLAN.md phase 1.3 — `systemctl`: the only real, interactive trigger for "a service started",
 * which the desktop shell turns into a real notification (see `notifications.ts`). Also the
 * first command anywhere in the shell wired to `ctx.services` (ServiceManager existed since
 * phase 0 but had no interactive command using it until now). */
export function registerServiceCommands(registry: CommandRegistry): void {
  registry.register('systemctl', (args, ctx) => {
    const [sub, name] = args

    if (sub === 'list-units' || sub === 'list-unit-files' || (!sub && !name)) {
      const rows = ctx.services.list().map((s) => `${s.name.padEnd(24)}${s.status.padEnd(10)}${s.description}`)
      return ok(['UNIT                    STATE     DESCRIPTION', ...rows].join('\n'))
    }

    if (!name) return fail('usage: systemctl {start|stop|status|restart} SERVICE')
    const svc = ctx.services.get(name)
    if (!svc) return fail(`Unit ${name}.service could not be found.`)

    if (sub === 'status') {
      return ok(`● ${svc.name}.service - ${svc.description}\n   Active: ${svc.status}`)
    }

    if (sub === 'start') {
      const denied = requireRoot(ctx, 'start', name)
      if (denied) return fail(denied)
      if (svc.status === 'active') return ok()
      ctx.services.start(name)
      ctx.services.log(ctx.vfs, `systemd[1]: Started ${svc.description}.`)
      ctx.notifications.emit({ app: 'systemd', title: 'Service started', body: `${name}.service is now active (running).` })
      return ok()
    }

    if (sub === 'stop') {
      const denied = requireRoot(ctx, 'stop', name)
      if (denied) return fail(denied)
      if (svc.status === 'inactive') return ok()
      ctx.services.stop(name)
      ctx.services.log(ctx.vfs, `systemd[1]: Stopped ${svc.description}.`)
      return ok()
    }

    if (sub === 'restart') {
      const denied = requireRoot(ctx, 'restart', name)
      if (denied) return fail(denied)
      ctx.services.stop(name)
      ctx.services.start(name)
      ctx.services.log(ctx.vfs, `systemd[1]: Stopped ${svc.description}.`)
      ctx.services.log(ctx.vfs, `systemd[1]: Started ${svc.description}.`)
      ctx.notifications.emit({ app: 'systemd', title: 'Service restarted', body: `${name}.service is now active (running).` })
      return ok()
    }

    return fail(`systemctl: unrecognized command '${sub}'`)
  })
}
