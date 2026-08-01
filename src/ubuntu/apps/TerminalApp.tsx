import React, { useEffect, useRef, useState } from 'react'
import { useDesktop } from '../context/DesktopContext'

interface Line {
  text: string
  cls?: string
  html?: string
}

type FsNode = { [key: string]: FsNode | string }

const FS: FsNode = {
  home: {
    user: {
      Desktop: {},
      Documents: {
        'welcome.txt':
          'Welcome to Ubuntu Web Desktop!\n\nThis entire desktop environment runs in your browser.\nTry the Activities overview, snap windows to screen edges,\nor type "neofetch" in this terminal.',
        'notes.md': '# Notes\n\n- Drag windows by their title bar\n- Drag to screen edge to snap\n- Double-click title bar to maximize\n- Right-click the desktop for options',
        'report.odt': '[binary file]',
      },
      Downloads: {
        'ubuntu-24.04.iso': '[binary file]',
        'wallpapers.zip': '[binary file]',
      },
      Pictures: {
        'jellyfish.png': '[binary file]',
        'sunset.jpg': '[binary file]',
      },
      Music: {},
      Videos: {},
      '.bashrc': '# ~/.bashrc\nexport PS1="\\u@\\h:\\w$ "\nalias ll="ls -alF"',
    },
  },
}

const USER = 'user'
const HOST = 'ubuntu'

function resolvePath(cwd: string[], target: string): string[] | null {
  if (target === '/') return []
  const parts = target.split('/').filter(Boolean)
  let path: string[]
  if (target.startsWith('/')) {
    path = []
  } else if (target.startsWith('~')) {
    path = ['home', 'user']
    parts.shift()
  } else {
    path = [...cwd]
  }
  for (const p of parts) {
    if (p === '.') continue
    if (p === '..') path.pop()
    else path.push(p)
  }
  return path
}

function getNode(path: string[]): FsNode | string | null {
  let node: FsNode | string = FS
  for (const p of path) {
    if (typeof node !== 'object' || node === null || !(p in node)) return null
    node = (node as FsNode)[p]
  }
  return node
}

function fmtPath(cwd: string[]): string {
  const full = '/' + cwd.join('/')
  if (full === '/home/user') return '~'
  if (full.startsWith('/home/user/')) return '~' + full.slice(10)
  return full
}

const NEOFETCH = [
  { text: "            ./+o+-      ", cls: 'text-[#E95420]' },
  { text: '      yyyyy- -yyyyyy+      ', cls: 'text-[#E95420]' },
  { text: '   `-://+//////-yyyyyyo   ', cls: 'text-[#E95420]' },
  { text: '       .++ .:/++++++/-.+sss/`  ', cls: 'text-[#E95420]' },
  { text: '     .:++o:  /++++++++/:--:/-  ', cls: 'text-[#E95420]' },
  { text: '    o:+o+:++.`..```.-/oo+++++/ ', cls: 'text-[#E95420]' },
  { text: '   .:+o:+o/.          `+sssoo+/', cls: 'text-[#E95420]' },
  { text: '     ++:+:              `-/:   ', cls: 'text-[#E95420]' },
  { text: '    `o/+`               .++`   ', cls: 'text-[#E95420]' },
  { text: '   `/++.                .o-    ', cls: 'text-[#E95420]' },
  { text: '  `+++:.                 -+.   ', cls: 'text-[#E95420]' },
]

const NEOFETCH_INFO = [
  ['', 'user@ubuntu'],
  ['', '-------------------'],
  ['OS', 'Ubuntu 24.04.2 LTS x86_64'],
  ['Host', 'Kimi Web Desktop'],
  ['Kernel', '6.11.0-generic'],
  ['Uptime', '42 mins'],
  ['Packages', '1782 (dpkg), 12 (snap)'],
  ['Shell', 'bash 5.2.21'],
  ['Resolution', '1920x1080'],
  ['DE', 'GNOME 46 (Web)'],
  ['WM', 'Mutter'],
  ['Theme', 'Yaru'],
  ['Icons', 'Yaru'],
  ['CPU', 'Web V8 JIT (4) @ 3.40GHz'],
  ['GPU', 'WebGL Renderer'],
  ['Memory', '1842MiB / 7936MiB'],
]

