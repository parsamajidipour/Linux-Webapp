export type ProcessStatus = 'running' | 'sleeping' | 'stopped' | 'zombie'

export interface ProcessRecord {
  pid: number
  ppid: number
  user: string
  command: string
  cpu: number
  mem: number
  startedAt: number
  status: ProcessStatus
}
