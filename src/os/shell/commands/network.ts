import { djb2Hash } from '../../hash'
import type { CommandRegistry } from '../registry'
import { fail, ok, type ShellContext } from '../types'
import { errMsg, flagChars, homeOf } from './util'

/** No real network exists here — every "lookup" below is a deterministic function of the
 * hostname (same input always gives the same fake answer), checked against /etc/hosts first
 * so entries seeded in phase 3 (like `ubuntu`) resolve consistently with the rest of the OS. */
function fakeIpFor(host: string): string {
  const h = djb2Hash(host.toLowerCase())
  const a = 20 + (h % 200)
  const b = (h >>> 8) % 256
  const c = (h >>> 16) % 256
  const d = 1 + ((h >>> 24) % 254)
  return `${a}.${b}.${c}.${d}`
}

function resolveHost(ctx: ShellContext, host: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host

  try {
    const hosts = ctx.vfs.readFile('/etc/hosts')
    for (const line of hosts.split('\n')) {
      const [ip, ...names] = line.trim().split(/\s+/)
      if (ip && names.some((n) => n.toLowerCase() === host.toLowerCase())) return ip
    }
  } catch {
    // /etc/hosts not seeded yet — fall through to the fake generator.
  }

  return fakeIpFor(host)
}

function baseLatencyFor(host: string): number {
  return 5 + (djb2Hash(host.toLowerCase()) % 80)
}

