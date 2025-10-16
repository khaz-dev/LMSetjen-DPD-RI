import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files > 1KB
      deleteOriginFile: false,
    }),
    // Brotli compression (better compression than gzip)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  build: {
    // Optimize bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log, console.error, console.warn in production
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Improve chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['bootstrap', 'react-bootstrap', 'react-icons'],
          'chart-vendor': ['chart.js', 'react-chartjs-2', 'recharts'],
          'editor-vendor': ['@ckeditor/ckeditor5-build-classic', '@ckeditor/ckeditor5-react'],
          'utils-vendor': ['axios', 'dayjs', 'js-cookie', 'jwt-decode', 'zustand'],
        },
      },
    },
    // Improve chunk size
    chunkSizeWarningLimit: 1000,
  },
})
