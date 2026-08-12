import { useEffect, useState } from 'react'
import { Info, MonitorCog, Image as ImageIcon, X } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'
import { TopBar } from './TopBar'
import { Dock } from './Dock'
import { Window } from './Window'
import { ActivitiesOverview } from './ActivitiesOverview'
import { AppGrid } from './AppGrid'
import { AltTabSwitcher } from './AltTabSwitcher'
import { HomeIcon, TrashIcon, UbuntuLogo } from '../icons'

function WallpaperDecor({ id }: { id: string }) {
  // flowing translucent curves over the gradient, different hue per wallpaper
  const strokes: Record<string, string[]> = {
    noble: ['rgba(255,160,110,0.20)', 'rgba(255,255,255,0.08)', 'rgba(233,84,32,0.16)'],
    aubergine: ['rgba(180,76,179,0.18)', 'rgba(255,255,255,0.07)', 'rgba(119,33,111,0.22)'],
    sunrise: ['rgba(255,200,120,0.22)', 'rgba(255,255,255,0.08)', 'rgba(233,84,32,0.18)'],
    ocean: ['rgba(120,210,255,0.18)', 'rgba(255,255,255,0.07)', 'rgba(46,194,126,0.14)'],
  }
  const c = strokes[id] ?? strokes.noble
  return (
    <svg className="wallpaper-decor" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <path d="M-100,700 C300,520 500,860 900,640 S1300,380 1560,520" fill="none" stroke={c[0]} strokeWidth="90" strokeLinecap="round" />
      <path d="M-100,300 C250,180 620,420 940,260 S1350,60 1560,180" fill="none" stroke={c[1]} strokeWidth="60" strokeLinecap="round" />
      <path d="M-100,860 C350,760 700,940 1100,820 S1420,660 1560,760" fill="none" stroke={c[2]} strokeWidth="120" strokeLinecap="round" />
      <circle cx="1180" cy="240" r="150" fill={c[1]} />
      <circle cx="260" cy="620" r="190" fill={c[2]} />
    </svg>
  )
}

function DesktopIcon({
  label,
  icon,
  onOpen,
  defaultPos,
}: {
  label: string
  icon: React.ReactNode
  onOpen: () => void
  defaultPos: { x: number; y: number }
}) {
  const [pos, setPos] = useState(defaultPos)
  const [selected, setSelected] = useState(false)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelected(true)
    const sx = e.clientX
    const sy = e.clientY
    const orig = { ...pos }
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true
      if (moved) setPos({ x: Math.max(6, orig.x + dx), y: Math.max(40, orig.y + dy) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <button
      className="absolute flex flex-col items-center gap-1 w-20 p-1.5 rounded-lg"
      style={{
        left: pos.x,
        top: pos.y,
        background: selected ? 'rgba(255,255,255,0.16)' : 'transparent',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onOpen}
      onBlur={() => setSelected(false)}
    >
      {icon}
      <span className="text-white text-[11.5px] text-shadow-panel leading-tight text-center">{label}</span>
    </button>
  )
}

function ContextMenu() {
  const ctx = useDesktop()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-desktop-area]')) {
        e.preventDefault()
        setMenu({ x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 220) })
      }
    }
    const close = () => setMenu(null)
    window.addEventListener('contextmenu', handler)
    window.addEventListener('pointerdown', close)
    return () => {
      window.removeEventListener('contextmenu', handler)
      window.removeEventListener('pointerdown', close)
    }
  }, [])

  if (!menu) return null

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
  ) => (
    <button
      onClick={() => {
        onClick()
        setMenu(null)
      }}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg hover:bg-white/10 text-[13px] text-white"
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div
      className="fixed z-[750] w-56 popover-glass rounded-xl p-1.5 slide-up"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {item(<ImageIcon size={15} />, 'Change Background…', () => ctx.openApp('settings'))}
      {item(<MonitorCog size={15} />, 'Display Settings', () => ctx.openApp('settings'))}
      <div className="my-1 h-px bg-white/10" />
      {item(<Info size={15} />, 'About This Computer', () => ctx.openApp('settings'))}
    </div>
  )
}

function Notifications() {
  const ctx = useDesktop()
  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[900] flex flex-col items-center gap-2 pointer-events-none">
      {ctx.notifications.map((n) => (
        <div
          key={n.id}
          className="notif-in pointer-events-auto w-[340px] popover-glass rounded-xl px-4 py-3 text-white flex items-start gap-3"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'var(--ubuntu-accent)' }}
          >
            <UbuntuLogo size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">{n.title}</div>
            <div className="text-[12px] text-neutral-300 truncate">{n.body}</div>
            <div className="text-[10.5px] text-neutral-500 mt-0.5">{n.app}</div>
          </div>
          <button
            onClick={() => ctx.dismissNotification(n.id)}
            className="p-1 rounded-full hover:bg-white/10 text-neutral-400"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Desktop() {
  const ctx = useDesktop()
  const { kernel } = useKernel()
  const home = kernel.users.findByName(ctx.sessionUser ?? '')?.home ?? '/root'

  // global escape closes overlays; Super opens Activities; Ctrl+Alt+Left/Right switches
  // workspace — all real GNOME defaults.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ctx.setOverviewOpen(false)
        ctx.setAppGridOpen(false)
      } else if (e.key === 'Meta' || e.key === 'OS') {
        e.preventDefault()
        ctx.setOverviewOpen(!ctx.overviewOpen)
      } else if (e.ctrlKey && e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        ctx.setCurrentWorkspace(Math.min(ctx.workspaceCount, ctx.currentWorkspace + 1))
      } else if (e.ctrlKey && e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        ctx.setCurrentWorkspace(Math.max(1, ctx.currentWorkspace - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.overviewOpen, ctx.currentWorkspace, ctx.workspaceCount])

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* wallpaper */}
      <div className={`wallpaper wp-${ctx.wallpaper}`} />
      <WallpaperDecor id={ctx.wallpaper} />

      {/* desktop area (icons + context menu target) */}
      <div
        data-desktop-area
        className="absolute"
        style={{ left: 60, top: 32, right: 0, bottom: 0 }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).hasAttribute('data-desktop-area')) {
            // double click empty desktop: nothing
          }
        }}
      >
        <DesktopIcon
          label="Home"
          icon={<HomeIcon size={44} />}
          defaultPos={{ x: 22, y: 24 }}
          onOpen={() => ctx.openApp('files', { path: home })}
        />
        <DesktopIcon
          label="Trash"
          icon={<TrashIcon size={44} />}
          defaultPos={{ x: 22, y: 120 }}
          onOpen={() => ctx.openApp('files', { path: `${home}/.local/share/Trash/files` })}
        />
      </div>

      {/* windows — only this workspace's, like real GNOME workspaces */}
      {ctx.windows
        .filter((w) => w.workspace === ctx.currentWorkspace)
        .map((w) => (
          <Window key={w.id} win={w} />
        ))}

      {/* shell */}
      <Dock />
      <TopBar />
      <ActivitiesOverview />
      <AppGrid />
      <AltTabSwitcher />
      <ContextMenu />
      <Notifications />

      {/* brightness */}
      <div className="brightness-overlay" style={{ opacity: (100 - ctx.brightness) / 100 * 0.85 }} />
    </div>
  )
}
