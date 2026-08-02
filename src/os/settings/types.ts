export interface Settings {
  theme: 'dark' | 'light'
  wallpaper: string
  accent: string
  locale: string
  volume: number
  brightness: number
  wifiEnabled: boolean
  bluetoothEnabled: boolean
  dockAutoHide: boolean
  /** App ids pinned to the Dock, in display order. */
  pinnedApps: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  wallpaper: 'noble',
  accent: 'Orange',
  locale: 'en_US.UTF-8',
  volume: 72,
  brightness: 100,
  wifiEnabled: true,
  bluetoothEnabled: true,
  dockAutoHide: false,
  pinnedApps: ['files', 'app-center', 'terminal', 'editor', 'calculator', 'sys-monitor', 'settings'],
}
