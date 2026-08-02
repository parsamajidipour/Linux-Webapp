import { useEffect, useRef, useState } from 'react'
import { useDesktop } from '../context/DesktopContext'
import { APPS, getApp } from '../apps'
import { ShowAppsIcon } from '../icons'

export function Dock() {
  const ctx = useDesktop()
  const [hovered, setHovered] = useState<string | null>(null)
  const [launching, setLaunching] = useState<string | null>(null)
  const [peeking, setPeeking] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const hideTimer = useRef<number | null>(null)

  const runningIds = [...new Set(ctx.windows.map((w) => w.appId))]
  // Pin order is the real, persisted source of truth (`ctx.pinnedApps`, backed by SettingsStore)
  // — not a hardcoded flag on APPS — so drag-reordering and pin/unpin actually stick.
  const pinned = ctx.pinnedApps.map((id) => APPS.find((a) => a.id === id)).filter((a) => a !== undefined)
  const unpinnedRunning = APPS.filter((a) => !ctx.pinnedApps.includes(a.id) && runningIds.includes(a.id))

  const hidden = ctx.dockAutoHide && !peeking && !ctx.overviewOpen && !ctx.appGridOpen

  useEffect(() => {
    if (!ctx.dockAutoHide) return
    const onMove = (e: PointerEvent) => {
      if (e.clientX <= 2) {
        if (hideTimer.current) window.clearTimeout(hideTimer.current)
        setPeeking(true)
      } else if (e.clientX > 72) {
        hideTimer.current = window.setTimeout(() => setPeeking(false), 350)
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [ctx.dockAutoHide])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const clickApp = (id: string) => {
    const win = ctx.windows.find((w) => w.appId === id)
    if (win) {
      if (win.minimized || ctx.activeWindowId !== win.id) {
        ctx.focusWindow(win.id)
      } else {
        ctx.minimizeWindow(win.id)
      }
    } else {
      ctx.openApp(id)
      setLaunching(id)
      setTimeout(() => setLaunching(null), 650)
    }
  }

  const onDragOver = (overId: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragId || dragId === overId) return
    const order = [...ctx.pinnedApps]
    const from = order.indexOf(dragId)
    const to = order.indexOf(overId)
    if (from === -1 || to === -1) return
    order.splice(from, 1)
    order.splice(to, 0, dragId)
    ctx.reorderPinned(order)
  }

  const renderIcon = (
    id: string,
    name: string,
    icon: React.ReactNode,
    isShowApps = false,
    extra: React.HTMLAttributes<HTMLDivElement> = {},
  ) => {
    const running = runningIds.includes(id)
    const active = ctx.windows.some((w) => w.appId === id && w.id === ctx.activeWindowId)
    return (
      <div key={id} className="relative flex items-center" {...extra}>
        {/* running indicator */}
        {!isShowApps && (
          <div
            className="absolute -left-[9px] w-[4px] rounded-full transition-all duration-200"
            style={{
              height: running ? (active ? 26 : 10) : 0,
              background: 'var(--ubuntu-accent)',
              opacity: running ? 1 : 0,
            }}
          />
        )}
        <button
          onClick={() => (isShowApps ? (ctx.setAppGridOpen(!ctx.appGridOpen), ctx.setOverviewOpen(false)) : clickApp(id))}
          onContextMenu={
            isShowApps
              ? undefined
              : (e) => {
                  e.preventDefault()
                  setMenu({ id, x: e.clientX, y: e.clientY })
                }
          }
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
          className={`dock-icon relative w-11 h-11 rounded-[13px] flex items-center justify-center ${
            active ? 'bg-white/[0.16]' : isShowApps && ctx.appGridOpen ? 'bg-white/[0.16]' : 'hover:bg-white/10'
          } ${launching === id ? 'dock-launch' : ''}`}
        >
          {icon}
        </button>
        {hovered === id && (
          <div className="dock-tip absolute left-[54px] px-3 py-1.5 rounded-lg popover-glass text-white text-[12.5px] whitespace-nowrap z-[560] pointer-events-none">
            {name}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {ctx.dockAutoHide && (
        <div className="fixed left-0 top-8 bottom-0 w-1.5 z-[549]" onMouseEnter={() => setPeeking(true)} />
      )}
      <div
        className="fixed left-0 top-8 bottom-0 w-[60px] dock-blur z-[550] flex flex-col items-center py-2 gap-1"
        style={{
          transform: hidden ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.25s cubic-bezier(0.3,0.9,0.3,1)',
        }}
        onMouseEnter={() => setPeeking(true)}
        onMouseLeave={() => ctx.dockAutoHide && setPeeking(false)}
      >
        <div className="flex-1 flex flex-col items-center gap-1 overflow-y-auto ubuntu-scroll w-full py-0.5" style={{ scrollbarWidth: 'none' }}>
          {pinned.map((a) =>
            renderIcon(a.id, a.name, a.icon, false, {
              draggable: true,
              onDragStart: () => setDragId(a.id),
              onDragOver: onDragOver(a.id),
              onDragEnd: () => setDragId(null),
              style: { opacity: dragId === a.id ? 0.35 : 1 },
            }),
          )}
          {unpinnedRunning.length > 0 && <div className="w-8 h-px bg-white/20 my-1" />}
          {unpinnedRunning.map((a) => renderIcon(a.id, a.name, a.icon))}
        </div>
        <div className="pt-1">{renderIcon('show-apps', 'Show Applications', <ShowAppsIcon size={40} />, true)}</div>
      </div>

      {menu && (
        <div
          className="fixed z-[700] popover-glass rounded-lg p-1 w-52 text-white text-[13px] slide-up"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              ctx.togglePinned(menu.id)
              setMenu(null)
            }}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10"
          >
            {ctx.pinnedApps.includes(menu.id) ? 'Unpin from Dock' : 'Pin to Dock'}
          </button>
          {ctx.windows.some((w) => w.appId === menu.id) && (
            <button
              onClick={() => {
                const win = ctx.windows.find((w) => w.appId === menu.id)
                if (win) ctx.closeWindow(win.id)
                setMenu(null)
              }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10"
            >
              Quit {getApp(menu.id).name}
            </button>
          )}
        </div>
      )}
    </>
  )
}
