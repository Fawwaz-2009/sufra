import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css' // imported eagerly at the entry so tldraw's CSS cascade is correct
import './app.css'
import TldrawCanvas from './tldraw/TldrawCanvas'

// The skill is a thin layer over tldraw: a host that serves artifact files, one
// custom shape, and (next) a file-sync layer. tldraw is the entire canvas.
createRoot(document.getElementById('root')!).render(<TldrawCanvas />)
