import type { PersistenceAdapter } from '../persistence/PersistenceAdapter'
import { canAccess, type PermissionSubject } from '../permissions'
import { basename, dirname, resolvePath, segments } from './path'
import { DEFAULT_DIR_MODE, DEFAULT_FILE_MODE, type DirInode, type FileInode, type Inode, type SymlinkInode } from './types'

export class VfsError extends Error {}
export class PermissionError extends VfsError {}
export class NotFoundError extends VfsError {}
export class NotADirectoryError extends VfsError {}
export class AlreadyExistsError extends VfsError {}
export class NotEmptyError extends VfsError {}

const PERSIST_KEY = 'vfs-root'

function now(): number {
  return Date.now()
}

function makeDir(name: string, owner: string, group: string, mode = DEFAULT_DIR_MODE): DirInode {
  const t = now()
  return { type: 'dir', name, owner, group, mode, mtime: t, ctime: t, children: {} }
}

function makeFile(name: string, owner: string, group: string, content = '', mode = DEFAULT_FILE_MODE): FileInode {
  const t = now()
  return { type: 'file', name, owner, group, mode, mtime: t, ctime: t, content }
}

function makeSymlink(name: string, owner: string, group: string, target: string): SymlinkInode {
  const t = now()
  return { type: 'symlink', name, owner, group, mode: 0o777, mtime: t, ctime: t, target }
}

export class Vfs {
  private root: DirInode
  private persistence?: PersistenceAdapter
  private dynamicProviders = new Map<string, () => string>()

  constructor(persistence?: PersistenceAdapter) {
    this.persistence = persistence
    this.root = makeDir('/', 'root', 'root')
  }

  resolve(path: string, cwd: string, home: string): string {
    return resolvePath(path, cwd, home)
  }

  async load(): Promise<void> {
    if (!this.persistence) return
    const saved = await this.persistence.load<DirInode>(PERSIST_KEY)
    if (saved) this.root = saved
  }

  async save(): Promise<void> {
    if (!this.persistence) return
    await this.persistence.save(PERSIST_KEY, this.root)
  }

  /** Walks from root and returns the inode at `absPath`, or null if missing. */
  private walk(absPath: string): Inode | null {
    if (absPath === '/' || absPath === '') return this.root
    let node: Inode = this.root
    for (const part of segments(absPath)) {
      if (node.type !== 'dir') return null
      const next: Inode | undefined = node.children[part]
      if (!next) return null
      node = next
    }
    return node
  }

  private walkDir(absPath: string): DirInode | null {
    const node = this.walk(absPath)
    return node && node.type === 'dir' ? node : null
  }

  stat(absPath: string): Inode | null {
    return this.walk(absPath)
  }

  exists(absPath: string): boolean {
    return this.walk(absPath) !== null
  }

  list(absPath: string): string[] {
    const node = this.walk(absPath)
    if (!node) throw new NotFoundError(`No such file or directory: ${absPath}`)
    if (node.type !== 'dir') throw new NotADirectoryError(`Not a directory: ${absPath}`)
    return Object.keys(node.children).sort()
  }

  private checkAccess(node: Inode, actor: PermissionSubject | undefined, access: 'read' | 'write' | 'execute') {
    if (!actor) return
    if (!canAccess(node, actor, access)) {
      throw new PermissionError(`Permission denied: ${node.name}`)
    }
  }

  mkdir(absPath: string, opts: { parents?: boolean; owner?: string; group?: string; actor?: PermissionSubject } = {}): void {
    if (absPath === '/') {
      if (this.root.type === 'dir') return
    }
    const parentPath = dirname(absPath)
    const name = basename(absPath)
    if (!name) throw new VfsError(`Invalid path: ${absPath}`)

    let parent = this.walkDir(parentPath)
    if (!parent) {
      if (!opts.parents) throw new NotFoundError(`No such file or directory: ${parentPath}`)
      this.mkdir(parentPath, opts)
      parent = this.walkDir(parentPath)!
    }

    this.checkAccess(parent, opts.actor, 'write')

    if (parent.children[name]) {
      if (parent.children[name].type === 'dir' && opts.parents) return
      throw new AlreadyExistsError(`File exists: ${absPath}`)
    }

    const owner = opts.owner ?? opts.actor?.username ?? 'root'
    const group = opts.group ?? opts.actor?.username ?? 'root'
    parent.children[name] = makeDir(name, owner, group)
    parent.mtime = now()
  }

