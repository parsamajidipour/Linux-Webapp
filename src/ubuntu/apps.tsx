import type { AppDef } from './types'
import {
  AppCenterIcon,
  CalculatorIcon,
  EditorIcon,
  FilesIcon,
  MonitorIcon,
  SettingsIconTile,
  TerminalIcon,
} from './icons'
import { FilesApp } from './apps/FilesApp'
import { TerminalApp } from './apps/TerminalApp'
import { EditorApp } from './apps/EditorApp'
import { CalculatorApp } from './apps/CalculatorApp'
import { SettingsApp } from './apps/SettingsApp'
import { AppCenterApp } from './apps/AppCenterApp'
import { SysMonitorApp } from './apps/SysMonitorApp'
import type { ComponentType } from 'react'

export const APP_COMPONENTS: Record<string, ComponentType<{ payload?: unknown }>> = {
  files: FilesApp,
  terminal: TerminalApp,
  editor: EditorApp,
  calculator: CalculatorApp,
  settings: SettingsApp,
  'app-center': AppCenterApp,
  'sys-monitor': SysMonitorApp,
}

export const APPS: AppDef[] = [
  {
    id: 'files',
    name: 'Files',
    color: '#7a7a72',
    icon: <FilesIcon size={40} />,
    defaultSize: { w: 920, h: 580 },
    minSize: { w: 560, h: 380 },
    pinned: true,
  },
  {
    id: 'app-center',
    name: 'App Center',
    color: '#E95420',
    icon: <AppCenterIcon size={40} />,
    defaultSize: { w: 940, h: 600 },
    minSize: { w: 620, h: 420 },
    pinned: true,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    color: '#1d1d1d',
    icon: <TerminalIcon size={40} />,
    defaultSize: { w: 760, h: 500 },
    minSize: { w: 420, h: 280 },
    pinned: true,
  },
  {
    id: 'editor',
    name: 'Text Editor',
    color: '#d9d7d4',
    icon: <EditorIcon size={40} />,
    defaultSize: { w: 720, h: 540 },
    minSize: { w: 420, h: 320 },
    pinned: true,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    color: '#2c2c28',
    icon: <CalculatorIcon size={40} />,
    defaultSize: { w: 360, h: 520 },
    minSize: { w: 320, h: 480 },
    pinned: true,
  },
  {
    id: 'sys-monitor',
    name: 'System Monitor',
    color: '#20301f',
    icon: <MonitorIcon size={40} />,
    defaultSize: { w: 820, h: 560 },
    minSize: { w: 560, h: 400 },
    pinned: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    color: '#63635c',
    icon: <SettingsIconTile size={40} />,
    defaultSize: { w: 900, h: 580 },
    minSize: { w: 640, h: 440 },
    pinned: true,
  },
]

export function getApp(id: string): AppDef {
  return APPS.find((a) => a.id === id) ?? APPS[0]
}
