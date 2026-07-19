import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@techstark/opencv-js']
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 5000
  }
})
