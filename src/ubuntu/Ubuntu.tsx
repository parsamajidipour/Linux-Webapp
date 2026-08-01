import { DesktopProvider, useDesktop } from './context/DesktopContext'
import { Desktop } from './components/Desktop'
import { LockScreen } from './components/LockScreen'
import { BootScreen, PowerOffScreen } from './components/PowerScreens'
import { KernelProvider } from '../os/context/KernelContext'

function Shell() {
  const ctx = useDesktop()
  return (
    <>
      {(ctx.power === 'desktop' || ctx.power === 'lock') && <Desktop />}
      <LockScreen />
      <BootScreen />
      <PowerOffScreen />
    </>
  )
}

export default function Ubuntu() {
  return (
    <KernelProvider>
      <DesktopProvider>
        <Shell />
      </DesktopProvider>
    </KernelProvider>
  )
}
