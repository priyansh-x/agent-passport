import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3200,
    proxy: {
      '/v1': 'http://localhost:3100',
      '/health': 'http://localhost:3100',
    },
  },
})
