import type { ReactNode } from 'react'

export type SnapState = 'left' | 'right' | 'full' | 'tl' | 'tr' | 'bl' | 'br' | null

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
  /** Chrome-less true fullscreen (F11) — distinct from Maximize (`snap: 'full'`), which keeps
   * the title bar. Covers the entire viewport, including over the TopBar. */
  fullscreen: boolean
  /** 1-based workspace this window lives on. */
  workspace: number
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
