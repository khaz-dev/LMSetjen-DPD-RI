import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// SPA Fallback Plugin - serve index.html for all non-file routes
// This enables client-side routing for React Router
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback',
    apply: 'serve',
    configureServer(server) {
      return () => {
        // Middleware to handle SPA routing fallback
        server.middlewares.use((req, res, next) => {
          // Skip if it's a real file request (has a file extension)
          if (req.url.includes('.')) {
            return next()
          }
          
          // Skip api calls and other special paths
          if (req.url.startsWith('/api') || req.url.startsWith('/node_modules')) {
            return next()
          }
          
          // For all other routes, rewrite to root (/)
          // This allows React Router to handle the routing
          req.url = '/'
          next()
        })
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    spaFallbackPlugin(),
    react({
      // Add fast refresh options
      fastRefresh: true,
      // Exclude problematic files from HMR
      include: "**/*.{jsx,tsx}",
    }),
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
  server: {
    port: 5173,
    hmr: {
      // HMR settings
      protocol: 'ws',
      host: 'localhost',
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
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
