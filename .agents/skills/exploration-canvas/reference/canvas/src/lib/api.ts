import type { CanvasDoc } from '../types'

export async function fetchCanvas(): Promise<CanvasDoc> {
  const r = await fetch('/api/canvas')
  return r.json()
}

// Human dragged/resized a tile -> write its frame back to the artifact's frame.json.
export async function saveFrame(id: string, frame: { x: number; y: number; w: number; h: number }) {
  await fetch(`/api/artifact/${id}/frame`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(frame),
  }).catch(() => {})
}

// Canvas-level state (viewport / groups / edges) -> canvas.json.
export async function saveCanvasMeta(patch: Partial<Pick<CanvasDoc, 'viewport' | 'groups' | 'edges'>>) {
  await fetch('/api/canvas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}
