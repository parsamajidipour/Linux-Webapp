import { useMemo, useState } from 'react'
import { File, Folder, Search, X } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'
import type { Kernel } from '../../os/Kernel'
import { APPS, getApp } from '../apps'
import { kindOf } from '../fileKind'
import { basename, dirname } from '../../os/vfs/path'

interface FileHit {
  path: string
  type: 'file' | 'dir'
}

/** Recursively searches the real VFS from `root`, matching entry names against `query`.
 * Bounded (depth + result count) so a large home directory can't hang the UI. */
function searchVfs(kernel: Kernel, root: string, query: string, limit = 8): FileHit[] {
  const q = query.toLowerCase()
  const results: FileHit[] = []

  function walk(abs: string, depth: number) {
    if (results.length >= limit || depth > 6) return
    let entries: string[]
    try {
      entries = kernel.vfs.list(abs)
    } catch {
      return
    }
    for (const name of entries) {
      if (results.length >= limit) return
      const childAbs = abs === '/' ? `/${name}` : `${abs}/${name}`
      const node = kernel.vfs.stat(childAbs)
      if (!node) continue
      if (name.toLowerCase().includes(q)) {
        results.push({ path: childAbs, type: node.type === 'dir' ? 'dir' : 'file' })
      }
      if (node.type === 'dir') walk(childAbs, depth + 1)
    }
  }

  walk(root, 0)
  return results
}

export function ActivitiesOverview() {
  const ctx = useDesktop()
  const { kernel, ready } = useKernel()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => APPS.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  const home = kernel.users.findByName(ctx.sessionUser ?? '')?.home ?? '/root'
  const fileHits = useMemo(
    () => (ready && query ? searchVfs(kernel, home, query) : []),
    [kernel, ready, home, query],
  )

  const openFileHit = (hit: FileHit) => {
    if (hit.type === 'dir') {
      ctx.openApp('files', { path: hit.path })
      ctx.setOverviewOpen(false)
      return
    }
    const node = kernel.vfs.stat(hit.path)
    const kind = node ? kindOf(node, basename(hit.path)) : 'other'
    if (kind === 'text') {
      try {
        const content = kernel.vfs.readFile(hit.path, { actor: kernel.users.toSubject(ctx.sessionUser ?? '') })
        ctx.openApp('editor', { path: hit.path, name: basename(hit.path), content })
      } catch {
        ctx.openApp('files', { path: dirname(hit.path) })
      }
    } else {
      // No viewer/player app exists yet — land in Files, right next to the file, like a
      // real DE falling back to "show in folder" when it has nothing to open something with.
      ctx.openApp('files', { path: dirname(hit.path) })
    }
    ctx.setOverviewOpen(false)
  }

  if (!ctx.overviewOpen) return null

  // Real GNOME scopes the overview's window cards to the workspace you're currently on —
  // switching workspace (via the dots below) shows that workspace's own windows.
  const openWins = ctx.windows.filter((w) => !w.closing && w.workspace === ctx.currentWorkspace)

  return (
    <div
      className="fixed inset-0 z-[450] overview-zoom flex flex-col"
      style={{ background: 'rgba(23,13,26,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      onClick={() => ctx.setOverviewOpen(false)}
    >
      {/* search */}
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
              if (e.key === 'Escape') ctx.setOverviewOpen(false)
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* content */}
      <div className="flex-1 flex flex-col items-center justify-center px-24" onClick={(e) => e.stopPropagation()}>
        {query ? (
          /* search results */
          <div style={{ width: 'min(760px, 100%)' }}>
            {filtered.length > 0 && (
              <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      ctx.openApp(a.id)
                      ctx.setOverviewOpen(false)
                    }}
                    className="app-grid-icon flex flex-col items-center gap-2 p-4 rounded-2xl hover:bg-white/10"
                  >
                    {a.icon}
                    <span className="text-white text-[13px]">{a.name}</span>
                  </button>
                ))}
              </div>
            )}

            {fileHits.length > 0 && (
              <div>
                <div className="text-[12px] font-semibold text-neutral-400 uppercase tracking-wide mb-2 px-1">
                  Files
                </div>
                <div className="rounded-2xl bg-white/[0.06] divide-y divide-white/10 overflow-hidden">
                  {fileHits.map((hit) => (
                    <button
                      key={hit.path}
                      onClick={() => openFileHit(hit)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-left"
                    >
                      {hit.type === 'dir' ? (
                        <Folder size={16} className="text-neutral-300 shrink-0" />
                      ) : (
                        <File size={16} className="text-neutral-300 shrink-0" />
                      )}
                      <span className="text-white text-[13px] truncate">{hit.path}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 && fileHits.length === 0 && (
              <div className="text-center text-neutral-400 text-[14px] py-10">No results for “{query}”</div>
            )}
          </div>
        ) : openWins.length ? (
          /* window cards */
          <div className="flex flex-wrap items-center justify-center gap-6 max-w-6xl">
            {openWins.map((w) => {
              const app = getApp(w.appId)
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    ctx.focusWindow(w.id)
                    ctx.setOverviewOpen(false)
                  }}
                  className="group flex flex-col items-center gap-2.5"
                >
                  <div
                    className="relative w-[300px] h-[185px] rounded-xl overflow-hidden transition-transform duration-200 group-hover:scale-[1.04]"
                    style={{
                      background: ctx.darkStyle ? '#2b2b2b' : '#e4e2df',
                      boxShadow: '0 18px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12)',
                    }}
                  >
                    {/* mini titlebar */}
                    <div className={`h-7 flex items-center px-2 gap-1.5 ${ctx.darkStyle ? 'bg-[#333]' : 'bg-[#d9d7d4]'}`}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ubuntu-accent)' }} />
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-400/60" />
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-400/60" />
                    </div>
                    <div className={`flex-1 h-[calc(100%-28px)] flex items-center justify-center ${ctx.darkStyle ? 'bg-[#242424]' : 'bg-[#f6f5f4]'}`}>
                      <div className="scale-[1.9]">{app.icon}</div>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-white/[0.06] transition-colors" />
                  </div>
                  <span className="text-white text-[13px] font-medium flex items-center gap-2 text-shadow-panel">
                    {app.name}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-neutral-300">
            <div className="text-[17px] font-medium mb-1">No open windows</div>
            <div className="text-[13px] text-neutral-400">Search above or pick an app from the dash</div>
          </div>
        )}
      </div>

      {/* workspace switcher */}
      <div className="pb-8 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
        {Array.from({ length: ctx.workspaceCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => ctx.setCurrentWorkspace(n)}
            title={`Workspace ${n}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: n === ctx.currentWorkspace ? 24 : 6,
              background: n === ctx.currentWorkspace ? 'var(--ubuntu-accent)' : 'rgba(255,255,255,0.4)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
