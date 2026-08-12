import { useState } from 'react'
import {
  Wifi,
  Bluetooth,
  Palette,
  Volume2,
  Info,
  Monitor,
  Check,
  Cpu,
  HardDrive,
  MemoryStick,
  MonitorSmartphone,
  Users as UsersIcon,
  Pencil,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useDesktop, ACCENTS } from '../context/DesktopContext'
import { useWinTheme } from '../winTheme'
import { useKernel } from '../../os/context/KernelContext'
import { UbuntuLogo } from '../icons'
import type { WallpaperId } from '../types'

const WALLPAPERS: { id: WallpaperId; name: string }[] = [
  { id: 'noble', name: 'Noble' },
  { id: 'aubergine', name: 'Aubergine' },
  { id: 'sunrise', name: 'Sunrise' },
  { id: 'ocean', name: 'Ocean' },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-11 h-6 rounded-full relative transition-colors duration-200 shrink-0"
      style={{ background: on ? 'var(--ubuntu-accent)' : 'rgba(128,128,128,0.4)' }}
    >
      <span
        className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  )
}

function Row({
  label,
  desc,
  children,
}: {
  label: string
  desc?: string
  children: React.ReactNode
}) {
  const t = useWinTheme()
  return (
    <div className={`flex items-center justify-between gap-6 px-5 py-4 border-b ${t.border}`}>
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{label}</div>
        {desc && <div className={`text-[12px] ${t.textDim} mt-0.5`}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useWinTheme()
  return (
    <div className="flex-1 overflow-y-auto ubuntu-scroll">
      <div className="max-w-2xl mx-auto py-6 px-4">
        <h2 className="text-[20px] font-bold mb-4 px-1">{title}</h2>
        <div className={`rounded-xl border ${t.border} ${t.bgPanel} overflow-hidden`}>{children}</div>
      </div>
    </div>
  )
}

/** Reads/writes the real `/etc/hostname` — the same file `hostname`/`uname -a` read in Terminal.
 * Only root can rename the host (matches the exact gate the `hostname` shell command enforces). */
function HostnameField() {
  const { kernel } = useKernel()
  const { sessionUser, pushNotification } = useDesktop()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const canEdit = sessionUser === 'root'

  const hostname = (() => {
    try {
      return kernel.vfs.readFile('/etc/hostname').trim()
    } catch {
      return 'ubuntu'
    }
  })()

  const commit = () => {
    const next = value.trim()
    setEditing(false)
    if (!next || next === hostname) return
    kernel.vfs.writeFile('/etc/hostname', `${next}\n`, { actor: kernel.users.toSubject(sessionUser ?? '') })
    void kernel.persist()
    pushNotification({ app: 'Settings', title: 'Hostname changed', body: `This device is now known as "${next}".` })
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="text-[19px] font-bold bg-transparent border-b border-[var(--ubuntu-accent)] outline-none w-56"
      />
    )
  }
  return (
    <button
      className="text-[19px] font-bold flex items-center gap-1.5 group"
      disabled={!canEdit}
      onClick={() => {
        setValue(hostname)
        setEditing(true)
      }}
      title={canEdit ? 'Click to rename this device' : 'Only root can change the hostname'}
    >
      {hostname}
      {canEdit && <Pencil size={13} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
    </button>
  )
}

function UsersPage() {
  const t = useWinTheme()
  const { kernel } = useKernel()
  const { sessionUser, pushNotification } = useDesktop()
  const [pwUser, setPwUser] = useState<string | null>(null)
  const [pw, setPw] = useState('')

  const users = kernel.users.list()

  const changePassword = () => {
    if (!pwUser || !pw.trim()) return
    kernel.users.setPassword(pwUser, pw.trim())
    void kernel.persist()
    pushNotification({ app: 'Settings', title: 'Password changed', body: `Password updated for ${pwUser}.` })
    setPwUser(null)
    setPw('')
  }

  return (
    <Page title="Users">
      {users.map((u) => {
        const admin = kernel.users.isSudoer(u.username)
        const isSelf = u.username === sessionUser
        return (
          <div key={u.username} className={`px-5 py-4 border-b ${t.border}`}>
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: u.passwordHash === null ? 'linear-gradient(160deg,#5c5c5c,#2c2c2c)' : 'linear-gradient(160deg,#8a6f95,#5e2750)' }}
              >
                <User size={22} color="#fff" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium flex items-center gap-2">
                  {u.fullName}
                  {isSelf && <span className={`text-[11px] ${t.textDim}`}>(this account)</span>}
                </div>
                <div className={`text-[12px] ${t.textDim} flex items-center gap-3`}>
                  <span>{u.username}</span>
                  <span className="flex items-center gap-1">
                    {admin ? <ShieldCheck size={12} style={{ color: 'var(--ubuntu-accent)' }} /> : null}
                    {admin ? 'Administrator' : 'Standard'}
                  </span>
                  <span>uid {u.uid}</span>
                </div>
              </div>
              {isSelf && u.passwordHash !== null && (
                <button
                  onClick={() => (setPwUser(u.username), setPw(''))}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${t.hover} border ${t.border}`}
                >
                  Change Password
                </button>
              )}
            </div>
            {pwUser === u.username && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="password"
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && changePassword()}
                  placeholder="New password"
                  className={`text-[13px] rounded-md border px-2.5 py-1.5 outline-none flex-1 ${t.border} ${t.input}`}
                />
                <button
                  onClick={changePassword}
                  className="px-3 py-1.5 rounded-md text-[12px] font-medium text-white"
                  style={{ background: 'var(--ubuntu-accent)' }}
                >
                  Save
                </button>
                <button onClick={() => setPwUser(null)} className={`px-3 py-1.5 rounded-md text-[12px] ${t.hover}`}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
    </Page>
  )
}

export function SettingsApp() {
  const t = useWinTheme()
  const ctx = useDesktop()
  const [page, setPage] = useState('appearance')
  const { pushNotification } = ctx

  const nav = [
    { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
    { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'sound', label: 'Sound', icon: Volume2 },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className={`flex h-full ${t.bg} ${t.text}`}>
      {/* Sidebar */}
      <div className={`w-52 shrink-0 ${t.bgSidebar} border-r ${t.border} py-3`}>
        <div className={`mx-3 mb-3 px-3 py-1.5 rounded-md text-[13px] ${t.textDim}`}>Settings</div>
        {nav.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={`w-full flex items-center gap-3 px-5 py-2 text-[13.5px] ${t.hover} ${
              page === n.id ? `${t.active} font-medium` : ''
            }`}
            style={page === n.id ? { boxShadow: `inset 3px 0 0 var(--ubuntu-accent)` } : undefined}
          >
            <n.icon size={16} className={t.textDim} />
            {n.label}
          </button>
        ))}
      </div>

      {/* Pages */}
      {page === 'wifi' && (
        <Page title="Wi-Fi">
          <Row label="Wi-Fi" desc={ctx.wifiOn ? 'Connected to "KimiNet 5G"' : 'Disabled'}>
            <Toggle on={ctx.wifiOn} onChange={ctx.setWifiOn} />
          </Row>
          {ctx.wifiOn && (
            <>
              <Row label="KimiNet 5G" desc="Connected · Signal excellent">
                <Check size={18} style={{ color: 'var(--ubuntu-accent)' }} />
              </Row>
              <Row label="CoffeeShop_Guest" desc="Secured with WPA2">
                <Wifi size={18} className={t.textDim} />
              </Row>
              <Row label="NeighborWiFi" desc="Secured with WPA2">
                <Wifi size={18} className={t.textDim} />
              </Row>
            </>
          )}
        </Page>
      )}

      {page === 'bluetooth' && (
        <Page title="Bluetooth">
          <Row label="Bluetooth" desc={ctx.bluetoothOn ? 'On — visible to nearby devices' : 'Off'}>
            <Toggle on={ctx.bluetoothOn} onChange={ctx.setBluetoothOn} />
          </Row>
          {ctx.bluetoothOn && (
            <>
              <Row label="MX Master 3S" desc="Connected · 87% battery">
                <Bluetooth size={18} style={{ color: 'var(--ubuntu-accent)' }} />
              </Row>
              <Row label="WH-1000XM5" desc="Not connected">
                <Bluetooth size={18} className={t.textDim} />
              </Row>
            </>
          )}
        </Page>
      )}

      {page === 'appearance' && (
        <Page title="Appearance">
          <Row label="Style" desc="Window colors for applications">
            <div className="flex gap-2">
              {(['Light', 'Dark'] as const).map((s) => {
                const active = s === 'Dark' ? ctx.darkStyle : !ctx.darkStyle
                return (
                  <button
                    key={s}
                    onClick={() => ctx.setDarkStyle(s === 'Dark')}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      active ? 'text-white' : t.dark ? 'bg-white/10 text-neutral-300' : 'bg-black/10 text-neutral-600'
                    }`}
                    style={active ? { background: 'var(--ubuntu-accent)' } : undefined}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="Accent color" desc="Used for selection and highlights">
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.name}
                  title={a.name}
                  onClick={() => ctx.setAccent(a)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: a.value }}
                >
                  {ctx.accent.name === a.name && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </Row>
          <div className={`px-5 py-4 border-b ${t.border}`}>
            <div className="text-[14px] font-medium mb-3">Background</div>
            <div className="grid grid-cols-4 gap-3">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => ctx.setWallpaper(w.id)}
                  className="group relative rounded-lg overflow-hidden aspect-video transition-transform hover:scale-[1.03]"
                  style={
                    ctx.wallpaper === w.id
                      ? { boxShadow: `0 0 0 2.5px var(--ubuntu-accent), 0 4px 14px rgba(0,0,0,0.4)` }
                      : { boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                  }
                >
                  <div className={`absolute inset-0 wp-${w.id}`} />
                  {ctx.wallpaper === w.id && (
                    <div
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ubuntu-accent)' }}
                    >
                      <Check size={12} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10.5px] py-0.5 text-center backdrop-blur-sm">
                    {w.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Row label="Auto-hide the Dock" desc="Dock reveals when pointer touches screen edge">
            <Toggle on={ctx.dockAutoHide} onChange={ctx.setDockAutoHide} />
          </Row>
        </Page>
      )}

      {page === 'sound' && (
        <Page title="Sound">
          <Row label="Output volume" desc="Speakers — Built-in Audio">
            <div className="flex items-center gap-3 w-56">
              <Volume2 size={16} className={t.textDim} />
              <input
                type="range"
                min={0}
                max={100}
                value={ctx.volume}
                onChange={(e) => ctx.setVolume(Number(e.target.value))}
                className="ubuntu-slider flex-1"
                style={{
                  background: `linear-gradient(to right, var(--ubuntu-accent) ${ctx.volume}%, rgba(128,128,128,0.35) ${ctx.volume}%)`,
                }}
              />
              <span className={`text-[12px] w-9 text-right ${t.textDim}`}>{ctx.volume}%</span>
            </div>
          </Row>
          <Row label="Alert sound" desc="Play a sound for notifications">
            <Toggle on={true} onChange={() => {}} />
          </Row>
        </Page>
      )}

      {page === 'users' && <UsersPage />}

      {page === 'about' && (
        <Page title="About">
          <div className={`px-5 py-6 flex items-center gap-5 border-b ${t.border}`}>
            <UbuntuLogo size={72} />
            <div>
              <HostnameField />
              <div className={`text-[13px] ${t.textDim}`}>Ubuntu 24.04.2 LTS “Noble Numbat”</div>
              <button
                onClick={() =>
                  pushNotification({
                    app: 'Software Updater',
                    title: 'Software is up to date',
                    body: 'Last checked just now',
                  })
                }
                className="mt-2 px-3 py-1 rounded-md text-[12px] font-medium text-white"
                style={{ background: 'var(--ubuntu-accent)' }}
              >
                Check for Updates
              </button>
            </div>
          </div>
          <Row label="Device model" desc="Virtual hardware">
            <span className="flex items-center gap-2 text-[13px]"><MonitorSmartphone size={16} className={t.textDim} /> Kimi WebBox Pro</span>
          </Row>
          <Row label="Processor">
            <span className="flex items-center gap-2 text-[13px]"><Cpu size={16} className={t.textDim} /> Web V8 JIT × 4</span>
          </Row>
          <Row label="Memory">
            <span className="flex items-center gap-2 text-[13px]"><MemoryStick size={16} className={t.textDim} /> 8.0 GiB</span>
          </Row>
          <Row label="Graphics">
            <span className="flex items-center gap-2 text-[13px]"><Monitor size={16} className={t.textDim} /> WebGL / Mesa</span>
          </Row>
          <Row label="Disk capacity">
            <span className="flex items-center gap-2 text-[13px]"><HardDrive size={16} className={t.textDim} /> 256 GB</span>
          </Row>
        </Page>
      )}
    </div>
  )
}
