import { useMemo, useState } from 'react'
import { Save, Menu, CircleCheck } from 'lucide-react'
import { useWinTheme } from '../winTheme'

interface Payload {
  name?: string
  content?: string
}

export function EditorApp({ payload }: { payload?: unknown }) {
  const t = useWinTheme()
  const p = (payload ?? {}) as Payload
  const [name] = useState(p.name ?? 'untitled.txt')
  const [text, setText] = useState(p.content ?? '')
  const [savedFlash, setSavedFlash] = useState(false)

  const stats = useMemo(() => {
    const lines = text === '' ? 0 : text.split('\n').length
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
    return { lines, words, chars: text.length }
  }, [text])

  const save = () => {
    try {
      localStorage.setItem(`ubuntu-doc-${name}`, text)
    } catch {
      /* ignore */
    }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
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
        <span>Ln {text.slice(0, 0).length || stats.lines}, Col 1</span>
        <span>{stats.words} words</span>
        <span>{stats.chars} characters</span>
        <span className="ml-auto">Plain Text · UTF-8</span>
      </div>
    </div>
  )
}
