import { useMemo, useState } from 'react'
import { ArrowRight, User as UserIcon } from 'lucide-react'
import { useDesktop } from '../context/DesktopContext'
import { useKernel } from '../../os/context/KernelContext'

export function LockScreen() {
  const ctx = useDesktop()
  const { kernel, ready } = useKernel()
  const [selected, setSelected] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [revealed, setRevealed] = useState(false)

  // Root is a real Unix account here (used by `sudo`/`su` in the terminal) but real Ubuntu
  // hides it from the graphical greeter too — only real login candidates show up here.
  // `ready` isn't read in the callback but must stay a dep: kernel.users.list() returns the
  // store's live array, which UserStore.load() *replaces* (not mutates) once persisted data
  // loads — this is the only signal that the array reference actually changed.
  const loginUsers = useMemo(
    () => kernel.users.list().filter((u) => u.username !== 'root'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kernel, ready],
  )

  if (ctx.power !== 'lock') return null

  // Re-locking an already-logged-in session skips the picker entirely — same as real Ubuntu,
  // the lock screen never logs you out, it just re-prompts the same account.
  const activeUsername = ctx.sessionUser ?? selected
  const activeUser = activeUsername ? kernel.users.findByName(activeUsername) : null

  const finishLogin = (username: string) => {
    setLeaving(true)
    setTimeout(() => {
      ctx.unlock(username)
      setLeaving(false)
      setRevealed(false)
      setSelected(null)
      setPassword('')
    }, 420)
  }

  const pickUser = (username: string) => {
    const user = kernel.users.findByName(username)
    setSelected(username)
    setPassword('')
    if (user?.passwordHash === null) finishLogin(username) // guest-style account: no password needed
  }

  const submit = () => {
    if (!revealed) {
      setRevealed(true)
      return
    }
    if (!activeUsername) return // still on the picker, nobody chosen yet
    if (!kernel.users.authenticate(activeUsername, password)) {
      setShaking(true)
      setPassword('')
      setTimeout(() => setShaking(false), 500)
      return
    }
    finishLogin(activeUsername)
  }

  const time = ctx.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = ctx.now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center lock-blur text-white ${
        leaving ? 'lock-fade' : 'fade-in'
      }`}
      onClick={() => !revealed && setRevealed(true)}
      onKeyDown={(e) => e.key === 'Enter' && submit()}
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
        onClick={(e) => e.stopPropagation()}
      >
        {!activeUsername ? (
          // Fresh boot, nobody's logged in yet — pick which account to log into.
          <div className="flex items-end gap-10">
            {loginUsers.map((u) => (
              <button
                key={u.username}
                onClick={() => pickUser(u.username)}
                className="flex flex-col items-center gap-3 group"
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{
                    background:
                      u.passwordHash === null
                        ? 'linear-gradient(160deg, #5c5c5c, #2c2c2c)'
                        : 'linear-gradient(160deg, #8a6f95, #5e2750)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}
                >
                  <UserIcon size={40} strokeWidth={1.5} />
                </div>
                <div className="text-[15px] font-medium">{u.fullName}</div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(160deg, #8a6f95, #5e2750)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <UserIcon size={40} strokeWidth={1.5} />
            </div>
            <div className="text-[17px] font-medium mb-4">{activeUser?.fullName ?? activeUsername}</div>
            <div
              className="flex items-center gap-2"
              style={shaking ? { animation: 'shake 0.4s ease' } : undefined}
            >
              <input
                type="password"
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Password"
                className="w-64 px-4 py-2.5 rounded-full bg-white/[0.14] border border-white/25 outline-none text-[14px] placeholder-neutral-300 text-center backdrop-blur-xl focus:bg-white/[0.2] transition-colors"
              />
              <button
                onClick={submit}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                style={{ background: 'var(--ubuntu-accent)' }}
              >
                <ArrowRight size={18} />
              </button>
            </div>
            {!ctx.sessionUser && (
              <>
                <div className="text-[12px] text-neutral-400 mt-3">Demo account — password is "ubuntu"</div>
                <button
                  className="text-[12px] text-neutral-400 underline mt-1 hover:text-neutral-200"
                  onClick={() => {
                    setSelected(null)
                    setPassword('')
                  }}
                >
                  Not {activeUser?.fullName ?? activeUsername}?
                </button>
              </>
            )}
          </>
        )}
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
