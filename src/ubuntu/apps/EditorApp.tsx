import { useMemo, useState } from 'react'
import { Save, Menu, CircleCheck, AlertCircle } from 'lucide-react'
import { useWinTheme } from '../winTheme'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'
import { basename } from '../../os/vfs/path'

interface Payload {
  name?: string
  path?: string
  content?: string
}

export function EditorApp({ payload }: { payload?: unknown }) {
  const t = useWinTheme()
  const { kernel } = useKernel()
  const { sessionUser } = useDesktop()
  const p = (payload ?? {}) as Payload

  const username = sessionUser ?? 'root'
  const home = kernel.users.findByName(username)?.home ?? '/root'
  const actor = kernel.users.toSubject(username)

  const [path, setPath] = useState(p.path ?? `${home}/Untitled Document.txt`)
  const [name, setName] = useState(p.name ?? basename(path))
  const [text, setText] = useState(p.content ?? '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A new payload means a different file was double-clicked from Files while this window
  // was already open (openApp() updates payload without remounting). React's recommended
  // way to react to that is adjusting state during render, not in an effect — an effect
  // would render once with the stale buffer, then re-render with the new one.
  const [syncedPayload, setSyncedPayload] = useState(payload)
  if (payload !== syncedPayload) {
    setSyncedPayload(payload)
    const next = payload as Payload | undefined
    if (next?.path) {
      setPath(next.path)
      setName(next.name ?? basename(next.path))
      setText(next.content ?? '')
      setError(null)
    }
  }

  const stats = useMemo(() => {
    const lines = text === '' ? 0 : text.split('\n').length
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
    return { lines, words, chars: text.length }
  }, [text])

  const save = () => {
    try {
      if (!kernel.vfs.exists(path)) kernel.vfs.touch(path, { actor })
      kernel.vfs.writeFile(path, text, { actor })
      void kernel.persist()
      setError(null)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1600)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={`flex flex-col h-full ${t.bgPanel} ${t.text}`}>
      {/* mini header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${t.border} ${t.bgToolbar}`}>
        <button
          onClick={save}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12.5px] font-medium text-white transition-colors"
          style={{ background: 'var(--ubuntu-accent)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ubuntu-accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ubuntu-accent)')}
        >
          <Save size={13} />
          Save
        </button>
        <span className={`text-[12.5px] ${t.textDim} truncate`}>
          {name}
          {savedFlash && (
            <span className="ml-2 inline-flex items-center gap-1 text-green-500 fade-in">
              <CircleCheck size={12} /> Saved
            </span>
          )}
          {error && (
            <span className="ml-2 inline-flex items-center gap-1 text-red-500 fade-in" title={error}>
              <AlertCircle size={12} /> {error}
            </span>
          )}
        </span>
        <div className="flex-1" />
        <button className={`p-1.5 rounded ${t.hover}`}>
          <Menu size={15} />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type here…"
        spellCheck={false}
        className={`flex-1 resize-none outline-none p-4 text-[13.5px] leading-relaxed terminal-font bg-transparent ${t.text} placeholder:text-neutral-400 ubuntu-scroll`}
        style={{ userSelect: 'text' }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault()
            save()
          }
        }}
      />

      <div className={`px-3 py-1 text-[11.5px] ${t.textDim} border-t ${t.border} flex gap-4`}>
        <span>{stats.lines} lines</span>
        <span>{stats.words} words</span>
        <span>{stats.chars} characters</span>
        <span className="ml-auto truncate">{path} · UTF-8</span>
      </div>
    </div>
  )
}
