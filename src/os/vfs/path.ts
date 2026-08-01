/** Resolves `path` (absolute, relative, or `~`-prefixed) against `cwd` into a normalized absolute path. */
export function resolvePath(path: string, cwd: string, home: string): string {
  let input = path
  if (input === '~') input = home
  else if (input.startsWith('~/')) input = home + input.slice(1)

  const segments = input.startsWith('/') ? [] : cwd.split('/').filter(Boolean)

  for (const part of input.split('/').filter(Boolean)) {
    if (part === '.') continue
    else if (part === '..') segments.pop()
    else segments.push(part)
  }

  return '/' + segments.join('/')
}

export function dirname(path: string): string {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

export function basename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}