  touch(absPath: string, opts: { owner?: string; group?: string; actor?: PermissionSubject } = {}): void {
    const parentPath = dirname(absPath)
    const name = basename(absPath)
    const parent = this.walkDir(parentPath)
    if (!parent) throw new NotFoundError(`No such file or directory: ${parentPath}`)

    const existing = parent.children[name]
    if (existing) {
      this.checkAccess(existing, opts.actor, 'write')
      existing.mtime = now()
      return
    }

    this.checkAccess(parent, opts.actor, 'write')
    const owner = opts.owner ?? opts.actor?.username ?? 'root'
    const group = opts.group ?? opts.actor?.username ?? 'root'
    parent.children[name] = makeFile(name, owner, group)
    parent.mtime = now()
  }

  symlink(target: string, linkAbsPath: string, opts: { owner?: string; group?: string; actor?: PermissionSubject } = {}): void {
    const parentPath = dirname(linkAbsPath)
    const name = basename(linkAbsPath)
    const parent = this.walkDir(parentPath)
    if (!parent) throw new NotFoundError(`No such file or directory: ${parentPath}`)
    if (parent.children[name]) throw new AlreadyExistsError(`File exists: ${linkAbsPath}`)

    this.checkAccess(parent, opts.actor, 'write')
    const owner = opts.owner ?? opts.actor?.username ?? 'root'
    const group = opts.group ?? opts.actor?.username ?? 'root'
    parent.children[name] = makeSymlink(name, owner, group, target)
    parent.mtime = now()
  }

  readFile(absPath: string, opts: { actor?: PermissionSubject } = {}): string {
    const node = this.walk(absPath)
    if (!node) throw new NotFoundError(`No such file or directory: ${absPath}`)
    if (node.type !== 'file') throw new VfsError(`Is a directory: ${absPath}`)
    this.checkAccess(node, opts.actor, 'read')
    const dynamic = this.dynamicProviders.get(absPath)
    return dynamic ? dynamic() : node.content
  }

  /** Overrides read content for a path (e.g. `/proc/uptime`) with a live value, computed fresh on every read. */
  registerDynamic(absPath: string, provider: () => string): void {
    this.dynamicProviders.set(absPath, provider)
  }

  writeFile(
    absPath: string,
    content: string,
    opts: { append?: boolean; owner?: string; group?: string; actor?: PermissionSubject } = {},
  ): void {
    const parentPath = dirname(absPath)
    const name = basename(absPath)
    const parent = this.walkDir(parentPath)
    if (!parent) throw new NotFoundError(`No such file or directory: ${parentPath}`)

    const existing = parent.children[name]
    if (existing) {
      if (existing.type !== 'file') throw new VfsError(`Is a directory: ${absPath}`)
      this.checkAccess(existing, opts.actor, 'write')
      existing.content = opts.append ? existing.content + content : content
      existing.mtime = now()
      return
    }

    this.checkAccess(parent, opts.actor, 'write')
    const owner = opts.owner ?? opts.actor?.username ?? 'root'
    const group = opts.group ?? opts.actor?.username ?? 'root'
    parent.children[name] = makeFile(name, owner, group, content)
    parent.mtime = now()
  }

  remove(absPath: string, opts: { recursive?: boolean; actor?: PermissionSubject } = {}): void {
    if (absPath === '/') throw new VfsError('Cannot remove root')
    const parentPath = dirname(absPath)
    const name = basename(absPath)
    const parent = this.walkDir(parentPath)
    if (!parent) throw new NotFoundError(`No such file or directory: ${parentPath}`)

    const node = parent.children[name]
    if (!node) throw new NotFoundError(`No such file or directory: ${absPath}`)
    this.checkAccess(parent, opts.actor, 'write')

    if (node.type === 'dir' && Object.keys(node.children).length > 0 && !opts.recursive) {
      throw new NotEmptyError(`Directory not empty: ${absPath}`)
    }

    delete parent.children[name]
    parent.mtime = now()
  }

