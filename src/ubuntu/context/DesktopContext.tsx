import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useKernel } from '../../os/context/KernelContext'
import type { AccentDef, Notification, SnapState, WallpaperId, WindowState } from '../types'

export const ACCENTS: AccentDef[] = [
  { name: 'Orange', value: '#E95420', hover: '#d64516' },
  { name: 'Aubergine', value: '#77216F', hover: '#5e1a58' },
  { name: 'Green', value: '#3EB34F', hover: '#2f9c3f' },
  { name: 'Blue', value: '#1D7AED', hover: '#1366d4' },
  { name: 'Magenta', value: '#B34CB3', hover: '#9d3c9d' },
  { name: 'Red', value: '#E61A1A', hover: '#c91515' },
]

export type PowerState = 'boot' | 'lock' | 'desktop' | 'off'

interface DesktopCtx {
  // power / session
  power: PowerState
  setPower: (p: PowerState) => void
  /** Who's actually logged in — set by a successful LockScreen auth against the kernel's UserStore. */
  sessionUser: string | null
  /** Completes login as `username` and switches to the desktop. Locking again later re-prompts
   * this same user (no picker) until `logout()` is called. */
  unlock: (username: string) => void
  /** Ends the session — used by Restart/Power Off so the next boot shows the user picker again. */
  logout: () => void
  // windows
  windows: WindowState[]
  openApp: (appId: string, payload?: unknown) => void
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  toggleMaximize: (id: string) => void
  updateWindow: (id: string, patch: Partial<WindowState>) => void
  snapWindow: (id: string, snap: SnapState) => void
  activeWindowId: string | null
  // overlays
  overviewOpen: boolean
  setOverviewOpen: (v: boolean) => void
  appGridOpen: boolean
  setAppGridOpen: (v: boolean) => void
  // settings
  accent: AccentDef
  setAccent: (a: AccentDef) => void
  wallpaper: WallpaperId
  setWallpaper: (w: WallpaperId) => void
  darkStyle: boolean
  setDarkStyle: (v: boolean) => void
  brightness: number
  setBrightness: (v: number) => void
  volume: number
  setVolume: (v: number) => void
  wifiOn: boolean
  setWifiOn: (v: boolean) => void
  bluetoothOn: boolean
  setBluetoothOn: (v: boolean) => void
  dockAutoHide: boolean
  setDockAutoHide: (v: boolean) => void
  // notifications
  /** Currently-visible toasts — auto-removed a few seconds after appearing. */
  notifications: Notification[]
  /** Recent notifications that keep showing in the top-bar clock popover after their toast
   * has disappeared, same as real GNOME's notification shade. Capped, not persisted. */
  notificationHistory: Notification[]
  pushNotification: (n: Omit<Notification, 'id'>) => void
  dismissNotification: (id: number) => void
  // clock
  now: Date
}

const Ctx = createContext<DesktopCtx | null>(null)

