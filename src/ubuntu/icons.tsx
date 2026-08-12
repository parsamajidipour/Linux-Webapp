import React from 'react'
import {
  FolderOpen,
  TerminalSquare,
  FileText,
  Calculator as CalcIcon,
  Settings as SettingsIcon,
  ShoppingBag,
  Activity,
  Grid3x3,
  Home,
  Trash2,
  Search,
  ScrollText,
} from 'lucide-react'

/** Ubuntu "Circle of Friends" logo */
export function UbuntuLogo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      <circle cx="50" cy="50" r="46" fill="#E95420" />
      <path
        d="M50 18 a32 32 0 0 1 32 32 M50 82 a32 32 0 0 1 -32 -32 M24.6 34 a32 32 0 0 1 50.8 32"
        fill="none"
        stroke="white"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="32" fill="none" stroke="white" strokeWidth="8.5" />
      <circle cx="50" cy="14" r="9" fill="white" />
      <circle cx="81" cy="68" r="9" fill="white" />
      <circle cx="19" cy="68" r="9" fill="white" />
    </svg>
  )
}

interface TileProps {
  size?: number
  className?: string
}

function Tile({
  size = 40,
  radius = 10,
  bg,
  children,
  className = '',
}: TileProps & { bg: string; radius?: number; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </div>
  )
}

export function FilesIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#7a7a72 0%,#5f5f58 100%)">
      <FolderOpen size={size * 0.55} color="#f6f5f4" strokeWidth={1.8} />
    </Tile>
  )
}

export function TerminalIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#3d3d3d 0%,#1d1d1d 100%)">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M5 6l6 6-6 6" stroke="#E95420" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 18h7" stroke="#f6f5f4" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </Tile>
  )
}

export function EditorIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#f6f5f4 0%,#d9d7d4 100%)">
      <FileText size={size * 0.55} color="#5e2750" strokeWidth={1.8} />
    </Tile>
  )
}

export function CalculatorIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#4a4a44 0%,#2c2c28 100%)">
      <CalcIcon size={size * 0.55} color="#f6f5f4" strokeWidth={1.8} />
    </Tile>
  )
}

export function SettingsIconTile({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#8a8a82 0%,#63635c 100%)">
      <SettingsIcon size={size * 0.58} color="#f6f5f4" strokeWidth={1.8} />
    </Tile>
  )
}

export function AppCenterIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#ff7a3c 0%,#E95420 100%)">
      <ShoppingBag size={size * 0.55} color="#fff" strokeWidth={1.9} />
    </Tile>
  )
}

export function MonitorIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#3a4a3a 0%,#20301f 100%)">
      <Activity size={size * 0.55} color="#8eef97" strokeWidth={2} />
    </Tile>
  )
}

export function HomeIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#7a7a72 0%,#5f5f58 100%)">
      <Home size={size * 0.55} color="#f6f5f4" strokeWidth={1.8} />
    </Tile>
  )
}

export function TrashIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#8a8a82 0%,#63635c 100%)">
      <Trash2 size={size * 0.55} color="#f6f5f4" strokeWidth={1.8} />
    </Tile>
  )
}

export function LogsIcon({ size = 40, className }: TileProps) {
  return (
    <Tile size={size} className={className} bg="linear-gradient(180deg,#3d4a5a 0%,#1f2833 100%)">
      <ScrollText size={size * 0.52} color="#8ec4f6" strokeWidth={1.8} />
    </Tile>
  )
}

export function ShowAppsIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Grid3x3 size={size * 0.6} className={className} color="#f6f5f4" strokeWidth={2} />
  )
}

export function SearchIcon({ size = 18 }: { size?: number }) {
  return <Search size={size} strokeWidth={2} />
}

export function TerminalGlyph({ size = 24 }: { size?: number }) {
  return <TerminalSquare size={size} strokeWidth={1.8} />
}
