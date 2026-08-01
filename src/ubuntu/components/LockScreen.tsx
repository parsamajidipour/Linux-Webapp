import { useState } from 'react'
import { ArrowRight, User } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'

export function LockScreen() {
  const ctx = useDesktop()
  const [password, setPassword] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [revealed, setRevealed] = useState(false)

  if (ctx.power !== 'lock') return null

  const unlock = () => {
    if (!revealed) {
      setRevealed(true)
      return
    }
    if (password.length === 0) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      return
    }
    setLeaving(true)
    setTimeout(() => {
      ctx.unlock()
      setLeaving(false)
      setRevealed(false)
      setPassword('')
    }, 420)
  }

  const time = ctx.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = ctx.now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center lock-blur text-white ${
        leaving ? 'lock-fade' : 'fade-in'
      }`}
      onClick={() => !revealed && setRevealed(true)}
      onKeyDown={(e) => e.key === 'Enter' && unlock()}
      tabIndex={0}
    >
      {/* Clock */}
      <div
        className="absolute transition-all duration-500 ease-out"
        style={{
          top: revealed ? '8%' : '50%',
          transform: revealed ? 'translateY(0)' : 'translateY(-50%)',
        }}
      >
        <div className="lock-clock text-[88px] leading-none text-center">{time}</div>
        <div className="text-center text-[19px] font-light text-neutral-200 mt-2">{date}</div>
      </div>

      {/* Login card */}
      <div
        className="flex flex-col items-center transition-all duration-500"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(110px)' : 'translateY(180px)',
          pointerEvents: revealed ? 'auto' : 'none',
        }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(160deg, #8a6f95, #5e2750)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <User size={40} strokeWidth={1.5} />
        </div>
        <div className="text-[17px] font-medium mb-4">user</div>
        <div
          className={`flex items-center gap-2 ${shaking ? '' : ''}`}
          style={shaking ? { animation: 'shake 0.4s ease' } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="password"
            value={password}
            autoFocus={revealed}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
            placeholder="Password"
            className="w-64 px-4 py-2.5 rounded-full bg-white/[0.14] border border-white/25 outline-none text-[14px] placeholder-neutral-300 text-center backdrop-blur-xl focus:bg-white/[0.2] transition-colors"
          />
          <button
            onClick={unlock}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{ background: 'var(--ubuntu-accent)' }}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="text-[12px] text-neutral-400 mt-3">
          Enter any password to unlock — this is a demo desktop
        </div>
      </div>

      {/* bottom hint */}
      <div
        className="absolute bottom-8 text-[13px] text-neutral-300 transition-opacity duration-300"
        style={{ opacity: revealed ? 0 : 1 }}
      >
        Click or press Enter to log in
      </div>

      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }`}</style>
    </div>
  )
}
