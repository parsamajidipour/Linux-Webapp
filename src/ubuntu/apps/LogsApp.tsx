import { useEffect, useMemo, useState } from 'react'
import { Search, RotateCw, ScrollText } from 'lucide-react'
import { useWinTheme } from '../winTheme'
import { useKernel } from '../../os/context/KernelContext'

interface LogLine {
  timestamp: string
  host: string
  message: string
  unit: string | null
}

/** `/var/log/syslog` lines look like `<ISO> ubuntu <unit>[pid]: <message>` (ServiceManager.log()). */
function parseLine(raw: string): LogLine | null {
  const m = /^(\S+) (\S+) (.*)$/.exec(raw)
  if (!m) return null
  const [, timestamp, host, rest] = m
  const unitMatch = /^([\w.-]+)(?:\[\d+\])?:/.exec(rest)
  return { timestamp, host, message: rest, unit: unitMatch ? unitMatch[1] : null }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function LogsApp() {
  const t = useWinTheme()
  const { kernel } = useKernel()
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const readSyslog = () => {
    try {
      setRaw(kernel.vfs.readFile('/var/log/syslog'))
    } catch {
      setRaw('')
    }
  }

  useEffect(() => {
    readSyslog()
    if (!autoRefresh) return
    const t = setInterval(readSyslog, 1500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, kernel])

  const lines = useMemo(
    () =>
      raw
        .split('\n')
        .filter((l) => l.trim())
        .map(parseLine)
        .filter((l): l is LogLine => l !== null),
    [raw],
  )

  const units = useMemo(() => {
    const set = new Set(lines.map((l) => l.unit).filter((u): u is string => u !== null))
    return ['all', ...[...set].sort()]
  }, [lines])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return lines.filter((l) => (unitFilter === 'all' || l.unit === unitFilter) && (!q || l.message.toLowerCase().includes(q)))
  }, [lines, query, unitFilter])

  const services = kernel.services.list()

  return (
    <div className={`flex flex-col h-full ${t.bg} ${t.text}`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${t.border} ${t.bgToolbar}`}>
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className={`text-[12.5px] rounded-md border px-2 py-1.5 outline-none ${t.border} ${t.input}`}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u === 'all' ? 'All units' : u}
            </option>
          ))}
        </select>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${t.border} ${t.input} text-[12.5px] w-56`}>
          <Search size={13} className="opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter messages"
            className="bg-transparent outline-none w-full"
          />
        </div>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] ${t.hover} ${autoRefresh ? t.active : ''}`}
          title={autoRefresh ? 'Live tail on — click to pause' : 'Paused — click to resume live tail'}
        >
          <RotateCw size={13} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '2.5s' }} />
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
        <div className="flex-1" />
        <span className={`text-[12px] ${t.textDim}`}>
          {filtered.length} of {lines.length} lines · {services.filter((s) => s.status === 'active').length} active units
        </span>
      </div>

      <div className="flex-1 overflow-y-auto ubuntu-scroll p-3 terminal-font text-[12.5px] leading-relaxed">
        {filtered.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center gap-3 ${t.textDim}`}>
            <ScrollText size={56} strokeWidth={1} />
            <div className="text-[14px] font-medium">No log entries</div>
            <div className="text-[12px]">
              Try <code>systemctl start &lt;service&gt;</code> or <code>sudo apt install</code> in Terminal — real events land here.
            </div>
          </div>
        ) : (
          filtered.map((l, i) => (
            <div key={i} className="flex gap-3 py-0.5 hover:bg-white/5 px-1 rounded">
              <span className={`shrink-0 ${t.textDim}`}>{formatTime(l.timestamp)}</span>
              {l.unit && (
                <span className="shrink-0" style={{ color: 'var(--ubuntu-accent)' }}>
                  {l.unit}
                </span>
              )}
              <span className="break-all">{l.message.replace(/^[\w.-]+(?:\[\d+\])?:\s*/, '')}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
