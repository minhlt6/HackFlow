import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        // FIX: Tránh mất Authorization header khi backend redirect 307 (trailing slash)
        followRedirects: true,
      },
    },
  },
})