  move(srcAbs: string, destAbs: string, opts: { actor?: PermissionSubject } = {}): void {
    const srcParent = this.walkDir(dirname(srcAbs))
    const srcName = basename(srcAbs)
    if (!srcParent || !srcParent.children[srcName]) throw new NotFoundError(`No such file or directory: ${srcAbs}`)

    let destParentPath = dirname(destAbs)
    let destName = basename(destAbs)
    const destExisting = this.walk(destAbs)
    if (destExisting && destExisting.type === 'dir') {
      destParentPath = destAbs
      destName = srcName
    }

    const destParent = this.walkDir(destParentPath)
    if (!destParent) throw new NotFoundError(`No such file or directory: ${destParentPath}`)

    this.checkAccess(srcParent, opts.actor, 'write')
    this.checkAccess(destParent, opts.actor, 'write')

    if (destParent.children[destName]) throw new AlreadyExistsError(`File exists: ${destParentPath}/${destName}`)

    const node = srcParent.children[srcName]
    delete srcParent.children[srcName]
    node.name = destName
    node.mtime = now()
    destParent.children[destName] = node
    srcParent.mtime = now()
    destParent.mtime = now()
  }

  copy(srcAbs: string, destAbs: string, opts: { recursive?: boolean; actor?: PermissionSubject } = {}): void {
    const srcNode = this.walk(srcAbs)
    if (!srcNode) throw new NotFoundError(`No such file or directory: ${srcAbs}`)
    if (srcNode.type === 'dir' && !opts.recursive) {
      throw new VfsError(`Omitting directory: ${srcAbs}`)
    }
    this.checkAccess(srcNode, opts.actor, 'read')

    let destParentPath = dirname(destAbs)
    let destName = basename(destAbs)
    const destExisting = this.walk(destAbs)
    if (destExisting && destExisting.type === 'dir') {
      destParentPath = destAbs
      destName = srcNode.name
    }

    const destParent = this.walkDir(destParentPath)
    if (!destParent) throw new NotFoundError(`No such file or directory: ${destParentPath}`)
    this.checkAccess(destParent, opts.actor, 'write')
    if (destParent.children[destName]) throw new AlreadyExistsError(`File exists: ${destParentPath}/${destName}`)

    destParent.children[destName] = this.cloneInode(srcNode, destName, opts.actor?.username)
    destParent.mtime = now()
  }

  private cloneInode(node: Inode, name: string, owner?: string): Inode {
    const t = now()
    if (node.type === 'dir') {
      const clone: DirInode = { ...node, name, owner: owner ?? node.owner, mtime: t, ctime: t, children: {} }
      for (const [childName, child] of Object.entries(node.children)) {
        clone.children[childName] = this.cloneInode(child, childName, owner)
      }
      return clone
    }
    return { ...node, name, owner: owner ?? node.owner, mtime: t, ctime: t }
  }

  chmod(absPath: string, mode: number, opts: { actor?: PermissionSubject } = {}): void {
    const node = this.walk(absPath)
    if (!node) throw new NotFoundError(`No such file or directory: ${absPath}`)
    if (opts.actor && opts.actor.uid !== 0 && node.owner !== opts.actor.username) {
      throw new PermissionError(`Operation not permitted: ${absPath}`)
    }
    node.mode = mode
    node.ctime = now()
  }

  chown(absPath: string, owner: string, group: string | undefined, opts: { actor?: PermissionSubject } = {}): void {
    const node = this.walk(absPath)
    if (!node) throw new NotFoundError(`No such file or directory: ${absPath}`)
    if (opts.actor && opts.actor.uid !== 0) {
      throw new PermissionError(`Operation not permitted: ${absPath}`)
    }
    node.owner = owner
    if (group) node.group = group
    node.ctime = now()
  }

  /** Total bytes of all file content under `absPath` (rough `du`-style size). */
  sizeOf(absPath: string): number {
    const node = this.walk(absPath)
    if (!node) throw new NotFoundError(`No such file or directory: ${absPath}`)
    return this.sizeOfNode(node)
  }

  private sizeOfNode(node: Inode): number {
    if (node.type === 'file') return node.content.length
    if (node.type === 'symlink') return node.target.length
    return Object.values(node.children).reduce((sum, child) => sum + this.sizeOfNode(child), 0)
  }
}
