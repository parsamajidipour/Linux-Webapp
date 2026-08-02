import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 1.3 — systemctl + real notification events', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('list-units shows real ServiceManager state, including inactive services', async () => {
    const result = await kernel.shell.run('systemctl list-units', ctx)
    expect(result.stdout).toContain('NetworkManager')
    expect(result.stdout).toContain('nginx')
  })

  it('status reflects the live status of a service', async () => {
    const result = await kernel.shell.run('systemctl status nginx', ctx)
    expect(result.stdout).toContain('Active: inactive')
  })

  it('a regular user cannot start or stop a service', async () => {
    const result = await kernel.shell.run('systemctl start nginx', ctx)
    expect(result.exitCode).not.toBe(0)
    expect(kernel.services.get('nginx')?.status).toBe('inactive')
  })

  it('root can start a service, which flips ServiceManager state and logs to syslog', async () => {
    const result = await kernel.shell.run('sudo systemctl start nginx', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.services.get('nginx')?.status).toBe('active')
    expect(kernel.vfs.readFile('/var/log/syslog')).toContain('Started A high performance web server')
  })

  it('root can stop a running service', async () => {
    await kernel.shell.run('sudo systemctl start nginx', ctx)
    const result = await kernel.shell.run('sudo systemctl stop nginx', ctx)
    expect(result.exitCode).toBe(0)
    expect(kernel.services.get('nginx')?.status).toBe('inactive')
  })

  it('starting a service emits a real notification event that the desktop shell can subscribe to', async () => {
    const seen: string[] = []
    kernel.notifications.subscribe((n) => seen.push(`${n.title}: ${n.body}`))

    await kernel.shell.run('sudo systemctl start nginx', ctx)
    expect(seen).toEqual(['Service started: nginx.service is now active (running).'])

    // starting an already-active service is a no-op — real systemd doesn't re-notify either
    await kernel.shell.run('sudo systemctl start nginx', ctx)
    expect(seen).toHaveLength(1)
  })

  it('rejects an unknown service', async () => {
    const result = await kernel.shell.run('sudo systemctl start not-a-real-service', ctx)
    expect(result.exitCode).not.toBe(0)
  })
})
