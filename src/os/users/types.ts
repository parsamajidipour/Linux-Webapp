export interface UserRecord {
  username: string
  uid: number
  gid: number
  groups: string[]
  home: string
  shell: string
  fullName: string
  /** Non-cryptographic digest; this is a simulated OS, not a real auth boundary. `null` = passwordless (guest). */
  passwordHash: string | null
}

export interface GroupRecord {
  name: string
  gid: number
  members: string[]
}
