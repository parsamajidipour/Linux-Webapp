import { useState } from 'react'
import {
  Download,
  Star,
  Gamepad2,
  Brush,
  Code2,
  Music4,
  Video,
  Globe,
  MessageCircle,
  Package,
  Check,
  Sparkles,
} from 'lucide-react'
import { useWinTheme } from '../winTheme'
import { useDesktop } from '../context/DesktopContext'

interface StoreApp {
  id: string
  name: string
  desc: string
  icon: React.ReactNode
  rating: number
  installs: string
  color: string
}

const CATALOG: StoreApp[] = [
  { id: 'gimp', name: 'GIMP', desc: 'Create art and edit images', icon: <Brush size={26} color="#fff" />, rating: 4.5, installs: '12M', color: '#5a4a3a' },
  { id: 'vscode', name: 'VS Code', desc: 'Code editing. Redefined.', icon: <Code2 size={26} color="#fff" />, rating: 4.8, installs: '40M', color: '#2563a8' },
  { id: 'spotify', name: 'Spotify', desc: 'Music for everyone', icon: <Music4 size={26} color="#fff" />, rating: 4.4, installs: '100M', color: '#1db954' },
  { id: 'vlc', name: 'VLC', desc: 'Plays everything, everywhere', icon: <Video size={26} color="#fff" />, rating: 4.7, installs: '80M', color: '#e86a10' },
  { id: 'firefox', name: 'Firefox', desc: 'Fast, private web browser', icon: <Globe size={26} color="#fff" />, rating: 4.6, installs: '60M', color: '#c2410c' },
  { id: 'telegram', name: 'Telegram', desc: 'Fast and secure messaging', icon: <MessageCircle size={26} color="#fff" />, rating: 4.3, installs: '90M', color: '#229ed9' },
  { id: 'supertux', name: 'SuperTux', desc: 'Classic 2D jump-and-run game', icon: <Gamepad2 size={26} color="#fff" />, rating: 4.2, installs: '5M', color: '#3b82c4' },
  { id: 'htop', name: 'htop', desc: 'Interactive process viewer', icon: <Package size={26} color="#fff" />, rating: 4.9, installs: '20M', color: '#2c2c28' },
]

export function AppCenterApp() {
  const t = useWinTheme()
  const { pushNotification } = useDesktop()
  const [installed, setInstalled] = useState<Record<string, boolean>>({})
  const [installing, setInstalling] = useState<Record<string, number>>({})

  const install = (app: StoreApp) => {
    if (installed[app.id] || installing[app.id] !== undefined) return
    let progress = 0
    setInstalling((s) => ({ ...s, [app.id]: 0 }))
    const timer = setInterval(() => {
      progress += Math.random() * 22 + 10
      if (progress >= 100) {
        clearInterval(timer)
        setInstalling((s) => {
          const n = { ...s }
          delete n[app.id]
          return n
        })
        setInstalled((s) => ({ ...s, [app.id]: true }))
        pushNotification({
          app: 'App Center',
          title: `${app.name} installed`,
          body: `${app.name} is ready to use.`,
        })
      } else {
        setInstalling((s) => ({ ...s, [app.id]: progress }))
      }
    }, 260)
  }

  return (
    <div className={`h-full overflow-y-auto ubuntu-scroll ${t.bg} ${t.text}`}>
      {/* Hero */}
      <div
        className="mx-5 mt-5 rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(120deg, #2c001e 0%, #77216f 55%, #E95420 130%)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest opacity-80">
          <Sparkles size={14} /> Editor's choice
        </div>
        <div className="text-[24px] font-bold mt-1">Apps built for Ubuntu</div>
        <div className="text-[13.5px] opacity-85 mt-1 max-w-md">
          Discover open-source software curated for your desktop — install with a single click.
        </div>
      </div>

      <div className="px-5 pt-5 pb-2 text-[16px] font-bold">Featured</div>
      <div className="px-5 pb-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {CATALOG.map((app) => {
          const inst = installed[app.id]
          const prog = installing[app.id]
          return (
            <div
              key={app.id}
              className={`rounded-xl border ${t.border} ${t.bgPanel} p-4 flex gap-3.5 items-center transition-shadow hover:shadow-lg`}
            >
              <div
                className="w-13 h-13 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  width: 52,
                  height: 52,
                  background: `linear-gradient(160deg, ${app.color}, ${app.color}cc)`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 3px 8px rgba(0,0,0,0.3)',
                }}
              >
                {app.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold truncate">{app.name}</div>
                <div className={`text-[12px] ${t.textDim} truncate`}>{app.desc}</div>
                <div className={`flex items-center gap-2 text-[11px] ${t.textDim} mt-1`}>
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star size={11} fill="currentColor" /> {app.rating}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Download size={11} /> {app.installs}
                  </span>
                </div>
              </div>
              {prog !== undefined ? (
                <div className="w-20">
                  <div className={`h-1.5 rounded-full overflow-hidden ${t.dark ? 'bg-white/10' : 'bg-black/10'}`}>
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{ width: `${prog}%`, background: 'var(--ubuntu-accent)' }}
                    />
                  </div>
                  <div className={`text-[10px] text-center mt-1 ${t.textDim}`}>{Math.floor(prog)}%</div>
                </div>
              ) : (
                <button
                  onClick={() => install(app)}
                  disabled={inst}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                    inst
                      ? t.dark
                        ? 'bg-white/10 text-green-400'
                        : 'bg-black/[0.06] text-green-600'
                      : 'text-white'
                  }`}
                  style={inst ? undefined : { background: 'var(--ubuntu-accent)' }}
                >
                  {inst ? (
                    <>
                      <Check size={13} /> Installed
                    </>
                  ) : (
                    'Install'
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
