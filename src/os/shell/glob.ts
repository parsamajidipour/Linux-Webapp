import type { Vfs } from '../vfs/Vfs'

function globToRegExp(pattern: string): RegExp {
  let re = '^'
  for (const ch of pattern) {
    if (ch === '*') re += '.*'
    else if (ch === '?') re += '.'
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(re + '$')
}

/** Expands a `*`/`?` glob against the VFS. Returns `[word]` unchanged if there's no match (bash behavior). */
export function expandGlob(word: string, vfs: Vfs, cwd: string, home: string): string[] {
  if (!/[*?]/.test(word)) return [word]

  const lastSlash = word.lastIndexOf('/')
  const dirPart = lastSlash >= 0 ? word.slice(0, lastSlash) || '/' : '.'
  const pattern = lastSlash >= 0 ? word.slice(lastSlash + 1) : word

  const absDir = vfs.resolve(dirPart, cwd, home)
  let names: string[]
  try {
    names = vfs.list(absDir)
  } catch {
    return [word]
  }

  const re = globToRegExp(pattern)
  const matches = names.filter((n) => !n.startsWith('.') && re.test(n)).sort()
  if (matches.length === 0) return [word]

  return matches.map((n) => (lastSlash >= 0 ? `${dirPart}/${n}` : n))
}
