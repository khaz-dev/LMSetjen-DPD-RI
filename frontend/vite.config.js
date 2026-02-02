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
      // Return a POST hook that runs AFTER Vite's built-in middlewares
      return () => {
        // Use the post hook to catch all unhandled requests
        server.middlewares.use((req, res, next) => {
          const method = req.method
          const url = req.url
          
          // Only handle GET and HEAD requests
          if (method !== 'GET' && method !== 'HEAD') {
            return next()
          }
          
          // Get the path without query string or fragment
          const urlPath = url.split('?')[0].split('#')[0]
          
          console.log(`[SPA] Middleware checking: ${urlPath}`)
          
          // Skip if it's an API request
          if (urlPath.startsWith('/api')) {
            console.log(`[SPA]   → API request, passing through`)
            return next()
          }
          
          // Skip if it's a special Vite path
          if (urlPath.startsWith('/node_modules') || urlPath.startsWith('/@') || urlPath.startsWith('/vite')) {
            console.log(`[SPA]   → Special path, passing through`)
            return next()
          }
          
          // Check for real file extensions
          // Match patterns like: .js, .css, .json, .png, .jpg, .gif, .svg, .ico, .woff, .woff2, etc.
          // The regex /\.\w{2,5}$/ looks for a dot followed by 2-5 word characters at the END of path
          // This prevents matching JWT tokens which have multiple dots in the middle
          // JWT example: /sso/eyJ0eXAi.eyJuaXA.bJacH9ei (NOT at end, so won't match)
          if (/\.\w{2,5}$/.test(urlPath)) {
            console.log(`[SPA]   → File request, passing through`)
            return next()
          }
          
          // For all other routes, rewrite to /index.html so Vite can process it
          // This allows React Router to handle the routing on the client side
          // IMPORTANT: We rewrite to /index.html (not serve directly) so Vite's React plugin
          // can inject the Fast Refresh preamble into the HTML
          console.log(`[SPA]   → Route request, rewriting to /index.html`)
          req.url = '/index.html'
          next()
        })
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Explicitly define environment variables for client-side access
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
      process.env.VITE_GOOGLE_CLIENT_ID || '634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com'
    ),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:8001'
    ),
  },
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
    host: '0.0.0.0',  // Listen on all interfaces (IPv4 + IPv6)
    port: process.env.VITE_PORT || 5174,  // Use VITE_PORT env var if set, default to 5174 for local dev
    hmr: {
      // HMR settings
      protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
      host: process.env.VITE_HMR_HOST || 'localhost',
      port: process.env.VITE_HMR_PORT ? parseInt(process.env.VITE_HMR_PORT) : 5174,
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
  },
  
  // allowedHosts configuration for Vite dev server
  // Allows specific hosts to access the dev server (prevents "Blocked request" errors)
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    'lms.dpd.go.id',
    'lmsetjendpdri.duckdns.org',
    process.env.VITE_ALLOWED_HOSTS || 'localhost',
  ].filter(Boolean),
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
