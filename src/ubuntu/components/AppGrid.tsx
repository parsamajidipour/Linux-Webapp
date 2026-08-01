import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { APPS } from '../apps'

export function AppGrid() {
  const ctx = useDesktop()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => APPS.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  if (!ctx.appGridOpen) return null

  return (
    <div
      className="fixed inset-0 z-[450] overview-zoom flex flex-col"
      style={{ background: 'rgba(23,13,26,0.8)', backdropFilter: 'blur(28px) saturate(1.3)', WebkitBackdropFilter: 'blur(28px) saturate(1.3)' }}
      onClick={() => ctx.setAppGridOpen(false)}
    >
      <div className="flex justify-center mt-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 w-[420px] px-4 py-2.5 rounded-full bg-white/[0.12] border border-white/20 text-white backdrop-blur-xl">
          <Search size={17} className="opacity-70" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="bg-transparent outline-none flex-1 text-[14px] placeholder-neutral-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length) ctx.openApp(filtered[0].id)
              if (e.key === 'Escape') ctx.setAppGridOpen(false)
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-24" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-x-4 gap-y-7" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', width: 'min(680px, 100%)' }}>
          {filtered.map((a, i) => (
            <button
              key={a.id}
              onClick={() => ctx.openApp(a.id)}
              className="app-grid-icon flex flex-col items-center gap-2.5 p-3 rounded-2xl hover:bg-white/[0.09] slide-up"
              style={{ animationDelay: `${i * 28}ms`, animationFillMode: 'backwards' }}
            >
              <div className="scale-[1.25]">{a.icon}</div>
              <span className="text-white text-[12.5px] text-shadow-panel">{a.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-neutral-400 text-[14px] py-10">
              No results for “{query}”
            </div>
          )}
        </div>
      </div>

      <div className="pb-8 flex justify-center gap-2">
        <div className="h-1.5 w-6 rounded-full" style={{ background: 'var(--ubuntu-accent)' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
      </div>
    </div>
  )
}
