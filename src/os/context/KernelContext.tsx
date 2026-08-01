import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Kernel } from '../Kernel'
import { IndexedDbAdapter } from '../persistence/IndexedDbAdapter'

interface KernelContextValue {
  kernel: Kernel
  ready: boolean
}

const KernelContext = createContext<KernelContextValue | null>(null)

export function KernelProvider({ children }: { children: ReactNode }) {
  const [kernel] = useState(
    () =>
      new Kernel({
        vfs: new IndexedDbAdapter(),
        users: new IndexedDbAdapter(),
        packages: new IndexedDbAdapter(),
        settings: new IndexedDbAdapter(),
      }),
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    kernel.boot().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [kernel])

  return <KernelContext.Provider value={{ kernel, ready }}>{children}</KernelContext.Provider>
}

export function useKernel(): KernelContextValue {
  const ctx = useContext(KernelContext)
  if (!ctx) throw new Error('useKernel must be used within a KernelProvider')
  return ctx
}
