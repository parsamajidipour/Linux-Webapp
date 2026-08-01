import { useEffect, useMemo, useRef, useState } from 'react'
import { useWinTheme } from '../winTheme'

const PROCS = [
  { name: 'gnome-shell', cpu: 4.2, mem: 412 },
  { name: 'Xorg', cpu: 2.8, mem: 268 },
  { name: 'firefox', cpu: 11.6, mem: 1420 },
  { name: 'code', cpu: 6.3, mem: 986 },
  { name: 'systemd', cpu: 0.1, mem: 18 },
  { name: 'pipewire', cpu: 1.2, mem: 44 },
  { name: 'mutter', cpu: 3.4, mem: 210 },
  { name: 'tracker-miner', cpu: 0.7, mem: 92 },
  { name: 'gnome-terminal', cpu: 0.4, mem: 76 },
  { name: 'nautilus', cpu: 0.9, mem: 134 },
]

function useSeries(max: number, drift: number, base: number) {
  const [data, setData] = useState<number[]>(() => Array(60).fill(base))
  useEffect(() => {
    const t = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1]
        let next = last + (Math.random() - 0.5) * drift
        next = Math.max(2, Math.min(max, next))
        return [...prev.slice(1), next]
      })
    }, 1000)
    return () => clearInterval(t)
  }, [max, drift])
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
    // grid
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (h / 4) * i)
      ctx.lineTo(w, (h / 4) * i)
      ctx.stroke()
    }
    // fill
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
  const cpu = useSeries(96, 26, 32)
  const mem = useSeries(88, 6, 54)
  const net = useSeries(70, 30, 20)
  const [tab, setTab] = useState<'resources' | 'processes'>('resources')

  const procs = useMemo(
    () =>
      PROCS.map((p) => ({ ...p, cpu: +(p.cpu * (0.6 + Math.random())).toFixed(1) })).sort(
        (a, b) => b.cpu - a.cpu,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cpu[cpu.length - 1]],
  )

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
          <Graph data={mem} color="#8eef97" label="Memory and Swap History" value={`${((mem[mem.length - 1] / 100) * 8).toFixed(1)} / 8.0 GiB`} dark={t.dark} />
          <Graph data={net} color="#729fcf" label="Network History" value={`${(net[net.length - 1] * 12).toFixed(0)} KiB/s`} dark={t.dark} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto ubuntu-scroll">
          <table className="w-full text-[12.5px]">
            <thead className={`sticky top-0 ${t.bgToolbar}`}>
              <tr className={`text-left ${t.textDim}`}>
                <th className="font-medium px-4 py-2">Process Name</th>
                <th className="font-medium px-4 py-2 w-20 text-right">CPU %</th>
                <th className="font-medium px-4 py-2 w-28 text-right">Memory</th>
              </tr>
            </thead>
            <tbody>
              {procs.map((p) => (
                <tr key={p.name} className={t.hover}>
                  <td className="px-4 py-1.5">{p.name}</td>
                  <td className="px-4 py-1.5 text-right" style={{ color: p.cpu > 8 ? 'var(--ubuntu-accent)' : undefined }}>
                    {p.cpu.toFixed(1)}
                  </td>
                  <td className="px-4 py-1.5 text-right">{p.mem} MiB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
