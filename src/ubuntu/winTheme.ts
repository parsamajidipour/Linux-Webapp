import { useDesktop } from './context/DesktopContext'

export function useWinTheme() {
  const { darkStyle } = useDesktop()
  return {
    dark: darkStyle,
    bg: darkStyle ? 'bg-[#242424]' : 'bg-[#f6f5f4]',
    bgPanel: darkStyle ? 'bg-[#2d2d2d]' : 'bg-white',
    bgSidebar: darkStyle ? 'bg-[#1d1d1d]' : 'bg-[#e9e7e4]',
    bgToolbar: darkStyle ? 'bg-[#2d2d2d]' : 'bg-[#f0eeec]',
    text: darkStyle ? 'text-neutral-200' : 'text-neutral-800',
    textDim: darkStyle ? 'text-neutral-400' : 'text-neutral-500',
    border: darkStyle ? 'border-white/10' : 'border-black/10',
    hover: darkStyle ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]',
    active: darkStyle ? 'bg-white/10' : 'bg-black/[0.08]',
    input: darkStyle
      ? 'bg-[#1d1d1d] border-white/15 text-neutral-200 placeholder-neutral-500'
      : 'bg-white border-black/15 text-neutral-800 placeholder-neutral-400',
    divider: darkStyle ? 'bg-white/10' : 'bg-black/10',
  }
}
