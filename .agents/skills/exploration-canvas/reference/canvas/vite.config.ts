import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { artifactHost } from './server/artifactPlugin'

// The Vite dev server doubles as the single-origin "canvas host":
// it serves the React Flow app, the artifact files under /_artifact/<id>/,
// and the manifest API under /api/*.
export default defineConfig({
  plugins: [react(), artifactHost()],
  server: { port: 5173, strictPort: true },
})
