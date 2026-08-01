import type { CommandRegistry } from '../registry'
import { fail, ok, type CommandResult, type ShellContext } from '../types'
import { errMsg, flagChars, readFileArg } from './util'

function interpretBackslashEscapes(s: string): string {
  return s.replace(/\\([ntr\\abfv0])/g, (_, c: string) => {
    switch (c) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      case 'a':
        return '\x07'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      case 'v':
        return '\v'
      case '0':
        return '\0'
      default:
        return '\\'
    }
  })
}

function renderPrintf(format: string, args: string[]): string {
  let argIndex = 0
  let out = ''
  let i = 0
  while (i < format.length) {
    const c = format[i]
    if (c === '\\' && i + 1 < format.length) {
      out += interpretBackslashEscapes(format[i] + format[i + 1])
      i += 2
      continue
    }
    if (c === '%' && i + 1 < format.length) {
      const spec = format[i + 1]
      if (spec === '%') {
        out += '%'
      } else if (spec === 's') {
        out += args[argIndex++] ?? ''
      } else if (spec === 'd' || spec === 'i') {
        out += String(parseInt(args[argIndex++] ?? '0', 10) || 0)
      } else {
        out += c + spec
      }
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/** Parses `1,3` or `1-3` (or a mix) field/char specs into a 1-indexed number list. */
function parseFieldSpec(spec: string): number[] {
  const out: number[] = []
  for (const part of spec.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let n = a; n <= b; n++) out.push(n)
    } else {
      out.push(Number(part))
    }
  }
  return out
}

function readStdinOrFile(ctx: ShellContext, args: string[], stdin: string): { content: string; target?: string } | { error: string } {
  const target = args.find((a) => !a.startsWith('-'))
  if (!target) return { content: stdin }
  try {
    return { content: readFileArg(ctx, target), target }
  } catch (e) {
    return { error: errMsg(e) }
  }
}

function evalAwkPrintArg(token: string, origLine: string, fields: string[], nr: number): string {
  if (token === '$0') return origLine
  const fieldRef = /^\$(\d+)$/.exec(token)
  if (fieldRef) return fields[Number(fieldRef[1]) - 1] ?? ''
  if (token === 'NR' || token === 'NF') return token === 'NR' ? String(nr) : String(fields.length)
  const quoted = /^"(.*)"$/.exec(token)
  if (quoted) return quoted[1]
  return token
}

function parseSedSubstitute(expr: string): { pattern: string; replacement: string; global: boolean } | null {
  if (!expr.startsWith('s') || expr.length < 2) return null
  const delimiter = expr[1]
  const parts: string[] = []
  let current = ''
  let escaped = false
  for (let i = 2; i < expr.length; i++) {
    const c = expr[i]
    if (escaped) {
      current += c
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === delimiter) {
      parts.push(current)
      current = ''
      continue
    }
    current += c
  }
  parts.push(current)
  if (parts.length < 2) return null
  const [pattern, replacement, flags = ''] = parts
  return { pattern, replacement, global: flags.includes('g') }
}

function wcCounts(content: string): { lineCount: number; wordCount: number; charCount: number } {
  const lineCount = content.length ? content.split('\n').length - (content.endsWith('\n') ? 1 : 0) : 0
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return { lineCount, wordCount, charCount: content.length }
}

function renderWc(flags: string, c: { lineCount: number; wordCount: number; charCount: number }, label?: string): string {
  const suffix = label ? ` ${label}` : ''
  if (flags.includes('l')) return `${c.lineCount}${suffix}`
  if (flags.includes('w')) return `${c.wordCount}${suffix}`
  if (flags.includes('c')) return `${c.charCount}${suffix}`
  return `${c.lineCount} ${c.wordCount} ${c.charCount}${suffix}`
}

/** PLAN.md phase 4.12 — Text processing: echo, printf, sort, uniq, cut, awk, sed, wc.
 * `echo`/`wc` move here from `basic.ts` now that this sub-phase is actually implemented. */
export function registerTextCommands(registry: CommandRegistry): void {
  registry.register('echo', (args) => {
    let i = 0
    let interpretEscapes = false
    while (i < args.length && /^-[neE]+$/.test(args[i])) {
      if (args[i].includes('e')) interpretEscapes = true
      if (args[i].includes('E')) interpretEscapes = false
      i++
    }
    let text = args.slice(i).join(' ')
    if (interpretEscapes) text = interpretBackslashEscapes(text)
    return ok(text)
  })

  registry.register('printf', (args) => {
    const format = args[0]
    if (!format) return fail('usage: printf FORMAT [ARGS...]')
    return ok(renderPrintf(format, args.slice(1)))
  })

  registry.register('sort', (args, ctx, stdin): CommandResult => {
    const read = readStdinOrFile(ctx, args, stdin)
    if ('error' in read) return fail(`sort: ${read.error}`)
    const flags = flagChars(args)
    const numeric = flags.includes('n')

    let lines = read.content.length ? read.content.split('\n') : []
    lines = [...lines].sort((a, b) => (numeric ? (parseFloat(a) || 0) - (parseFloat(b) || 0) : a.localeCompare(b)))
    if (flags.includes('r')) lines.reverse()
    if (flags.includes('u')) lines = lines.filter((l, i) => i === 0 || l !== lines[i - 1])
    return ok(lines.join('\n'))
  })

  registry.register('uniq', (args, ctx, stdin): CommandResult => {
    const read = readStdinOrFile(ctx, args, stdin)
    if ('error' in read) return fail(`uniq: ${read.error}`)
    const flags = flagChars(args)

    const lines = read.content.length ? read.content.split('\n') : []
    const groups: { line: string; count: number }[] = []
    for (const line of lines) {
      const last = groups[groups.length - 1]
      if (last && last.line === line) last.count++
      else groups.push({ line, count: 1 })
    }

    let result = groups
    if (flags.includes('d')) result = result.filter((g) => g.count > 1)
    if (flags.includes('u')) result = result.filter((g) => g.count === 1)

    const out = result.map((g) => (flags.includes('c') ? `${String(g.count).padStart(7)} ${g.line}` : g.line))
    return ok(out.join('\n'))
  })

  registry.register('cut', (args, ctx, stdin): CommandResult => {
    const dIdx = args.indexOf('-d')
    const fIdx = args.indexOf('-f')
    const cIdx = args.indexOf('-c')
    if (fIdx === -1 && cIdx === -1) return fail('usage: cut -d DELIM -f FIELDS | -c CHARS [file]')

    const delim = dIdx !== -1 ? args[dIdx + 1] : '\t'
    const flagPairs = [dIdx, fIdx, cIdx].filter((i) => i !== -1)
    const consumed = new Set(flagPairs.flatMap((i) => [i, i + 1]))
    const target = args.find((a, idx) => !a.startsWith('-') && !consumed.has(idx))

    let content: string
    if (target) {
      try {
        content = readFileArg(ctx, target)
      } catch (e) {
        return fail(`cut: ${errMsg(e)}`)
      }
    } else {
      content = stdin
    }

    const lines = content.length ? content.split('\n') : []
    if (fIdx !== -1) {
      const fields = parseFieldSpec(args[fIdx + 1])
      return ok(lines.map((line) => fields.map((f) => line.split(delim)[f - 1] ?? '').join(delim)).join('\n'))
    }
    const positions = parseFieldSpec(args[cIdx + 1])
    return ok(lines.map((line) => positions.map((p) => line[p - 1] ?? '').join('')).join('\n'))
  })

  registry.register('awk', (args, ctx, stdin): CommandResult => {
    const positional: string[] = []
    let delim: string | null = null
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-F') {
        delim = args[++i] ?? null
        continue
      }
      positional.push(args[i])
    }
    const program = positional[0]
    if (!program) return fail('usage: awk [-F sep] "program" [file]')

    let content: string
    if (positional[1]) {
      try {
        content = readFileArg(ctx, positional[1])
      } catch (e) {
        return fail(`awk: ${errMsg(e)}`)
      }
    } else {
      content = stdin
    }

    const printMatch = /^\{\s*print\s*(.*?)\s*\}$/.exec(program.trim())
    if (!printMatch) return fail(`awk: unsupported program (only '{print ...}' is supported): ${program}`)
    const printExpr = printMatch[1]

    const lines = content.length ? content.split('\n') : []
    const out = lines.map((line, idx) => {
      if (!printExpr) return line
      const fields = delim ? line.split(delim) : line.split(/\s+/).filter(Boolean)
      const tokens = printExpr.split(',').map((t) => t.trim()).filter(Boolean)
      return tokens.map((t) => evalAwkPrintArg(t, line, fields, idx + 1)).join(' ')
    })
    return ok(out.join('\n'))
  })

  registry.register('sed', (args, ctx, stdin): CommandResult => {
    const positional = args.filter((a, idx) => a !== '-e' && args[idx - 1] !== '-e')
    const expr = positional[0]
    if (!expr) return fail('usage: sed SCRIPT [file]')

    let content: string
    if (positional[1]) {
      try {
        content = readFileArg(ctx, positional[1])
      } catch (e) {
        return fail(`sed: ${errMsg(e)}`)
      }
    } else {
      content = stdin
    }

    const lines = content.length ? content.split('\n') : []

    const deleteMatch = /^(\d+)d$/.exec(expr)
    if (deleteMatch) {
      const n = Number(deleteMatch[1])
      return ok(lines.filter((_, idx) => idx + 1 !== n).join('\n'))
    }

    const sub = parseSedSubstitute(expr)
    if (!sub) return fail(`sed: unsupported expression: ${expr}`)
    let re: RegExp
    try {
      re = new RegExp(sub.pattern, sub.global ? 'g' : '')
    } catch {
      return fail(`sed: invalid pattern: ${sub.pattern}`)
    }
    const replacement = sub.replacement.replace(/\\(\d)/g, '$$$1')
    return ok(lines.map((line) => line.replace(re, replacement)).join('\n'))
  })

  registry.register('wc', (args, ctx, stdin): CommandResult => {
    const flags = flagChars(args)
    const files = args.filter((a) => !a.startsWith('-'))
    if (!files.length) return ok(renderWc(flags, wcCounts(stdin)))

    const lines: string[] = []
    const totals = { lineCount: 0, wordCount: 0, charCount: 0 }
    for (const f of files) {
      let content: string
      try {
        content = readFileArg(ctx, f)
      } catch (e) {
        return fail(`wc: ${f}: ${errMsg(e)}`)
      }
      const c = wcCounts(content)
      totals.lineCount += c.lineCount
      totals.wordCount += c.wordCount
      totals.charCount += c.charCount
      lines.push(renderWc(flags, c, f))
    }
    if (files.length > 1) lines.push(renderWc(flags, totals, 'total'))
    return ok(lines.join('\n'))
  })
}
