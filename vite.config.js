import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// base './' lets the built site work from any GitHub Pages path
// (https://user.github.io/repo/ or a custom domain) with no extra config.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { chunkSizeWarningLimit: 700 },
})
