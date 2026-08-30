export type TileKind = 'html' | 'spa' | 'image' | 'note' | 'app'

export interface Frame {
  x: number
  y: number
  w: number
  h: number
}

export interface Tile {
  id: string
  path?: string
  title: string
  kind: TileKind
  entry?: string
  frame: Frame
  tier?: string
  runtime?: Record<string, any>
  thumbnail?: string
  tags?: string[]
  status?: string
  forkedFrom?: string
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
  fromSide?: string
  toSide?: string
  toEnd?: string
  label?: string
}

export interface CanvasGroup {
  id: string
  label: string
  members: string[]
  color?: string
}

export interface CanvasDoc {
  schema: string
  version: number
  viewport?: { x: number; y: number; zoom: number }
  artifacts: Tile[]
  edges?: CanvasEdge[]
  groups?: CanvasGroup[]
  projectKey?: string
}