function parseUrl(url: string): { host: string; path: string } {
  const withoutProto = url.replace(/^https?:\/\//, '')
  const slash = withoutProto.indexOf('/')
  const hostPort = slash === -1 ? withoutProto : withoutProto.slice(0, slash)
  const path = slash === -1 ? '/' : withoutProto.slice(slash)
  return { host: hostPort.split(':')[0], path }
}

function fakePage(host: string, ip: string): string {
  return `<html><head><title>${host}</title></head><body><h1>It works!</h1><p>Simulated response from ${host} (${ip}) — there is no real network here, this is a browser-only OS.</p></body></html>\n`
}

const SERVICE_PORTS: Record<string, number> = { ssh: 22, nginx: 80, docker: 2375, cups: 631 }

function listeningSockets(ctx: ShellContext): { service: string; port: number }[] {
  return ctx.services
    .list()
    .filter((s) => s.status === 'active' && SERVICE_PORTS[s.name] !== undefined)
    .map((s) => ({ service: s.name, port: SERVICE_PORTS[s.name] }))
}

/** PLAN.md phase 4.7 — Network: ping, curl, wget, ip, ss, netstat, dig, nslookup, host, whois. */
export function registerNetworkCommands(registry: CommandRegistry): void {
  registry.register('ping', (args, ctx) => {
    const cIdx = args.indexOf('-c')
    const count = cIdx !== -1 ? parseInt(args[cIdx + 1] ?? '4', 10) || 4 : 4
    const host = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-c')
    if (!host) return fail('usage: ping [-c count] host')

    const ip = resolveHost(ctx, host)
    const base = baseLatencyFor(host)
    const times: number[] = []
    const lines = [`PING ${host} (${ip}) 56(84) bytes of data.`]

    for (let seq = 1; seq <= count; seq++) {
      const t = base + Math.random() * 4
      times.push(t)
      lines.push(`64 bytes from ${ip}: icmp_seq=${seq} ttl=64 time=${t.toFixed(1)} ms`)
    }

    const total = times.reduce((sum, t) => sum + t, 0)
    const min = Math.min(...times)
    const max = Math.max(...times)
    const avg = total / times.length
    lines.push(
      '',
      `--- ${host} ping statistics ---`,
      `${count} packets transmitted, ${count} received, 0% packet loss, time ${Math.round(total)}ms`,
      `rtt min/avg/max/mdev = ${min.toFixed(1)}/${avg.toFixed(1)}/${max.toFixed(1)}/0.5 ms`,
    )
    return ok(lines.join('\n'))
  })

  registry.register('curl', (args, ctx) => {
    const flags = flagChars(args)
    const headOnly = flags.includes('I') || args.includes('--head')
    const silent = flags.includes('s') || args.includes('--silent')
    const url = args.find((a) => !a.startsWith('-'))
    if (!url) return fail('usage: curl [-I] [-s] URL')

    const { host } = parseUrl(url)
    const ip = resolveHost(ctx, host)
    const headers = ['HTTP/1.1 200 OK', `Date: ${new Date().toUTCString()}`, 'Server: nginx/1.24.0', 'Content-Type: text/html; charset=UTF-8']
    if (headOnly) return ok(`${headers.join('\n')}\n`)

    const body = fakePage(host, ip)
    const progress = silent
      ? ''
      : `  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n100  ${body.length}  100 ${body.length}    0     0  ${body.length}      0 --:--:-- --:--:-- --:--:-- ${body.length}\n`
    return ok(progress + body)
  })

  registry.register('wget', (args, ctx) => {
    const url = args.find((a) => !a.startsWith('-'))
    if (!url) return fail('usage: wget URL')

    const { host, path } = parseUrl(url)
    const ip = resolveHost(ctx, host)
    const body = fakePage(host, ip)
    const filename = path === '/' || path === '' ? 'index.html' : (path.split('/').filter(Boolean).pop() ?? 'index.html')

    const abs = ctx.vfs.resolve(filename, ctx.cwd, homeOf(ctx))
    try {
      ctx.vfs.writeFile(abs, body, { actor: ctx.users.toSubject(ctx.currentUser) })
    } catch (e) {
      return fail(`wget: ${errMsg(e)}`)
    }

    const sizeKb = (body.length / 1024).toFixed(1)
    const lines = [
      `--${new Date().toISOString()}--  ${url}`,
      `Resolving ${host} (${host})... ${ip}`,
      `Connecting to ${host} (${host})|${ip}|:80... connected.`,
      'HTTP request sent, awaiting response... 200 OK',
      `Length: ${body.length} (${sizeKb}K) [text/html]`,
      `Saving to: '${filename}'`,
      '',
      `${filename}  100%[===================>]  ${body.length}  --.-KB/s    in 0s`,
      '',
      `${new Date().toISOString()} (${sizeKb} KB/s) - '${filename}' saved [${body.length}/${body.length}]`,
    ]
    return ok(lines.join('\n'))
  })

  registry.register('ip', (args) => {
    const sub = args[0]
    if (sub === 'addr' || sub === 'a' || sub === 'address') {
      return ok(
        [
          '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000',
          '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
          '    inet 127.0.0.1/8 scope host lo',
          '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000',
          '    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff',
          '    inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0',
        ].join('\n'),
      )
    }
    if (sub === 'route' || sub === 'r') {
      return ok(['default via 172.17.0.1 dev eth0', '172.17.0.0/16 dev eth0 proto kernel scope link src 172.17.0.2'].join('\n'))
    }
    return fail(`Object "${sub ?? ''}" is unknown, try "ip help".`)
  })

  registry.register('ss', (_args, ctx) => {
    const header = 'Netid  State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port  Process'
    const rows = listeningSockets(ctx).map(
      (s) => `tcp    LISTEN  0       128            0.0.0.0:${s.port}         0.0.0.0:*       users:(("${s.service}"))`,
    )
    return ok([header, ...rows].join('\n'))
  })

  registry.register('netstat', (_args, ctx) => {
    const header = 'Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name'
    const rows = listeningSockets(ctx).map((s) => {
      const addr = `0.0.0.0:${s.port}`
      return `tcp        0      0 ${addr.padEnd(24)}0.0.0.0:*               LISTEN      -/${s.service}`
    })
    return ok([header, ...rows].join('\n'))
  })

  registry.register('dig', (args, ctx) => {
    const host = args.find((a) => !a.startsWith('-'))
    if (!host) return fail('usage: dig HOST')
    const ip = resolveHost(ctx, host)
    return ok(
      [`; <<>> DiG 9.18.30-1ubuntu1-Ubuntu <<>> ${host}`, ';; ANSWER SECTION:', `${host}.\t\t300\tIN\tA\t${ip}`].join('\n'),
    )
  })

  registry.register('nslookup', (args, ctx) => {
    const host = args.find((a) => !a.startsWith('-'))
    if (!host) return fail('usage: nslookup HOST')
    const ip = resolveHost(ctx, host)
    return ok(['Server:\t\t127.0.0.53', 'Address:\t127.0.0.53#53', '', `Name:\t${host}`, `Address: ${ip}`].join('\n'))
  })

  registry.register('host', (args, ctx) => {
    const target = args.find((a) => !a.startsWith('-'))
    if (!target) return fail('usage: host HOST')
    return ok(`${target} has address ${resolveHost(ctx, target)}`)
  })

  registry.register('whois', (args) => {
    const domain = args.find((a) => !a.startsWith('-'))
    if (!domain) return fail('usage: whois DOMAIN')
    const year = 2000 + (djb2Hash(domain.toLowerCase()) % 24)
    return ok(
      [
        `Domain Name: ${domain.toUpperCase()}`,
        'Registrar: Simulated Registrar, Inc.',
        `Creation Date: ${year}-01-01T00:00:00Z`,
        `Registry Expiry Date: ${year + 10}-01-01T00:00:00Z`,
        'Domain Status: clientTransferProhibited',
        `Name Server: ns1.${domain.toLowerCase()}`,
        `Name Server: ns2.${domain.toLowerCase()}`,
      ].join('\n'),
    )
  })
}
