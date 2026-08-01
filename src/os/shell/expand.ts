const VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*|\?)\}|\$([A-Za-z_][A-Za-z0-9_]*|\?)/g

export function expandVariables(word: string, env: Record<string, string>): string {
  return word.replace(VAR_PATTERN, (_match, braced?: string, bare?: string) => {
    const name = braced ?? bare ?? ''
    return env[name] ?? ''
  })
}
