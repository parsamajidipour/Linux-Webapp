import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Film,
  Folder,
  HardDrive,
  Home,
  Image as ImageIcon,
  List,
  Music,
  Search,
  Star,
  Trash2,
  File as FileIcon,
} from 'lucide-react'
import { useWinTheme } from '../winTheme'
import { useDesktop } from '../context/DesktopContext'

interface FsItem {
  name: string
  type: 'folder' | 'text' | 'image' | 'audio' | 'video' | 'archive' | 'iso' | 'doc'
  size?: string
  modified?: string
  content?: string
  children?: FsItem[]
}

const HOME_CHILDREN: FsItem[] = [
  { name: 'Desktop', type: 'folder', children: [], modified: 'Today, 09:14' },
  {
    name: 'Documents',
    type: 'folder',
    modified: 'Today, 11:02',
    children: [
      {
        name: 'welcome.txt',
        type: 'text',
        size: '248 B',
        modified: 'Today, 11:02',
        content:
          'Welcome to Ubuntu Web Desktop!\n\nThis entire desktop environment runs in your browser.\n\nThings to try:\n  - Press Activities (top-left) for the overview\n  - Drag windows to screen edges to snap them\n  - Right-click the desktop for options\n  - Open the terminal and type "neofetch"',
      },
      {
        name: 'notes.md',
        type: 'text',
        size: '182 B',
        modified: 'Today, 10:47',
        content: '# My Notes\n\n- This desktop is fully interactive\n- Windows can be moved, resized and snapped\n- Settings lets you change accent color and wallpaper\n\nEnjoy exploring!',
      },
      { name: 'project-proposal.odt', type: 'doc', size: '84.2 kB', modified: 'Yesterday, 16:20' },
      { name: 'budget-2026.ods', type: 'doc', size: '41.7 kB', modified: 'Jul 14, 13:55' },
    ],
  },
  {
    name: 'Downloads',
    type: 'folder',
    modified: 'Jul 16, 18:31',
    children: [
      { name: 'ubuntu-24.04.2-desktop-amd64.iso', type: 'iso', size: '5.8 GB', modified: 'Jul 16, 18:31' },
      { name: 'wallpapers-pack.zip', type: 'archive', size: '12.4 MB', modified: 'Jul 12, 09:05' },
    ],
  },
  {
    name: 'Pictures',
    type: 'folder',
    modified: 'Jul 10, 20:12',
    children: [
      { name: 'jellyfish-noble.png', type: 'image', size: '3.2 MB', modified: 'Jul 10, 20:12' },
      { name: 'sunset-canyon.jpg', type: 'image', size: '2.1 MB', modified: 'Jul 08, 19:44' },
      { name: 'screenshot-2026-07-18.png', type: 'image', size: '912 kB', modified: 'Jul 05, 08:31' },
    ],
  },
  { name: 'Music', type: 'folder', children: [], modified: 'Jun 28, 15:00' },
  { name: 'Videos', type: 'folder', children: [], modified: 'Jun 21, 11:38' },
]

const SIDEBAR = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'desktop', label: 'Desktop', icon: HardDrive },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'pictures', label: 'Pictures', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Film },
]

function itemIcon(item: FsItem, size = 34) {
  switch (item.type) {
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
    default:
      return <FileIcon size={size} color="#8a8a82" strokeWidth={1.4} />
  }
}

function folderOf(place: string): FsItem[] {
  switch (place) {
    case 'home':
      return HOME_CHILDREN
    case 'desktop':
      return HOME_CHILDREN[0].children ?? []
    case 'documents':
      return HOME_CHILDREN[1].children ?? []
    case 'downloads':
      return HOME_CHILDREN[2].children ?? []
    case 'pictures':
      return HOME_CHILDREN[3].children ?? []
    case 'music':
      return HOME_CHILDREN[4].children ?? []
    case 'videos':
      return HOME_CHILDREN[5].children ?? []
    default:
      return []
  }
}

