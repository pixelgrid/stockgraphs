import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: set via CLI for GitHub Pages, e.g. vite build --base=/repo-name/
export default defineConfig({
  plugins: [react()],
})
