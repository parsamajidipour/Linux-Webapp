import { beforeEach, describe, expect, it } from 'vitest'
import { Kernel } from '../../Kernel'
import type { ShellContext } from '../types'

describe('phase 4.12 — text processing commands', () => {
  let kernel: Kernel
  let ctx: ShellContext

  beforeEach(async () => {
    kernel = new Kernel()
    await kernel.boot()
    ctx = kernel.createContext('bitx')
  })

  it('echo joins args with a space by default', async () => {
    const result = await kernel.shell.run('echo hello world', ctx)
    expect(result.stdout).toBe('hello world')
  })

  it('echo -e interprets backslash escapes, plain echo does not', async () => {
    const escaped = await kernel.shell.run('echo -e a\\tb', ctx)
    expect(escaped.stdout).toBe('a\tb')
    const plain = await kernel.shell.run('echo a\\tb', ctx)
    expect(plain.stdout).toBe('a\\tb')
  })

  it('printf substitutes %s/%d and interprets \\n', async () => {
    const result = await kernel.shell.run('printf %s-%d\\n hello 5', ctx)
    expect(result.stdout).toBe('hello-5\n')
  })

  it('sort sorts lines, -r reverses, -n sorts numerically, -u dedupes', async () => {
    await kernel.shell.run('printf "b\\n10\\na\\n2\\na"> nums.txt', ctx)
    const alpha = await kernel.shell.run('sort nums.txt', ctx)
    expect(alpha.stdout.split('\n')).toEqual(['10', '2', 'a', 'a', 'b'])

    const numeric = await kernel.shell.run('sort -n nums.txt', ctx)
    expect(numeric.stdout.split('\n').filter((l) => /^\d+$/.test(l))).toEqual(['2', '10'])

    const reversed = await kernel.shell.run('sort -r nums.txt', ctx)
    expect(reversed.stdout.split('\n')[0]).toBe('b')

    const unique = await kernel.shell.run('sort -u nums.txt', ctx)
    expect(unique.stdout.split('\n').filter((l) => l === 'a')).toHaveLength(1)
  })

  it('uniq collapses adjacent duplicates and supports -c/-d/-u', async () => {
    const piped = await kernel.shell.run('printf "a\\na\\nb\\na" | uniq', ctx)
    expect(piped.stdout.split('\n')).toEqual(['a', 'b', 'a'])

    const counted = await kernel.shell.run('printf "a\\na\\nb\\na" | uniq -c', ctx)
    expect(counted.stdout).toContain('2 a')

    const dupOnly = await kernel.shell.run('printf "a\\na\\nb\\na" | uniq -d', ctx)
    expect(dupOnly.stdout.trim()).toBe('a')
  })

  it('cut extracts fields with -d/-f and characters with -c', async () => {
    await kernel.shell.run('echo a:b:c > row.txt', ctx)
    const fields = await kernel.shell.run('cut -d : -f 1,3 row.txt', ctx)
    expect(fields.stdout).toBe('a:c')

    await kernel.shell.run('echo hello > word.txt', ctx)
    const cutChars = await kernel.shell.run('cut -c 1-3 word.txt', ctx)
    expect(cutChars.stdout).toBe('hel')
  })

  it('awk prints fields with default and custom (-F) delimiters', async () => {
    await kernel.shell.run('echo one two three > words.txt', ctx)
    const secondField = await kernel.shell.run("awk '{print $2}' words.txt", ctx)
    expect(secondField.stdout).toBe('two')

    await kernel.shell.run('echo a,b,c > csv.txt', ctx)
    const csvField = await kernel.shell.run("awk -F , '{print $3}' csv.txt", ctx)
    expect(csvField.stdout).toBe('c')
  })

  it('sed substitutes with s/// and supports the g flag', async () => {
    await kernel.shell.run('echo foo bar foo > s.txt', ctx)
    const first = await kernel.shell.run('sed s/foo/baz/ s.txt', ctx)
    expect(first.stdout).toBe('baz bar foo')

    const all = await kernel.shell.run('sed s/foo/baz/g s.txt', ctx)
    expect(all.stdout).toBe('baz bar baz')
  })

  it('wc counts a file directly by path, not just via stdin', async () => {
    await kernel.shell.run('printf "one two\\nthree\\n" > wc.txt', ctx)
    const result = await kernel.shell.run('wc wc.txt', ctx)
    expect(result.stdout.trim()).toBe('2 3 14 wc.txt')

    const lines = await kernel.shell.run('wc -l wc.txt', ctx)
    expect(lines.stdout.trim()).toBe('2 wc.txt')
  })
})
