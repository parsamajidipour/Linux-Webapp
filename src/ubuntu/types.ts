import type { ReactNode } from 'react'

export type SnapState = 'left' | 'right' | 'full' | null

export interface WindowState {
  id: string
  appId: string
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  snap: SnapState
  prevBounds: { x: number; y: number; w: number; h: number } | null
  closing: boolean
  payload?: unknown
}

export interface AppDef {
  id: string
  name: string
  /** accent color of the icon tile */
  color: string
  icon: ReactNode
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
}

export interface Notification {
  id: number
  app: string
  title: string
  body: string
  icon?: ReactNode
}

export type WallpaperId = 'noble' | 'aubergine' | 'sunrise' | 'ocean'

export interface AccentDef {
  name: string
  value: string
  hover: string
}
