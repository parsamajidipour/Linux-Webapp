export interface InodeBase {
  name: string
  owner: string
  group: string
  mode: number
  mtime: number
  ctime: number
}

export interface FileInode extends InodeBase {
  type: 'file'
  content: string
}

export interface DirInode extends InodeBase {
  type: 'dir'
  children: Record<string, Inode>
}

export interface SymlinkInode extends InodeBase {
  type: 'symlink'
  target: string
}

export type Inode = FileInode | DirInode | SymlinkInode

export const DEFAULT_FILE_MODE = 0o644
export const DEFAULT_DIR_MODE = 0o755
