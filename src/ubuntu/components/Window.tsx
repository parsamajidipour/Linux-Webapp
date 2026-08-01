import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Minus, Square, Copy } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { APP_COMPONENTS, getApp } from '../apps'
import type { WindowState } from '../types'

const TOPBAR_H = 32

interface Props {
  win: WindowState
}

export function Window({ win }: Props) {
  const ctx = useDesktop()
  const app = getApp(win.appId)
  const AppComp = APP_COMPONENTS[win.appId]
  const isActive = ctx.activeWindowId === win.id
  const rootRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const minW = app.minSize?.w ?? 320
  const minH = app.minSize?.h ?? 240

  /* ---------- geometry ---------- */
  const snapped = win.snap !== null
  const geo = (() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (win.snap === 'full') {
      return { x: 0, y: TOPBAR_H, w: vw, h: vh - TOPBAR_H }
    }
    if (win.snap === 'left') {
      return { x: 0, y: TOPBAR_H, w: vw / 2, h: vh - TOPBAR_H }
    }
    if (win.snap === 'right') {
      return { x: vw / 2, y: TOPBAR_H, w: vw / 2, h: vh - TOPBAR_H }
    }
    return { x: win.x, y: win.y, w: win.w, h: win.h }
  })()

  /* ---------- drag ---------- */
  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    ctx.focusWindow(win.id)
    const startX = e.clientX
    const startY = e.clientY
    const wasSnapped = win.snap
    const orig = { ...geo }
    let moved = false
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) moved = true
      if (!moved) return
      if (wasSnapped) {
        // restore to floating, keep cursor relative position
        const ratio = (ev.clientX - orig.x) / orig.w
        const newW = win.prevBounds?.w ?? 860
        const newH = win.prevBounds?.h ?? 560
        ctx.updateWindow(win.id, {
          snap: null,
          prevBounds: null,
          w: newW,
          h: newH,
          x: ev.clientX - newW * Math.min(Math.max(ratio, 0.1), 0.9),
          y: Math.max(ev.clientY - 14, TOPBAR_H),
        })
        return
      }
      ctx.updateWindow(win.id, {
        x: orig.x + dx,
        y: Math.max(orig.y + dy, TOPBAR_H),
      })
    }

    const onUp = (ev: PointerEvent) => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved) return
      // edge snapping
      const vw = window.innerWidth
      if (ev.clientY <= 6) {
        ctx.snapWindow(win.id, 'full')
      } else if (ev.clientX <= 6) {
        ctx.snapWindow(win.id, 'left')
      } else if (ev.clientX >= vw - 6) {
        ctx.snapWindow(win.id, 'right')
      } else {
        // clamp into view
        const cur = rootRef.current
        if (cur) {
          const r = cur.getBoundingClientRect()
          const patch: Partial<WindowState> = {}
          if (r.left > vw - 80) patch.x = vw - 120
          if (r.left < -r.width + 120) patch.x = -r.width + 160
          if (Object.keys(patch).length) ctx.updateWindow(win.id, patch)
        }
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ---------- resize ---------- */
  const startResize = (dir: string) => (e: React.PointerEvent) => {
    if (e.button !== 0 || snapped) return
    e.stopPropagation()
    ctx.focusWindow(win.id)
    const startX = e.clientX
    const startY = e.clientY
    const orig = { ...geo }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      let { x, y, w, h } = orig
      if (dir.includes('e')) w = Math.max(minW, orig.w + dx)
      if (dir.includes('s')) h = Math.max(minH, orig.h + dy)
      if (dir.includes('w')) {
        w = Math.max(minW, orig.w - dx)
        x = orig.x + (orig.w - w)
      }
      if (dir.includes('n')) {
        h = Math.max(minH, orig.h - dy)
        y = Math.max(TOPBAR_H, orig.y + (orig.h - h))
        if (y === TOPBAR_H) h = orig.y + orig.h - TOPBAR_H
      }
      ctx.updateWindow(win.id, { x, y, w, h })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleDoubleClick = useCallback(() => {
    ctx.toggleMaximize(win.id)
  }, [ctx, win.id])

  if (win.minimized) {
    return (
      <div
        className="fixed win-anim-minimize pointer-events-none"
        style={{ left: geo.x, top: geo.y, width: geo.w, height: geo.h, zIndex: win.z }}
      >
        <WindowChrome win={win} isActive={false} dark={ctx.darkStyle} title={app.name}>
          <div className="h-full" />
        </WindowChrome>
      </div>
    )
  }

  const resizeHandles: { dir: string; style: React.CSSProperties; cursor: string }[] = [
    { dir: 'n', style: { top: -4, left: 10, right: 10, height: 8 }, cursor: 'ns-resize' },
    { dir: 's', style: { bottom: -4, left: 10, right: 10, height: 8 }, cursor: 'ns-resize' },
    { dir: 'e', style: { right: -4, top: 10, bottom: 10, width: 8 }, cursor: 'ew-resize' },
    { dir: 'w', style: { left: -4, top: 10, bottom: 10, width: 8 }, cursor: 'ew-resize' },
    { dir: 'ne', style: { top: -5, right: -5, width: 14, height: 14 }, cursor: 'nesw-resize' },
    { dir: 'nw', style: { top: -5, left: -5, width: 14, height: 14 }, cursor: 'nwse-resize' },
    { dir: 'se', style: { bottom: -5, right: -5, width: 14, height: 14 }, cursor: 'nwse-resize' },
    { dir: 'sw', style: { bottom: -5, left: -5, width: 14, height: 14 }, cursor: 'nesw-resize' },
  ]

  return (
    <div
      ref={rootRef}
      className={`fixed ${win.closing ? 'win-anim-close' : mounted && !dragging ? '' : ''} ${
        mounted ? '' : 'win-anim-open'
      }`}
      style={{
        left: geo.x,
        top: geo.y,
        width: geo.w,
        height: geo.h,
        zIndex: win.z,
        transition: dragging ? 'none' : snapped ? 'all 0.18s cubic-bezier(0.3,0.9,0.3,1)' : 'none',
      }}
      onPointerDown={() => ctx.focusWindow(win.id)}
    >
      <WindowChrome
        win={win}
        isActive={isActive}
        dark={ctx.darkStyle}
        title={app.name}
        snapped={snapped}
        onTitlePointerDown={onTitlePointerDown}
        onTitleDoubleClick={handleDoubleClick}
        onClose={() => ctx.closeWindow(win.id)}
        onMinimize={() => ctx.minimizeWindow(win.id)}
        onMaximize={() => ctx.toggleMaximize(win.id)}
      >
        <AppComp payload={win.payload} />
      </WindowChrome>
      {!snapped &&
        resizeHandles.map((h) => (
          <div
            key={h.dir}
            onPointerDown={startResize(h.dir)}
            className="absolute"
            style={{ ...h.style, cursor: h.cursor, zIndex: 5 }}
          />
        ))}
    </div>
  )
}

/* ---------- chrome ---------- */

function WindowChrome({
  win,
  isActive,
  dark,
  title,
  snapped = false,
  onTitlePointerDown,
  onTitleDoubleClick,
  onClose,
  onMinimize,
  onMaximize,
  children,
}: {
  win: WindowState
  isActive: boolean
  dark: boolean
  title: string
  snapped?: boolean
  onTitlePointerDown?: (e: React.PointerEvent) => void
  onTitleDoubleClick?: () => void
  onClose?: () => void
  onMinimize?: () => void
  onMaximize?: () => void
  children: React.ReactNode
}) {
  const titleBg = dark
    ? isActive
      ? 'bg-[#2b2b2b]'
      : 'bg-[#242424]'
    : isActive
      ? 'bg-[#e4e2df]'
      : 'bg-[#efedeb]'
  const bodyBg = dark ? 'bg-[#242424]' : 'bg-[#f6f5f4]'
  const textCls = dark
    ? isActive
      ? 'text-neutral-200'
      : 'text-neutral-500'
    : isActive
      ? 'text-neutral-700'
      : 'text-neutral-400'

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden ${bodyBg} ${
        snapped ? 'rounded-none' : 'rounded-xl'
      } ${isActive ? 'window-shadow' : 'window-shadow-unfocused'}`}
      style={{ transition: 'box-shadow 0.15s ease' }}
    >
      {/* Title bar */}
      <div
        className={`h-10 shrink-0 flex items-center px-2.5 gap-2 select-none ${titleBg}`}
        onPointerDown={onTitlePointerDown}
        onDoubleClick={onTitleDoubleClick}
        style={{ cursor: snapped ? 'default' : 'grab', touchAction: 'none' }}
      >
        {/* Yaru window controls — left side like Ubuntu */}
        <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            className="group w-[18px] h-[18px] rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            style={{ background: isActive ? 'var(--ubuntu-accent)' : dark ? '#4a4a4a' : '#c9c6c3' }}
            title="Close"
          >
            <X size={12} strokeWidth={2.6} color={isActive ? '#fff' : dark ? '#999' : '#666'} className="opacity-0 group-hover:opacity-100" />
          </button>
          <button
            onClick={onMinimize}
            className="group w-[18px] h-[18px] rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            style={{ background: isActive ? (dark ? '#555' : '#c9c6c3') : dark ? '#4a4a4a' : '#d8d5d2' }}
            title="Minimize"
          >
            <Minus size={12} strokeWidth={2.6} color={dark ? '#bbb' : '#666'} className="opacity-0 group-hover:opacity-100" />
          </button>
          <button
            onClick={onMaximize}
            className="group w-[18px] h-[18px] rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            style={{ background: isActive ? (dark ? '#555' : '#c9c6c3') : dark ? '#4a4a4a' : '#d8d5d2' }}
            title={win.snap === 'full' ? 'Restore' : 'Maximize'}
          >
            {win.snap === 'full' ? (
              <Copy size={10} strokeWidth={2.6} color={dark ? '#bbb' : '#666'} className="opacity-0 group-hover:opacity-100" />
            ) : (
              <Square size={9} strokeWidth={2.6} color={dark ? '#bbb' : '#666'} className="opacity-0 group-hover:opacity-100" />
            )}
          </button>
        </div>
        <div className={`flex-1 text-center text-[13px] font-medium truncate ${textCls} pointer-events-none`}>
          {title}
        </div>
        <div className="w-[70px]" />
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0 relative">{children}</div>
    </div>
  )
}
