import { describe, expect, it } from 'vitest'
import { parseLine, tokenize } from './parser'

describe('tokenize', () => {
  it('splits plain words on whitespace', () => {
    const tokens = tokenize('ls -la /home')
    expect(tokens.map((t) => t.value)).toEqual(['ls', '-la', '/home'])
    expect(tokens.every((t) => t.type === 'word')).toBe(true)
  })

  it('recognizes pipes, redirects, and logical operators', () => {
    const tokens = tokenize('a | b > c.txt >> d.txt && e || f ; g')
    expect(tokens.map((t) => t.type)).toEqual([
      'word', 'pipe', 'word', 'redirect_out', 'word', 'redirect_append', 'word',
      'and', 'word', 'or', 'word', 'semi', 'word',
    ])
  })

  it('strips quotes but keeps content, marking literal for single-quoted words', () => {
    const tokens = tokenize(`echo "hello $USER" 'raw $USER'`)
    expect(tokens[1].value).toBe('hello $USER')
    expect(tokens[1].literal).toBe(false)
    expect(tokens[2].value).toBe('raw $USER')
    expect(tokens[2].literal).toBe(true)
  })

  it('marks quoted words as non-glob-eligible', () => {
    const tokens = tokenize(`echo "*.txt" *.txt`)
    expect(tokens[1].quoted).toBe(true)
    expect(tokens[2].quoted).toBe(false)
  })
})

describe('parseLine', () => {
  it('builds a single statement with a single command', () => {
    const statements = parseLine(tokenize('echo hi'))
    expect(statements).toHaveLength(1)
    expect(statements[0].commands).toHaveLength(1)
    expect(statements[0].op).toBe('always')
  })

  it('splits pipelines on |', () => {
    const statements = parseLine(tokenize('cat file.txt | grep nginx | wc -l'))
    expect(statements[0].commands).toHaveLength(3)
    expect(statements[0].commands[1].map((t) => t.value)).toEqual(['grep', 'nginx'])
  })

  it('extracts a trailing redirect', () => {
    const statements = parseLine(tokenize('echo hello > file.txt'))
    expect(statements[0].redirect).toEqual({ path: 'file.txt', append: false })
    expect(statements[0].commands[0].map((t) => t.value)).toEqual(['echo', 'hello'])
  })

  it('extracts an append redirect', () => {
    const statements = parseLine(tokenize('echo hi >> file.txt'))
    expect(statements[0].redirect).toEqual({ path: 'file.txt', append: true })
  })

  it('splits statements on ; && ||, tagging the operator', () => {
    const statements = parseLine(tokenize('mkdir x && cd x || echo failed ; pwd'))
    expect(statements.map((s) => s.op)).toEqual(['always', 'and', 'or', 'always'])
  })
})
