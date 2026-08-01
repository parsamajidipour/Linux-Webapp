import type { PermissionSubject } from '../permissions'
import { basename, dirname } from '../vfs/path'
import type { Vfs } from '../vfs/Vfs'

/**
 * Real zip/tar/gzip are binary formats; our VFS stores everything as UTF-16 strings.
 * Rather than fake binary bytes, archives here are our own JSON-serialized entry list,
 * written as the *content* of the archive file — same VFS, no special-casing needed
 * for save/load/persistence. `zip`/`tar`/`gzip` all share this one format; only the
 * command-line syntax differs, matching how the real tools differ only in UX.
 */
const ARCHIVE_MAGIC = 'CLXARCHIVE1'

export interface ArchiveEntry {
  /** Path relative to the archive root, e.g. `mydir/file.txt`. */
  path: string
  type: 'file' | 'dir' | 'symlink'
  mode: number
  content?: string
  target?: string
}

function collectEntries(vfs: Vfs, absPath: string, relPath: string, actor: PermissionSubject | undefined, out: ArchiveEntry[]): void {
  const node = vfs.stat(absPath)
  if (!node) throw new Error(`No such file or directory: ${absPath}`)

  if (node.type === 'dir') {
    out.push({ path: relPath, type: 'dir', mode: node.mode })
    for (const child of vfs.list(absPath)) {
      collectEntries(vfs, `${absPath}/${child}`, `${relPath}/${child}`, actor, out)
    }
  } else if (node.type === 'file') {
    out.push({ path: relPath, type: 'file', mode: node.mode, content: vfs.readFile(absPath, { actor }) })
  } else {
    out.push({ path: relPath, type: 'symlink', mode: node.mode, target: node.target })
  }
}

export function buildArchive(vfs: Vfs, absPaths: string[], actor?: PermissionSubject): string {
  const entries: ArchiveEntry[] = []
  for (const abs of absPaths) {
    collectEntries(vfs, abs, basename(abs), actor, entries)
  }
  return `${ARCHIVE_MAGIC}\n${JSON.stringify(entries)}`
}

export function isArchive(content: string): boolean {
  return content.startsWith(`${ARCHIVE_MAGIC}\n`)
}

export function parseArchive(content: string): ArchiveEntry[] {
  if (!isArchive(content)) throw new Error('not in our archive format (foreign/corrupt archive)')
  return JSON.parse(content.slice(ARCHIVE_MAGIC.length + 1)) as ArchiveEntry[]
}

/** Extracts every entry under `destAbsDir`. Returns the list of relative paths written, in order. */
export function extractArchive(vfs: Vfs, content: string, destAbsDir: string, actor?: PermissionSubject): string[] {
  const entries = [...parseArchive(content)].sort((a, b) => a.path.split('/').length - b.path.split('/').length)
  const written: string[] = []

  for (const entry of entries) {
    const abs = `${destAbsDir}/${entry.path}`
    const parent = dirname(abs)
    if (!vfs.exists(parent)) vfs.mkdir(parent, { parents: true, actor })

    if (entry.type === 'dir') {
      vfs.mkdir(abs, { parents: true, actor, mode: entry.mode })
    } else if (entry.type === 'file') {
      vfs.writeFile(abs, entry.content ?? '', { actor })
      vfs.chmod(abs, entry.mode, { actor })
    } else if (entry.type === 'symlink' && !vfs.exists(abs)) {
      vfs.symlink(entry.target ?? '', abs, { actor })
    }
    written.push(entry.path)
  }

  return written
}

/**
 * A cosmetic marker so `gzip`/`gunzip` and `file` can tell "gzip-wrapped" content apart —
 * no actual compression happens (there's nothing binary to compress here).
 */
const GZIP_MARKER = '\x1f\x8b\x08\x00'

export function gzipWrap(content: string): string {
  return GZIP_MARKER + content
}

export function isGzipped(content: string): boolean {
  return content.startsWith(GZIP_MARKER)
}

export function gunzipUnwrap(content: string): string {
  if (!isGzipped(content)) throw new Error('not in gzip format')
  return content.slice(GZIP_MARKER.length)
}
