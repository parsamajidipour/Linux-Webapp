import { useEffect, useState } from 'react'
import { Power } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'
import { UbuntuLogo } from '../icons'

/** Real boot log lines — one `[  OK  ] Started ...` per service that's actually active in
 * ServiceManager (phase 0), not a hand-written fake transcript. */
function useBootLogLines(recoveryMode: boolean): string[] {
  const { kernel } = useKernel()
  const active = kernel.services.list().filter((s) => s.status === 'active')
  const lines = [
    '[    0.000000] Linux version 6.11.0-generic (buildd@ubuntu) #24-Ubuntu SMP PREEMPT_DYNAMIC',
    '[    0.421337] systemd[1]: System initialization...',
    ...active.map((s) => `[  OK  ] Started ${s.description}.`),
  ]
  if (recoveryMode) lines.push('[  OK  ] Reached target Recovery Mode.', 'Giving root access — press Ctrl+D to continue normal boot.')
  return lines
}

export function BootScreen() {
  const ctx = useDesktop()
  const [fading, setFading] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const { power, setPower, recoveryMode } = ctx
  const logLines = useBootLogLines(recoveryMode)

  useEffect(() => {
    if (power !== 'boot') return
    setFading(false)
    setShowLog(recoveryMode) // real recovery mode is always text-only, never the pretty splash

    const duration = recoveryMode ? 3400 : 2600
    const t1 = setTimeout(() => setFading(true), duration - 500)
    const t2 = setTimeout(() => {
      if (recoveryMode) {
        ctx.unlock('root') // real recovery mode drops you straight into a root shell, no login
        ctx.openApp('terminal')
        ctx.setRecoveryMode(false)
      } else {
        setPower('lock')
      }
    }, duration)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // ctx methods (unlock/openApp/setRecoveryMode) are stable across renders; only
    // `power`/`recoveryMode` changing should actually restart this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [power, recoveryMode, setPower])

  useEffect(() => {
    if (power !== 'boot' || recoveryMode) return // recovery mode's log can't be toggled off
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLog((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [power, recoveryMode])

  if (ctx.power !== 'boot') return null

  return (
    <div
      className={`fixed inset-0 z-[1100] flex flex-col items-center justify-center ${fading ? 'boot-fade' : ''}`}
      style={{ background: showLog ? '#0a0a0a' : '#2c001e' }}
    >
      {showLog ? (
        <div className="w-full max-w-2xl px-6 font-mono text-[12px] leading-relaxed text-neutral-300">
          {logLines.map((line, i) => (
            <div key={i} className="fade-in">
              {line}
            </div>
          ))}
        </div>
      ) : (
        <>
          <UbuntuLogo size={110} className="fade-in" />
          <div className="mt-10 spinner-ubuntu">
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
              <path d="M17 3 a14 14 0 0 1 12.1 7" fill="none" stroke="#E95420" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
        </>
      )}
      <div className="absolute bottom-12 text-neutral-400 text-[13px] tracking-wide">
        Ubuntu 24.04 LTS{recoveryMode ? ' (recovery mode)' : ''}
      </div>
      {!recoveryMode && (
        <div className="absolute bottom-4 text-neutral-600 text-[11px] tracking-wide">
          Press Esc to {showLog ? 'hide' : 'show'} boot log
        </div>
      )}
    </div>
  )
}

export function PowerOffScreen() {
  const ctx = useDesktop()
  const [advanced, setAdvanced] = useState(false)
  if (ctx.power !== 'off') return null

  const boot = (recovery: boolean) => {
    ctx.setRecoveryMode(recovery)
    ctx.setPower('boot')
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-black flex flex-col items-center justify-center fade-in">
      <button onClick={() => boot(false)} className="group flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full border border-neutral-800 flex items-center justify-center transition-all group-hover:border-neutral-600 group-hover:shadow-[0_0_40px_rgba(233,84,32,0.25)]">
          <Power size={30} className="text-neutral-700 transition-colors group-hover:text-[#E95420]" />
        </div>
        <span className="text-neutral-700 text-[13px] group-hover:text-neutral-500 transition-colors">
          Power on
        </span>
      </button>

      <div className="absolute bottom-10 flex flex-col items-center gap-2">
        {!advanced ? (
          <button
            onClick={() => setAdvanced(true)}
            className="text-neutral-700 text-[11.5px] hover:text-neutral-500 transition-colors"
          >
            Advanced options for Ubuntu
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-[11.5px]">
            <button onClick={() => boot(false)} className="text-neutral-400 hover:text-white transition-colors">
              Ubuntu
            </button>
            <button onClick={() => boot(true)} className="text-neutral-400 hover:text-white transition-colors">
              Ubuntu, with Linux 6.11.0-generic (recovery mode)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
