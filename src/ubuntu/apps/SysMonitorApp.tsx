import { useEffect, useMemo, useRef, useState } from 'react'
import { Skull } from 'lucide-react'
import { useWinTheme } from '../winTheme'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'

/** No real per-core sampling exists in this simulator — ProcessManager assigns a fixed
 * cpu/mem to each process at spawn time (same numbers `ps aux` shows). The headline totals
 * below are the real sum of those; only the historical wiggle is a cosmetic random walk that
 * eases toward that real anchor, so the graph never contradicts the numbers next to it. */
const CORE_COUNT = 4
const FAKE_TOTAL_MEM_MIB = 8192

function useAnchoredSeries(anchor: number, max: number, noise: number) {
  const [data, setData] = useState<number[]>(() => Array(60).fill(anchor))
  useEffect(() => {
    const t = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1]
        const pulled = last + (anchor - last) * 0.18
        const next = Math.max(1, Math.min(max, pulled + (Math.random() - 0.5) * noise))
        return [...prev.slice(1), next]
      })
    }, 1000)
    return () => clearInterval(t)
  }, [anchor, max, noise])
  return data
}

function Graph({ data, color, label, value, dark }: { data: number[]; color: string; label: string; value: string; dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    c.width = w * dpr
    c.height = h * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (h / 4) * i)
      ctx.lineTo(w, (h / 4) * i)
      ctx.stroke()
    }
    const step = w / (data.length - 1)
    ctx.beginPath()
    ctx.moveTo(0, h - (data[0] / 100) * h)
    data.forEach((v, i) => ctx.lineTo(i * step, h - (v / 100) * h))
    ctx.strokeStyle = color
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, color + '55')
    grad.addColorStop(1, color + '05')
    ctx.fillStyle = grad
    ctx.fill()
  }, [data, color, dark])

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-[13px] font-medium" style={{ color }}>{value}</span>
      </div>
      <canvas ref={ref} className="w-full h-24 rounded-md" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
    </div>
  )
}

export function SysMonitorApp() {
  const t = useWinTheme()
  const { kernel } = useKernel()
  const { sessionUser, pushNotification } = useDesktop()
  const [tab, setTab] = useState<'resources' | 'processes'>('resources')
  const [tick, setTick] = useState(0)
  const [sortBy, setSortBy] = useState<'cpu' | 'mem'>('cpu')

  // ProcessManager has no pub-sub (like Vfs) — poll it so kills / new background jobs
  // started from the Terminal (`cmd &`) show up here without a manual reopen.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1500)
    return () => clearInterval(t)
  }, [])

  // `tick` isn't read directly — it just forces this re-render to re-poll ProcessManager,
  // which (like Vfs) has no pub-sub of its own.
  void tick
  const procs = kernel.processes.list()
  const cpuTotal = Math.min(100, procs.reduce((s, p) => s + p.cpu, 0) / CORE_COUNT)
  const memTotalMib = procs.reduce((s, p) => s + p.mem, 0)
  const memPct = Math.min(100, (memTotalMib / FAKE_TOTAL_MEM_MIB) * 100)

  const cpu = useAnchoredSeries(cpuTotal, 100, 6)
  const mem = useAnchoredSeries(memPct, 100, 2)
  const net = useAnchoredSeries(20, 70, 18)

  const sorted = useMemo(
    () => [...procs].sort((a, b) => (sortBy === 'cpu' ? b.cpu - a.cpu : b.mem - a.mem)),
    [procs, sortBy],
  )

  const endProcess = (pid: number, user: string, command: string) => {
    const actingUser = sessionUser ?? 'root'
    if (user !== actingUser && actingUser !== 'root') {
      const allowed = user === 'root' ? 'root' : `${user} or root`
      pushNotification({ app: 'System Monitor', title: 'Operation not permitted', body: `Only ${allowed} can end "${command}".` })
      return
    }
    kernel.processes.kill(pid)
    setTick((v) => v + 1)
  }

  return (
    <div className={`flex flex-col h-full ${t.bg} ${t.text}`}>
      <div className={`flex gap-1 px-3 pt-2.5 border-b ${t.border} ${t.bgToolbar}`}>
        {(['resources', 'processes'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-[13px] rounded-t-md capitalize ${
              tab === k ? `${t.bgPanel} font-semibold border ${t.border} border-b-0 -mb-px` : t.textDim
            }`}
          >
            {k === 'resources' ? 'Resources' : 'Processes'}
          </button>
        ))}
      </div>

      {tab === 'resources' ? (
        <div className="flex-1 overflow-y-auto ubuntu-scroll p-4 flex flex-col gap-5">
          <Graph data={cpu} color="#E95420" label="CPU History" value={`${cpu[cpu.length - 1].toFixed(0)}%`} dark={t.dark} />
          <Graph
            data={mem}
            color="#8eef97"
            label="Memory History"
            value={`${(memTotalMib / 1024).toFixed(1)} / ${(FAKE_TOTAL_MEM_MIB / 1024).toFixed(1)} GiB`}
            dark={t.dark}
          />
          <Graph data={net} color="#729fcf" label="Network History" value={`${(net[net.length - 1] * 12).toFixed(0)} KiB/s`} dark={t.dark} />
          <div className={`text-[11.5px] ${t.textDim}`}>
            CPU/Memory totals are the real sum from {procs.length} tracked processes — same table `ps aux` reads. Network has no backing
            counter in this simulator and stays illustrative.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto ubuntu-scroll">
          <table className="w-full text-[12.5px]">
            <thead className={`sticky top-0 ${t.bgToolbar}`}>
              <tr className={`text-left ${t.textDim}`}>
                <th className="font-medium px-4 py-2">Process Name</th>
                <th className="font-medium px-4 py-2 w-20">User</th>
                <th className="font-medium px-4 py-2 w-16 text-right">PID</th>
                <th className="font-medium px-4 py-2 w-20 text-right cursor-pointer" onClick={() => setSortBy('cpu')}>
                  CPU %{sortBy === 'cpu' ? ' ▾' : ''}
                </th>
                <th className="font-medium px-4 py-2 w-24 text-right cursor-pointer" onClick={() => setSortBy('mem')}>
                  Memory{sortBy === 'mem' ? ' ▾' : ''}
                </th>
                <th className="font-medium px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.pid} className={t.hover}>
                  <td className="px-4 py-1.5 truncate max-w-0">{p.command}</td>
                  <td className="px-4 py-1.5">{p.user}</td>
                  <td className="px-4 py-1.5 text-right">{p.pid}</td>
                  <td className="px-4 py-1.5 text-right" style={{ color: p.cpu > 8 ? 'var(--ubuntu-accent)' : undefined }}>
                    {p.cpu.toFixed(1)}
                  </td>
                  <td className="px-4 py-1.5 text-right">{p.mem.toFixed(1)} MiB</td>
                  <td className="px-2 py-1.5 text-center">
                    {p.pid !== 1 && (
                      <button
                        onClick={() => endProcess(p.pid, p.user, p.command)}
                        title={`End ${p.command}`}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400"
                      >
                        <Skull size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
