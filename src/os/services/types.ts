export type ServiceStatus = 'active' | 'inactive' | 'failed'

export interface ServiceRecord {
  name: string
  description: string
  status: ServiceStatus
}
