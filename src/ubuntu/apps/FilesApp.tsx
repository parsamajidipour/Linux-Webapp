import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Download,
  FileText,
  FilePlus,
  FolderPlus,
  Film,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Image as ImageIcon,
  List,
  Music,
  Search,
  Trash2,
  File as FileIcon,
  Link2,
} from 'lucide-react'
import { useWinTheme } from '../winTheme'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'
import { basename, dirname } from '../../os/vfs/path'
import type { Inode } from '../../os/vfs/types'
import { kindOf, type FileKind } from '../fileKind'

interface Entry {
  name: string
  abs: string
  node: Inode
  kind: FileKind
}

const TOTAL_DISK_BYTES = 20 * 1024 * 1024 * 1024

function humanBytes(bytes: number): string {
  const units = ['B', 'K', 'M', 'G', 'T']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

function relTime(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
}

function join(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

function itemIcon(kind: FileKind, size = 34) {
  switch (kind) {
    case 'folder':
      return <Folder size={size} fill="#e8a87c" color="#c97b4a" strokeWidth={1.2} />
    case 'text':
      return <FileText size={size} color="#8a8a82" strokeWidth={1.4} />
    case 'image':
      return <ImageIcon size={size} color="#729fcf" strokeWidth={1.4} />
    case 'audio':
      return <Music size={size} color="#ad7fa8" strokeWidth={1.4} />
    case 'video':
      return <Film size={size} color="#8a8a82" strokeWidth={1.4} />
    case 'archive':
      return <FileIcon size={size} color="#c4a000" strokeWidth={1.4} />
    case 'iso':
      return <HardDrive size={size} color="#888a85" strokeWidth={1.4} />
    case 'symlink':
      return <Link2 size={size} color="#729fcf" strokeWidth={1.4} />
    default:
      return <FileIcon size={size} color="#8a8a82" strokeWidth={1.4} />
  }
}

interface ContextMenuState {
  x: number
  y: number
  targetName: string | null
}

interface FilesPayload {
  path?: string
}

export function FilesApp({ payload }: { payload?: unknown }) {
  const t = useWinTheme()
  const { openApp, darkStyle, sessionUser, pushNotification } = useDesktop()
  const { kernel } = useKernel()

  const username = sessionUser ?? 'root'
  const home = kernel.users.findByName(username)?.home ?? '/root'
  const actor = kernel.users.toSubject(username)

  const trashDir = `${home}/.local/share/Trash/files`
  const trashInfoDir = `${home}/.local/share/Trash/info`

  const startPath = (payload as FilesPayload | undefined)?.path ?? home
  const [cwd, setCwd] = useState(startPath)
  const [history, setHistory] = useState<string[]>([startPath])
  const [historyIdx, setHistoryIdx] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [listView, setListView] = useState(false)
  const [version, setVersion] = useState(0)
  const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null)
  const [clipboard, setClipboard] = useState<{ abs: string; mode: 'copy' | 'cut' } | null>(null)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const bump = () => setVersion((v) => v + 1)
  const notifyError = (title: string, e: unknown) =>
    pushNotification({ app: 'Files', title, body: e instanceof Error ? e.message : String(e) })

  const isTrash = cwd === trashDir

  const navigate = (path: string) => {
    const newHist = [...history.slice(0, historyIdx + 1), path]
    setHistory(newHist)
    setHistoryIdx(newHist.length - 1)
    setCwd(path)
    setSelected(null)
    setQuery('')
  }

  // Window already open + a new file/folder picked from Activities search re-triggers
  // openApp() with a fresh payload rather than remounting. Adjusting state during render
  // (React's recommended pattern) avoids the extra render an effect-based sync would cost.
  const [syncedPayload, setSyncedPayload] = useState(payload)
  if (payload !== syncedPayload) {
    setSyncedPayload(payload)
    const nextPath = (payload as FilesPayload | undefined)?.path
    if (nextPath) navigate(nextPath)
  }

  const goBack = () => {
    if (historyIdx <= 0) return
    setHistoryIdx(historyIdx - 1)
    setCwd(history[historyIdx - 1])
    setSelected(null)
  }
  const goForward = () => {
    if (historyIdx >= history.length - 1) return
    setHistoryIdx(historyIdx + 1)
    setCwd(history[historyIdx + 1])
    setSelected(null)
  }

  const goSidebar = (path: string) => {
    if (!kernel.vfs.exists(path)) {
      try {
        kernel.vfs.mkdir(path, { parents: true, actor })
        bump()
      } catch {
        /* not creatable (e.g. no permission) — navigate anyway, will show empty state */
      }
    }
    navigate(path)
  }

  const entries: Entry[] = useMemo(() => {
    let names: string[]
    try {
      names = kernel.vfs.list(cwd)
    } catch {
      return []
    }
    const list = names
      .map((name): Entry | null => {
        const abs = join(cwd, name)
        const node = kernel.vfs.stat(abs)
        if (!node) return null
        return { name, abs, node, kind: kindOf(node, name) }
      })
      .filter((e): e is Entry => e !== null)
      .filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()))
    list.sort((a, b) => {
      if (a.kind === 'folder' && b.kind !== 'folder') return -1
      if (a.kind !== 'folder' && b.kind === 'folder') return 1
      return a.name.localeCompare(b.name)
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, query, version, kernel])

  const crumbs = useMemo(() => {
    const underHome = cwd === home || cwd.startsWith(home + '/')
    if (underHome) {
      const rest = cwd === home ? [] : cwd.slice(home.length + 1).split('/')
      return [{ label: 'Home', path: home }, ...rest.map((seg, i) => ({ label: seg, path: home + '/' + rest.slice(0, i + 1).join('/') }))]
    }
    const parts = cwd.split('/').filter(Boolean)
    return [{ label: 'Computer', path: '/' }, ...parts.map((seg, i) => ({ label: seg, path: '/' + parts.slice(0, i + 1).join('/') }))]
  }, [cwd, home])

  const freeUsed = kernel.vfs.sizeOf('/')

  const readTrashInfoPath = (name: string): string | null => {
    try {
      const info = kernel.vfs.readFile(join(trashInfoDir, `${name}.trashinfo`), { actor })
      const m = /^Path=(.*)$/m.exec(info)
      return m ? m[1] : null
    } catch {
      return null
    }
  }

  const moveToTrash = (entry: Entry) => {
    try {
      kernel.vfs.mkdir(trashDir, { parents: true, actor })
      kernel.vfs.mkdir(trashInfoDir, { parents: true, actor })
      let name = entry.name
      let n = 1
      while (kernel.vfs.exists(join(trashDir, name))) {
        name = `${entry.name}.${++n}`
      }
      kernel.vfs.move(entry.abs, join(trashDir, name), { actor })
      kernel.vfs.writeFile(join(trashInfoDir, `${name}.trashinfo`), `[Trash Info]\nPath=${entry.abs}\nDeletionDate=${new Date().toISOString()}\n`, { actor })
      void kernel.persist()
      bump()
      if (selected === entry.name) setSelected(null)
    } catch (e) {
      notifyError(`Couldn't move "${entry.name}" to Trash`, e)
    }
  }

  const restoreFromTrash = (entry: Entry) => {
    const original = readTrashInfoPath(entry.name)
    if (!original) {
      notifyError('Restore failed', `No record of the original location for "${entry.name}"`)
      return
    }
    try {
      kernel.vfs.mkdir(dirname(original), { parents: true, actor })
      kernel.vfs.move(entry.abs, original, { actor })
      kernel.vfs.remove(join(trashInfoDir, `${entry.name}.trashinfo`), { actor })
      void kernel.persist()
      bump()
    } catch (e) {
      notifyError(`Couldn't restore "${entry.name}"`, e)
    }
  }

  const deletePermanently = (entry: Entry) => {
    if (!window.confirm(`Permanently delete "${entry.name}"? This cannot be undone.`)) return
    try {
      kernel.vfs.remove(entry.abs, { recursive: true, actor })
      if (isTrash) {
        try {
          kernel.vfs.remove(join(trashInfoDir, `${entry.name}.trashinfo`), { actor })
        } catch {
          /* no companion info file — fine */
        }
      }
      void kernel.persist()
      bump()
      if (selected === entry.name) setSelected(null)
    } catch (e) {
      notifyError(`Couldn't delete "${entry.name}"`, e)
    }
  }

  const emptyTrash = () => {
    if (entries.length === 0) return
    if (!window.confirm('Empty Trash? All items will be permanently deleted.')) return
    for (const e of entries) {
      try {
        kernel.vfs.remove(e.abs, { recursive: true, actor })
        kernel.vfs.remove(join(trashInfoDir, `${e.name}.trashinfo`), { actor })
      } catch {
        /* best-effort cleanup */
      }
    }
    void kernel.persist()
    bump()
  }

  const uniqueName = (dir: string, base: string): string => {
    if (!kernel.vfs.exists(join(dir, base))) return base
    const dot = base.lastIndexOf('.')
    const hasExt = dot > 0 && dot < base.length - 1
    const stem = hasExt ? base.slice(0, dot) : base
    const ext = hasExt ? base.slice(dot) : ''
    let n = 2
    while (kernel.vfs.exists(join(dir, `${stem} ${n}${ext}`))) n++
    return `${stem} ${n}${ext}`
  }

  const newFolder = () => {
    const name = uniqueName(cwd, 'New Folder')
    try {
      kernel.vfs.mkdir(join(cwd, name), { actor })
      void kernel.persist()
      bump()
      setSelected(name)
      setRenaming({ name, value: name })
    } catch (e) {
      notifyError("Couldn't create folder", e)
    }
  }

  const commitRename = () => {
    if (!renaming) return
    const { name, value } = renaming
    const newName = value.trim()
    setRenaming(null)
    if (!newName || newName === name) return
    try {
      kernel.vfs.move(join(cwd, name), join(cwd, newName), { actor })
      void kernel.persist()
      bump()
      setSelected(newName)
    } catch (e) {
      notifyError(`Couldn't rename "${name}"`, e)
    }
  }

  const cancelRename = () => setRenaming(null)

  const pasteClipboard = () => {
    if (!clipboard) return
    const name = basename(clipboard.abs)
    const destName = uniqueName(cwd, name)
    try {
      if (clipboard.mode === 'copy') {
        const srcNode = kernel.vfs.stat(clipboard.abs)
        kernel.vfs.copy(clipboard.abs, join(cwd, destName), { recursive: srcNode?.type === 'dir', actor })
      } else {
        kernel.vfs.move(clipboard.abs, join(cwd, destName), { actor })
        setClipboard(null)
      }
      void kernel.persist()
      bump()
    } catch (e) {
      notifyError('Paste failed', e)
    }
  }

  const openItem = (entry: Entry) => {
    if (isTrash) return
    if (entry.kind === 'folder') {
      navigate(entry.abs)
      return
    }
    if (entry.kind === 'text') {
      try {
        const content = kernel.vfs.readFile(entry.abs, { actor })
        openApp('editor', { path: entry.abs, name: entry.name, content })
      } catch (e) {
        notifyError(`Couldn't open "${entry.name}"`, e)
      }
      return
    }
    pushNotification({ app: 'Files', title: entry.name, body: 'No application is available to open this file.' })
  }

  const openMenu = (e: React.MouseEvent, targetName: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    if (targetName) setSelected(targetName)
    setMenu({ x: e.clientX, y: e.clientY, targetName })
  }

  const closeMenu = () => setMenu(null)
  const menuEntry = menu?.targetName ? entries.find((e) => e.name === menu.targetName) ?? null : null

  return (
    <div className={`flex h-full ${t.bg} ${t.text}`} onClick={closeMenu}>
      {/* Sidebar */}
      <div className={`w-44 shrink-0 ${t.bgSidebar} flex flex-col py-2 border-r ${t.border}`}>
        <div className="flex-1 overflow-y-auto ubuntu-scroll">
          {[
            { label: 'Home', path: home, icon: Home },
            { label: 'Desktop', path: `${home}/Desktop`, icon: HardDrive },
            { label: 'Documents', path: `${home}/Documents`, icon: FileText },
            { label: 'Downloads', path: `${home}/Downloads`, icon: Download },
            { label: 'Music', path: `${home}/Music`, icon: Music },
            { label: 'Pictures', path: `${home}/Pictures`, icon: ImageIcon },
            { label: 'Videos', path: `${home}/Videos`, icon: Film },
          ].map((s) => (
            <button
              key={s.path}
              onClick={() => goSidebar(s.path)}
              className={`w-full flex items-center gap-2.5 px-4 py-[7px] text-[13px] ${t.hover} ${
                cwd === s.path ? `${t.active} font-medium` : ''
              }`}
              style={cwd === s.path ? { boxShadow: `inset 3px 0 0 var(--ubuntu-accent)` } : undefined}
            >
              <s.icon size={16} className={t.textDim} />
              {s.label}
            </button>
          ))}
          <div className={`mx-3 my-2 h-px ${t.divider}`} />
          <button
            onClick={() => navigate('/')}
            className={`w-full flex items-center gap-2.5 px-4 py-[7px] text-[13px] ${t.hover} ${
              cwd === '/' ? `${t.active} font-medium` : ''
            }`}
            style={cwd === '/' ? { boxShadow: `inset 3px 0 0 var(--ubuntu-accent)` } : undefined}
          >
            <HardDrive size={16} className={t.textDim} />
            Other Locations
          </button>
          <div className={`mx-3 my-2 h-px ${t.divider}`} />
          <button
            onClick={() => navigate(trashDir)}
            className={`w-full flex items-center gap-2.5 px-4 py-[7px] text-[13px] ${t.hover} ${
              isTrash ? `${t.active} font-medium` : ''
            }`}
            style={isTrash ? { boxShadow: `inset 3px 0 0 var(--ubuntu-accent)` } : undefined}
          >
            <Trash2 size={16} className={t.textDim} />
            Trash
          </button>
        </div>
        <div className={`px-4 py-2 flex items-center gap-2 text-[11px] ${t.textDim}`}>
          <HardDrive size={12} />
          <span>
            {humanBytes(TOTAL_DISK_BYTES - freeUsed)} free of {humanBytes(TOTAL_DISK_BYTES)}
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${t.border} ${t.bgToolbar}`}>
          <button onClick={goBack} disabled={historyIdx <= 0} className={`p-1.5 rounded ${t.hover} disabled:opacity-30`}>
            <ArrowLeft size={16} />
          </button>
          <button onClick={goForward} disabled={historyIdx >= history.length - 1} className={`p-1.5 rounded ${t.hover} disabled:opacity-30`}>
            <ArrowRight size={16} />
          </button>
          <div className={`flex items-center gap-0.5 text-[13px] px-2 py-1 rounded ${t.active} min-w-0 overflow-hidden`}>
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-0.5 whitespace-nowrap">
                {i > 0 && <ChevronRight size={13} className={t.textDim} />}
                <button className={`px-1 rounded ${t.hover} ${i === crumbs.length - 1 ? 'font-semibold' : ''}`} onClick={() => navigate(c.path)}>
                  {c.label}
                </button>
              </span>
            ))}
          </div>
          {!isTrash && (
            <button onClick={newFolder} title="New Folder" className={`p-1.5 rounded ${t.hover}`}>
              <FolderPlus size={16} />
            </button>
          )}
          {isTrash && entries.length > 0 && (
            <button onClick={emptyTrash} className={`px-2.5 py-1 rounded text-[12px] ${t.hover}`}>
              Empty Trash
            </button>
          )}
          <div className="flex-1" />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${t.border} ${t.input} text-[12px] w-44`}>
            <Search size={13} className="opacity-60" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="bg-transparent outline-none w-full" />
          </div>
          <button onClick={() => setListView(!listView)} className={`p-1.5 rounded ${t.hover} ${listView ? t.active : ''}`}>
            <List size={16} />
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto ubuntu-scroll p-3"
          onClick={() => setSelected(null)}
          onContextMenu={(e) => openMenu(e, null)}
        >
          {entries.length === 0 ? (
            <div className={`h-full flex flex-col items-center justify-center gap-3 ${t.textDim}`}>
              {isTrash ? <Trash2 size={64} strokeWidth={1} /> : <FolderOpen size={64} strokeWidth={1} />}
              <div className="text-lg font-medium">{isTrash ? 'Trash is Empty' : query ? 'No Results' : 'Folder is Empty'}</div>
            </div>
          ) : listView ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className={`text-left ${t.textDim} text-[12px]`}>
                  <th className="font-medium px-3 py-1">Name</th>
                  <th className="font-medium px-3 py-1 w-28">Size</th>
                  <th className="font-medium px-3 py-1 w-40">Modified</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.name}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(entry.name)
                    }}
                    onDoubleClick={() => openItem(entry)}
                    onContextMenu={(e) => openMenu(e, entry.name)}
                    className={`cursor-default rounded ${selected === entry.name ? '' : t.hover}`}
                    style={selected === entry.name ? { background: 'var(--ubuntu-accent)', color: '#fff' } : undefined}
                  >
                    <td className="px-3 py-1.5 flex items-center gap-2.5">
                      {itemIcon(entry.kind, 18)}
                      {renaming?.name === entry.name ? (
                        <RenameInput
                          value={renaming.value}
                          onChange={(v) => setRenaming({ name: entry.name, value: v })}
                          onCommit={commitRename}
                          onCancel={cancelRename}
                        />
                      ) : (
                        entry.name
                      )}
                    </td>
                    <td className="px-3 py-1.5">{entry.node.type === 'dir' ? `${kernel.vfs.list(entry.abs).length} items` : humanBytes(kernel.vfs.sizeOf(entry.abs))}</td>
                    <td className="px-3 py-1.5">{relTime(entry.node.mtime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
              {entries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(entry.name)
                  }}
                  onDoubleClick={() => openItem(entry)}
                  onContextMenu={(e) => openMenu(e, entry.name)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg ${t.hover}`}
                  style={
                    selected === entry.name
                      ? { background: 'var(--ubuntu-accent-soft)', boxShadow: `inset 0 0 0 1.5px var(--ubuntu-accent)` }
                      : undefined
                  }
                >
                  {itemIcon(entry.kind, 36)}
                  {renaming?.name === entry.name ? (
                    <RenameInput
                      value={renaming.value}
                      onChange={(v) => setRenaming({ name: entry.name, value: v })}
                      onCommit={commitRename}
                      onCancel={cancelRename}
                      center
                    />
                  ) : (
                    <span className={`text-[12px] text-center leading-tight break-words w-full line-clamp-2 ${selected === entry.name ? 'font-medium' : ''}`}>
                      {entry.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className={`px-3 py-1 text-[12px] ${t.textDim} border-t ${t.border} flex items-center gap-2`}>
          <Clock size={11} />
          <span>
            {entries.length} item{entries.length === 1 ? '' : 's'}
            {selected ? ` — "${selected}" selected` : ''}
          </span>
          <span className="ml-auto">{darkStyle ? 'Dark style' : 'Light style'}</span>
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div
          className="fixed z-[700] popover-glass rounded-lg p-1 w-52 text-white text-[13px] slide-up"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {isTrash ? (
            menuEntry ? (
              <>
                <MenuItem onClick={() => (restoreFromTrash(menuEntry), closeMenu())}>Restore</MenuItem>
                <MenuItem onClick={() => (deletePermanently(menuEntry), closeMenu())}>Delete Permanently</MenuItem>
              </>
            ) : (
              <MenuItem disabled={entries.length === 0} onClick={() => (emptyTrash(), closeMenu())}>
                Empty Trash
              </MenuItem>
            )
          ) : menuEntry ? (
            <>
              <MenuItem onClick={() => (openItem(menuEntry), closeMenu())}>Open</MenuItem>
              <MenuItem onClick={() => (setRenaming({ name: menuEntry.name, value: menuEntry.name }), closeMenu())}>Rename</MenuItem>
              <MenuItem onClick={() => (setClipboard({ abs: menuEntry.abs, mode: 'copy' }), closeMenu())}>Copy</MenuItem>
              <MenuItem onClick={() => (setClipboard({ abs: menuEntry.abs, mode: 'cut' }), closeMenu())}>Cut</MenuItem>
              <div className={`my-1 h-px bg-white/10`} />
              <MenuItem onClick={() => (moveToTrash(menuEntry), closeMenu())}>Move to Trash</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => (newFolder(), closeMenu())}>
                <span className="flex items-center gap-2">
                  <FolderPlus size={14} /> New Folder
                </span>
              </MenuItem>
              <MenuItem
                disabled={!clipboard}
                onClick={() => (pasteClipboard(), closeMenu())}
              >
                <span className="flex items-center gap-2">
                  <FilePlus size={14} /> Paste
                </span>
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  center,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  center?: boolean
}) {
  return (
    <input
      autoFocus
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCommit}
      className={`bg-white text-black text-[12px] rounded px-1 py-0.5 w-full outline-none ring-2 ring-[var(--ubuntu-accent)] ${center ? 'text-center' : ''}`}
    />
  )
}