export function FilesApp() {
  const t = useWinTheme()
  const { openApp, darkStyle } = useDesktop()
  const [place, setPlace] = useState('home')
  const [stack, setStack] = useState<string[][]>([])
  const [stackIdx, setStackIdx] = useState(-1)
  const [path, setPath] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [listView, setListView] = useState(false)

  const items = useMemo(() => {
    let items = folderOf(place)
    if (path.length > 0) {
      let cur: FsItem[] = HOME_CHILDREN
      for (const seg of path) {
        const next = cur.find((i) => i.name === seg && i.type === 'folder')
        if (!next) return []
        cur = next.children ?? []
      }
      items = cur
    }
    if (query) items = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    return items
  }, [place, path, query])

  const crumbs = useMemo(() => {
    const rootLabel = SIDEBAR.find((s) => s.id === place)?.label ?? 'Home'
    return [rootLabel, ...path]
  }, [place, path])

  const navigateTo = (newPlace: string, newPath: string[]) => {
    const entry = [newPlace, ...newPath]
    const newStack = [...stack.slice(0, stackIdx + 1), entry]
    setStack(newStack)
    setStackIdx(newStack.length - 1)
    setPlace(newPlace)
    setPath(newPath)
    setSelected(null)
  }

  const goBack = () => {
    if (stackIdx > 0) {
      const entry = stack[stackIdx - 1]
      setStackIdx(stackIdx - 1)
      setPlace(entry[0])
      setPath(entry.slice(1))
      setSelected(null)
    }
  }

  const goForward = () => {
    if (stackIdx < stack.length - 1) {
      const entry = stack[stackIdx + 1]
      setStackIdx(stackIdx + 1)
      setPlace(entry[0])
      setPath(entry.slice(1))
      setSelected(null)
    }
  }

  const openItem = (item: FsItem) => {
    if (item.type === 'folder') {
      if (place === 'home' && path.length === 0) {
        const map: Record<string, string> = {
          Desktop: 'desktop',
          Documents: 'documents',
          Downloads: 'downloads',
          Pictures: 'pictures',
          Music: 'music',
          Videos: 'videos',
        }
        if (map[item.name]) {
          navigateTo(map[item.name], [])
          return
        }
      }
      navigateTo(place, [...path, item.name])
    } else if (item.type === 'text' && item.content !== undefined) {
      openApp('editor', { name: item.name, content: item.content })
    }
  }

  const isTrash = place === 'trash'

  return (
    <div className={`flex h-full ${t.bg} ${t.text}`}>
      {/* Sidebar */}
      <div className={`w-44 shrink-0 ${t.bgSidebar} flex flex-col py-2 border-r ${t.border}`}>
        <div className="flex-1 overflow-y-auto ubuntu-scroll">
          {SIDEBAR.map((s) => (
            <button
              key={s.id}
              onClick={() => navigateTo(s.id, [])}
              className={`w-full flex items-center gap-2.5 px-4 py-[7px] text-[13px] ${t.hover} ${
                place === s.id ? `${t.active} font-medium` : ''
              }`}
              style={place === s.id ? { boxShadow: `inset 3px 0 0 var(--ubuntu-accent)` } : undefined}
            >
              <s.icon size={16} className={t.textDim} />
              {s.label}
            </button>
          ))}
          <div className={`mx-3 my-2 h-px ${t.divider}`} />
          <button
            onClick={() => navigateTo('trash', [])}
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
          <Star size={12} />
          <span>82.4 GB free of 256 GB</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${t.border} ${t.bgToolbar}`}>
          <button
            onClick={goBack}
            disabled={stackIdx <= 0}
            className={`p-1.5 rounded ${t.hover} disabled:opacity-30`}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={goForward}
            disabled={stackIdx >= stack.length - 1}
            className={`p-1.5 rounded ${t.hover} disabled:opacity-30`}
          >
            <ArrowRight size={16} />
          </button>
          <div className={`flex items-center gap-0.5 text-[13px] px-2 py-1 rounded ${t.active} min-w-0 overflow-hidden`}>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-0.5 whitespace-nowrap">
                {i > 0 && <ChevronRight size={13} className={t.textDim} />}
                <button
                  className={`px-1 rounded ${t.hover} ${i === crumbs.length - 1 ? 'font-semibold' : ''}`}
                  onClick={() => navigateTo(place, path.slice(0, i - 0))}
                >
                  {c}
                </button>
              </span>
            ))}
          </div>
          <div className="flex-1" />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${t.border} ${t.input} text-[12px] w-44`}>
            <Search size={13} className="opacity-60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="bg-transparent outline-none w-full"
            />
          </div>
          <button
            onClick={() => setListView(!listView)}
            className={`p-1.5 rounded ${t.hover} ${listView ? t.active : ''}`}
          >
            <List size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto ubuntu-scroll p-3" onClick={() => setSelected(null)}>
          {isTrash ? (
            <div className={`h-full flex flex-col items-center justify-center gap-3 ${t.textDim}`}>
              <Trash2 size={64} strokeWidth={1} />
              <div className="text-lg font-medium">Trash is Empty</div>
            </div>
          ) : items.length === 0 ? (
            <div className={`h-full flex flex-col items-center justify-center gap-3 ${t.textDim}`}>
              <Folder size={64} strokeWidth={1} />
              <div className="text-lg font-medium">Folder is Empty</div>
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
                {items.map((item) => (
                  <tr
                    key={item.name}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(item.name)
                    }}
                    onDoubleClick={() => openItem(item)}
                    className={`cursor-default rounded ${
                      selected === item.name ? '' : t.hover
                    }`}
                    style={
                      selected === item.name
                        ? { background: 'var(--ubuntu-accent)', color: '#fff' }
                        : undefined
                    }
                  >
                    <td className="px-3 py-1.5 flex items-center gap-2.5">
                      {itemIcon(item, 18)}
                      {item.name}
                    </td>
                    <td className="px-3 py-1.5">{item.type === 'folder' ? `${item.children?.length ?? 0} items` : item.size}</td>
                    <td className="px-3 py-1.5">{item.modified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
              {items.map((item) => (
                <button
                  key={item.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(item.name)
                  }}
                  onDoubleClick={() => openItem(item)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg ${t.hover}`}
                  style={
                    selected === item.name
                      ? { background: 'var(--ubuntu-accent-soft)', boxShadow: `inset 0 0 0 1.5px var(--ubuntu-accent)` }
                      : undefined
                  }
                >
                  {itemIcon(item, 36)}
                  <span
                    className={`text-[12px] text-center leading-tight break-words w-full line-clamp-2 ${
                      selected === item.name ? 'font-medium' : ''
                    }`}
                  >
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div
          className={`px-3 py-1 text-[12px] ${t.textDim} border-t ${t.border} flex items-center gap-2`}
        >
          <Clock size={11} />
          <span>
            {isTrash ? '0 items' : `${items.length} item${items.length === 1 ? '' : 's'}`}
            {selected ? ` — "${selected}" selected` : ''}
          </span>
          <span className="ml-auto">{darkStyle ? 'Dark style' : 'Light style'}</span>
        </div>
      </div>
    </div>
  )
}
