import type { Inode } from '../os/vfs/types'

export type FileKind = 'folder' | 'text' | 'image' | 'audio' | 'video' | 'archive' | 'iso' | 'symlink' | 'other'

const TEXT_EXT = new Set(['txt', 'md', 'log', 'conf', 'cfg', 'ini', 'json', 'yml', 'yaml', 'sh', 'csv', 'xml', 'js', 'ts', 'tsx', 'py', 'c', 'h', 'toml', ''])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'flac'])
const VIDEO_EXT = new Set(['mp4', 'mkv', 'webm', 'avi', 'mov'])
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', 'tgz'])

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** Classifies a VFS entry the same way for every app that browses files (Files, Activities search),
 * so "can this be opened, and with what" stays consistent everywhere. */
export function kindOf(node: Pick<Inode, 'type'>, name: string): FileKind {
  if (node.type === 'dir') return 'folder'
  if (node.type === 'symlink') return 'symlink'
  const ext = extOf(name)
  if (IMAGE_EXT.has(ext)) return 'image'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (ARCHIVE_EXT.has(ext)) return 'archive'
  if (ext === 'iso') return 'iso'
  if (TEXT_EXT.has(ext)) return 'text'
  return 'other'
}
