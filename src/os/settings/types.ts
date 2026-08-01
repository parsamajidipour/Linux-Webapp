export interface Settings {
  theme: 'dark' | 'light'
  wallpaper: string
  locale: string
  volume: number
  brightness: number
  wifiEnabled: boolean
  bluetoothEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  wallpaper: 'default',
  locale: 'en_US.UTF-8',
  volume: 70,
  brightness: 100,
  wifiEnabled: true,
  bluetoothEnabled: false,
}
