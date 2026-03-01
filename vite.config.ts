import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false, // Disable PWA in development to avoid reload conflicts
        type: 'module',
      },
      manifest: {
        name: '记账小助手',
        short_name: '记账',
        description: '个人记账应用 - Personal expense tracker',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  base: './',
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Add explicit alias for renderer to avoid HMR issues
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
    // Improve HMR configuration
    hmr: {
      overlay: true,
      clientPort: 5173,
    },
    // Allow Electron to access the dev server
    host: 'localhost',
    strictPort: true,
  },
  // Optimize dependencies to reduce reload time
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