export function TerminalApp() {
  const ctx = useDesktop()
  const [lines, setLines] = useState<Line[]>([
    { text: 'Welcome to Ubuntu 24.04.2 LTS (GNU/Linux 6.11.0-generic x86_64)', cls: 'text-neutral-400' },
    { text: '', cls: '' },
    { text: 'Type "help" to list available commands. Try "neofetch"!', cls: 'text-neutral-400' },
    { text: '', cls: '' },
  ])
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState<string[]>(['home', 'user'])
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  const print = (newLines: Line[]) => setLines((prev) => [...prev, ...newLines])

  const runCommand = (raw: string) => {
    const cmdline = raw.trim()
    print([{ text: `${USER}@${HOST}:${fmtPath(cwd)}$ ${raw}`, cls: 'text-[#8eef97]' }])
    if (!cmdline) return

    const [cmd, ...args] = cmdline.split(/\s+/)

    switch (cmd) {
      case 'help':
        print([
          { text: 'Available commands:', cls: 'text-white font-bold' },
          { text: '  ls [path]     list directory contents', cls: 'text-neutral-300' },
          { text: '  cd <dir>      change directory', cls: 'text-neutral-300' },
          { text: '  pwd           print working directory', cls: 'text-neutral-300' },
          { text: '  cat <file>    print file contents', cls: 'text-neutral-300' },
          { text: '  echo <text>   display a line of text', cls: 'text-neutral-300' },
          { text: '  neofetch      show system information', cls: 'text-neutral-300' },
          { text: '  uname -a      kernel information', cls: 'text-neutral-300' },
          { text: '  date          current date and time', cls: 'text-neutral-300' },
          { text: '  whoami        effective username', cls: 'text-neutral-300' },
          { text: '  apt update    refresh package lists', cls: 'text-neutral-300' },
          { text: '  sudo <cmd>    run as superuser', cls: 'text-neutral-300' },
          { text: '  clear         clear the terminal', cls: 'text-neutral-300' },
          { text: '  exit          close this terminal', cls: 'text-neutral-300' },
        ])
        break
      case 'ls': {
        const target = args[0] ? resolvePath(cwd, args[0]) : cwd
        if (!target) {
          print([{ text: `ls: cannot access '${args[0]}': No such file or directory`, cls: 'text-red-400' }])
          break
        }
        const node = getNode(target)
        if (node === null) {
          print([{ text: `ls: cannot access '${args[0]}': No such file or directory`, cls: 'text-red-400' }])
        } else if (typeof node === 'string') {
          print([{ text: args[0] ?? '', cls: 'text-neutral-200' }])
        } else {
          const names = Object.keys(node)
          if (!names.length) break
          print(
            names.map((n) => ({
              text: typeof node[n] === 'object' ? n + '/' : n,
              cls: typeof node[n] === 'object' ? 'text-[#729fcf] font-bold' : 'text-neutral-200',
            })),
          )
        }
        break
      }
      case 'cd': {
        if (!args[0] || args[0] === '~') {
          setCwd(['home', 'user'])
          break
        }
        const target = resolvePath(cwd, args[0])
        const node = target ? getNode(target) : null
        if (target && node && typeof node === 'object') {
          setCwd(target)
        } else {
          print([{ text: `bash: cd: ${args[0]}: No such file or directory`, cls: 'text-red-400' }])
        }
        break
      }
      case 'pwd':
        print([{ text: '/' + cwd.join('/'), cls: 'text-neutral-200' }])
        break
      case 'cat': {
        if (!args[0]) {
          print([{ text: 'cat: missing operand', cls: 'text-red-400' }])
          break
        }
        const target = resolvePath(cwd, args[0])
        const node = target ? getNode(target) : null
        if (typeof node === 'string') {
          print(node.split('\n').map((t) => ({ text: t, cls: 'text-neutral-200' })))
        } else {
          print([{ text: `cat: ${args[0]}: No such file or directory`, cls: 'text-red-400' }])
        }
        break
      }
      case 'echo':
        print([{ text: args.join(' ').replace(/^["']|["']$/g, ''), cls: 'text-neutral-200' }])
        break
      case 'whoami':
        print([{ text: USER, cls: 'text-neutral-200' }])
        break
      case 'date':
        print([{ text: new Date().toString(), cls: 'text-neutral-200' }])
        break
      case 'uname':
        print([
          {
            text: args.includes('-a')
              ? 'Linux ubuntu 6.11.0-generic #24-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux'
              : 'Linux',
            cls: 'text-neutral-200',
          },
        ])
        break
      case 'hostname':
        print([{ text: HOST, cls: 'text-neutral-200' }])
        break
      case 'neofetch': {
        const out: Line[] = []
        const rows = Math.max(NEOFETCH.length, NEOFETCH_INFO.length)
        for (let i = 0; i < rows; i++) {
          const art = NEOFETCH[i]?.text ?? ' '.repeat(32)
          const info = NEOFETCH_INFO[i]
          let infoText = ''
          if (info) {
            infoText = info[0] ? `${info[0]}: ${info[1]}` : info[1]
          }
          out.push({ text: art + '  ' + infoText, cls: i < NEOFETCH.length ? 'text-[#E95420]' : 'text-neutral-200' })
        }
        print(out)
        break
      }
      case 'apt':
      case 'apt-get': {
        if (args[0] === 'update') {
          print([
            { text: 'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease', cls: 'text-neutral-300' },
            { text: 'Get:2 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]', cls: 'text-neutral-300' },
            { text: 'Hit:3 http://archive.ubuntu.com/ubuntu noble-updates InRelease', cls: 'text-neutral-300' },
            { text: 'Fetched 126 kB in 1s (145 kB/s)', cls: 'text-neutral-300' },
            { text: 'Reading package lists... Done', cls: 'text-[#8eef97]' },
            { text: 'All packages are up to date.', cls: 'text-neutral-300' },
          ])
        } else if (args[0] === 'install') {
          print([
            { text: 'Reading package lists... Done', cls: 'text-neutral-300' },
            { text: 'Building dependency tree... Done', cls: 'text-neutral-300' },
            { text: `E: Unable to locate package ${args[1] ?? ''} (this is a web desktop)`, cls: 'text-yellow-300' },
          ])
        } else {
          print([{ text: 'apt 2.7.14 (amd64) — try: apt update', cls: 'text-neutral-300' }])
        }
        break
      }
      case 'sudo':
        if (args[0] === 'apt' || args[0] === 'apt-get') {
          runCommand(args.join(' '))
        } else {
          print([
            { text: '[sudo] password for user: ', cls: 'text-neutral-300' },
            { text: 'user is not in the sudoers file. This incident will be reported.', cls: 'text-red-400' },
          ])
        }
        break
      case 'clear':
        setLines([])
        break
      case 'exit':
        print([{ text: 'logout', cls: 'text-neutral-400' }])
        setTimeout(() => {
          const win = ctx.windows.find((w) => w.appId === 'terminal')
          if (win) ctx.closeWindow(win.id)
        }, 350)
        break
      default:
        print([{ text: `bash: ${cmd}: command not found`, cls: 'text-red-400' }])
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input)
      if (input.trim()) {
        setHistory((h) => [...h, input])
      }
      setHistIdx(-1)
      setInput('')
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
            {USER}@{HOST}:<span className="text-[#729fcf]">{fmtPath(cwd)}</span>$
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
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
