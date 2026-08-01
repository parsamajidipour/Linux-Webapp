import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'
import type { ShellContext } from '../../os/shell/types'

interface Line {
  text: string
  cls?: string
}

const CURRENT_USER = 'bitx' // hardcoded until PLAN.md phase 1 (login) picks the active session user

function formatCwd(cwd: string, home: string): string {
  if (cwd === home) return '~'
  if (cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`
  return cwd
}

export function TerminalApp() {
  const desktop = useDesktop()
  const { kernel, ready } = useKernel()
  const [lines, setLines] = useState<Line[]>([
    { text: 'Welcome to Ubuntu 24.04.2 LTS (GNU/Linux 6.11.0-generic x86_64)', cls: 'text-neutral-400' },
    { text: '', cls: '' },
    { text: 'Type "help" to list available commands.', cls: 'text-neutral-400' },
    { text: '', cls: '' },
  ])
  const [input, setInput] = useState('')
  const [sessionHistory, setSessionHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const shellCtx = useMemo<ShellContext | null>(() => (ready ? kernel.createContext(CURRENT_USER) : null), [ready, kernel])
  const [, bump] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ~/.bash_history is written by Shell.run() through the same VFS everything else uses, so
  // it survives a page reload — read it once (pure, synchronous) to seed arrow-key recall.
  const loadedHistory = useMemo<string[]>(() => {
    if (!shellCtx) return []
    const home = kernel.users.findByName(shellCtx.currentUser)?.home ?? '/root'
    try {
      return kernel.vfs.readFile(`${home}/.bash_history`).split('\n').filter(Boolean)
    } catch {
      return []
    }
  }, [shellCtx, kernel])
  const history = useMemo(() => [...loadedHistory, ...sessionHistory], [loadedHistory, sessionHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  const print = (newLines: Line[]) => setLines((prev) => [...prev, ...newLines])

  const promptLineFor = (raw: string): string => {
    const home = kernel.users.findByName(shellCtx?.currentUser ?? CURRENT_USER)?.home ?? '/root'
    return shellCtx
      ? `${shellCtx.currentUser}@${kernel.vfs.readFile('/etc/hostname').trim()}:${formatCwd(shellCtx.cwd, home)}$ ${raw}`
      : `$ ${raw}`
  }

  const runCommand = async (raw: string) => {
    print([{ text: promptLineFor(raw), cls: 'text-[#8eef97]' }])

    const cmdline = raw.trim()
    if (!cmdline) return

    if (!shellCtx) {
      print([{ text: 'bash: kernel is still booting, try again in a moment', cls: 'text-yellow-300' }])
      return
    }

    if (cmdline === 'clear') {
      setLines([])
      return
    }

    if (cmdline === 'exit') {
      print([{ text: 'logout', cls: 'text-neutral-400' }])
      setTimeout(() => {
        const win = desktop.windows.find((w) => w.appId === 'terminal')
        if (win) desktop.closeWindow(win.id)
      }, 350)
      return
    }

    if (cmdline === 'help') {
      print([
        { text: 'Available commands:', cls: 'text-white font-bold' },
        { text: kernel.registry.list().join('  '), cls: 'text-neutral-300' },
        { text: 'clear, exit, help  (built into this terminal window)', cls: 'text-neutral-300' },
      ])
      return
    }

    const result = await kernel.shell.run(raw, shellCtx)
    bump((n) => n + 1) // cwd/env/dirStack were mutated in place on the same object — force the prompt to re-render

    const out: Line[] = []
    if (result.stdout) out.push(...result.stdout.split('\n').map((text) => ({ text, cls: 'text-neutral-200' })))
    if (result.stderr) out.push(...result.stderr.split('\n').map((text) => ({ text, cls: 'text-red-400' })))
    print(out)
  }

  const longestCommonPrefix = (words: string[]): string => {
    if (!words.length) return ''
    let prefix = words[0]
    for (const w of words.slice(1)) {
      while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1)
    }
    return prefix
  }

  // Real Tab completion against the live VFS/command registry — not a hardcoded list.
  // Approximation: completes the token at the end of the input, ignoring cursor position
  // and quoting (good enough for a terminal simulator, matches real bash for the common case).
  const handleTabComplete = () => {
    if (!shellCtx) return
    const m = /(\S*)$/.exec(input)
    const partial = m ? m[1] : ''
    const beforeWord = input.slice(0, input.length - partial.length)
    const isFirstWord = beforeWord.trim() === ''

    let matches: string[]
    let dirPart = ''
    let isDirMatch: (name: string) => boolean = () => false

    if (isFirstWord) {
      matches = kernel.registry.list().filter((c) => c.startsWith(partial))
    } else {
      const lastSlash = partial.lastIndexOf('/')
      dirPart = lastSlash === -1 ? '' : partial.slice(0, lastSlash + 1)
      const prefix = lastSlash === -1 ? partial : partial.slice(lastSlash + 1)
      const dirInput = lastSlash === -1 ? '.' : partial.slice(0, lastSlash) || '/'
      const home = kernel.users.findByName(shellCtx.currentUser)?.home ?? '/root'
      const dirAbs = kernel.vfs.resolve(dirInput, shellCtx.cwd, home)
      let entries: string[] = []
      try {
        entries = kernel.vfs.list(dirAbs)
      } catch {
        entries = []
      }
      matches = entries.filter((e) => e.startsWith(prefix))
      isDirMatch = (name: string) => kernel.vfs.stat(`${dirAbs === '/' ? '' : dirAbs}/${name}`)?.type === 'dir'
    }

    if (matches.length === 0) return

    if (matches.length === 1) {
      const [match] = matches
      const suffix = !isFirstWord && isDirMatch(match) ? '/' : ' '
      setInput(beforeWord + dirPart + match + suffix)
      return
    }

    const lcp = longestCommonPrefix(matches)
    const currentPrefix = isFirstWord ? partial : partial.slice(partial.lastIndexOf('/') + 1)
    if (lcp.length > currentPrefix.length) {
      setInput(beforeWord + dirPart + lcp)
      return
    }

    print([{ text: matches.join('  '), cls: 'text-neutral-400' }])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      handleTabComplete()
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault()
      print([{ text: `${promptLineFor(input)}^C`, cls: 'text-[#8eef97]' }])
      setInput('')
      setHistIdx(-1)
    } else if (e.key === 'Enter') {
      const value = input
      setInput('')
      setHistIdx(-1)
      if (value.trim()) setSessionHistory((h) => [...h, value])
      void runCommand(value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length) {
        const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1)
        setHistIdx(idx)
        setInput(history[idx])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx !== -1) {
        const idx = histIdx + 1
        if (idx >= history.length) {
          setHistIdx(-1)
          setInput('')
        } else {
          setHistIdx(idx)
          setInput(history[idx])
        }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  const activeUser = shellCtx?.currentUser ?? CURRENT_USER
  const home = kernel.users.findByName(activeUser)?.home ?? '/root'
  const promptCwd = shellCtx ? formatCwd(shellCtx.cwd, home) : '~'
  const hostname = ready ? kernel.vfs.readFile('/etc/hostname').trim() : 'ubuntu'

  return (
    <div
      className="h-full w-full bg-[#300a24]/95 text-sm terminal-font overflow-hidden flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto ubuntu-scroll px-3 py-2 leading-[1.35]">
        {lines.map((l, i) => (
          <pre key={i} className={`whitespace-pre-wrap break-all ${l.cls ?? ''}`} style={{ margin: 0 }}>
            {l.text}
          </pre>
        ))}
        <div className="flex items-center">
          <span className="text-[#8eef97] shrink-0">
            {activeUser}@{hostname}:<span className="text-[#729fcf]">{promptCwd}</span>$
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent outline-none border-none text-neutral-100 ml-1 terminal-font caret-[#E95420]"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            disabled={!ready}
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
