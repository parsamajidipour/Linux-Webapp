import { useEffect, useRef, useState } from 'react'
import {
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  BatteryFull,
  BatteryCharging,
  Power,
  Lock,
  RotateCcw,
  Settings2,
  Bluetooth,
  Sun,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { getApp } from '../apps'

function useBattery() {
  const [bat, setBat] = useState<{ level: number; charging: boolean }>({ level: 100, charging: true })
  useEffect(() => {
    let battery: any = null
    const nav = navigator as any
    if (nav.getBattery) {
      nav.getBattery().then((b: any) => {
        battery = b
        const update = () => setBat({ level: Math.round(b.level * 100), charging: b.charging })
        update()
        b.addEventListener('levelchange', update)
        b.addEventListener('chargingchange', update)
      })
    }
    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', () => {})
      }
    }
  }, [])
  return bat
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Calendar({ now }: { now: Date }) {
  const [view, setView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isToday = (d: number) =>
    d === now.getDate() && month === now.getMonth() && year === now.getFullYear()

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          className="p-1 rounded-full hover:bg-white/10"
          onClick={() => setView(new Date(year, month - 1, 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13.5px] font-semibold">
          {MONTHS[month]} {year}
        </span>
        <button
          className="p-1 rounded-full hover:bg-white/10"
          onClick={() => setView(new Date(year, month + 1, 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-neutral-400 mb-1">
        {DAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[12.5px]">
        {Array.from({ length: firstDay }).map((_, i) => (
          <span key={'e' + i} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const today = isToday(d)
          return (
            <span
              key={d}
              className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full ${
                today ? 'text-white font-bold' : 'text-neutral-200 hover:bg-white/10'
              }`}
              style={today ? { background: 'var(--ubuntu-accent)' } : undefined}
            >
              {d}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function TopBar() {
  const ctx = useDesktop()
  const bat = useBattery()
  const [open, setOpen] = useState<'none' | 'clock' | 'system'>('none')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen('none')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen('none')
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const activeWin = ctx.windows.find((w) => w.id === ctx.activeWindowId)
  const activeAppName = activeWin ? getApp(activeWin.appId).name : null

  const fmtDay = ctx.now.toLocaleDateString('en-US', { weekday: 'short' })
  const fmtDate = ctx.now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const fmtTime = ctx.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  const slider = (val: number, set: (v: number) => void, icon: React.ReactNode) => (
    <div className="flex items-center gap-3 px-1">
      {icon}
      <input
        type="range"
        min={5}
        max={100}
        value={val}
        onChange={(e) => set(Number(e.target.value))}
        className="ubuntu-slider flex-1"
        style={{
          background: `linear-gradient(to right, var(--ubuntu-accent) ${val}%, rgba(255,255,255,0.18) ${val}%)`,
        }}
      />
    </div>
  )

  return (
    <div
      ref={ref}
      className="fixed top-0 inset-x-0 h-8 topbar-blur flex items-center px-3 text-white text-[13px] z-[600] select-none"
    >
      {/* Activities */}
      <button
        onClick={() => {
          ctx.setOverviewOpen(!ctx.overviewOpen)
          ctx.setAppGridOpen(false)
          setOpen('none')
        }}
        className={`px-2.5 py-0.5 rounded-md font-medium text-shadow-panel transition-colors ${
          ctx.overviewOpen ? 'bg-white/15' : 'hover:bg-white/10'
        }`}
      >
        Activities
      </button>

      {/* Focused app */}
      {activeAppName && (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md hover:bg-white/10 font-bold text-shadow-panel ml-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ubuntu-accent)' }} />
          {activeAppName}
        </div>
      )}

      <div className="flex-1" />

      {/* Clock */}
      <button
        onClick={() => setOpen(open === 'clock' ? 'none' : 'clock')}
        className={`absolute left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-md text-shadow-panel transition-colors ${
          open === 'clock' ? 'bg-white/15' : 'hover:bg-white/10'
        }`}
      >
        {fmtDay} {fmtDate}&nbsp;&nbsp;{fmtTime}
      </button>

      {/* Tray */}
      <button
        onClick={() => setOpen(open === 'system' ? 'none' : 'system')}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-md transition-colors ${
          open === 'system' ? 'bg-white/15' : 'hover:bg-white/10'
        }`}
      >
        {ctx.wifiOn ? <Wifi size={15} /> : <WifiOff size={15} className="opacity-60" />}
        {ctx.volume === 0 ? <VolumeX size={15} className="opacity-60" /> : <Volume2 size={15} />}
        <span className="flex items-center gap-1">
          {bat.charging ? <BatteryCharging size={17} /> : <BatteryFull size={17} />}
          <span className="text-[11.5px] opacity-90">{bat.level}%</span>
        </span>
        <Power size={14} className="opacity-90" />
      </button>

      {/* Clock popover */}
      {open === 'clock' && (
        <div className="absolute top-9 left-1/2 -translate-x-1/2 w-[300px] popover-glass rounded-xl p-4 text-white slide-up z-[700]">
          <div className="text-center mb-3">
            <div className="text-[13px] text-neutral-300">
              {ctx.now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="text-[34px] font-light leading-tight">{fmtTime}</div>
          </div>
          <Calendar now={ctx.now} />
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-[12px] font-semibold text-neutral-300 mb-1.5">Notifications</div>
            {ctx.notificationHistory.length === 0 ? (
              <div className="text-[12px] text-neutral-500 text-center py-2">No Notifications</div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {ctx.notificationHistory.map((n) => (
                  <div key={n.id} className="px-2.5 py-1.5 rounded-lg bg-white/5">
                    <div className="text-[12px] font-medium">{n.title}</div>
                    <div className="text-[11px] text-neutral-400 truncate">{n.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* System menu */}
      {open === 'system' && (
        <div className="absolute top-9 right-2 w-[300px] popover-glass rounded-xl p-3.5 text-white slide-up z-[700]">
          <div className="space-y-3">
            {slider(ctx.volume, ctx.setVolume, ctx.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />)}
            {slider(ctx.brightness, ctx.setBrightness, <Sun size={16} />)}
          </div>
          <div className="my-3 h-px bg-white/10" />
          <button
            onClick={() => ctx.setWifiOn(!ctx.wifiOn)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 text-[13px]"
          >
            {ctx.wifiOn ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="flex-1 text-left">{ctx.wifiOn ? 'KimiNet 5G' : 'Wi-Fi Off'}</span>
            <span className="text-[11px] text-neutral-400">{ctx.wifiOn ? 'Connected' : ''}</span>
          </button>
          <button
            onClick={() => ctx.setBluetoothOn(!ctx.bluetoothOn)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 text-[13px]"
          >
            <Bluetooth size={16} className={ctx.bluetoothOn ? '' : 'opacity-50'} />
            <span className="flex-1 text-left">Bluetooth</span>
            <span className="text-[11px] text-neutral-400">{ctx.bluetoothOn ? 'On' : 'Off'}</span>
          </button>
          <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/10 text-[13px]">
            {bat.charging ? <BatteryCharging size={16} /> : <BatteryFull size={16} />}
            <span className="flex-1 text-left">Battery</span>
            <span className="text-[11px] text-neutral-400">
              {bat.level}%{bat.charging ? ' · Charging' : ''}
            </span>
          </button>
          <div className="my-2 h-px bg-white/10" />
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => {
                ctx.openApp('settings')
                setOpen('none')
              }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg hover:bg-white/10 text-[11px]"
            >
              <Settings2 size={17} />
              Settings
            </button>
            <button
              onClick={() => ctx.setPower('lock')}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg hover:bg-white/10 text-[11px]"
            >
              <Lock size={17} />
              Lock
            </button>
            <div className="relative group">
              <button className="w-full flex flex-col items-center gap-1 py-2.5 rounded-lg hover:bg-white/10 text-[11px]">
                <Power size={17} />
                Power
              </button>
              <div className="absolute bottom-full right-0 mb-1 w-40 popover-glass rounded-lg p-1 hidden group-hover:block">
                <button
                  onClick={() => ctx.setPower('lock')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 text-[12px]"
                >
                  <Lock size={13} /> Suspend
                </button>
                <button
                  onClick={() => {
                    ctx.logout()
                    ctx.setPower('boot')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 text-[12px]"
                >
                  <RotateCcw size={13} /> Restart…
                </button>
                <button
                  onClick={() => {
                    ctx.logout()
                    ctx.setPower('off')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 text-[12px] text-red-400"
                >
                  <Power size={13} /> Power Off…
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