let winSeq = 0
let notifSeq = 0

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const { kernel } = useKernel()
  const [power, setPower] = useState<PowerState>('boot')
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [windows, setWindows] = useState<WindowState[]>([])
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [appGridOpen, setAppGridOpen] = useState(false)

  // Desktop prefs mirror kernel.settings (SettingsStore, IndexedDB-backed) so they survive a
  // reload instead of living only in React state. `settings` is the one source of truth;
  // the individual fields below (accent, wallpaper, ...) are derived from it, and their
  // setters write back through kernel.settings.set() rather than setState directly.
  const [settings, setSettings] = useState(() => kernel.settings.get())
  useEffect(() => kernel.settings.subscribe(setSettings), [kernel])

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationHistory, setNotificationHistory] = useState<Notification[]>([])
  const [now, setNow] = useState(() => new Date())
  const zCounter = useRef(10)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const accent = useMemo(() => ACCENTS.find((a) => a.name === settings.accent) ?? ACCENTS[0], [settings.accent])
  const wallpaper = settings.wallpaper as WallpaperId
  const darkStyle = settings.theme === 'dark'
  const brightness = settings.brightness
  const volume = settings.volume
  const wifiOn = settings.wifiEnabled
  const bluetoothOn = settings.bluetoothEnabled
  const dockAutoHide = settings.dockAutoHide

  // Applies whenever the accent changes for *any* reason — a user picking a new color, or a
  // persisted accent loading in after boot — not just from inside setAccent.
  useEffect(() => {
    document.documentElement.style.setProperty('--ubuntu-accent', accent.value)
    document.documentElement.style.setProperty('--ubuntu-accent-hover', accent.hover)
    document.documentElement.style.setProperty('--ubuntu-accent-soft', `${accent.value}29`)
  }, [accent])

  const setAccent = useCallback((a: AccentDef) => kernel.settings.set({ accent: a.name }), [kernel])
  const setWallpaper = useCallback((w: WallpaperId) => kernel.settings.set({ wallpaper: w }), [kernel])
  const setDarkStyle = useCallback((v: boolean) => kernel.settings.set({ theme: v ? 'dark' : 'light' }), [kernel])
  const setBrightness = useCallback((v: number) => kernel.settings.set({ brightness: v }), [kernel])
  const setVolume = useCallback((v: number) => kernel.settings.set({ volume: v }), [kernel])
  const setWifiOn = useCallback((v: boolean) => kernel.settings.set({ wifiEnabled: v }), [kernel])
  const setBluetoothOn = useCallback((v: boolean) => kernel.settings.set({ bluetoothEnabled: v }), [kernel])
  const setDockAutoHide = useCallback((v: boolean) => kernel.settings.set({ dockAutoHide: v }), [kernel])

  const pushNotification = useCallback((n: Omit<Notification, 'id'>) => {
    const id = ++notifSeq
    setNotifications((prev) => [...prev, { ...n, id }])
    setNotificationHistory((prev) => [{ ...n, id }, ...prev].slice(0, 20))
    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((x) => x.id !== id))
    }, 4600)
  }, [])

  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id))
  }, [])

  // Real OS events (package installed, service started, ...) turn into toasts here — the
  // kernel has no idea a UI exists, it just emits; this is the only place that listens.
  useEffect(() => kernel.notifications.subscribe(pushNotification), [kernel, pushNotification])

  const focusWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: false, z: ++zCounter.current } : w)),
    )
  }, [])

  const openApp = useCallback((appId: string, payload?: unknown) => {
    setOverviewOpen(false)
    setAppGridOpen(false)
    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId)
      if (existing) {
        return prev.map((w) =>
          w.id === existing.id
            ? { ...w, minimized: false, z: ++zCounter.current, payload: payload ?? w.payload }
            : w,
        )
      }
      const n = prev.length
      return [
        ...prev,
        {
          id: `win-${++winSeq}`,
          appId,
          title: appId,
          x: 140 + (n % 5) * 44,
          y: 64 + (n % 5) * 36,
          w: 860,
          h: 560,
          z: ++zCounter.current,
          minimized: false,
          snap: null,
          prevBounds: null,
          closing: false,
          payload,
        },
      ]
    })
  }, [])

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, closing: true } : w)))
    window.setTimeout(() => {
      setWindows((prev) => prev.filter((w) => w.id !== id))
    }, 170)
  }, [])

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
  }, [])

  const updateWindow = useCallback((id: string, patch: Partial<WindowState>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }, [])

  const toggleMaximize = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w
        if (w.snap === 'full') {
          const b = w.prevBounds ?? { x: 120, y: 60, w: 860, h: 560 }
          return { ...w, snap: null, ...b, prevBounds: null }
        }
        return {
          ...w,
          snap: 'full',
          prevBounds: { x: w.x, y: w.y, w: w.w, h: w.h },
        }
      }),
    )
  }, [])

  const snapWindow = useCallback((id: string, snap: SnapState) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w
        if (snap === null) {
          const b = w.prevBounds ?? { x: 120, y: 60, w: 860, h: 560 }
          return { ...w, snap: null, ...b, prevBounds: null }
        }
        if (w.snap === snap) return w
        return {
          ...w,
          snap,
          prevBounds: w.prevBounds ?? { x: w.x, y: w.y, w: w.w, h: w.h },
        }
      }),
    )
  }, [])

  const unlock = useCallback((username: string) => {
    setSessionUser(username)
    setPower('desktop')
  }, [])

  const logout = useCallback(() => setSessionUser(null), [])

  const activeWindowId = useMemo(() => {
    const visible = windows.filter((w) => !w.minimized && !w.closing)
    if (!visible.length) return null
    return visible.reduce((a, b) => (a.z > b.z ? a : b)).id
  }, [windows])

  const value: DesktopCtx = {
    power,
    setPower,
    sessionUser,
    unlock,
    logout,
    windows,
    openApp,
    closeWindow,
    focusWindow,
    minimizeWindow,
    toggleMaximize,
    updateWindow,
    snapWindow,
    activeWindowId,
    overviewOpen,
    setOverviewOpen,
    appGridOpen,
    setAppGridOpen,
    accent,
    setAccent,
    wallpaper,
    setWallpaper,
    darkStyle,
    setDarkStyle,
    brightness,
    setBrightness,
    volume,
    setVolume,
    wifiOn,
    setWifiOn,
    bluetoothOn,
    setBluetoothOn,
    dockAutoHide,
    setDockAutoHide,
    notifications,
    notificationHistory,
    pushNotification,
    dismissNotification,
    now,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDesktop() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDesktop must be used within DesktopProvider')
  return ctx
}
