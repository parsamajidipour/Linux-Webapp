import { binariesFor } from '../../packages/binaries'
import type { CommandRegistry } from '../registry'
import { fail, ok, type CommandResult, type ShellContext } from '../types'

function requireRoot(ctx: ShellContext): string | null {
  if (ctx.currentUser === 'root') return null
  return 'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock, are you root?'
}

function aptDispatch(args: string[], ctx: ShellContext): CommandResult {
  const sub = args[0]
  const rest = args.slice(1).filter((a) => !a.startsWith('-'))

  if (sub === 'update') {
    const denied = requireRoot(ctx)
    if (denied) return fail(denied, 100)
    return ok(
      [
        'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease',
        'Get:2 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]',
        'Hit:3 http://archive.ubuntu.com/ubuntu noble-updates InRelease',
        'Fetched 126 kB in 1s (145 kB/s)',
        'Reading package lists... Done',
      ].join('\n'),
    )
  }

  if (sub === 'search') {
    const query = rest[0]
    if (!query) return fail('usage: apt search QUERY')
    const matches = ctx.packages.search(query)
    if (!matches.length) return ok('')
    return ok(matches.map((p) => `${p.name}/noble ${p.version} amd64\n  ${p.description}`).join('\n\n'))
  }

  if (sub === 'list' && args.includes('--installed')) {
    return ok(ctx.packages.list().map((p) => `${p.name}/noble,now ${p.version} amd64 [installed]`).join('\n'))
  }

  if (sub === 'install') {
    const denied = requireRoot(ctx)
    if (denied) return fail(denied, 100)
    const name = rest[0]
    if (!name) return fail('usage: apt install PACKAGE')

    const wasInstalled = ctx.packages.isInstalled(name)
    const result = ctx.packages.install(name)
    if (!result.ok) return fail(result.message, 100)

    if (!wasInstalled) {
      for (const bin of binariesFor(name)) {
        ctx.vfs.writeFile(`/usr/bin/${bin}`, `[fake binary for package ${name}]`, { owner: 'root', group: 'root' })
        ctx.vfs.chmod(`/usr/bin/${bin}`, 0o755)
      }
    }
    return ok(['Reading package lists... Done', 'Building dependency tree... Done', result.message].join('\n'))
  }

  if (sub === 'remove' || sub === 'purge') {
    const denied = requireRoot(ctx)
    if (denied) return fail(denied, 100)
    const name = rest[0]
    if (!name) return fail('usage: apt remove PACKAGE')

    const result = ctx.packages.remove(name)
    if (!result.ok) return fail(result.message, 100)

    for (const bin of binariesFor(name)) {
      const path = `/usr/bin/${bin}`
      if (ctx.vfs.exists(path)) ctx.vfs.remove(path)
    }
    return ok(['Reading package lists... Done', result.message].join('\n'))
  }

  return ok('apt 2.7.14 (amd64)\nUsage: apt [update|install|remove|search|list --installed] ...')
}

/** PLAN.md phase 4.8 — Package: apt update/install/remove/search, dpkg. */
export function registerPackageCommands(registry: CommandRegistry): void {
  registry.register('apt', aptDispatch)
  registry.register('apt-get', aptDispatch)

  registry.register('dpkg', (args, ctx) => {
    if (args[0] === '-l' || args[0] === '--list') {
      const filter = args[1]
      const pkgs = ctx.packages.list().filter((p) => !filter || p.name.includes(filter))
      const header = [
        'Desired=Unknown/Install/Remove/Purge/Hold',
        '| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend',
        '||/ Name           Version          Description',
        '+++-==============-================-===================',
      ].join('\n')
      const rows = pkgs.map((p) => `ii  ${p.name.padEnd(15)}${p.version.padEnd(17)}${p.description}`)
      return ok([header, ...rows].join('\n'))
    }

    if (args[0] === '-L') {
      const name = args[1]
      if (!name) return fail('usage: dpkg -L PACKAGE')
      if (!ctx.packages.isInstalled(name)) return fail(`dpkg-query: package '${name}' is not installed`)
      return ok(binariesFor(name).map((b) => `/usr/bin/${b}`).join('\n'))
    }

    return fail('usage: dpkg -l [pattern] | dpkg -L PACKAGE')
  })
}
