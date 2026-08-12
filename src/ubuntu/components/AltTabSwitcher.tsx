import { useEffect, useRef, useState } from 'react'
import { useDesktop } from '../context/DesktopContext'
import { getApp } from '../apps'

/** Alt+Tab window switcher. Shows every open window across all workspaces — same default as
 * real GNOME Shell (it doesn't scope Alt+Tab to the current workspace unless configured to). */
export function AltTabSwitcher() {
  const ctx = useDesktop()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const orderRef = useRef<string[]>([])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !e.altKey) return
      e.preventDefault()
      if (!open) {
        // Most-recently-focused first, so a bare Alt+Tab jumps straight to "the other window".
        const order = [...ctx.windows]
          .filter((w) => !w.closing)
          .sort((a, b) => b.z - a.z)
          .map((w) => w.id)
        if (order.length < 2) return
        orderRef.current = order
        setOpen(true)
        setIndex(1)
        return
      }
      setIndex((i) => {
        const n = orderRef.current.length
        return (i + (e.shiftKey ? -1 : 1) + n) % n
      })
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || !open) return
      const id = orderRef.current[index]
      const win = ctx.windows.find((w) => w.id === id)
      if (win) {
        ctx.setCurrentWorkspace(win.workspace)
        ctx.focusWindow(win.id)
      }
      setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, ctx.windows])

  if (!open) return null

  const selectedWin = ctx.windows.find((w) => w.id === orderRef.current[index])
  const selectedApp = selectedWin ? getApp(selectedWin.appId) : null

  return (
    <div className="fixed inset-0 z-[1050] flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="flex items-end gap-3 px-6 py-5 rounded-2xl popover-glass">
        {orderRef.current.map((id, i) => {
          const win = ctx.windows.find((w) => w.id === id)
          if (!win) return null
          const app = getApp(win.appId)
          const selected = i === index
          return (
            <div
              key={id}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all"
              style={{
                background: selected ? 'rgba(255,255,255,0.16)' : 'transparent',
                transform: selected ? 'scale(1.08)' : 'scale(1)',
                opacity: win.minimized ? 0.55 : 1,
              }}
            >
              <div className="scale-[1.3]">{app.icon}</div>
            </div>
          )
        })}
      </div>
      {selectedApp && <div className="mt-4 text-white text-[14px] font-medium text-shadow-panel">{selectedApp.name}</div>}
    </div>
  )
}
