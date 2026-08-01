export type TokenType = 'word' | 'pipe' | 'redirect_out' | 'redirect_append' | 'and' | 'or' | 'semi'

export interface Token {
  type: TokenType
  value: string
  /** Entirely single-quoted — skip $VAR expansion. */
  literal: boolean
  /** Contains any quoting — skip glob expansion. */
  quoted: boolean
}

/** Tokenizes a shell line, honoring single/double quotes and the `| > >> && || ;` operators. */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = line.length

  while (i < n) {
    const c = line[i]

    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (c === '|' && line[i + 1] === '|') {
      tokens.push({ type: 'or', value: '||', literal: false, quoted: false })
      i += 2
      continue
    }
    if (c === '|') {
      tokens.push({ type: 'pipe', value: '|', literal: false, quoted: false })
      i++
      continue
    }
    if (c === '&' && line[i + 1] === '&') {
      tokens.push({ type: 'and', value: '&&', literal: false, quoted: false })
      i += 2
      continue
    }
    if (c === ';') {
      tokens.push({ type: 'semi', value: ';', literal: false, quoted: false })
      i++
      continue
    }
    if (c === '>' && line[i + 1] === '>') {
      tokens.push({ type: 'redirect_append', value: '>>', literal: false, quoted: false })
      i += 2
      continue
    }
    if (c === '>') {
      tokens.push({ type: 'redirect_out', value: '>', literal: false, quoted: false })
      i++
      continue
    }

    let value = ''
    let hasSingleQuote = false
    let hasDoubleQuote = false
    let hasBareChars = false

    while (i < n) {
      const ch = line[i]
      if (ch === ' ' || ch === '\t' || ch === '|' || ch === ';' || ch === '>') break
      if (ch === '&' && line[i + 1] === '&') break

      if (ch === "'") {
        hasSingleQuote = true
        i++
        while (i < n && line[i] !== "'") {
          value += line[i]
          i++
        }
        i++ // closing quote
        continue
      }
      if (ch === '"') {
        hasDoubleQuote = true
        i++
        while (i < n && line[i] !== '"') {
          value += line[i]
          i++
        }
        i++ // closing quote
        continue
      }

      hasBareChars = true
      value += ch
      i++
    }

    tokens.push({
      type: 'word',
      value,
      literal: hasSingleQuote && !hasDoubleQuote && !hasBareChars,
      quoted: hasSingleQuote || hasDoubleQuote,
    })
  }

  return tokens
}

export interface Redirect {
  path: string
  append: boolean
}

export interface Statement {
  /** Relation to the previous statement's exit code. First statement is always `'always'`. */
  op: 'always' | 'and' | 'or'
  /** Pipeline: each entry is one command's word tokens. */
  commands: Token[][]
  redirect: Redirect | null
}

function buildStatement(tokens: Token[], op: Statement['op']): Statement {
  let redirect: Redirect | null = null
  const filtered: Token[] = []

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'redirect_out' || t.type === 'redirect_append') {
      const target = tokens[i + 1]
      if (target?.type === 'word') {
        redirect = { path: target.value, append: t.type === 'redirect_append' }
        i++
        continue
      }
    }
    filtered.push(t)
  }

  const commands: Token[][] = [[]]
  for (const t of filtered) {
    if (t.type === 'pipe') commands.push([])
    else commands[commands.length - 1].push(t)
  }

  return { op, commands, redirect }
}

/** Splits tokens into statements on `;`, `&&`, `||`, extracting the trailing redirect (if any) per statement. */
export function parseLine(tokens: Token[]): Statement[] {
  const statements: Statement[] = []
  let current: Token[] = []
  let op: Statement['op'] = 'always'

  const flush = () => {
    if (current.length > 0) statements.push(buildStatement(current, op))
    current = []
  }

  for (const t of tokens) {
    if (t.type === 'semi') {
      flush()
      op = 'always'
    } else if (t.type === 'and') {
      flush()
      op = 'and'
    } else if (t.type === 'or') {
      flush()
      op = 'or'
    } else {
      current.push(t)
    }
  }
  flush()

  return statements
}
