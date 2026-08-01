import type { ProcessRecord } from './types'

const BASELINE: Array<Pick<ProcessRecord, 'ppid' | 'user' | 'command'>> = [
  { ppid: 0, user: 'root', command: '/sbin/init' },
  { ppid: 1, user: 'root', command: '/lib/systemd/systemd-journald' },
  { ppid: 1, user: 'root', command: '/lib/systemd/systemd-logind' },
  { ppid: 1, user: 'root', command: 'NetworkManager' },
  { ppid: 1, user: 'root', command: '/usr/sbin/sshd' },
  { ppid: 1, user: 'bitx', command: '/usr/bin/gnome-shell' },
  { ppid: 1, user: 'bitx', command: '/usr/bin/Xorg' },
  { ppid: 1, user: 'bitx', command: 'gnome-terminal-server' },
  { ppid: 1, user: 'bitx', command: '-bash' },
]

export class ProcessManager {
  private processes = new Map<number, ProcessRecord>()
  private nextPid = 1
  private bootTime = Date.now()

  constructor(seedDefaults = true) {
    if (seedDefaults) {
      for (const proc of BASELINE) this.spawn(proc.command, proc.user, proc.ppid)
    }
  }

  spawn(command: string, user: string, ppid = 1): ProcessRecord {
    const pid = this.nextPid++
    const record: ProcessRecord = {
      pid,
      ppid,
      user,
      command,
      cpu: Math.round(Math.random() * 250) / 10,
      mem: Math.round(Math.random() * 400) / 10,
      startedAt: Date.now(),
      status: 'running',
    }
    this.processes.set(pid, record)
    return record
  }

  kill(pid: number, signal: string = 'TERM'): boolean {
    if (pid === 1) return false
    const proc = this.processes.get(pid)
    if (!proc) return false
    if (signal === 'STOP') {
      proc.status = 'stopped'
      return true
    }
    if (signal === 'CONT') {
      proc.status = 'running'
      return true
    }
    return this.processes.delete(pid)
  }

  get(pid: number): ProcessRecord | undefined {
    return this.processes.get(pid)
  }

  list(): ProcessRecord[] {
    return [...this.processes.values()].sort((a, b) => a.pid - b.pid)
  }

  uptimeSeconds(): number {
    return Math.floor((Date.now() - this.bootTime) / 1000)
  }
}
