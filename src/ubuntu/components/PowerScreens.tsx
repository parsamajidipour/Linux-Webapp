import { useEffect, useState } from 'react'
import { Power } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { UbuntuLogo } from '../icons'

export function BootScreen() {
  const ctx = useDesktop()
  const [fading, setFading] = useState(false)
  const { power, setPower } = ctx

  useEffect(() => {
    if (power !== 'boot') return
    setFading(false)
    const t1 = setTimeout(() => setFading(true), 2100)
    const t2 = setTimeout(() => setPower('lock'), 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [power, setPower])

  if (ctx.power !== 'boot') return null

  return (
    <div
      className={`fixed inset-0 z-[1100] flex flex-col items-center justify-center ${
        fading ? 'boot-fade' : ''
      }`}
      style={{ background: '#2c001e' }}
    >
      <UbuntuLogo size={110} className="fade-in" />
      <div className="mt-10 spinner-ubuntu">
        <svg width="34" height="34" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
          <path
            d="M17 3 a14 14 0 0 1 12.1 7"
            fill="none"
            stroke="#E95420"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="absolute bottom-12 text-neutral-400 text-[13px] tracking-wide">Ubuntu 24.04 LTS</div>
    </div>
  )
}

export function PowerOffScreen() {
  const ctx = useDesktop()
  if (ctx.power !== 'off') return null
  return (
    <div className="fixed inset-0 z-[1100] bg-black flex flex-col items-center justify-center fade-in">
      <button
        onClick={() => ctx.setPower('boot')}
        className="group flex flex-col items-center gap-4"
      >
        <div className="w-20 h-20 rounded-full border border-neutral-800 flex items-center justify-center transition-all group-hover:border-neutral-600 group-hover:shadow-[0_0_40px_rgba(233,84,32,0.25)]">
          <Power size={30} className="text-neutral-700 transition-colors group-hover:text-[#E95420]" />
        </div>
        <span className="text-neutral-700 text-[13px] group-hover:text-neutral-500 transition-colors">
          Power on
        </span>
      </button>
    </div>
  )
}
