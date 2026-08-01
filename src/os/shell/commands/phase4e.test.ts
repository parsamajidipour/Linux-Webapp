import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.7 — network commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('ping resolves the host and reports the requested packet count', async () => {
    const result = await kernel.shell.run('ping -c 2 example.com', ctx)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('PING example.com')
    expect((result.stdout.match(/icmp_seq=/g) ?? []).length).toBe(2)
    expect(result.stdout).toContain('2 packets transmitted, 2 received, 0% packet loss')
  })

  it('resolves hostnames from /etc/hosts before falling back to the fake generator', async () => {
    const result = await kernel.shell.run('host ubuntu', ctx)
    expect(result.stdout).toBe('ubuntu has address 127.0.1.1') // seeded in /etc/hosts by phase 3
  })

  it('DNS-style lookups are deterministic for the same hostname', async () => {
    const first = await kernel.shell.run('dig example.com', ctx)
    const second = await kernel.shell.run('dig example.com', ctx)
    expect(first.stdout).toBe(second.stdout)

    const nslookup = await kernel.shell.run('nslookup example.com', ctx)
    const ipLine = first.stdout.match(/A\t([\d.]+)/)![1]
    expect(nslookup.stdout).toContain(ipLine)
  })

  it('curl returns a simulated page and -I returns only headers', async () => {
    const full = await kernel.shell.run('curl http://example.com', ctx)
    expect(full.stdout).toContain('<html>')
    expect(full.stdout).toContain('example.com')

    const headOnly = await kernel.shell.run('curl -I http://example.com', ctx)
    expect(headOnly.stdout).toContain('HTTP/1.1 200 OK')
    expect(headOnly.stdout).not.toContain('<html>')
  })

  it('wget saves the fetched page into the current directory', async () => {
    const result = await kernel.shell.run('wget http://example.com/page.html', ctx)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("saved")
    expect(kernel.vfs.readFile('/home/bitx/page.html')).toContain('example.com')
  })

  it('ip addr and ip route print plausible interface/routing info', async () => {
    const addr = await kernel.shell.run('ip addr', ctx)
    expect(addr.stdout).toContain('lo:')
    expect(addr.stdout).toContain('eth0')

    const route = await kernel.shell.run('ip route', ctx)
    expect(route.stdout).toContain('default via')
  })

  it('ss/netstat reflect actually-active services, not a hardcoded list', async () => {
    const before = await kernel.shell.run('ss', ctx)
    expect(before.stdout).toContain(':22') // ssh is active by default (ServiceManager seed)
    expect(before.stdout).not.toContain(':80') // nginx starts inactive

    kernel.services.start('nginx')
    const after = await kernel.shell.run('netstat', ctx)
    expect(after.stdout).toContain(':80')
  })

  it('whois gives a stable, deterministic-looking record', async () => {
    const first = await kernel.shell.run('whois example.com', ctx)
    const second = await kernel.shell.run('whois example.com', ctx)
    expect(first.stdout).toBe(second.stdout)
    expect(first.stdout).toContain('EXAMPLE.COM')
  })
})
