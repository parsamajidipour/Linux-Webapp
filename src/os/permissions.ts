export interface PermissionSubject {
  username: string
  uid: number
  gid: number
  groups: string[]
}

export interface PermissionTarget {
  owner: string
  group: string
  mode: number
}

export type Access = 'read' | 'write' | 'execute'

/** Unix-style rwx check. uid 0 (root) always passes. */
export function canAccess(target: PermissionTarget, subject: PermissionSubject, access: Access): boolean {
  if (subject.uid === 0) return true

  const bit = access === 'read' ? 4 : access === 'write' ? 2 : 1
  const isOwner = target.owner === subject.username
  const isGroup = subject.groups.includes(target.group)
  const shift = isOwner ? 6 : isGroup ? 3 : 0

  return ((target.mode >> shift) & bit) !== 0
}

export function formatMode(mode: number, type: 'file' | 'dir' | 'symlink'): string {
  const typeChar = type === 'dir' ? 'd' : type === 'symlink' ? 'l' : '-'
  const bits = [6, 3, 0].map((shift) => {
    const v = (mode >> shift) & 7
    return `${v & 4 ? 'r' : '-'}${v & 2 ? 'w' : '-'}${v & 1 ? 'x' : '-'}`
  })
  return typeChar + bits.join('')
}
