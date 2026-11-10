import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Vite plugin that automatically duplicates dist/index.html to dist/404.html
 * for seamless Single Page Application (SPA) routing on GitHub Pages.
 */
function generate404Plugin(): Plugin {
  return {
    name: 'generate-404-html',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(distDir, 'index.html');
      const notFoundPath = path.join(distDir, '404.html');

      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
        console.log('✓ Successfully generated dist/404.html from dist/index.html for GitHub Pages SPA fallback');
      }
    },
  };
}

const basePath = process.env.VITE_BASE_PATH || '/MIND-MAZE-2.0/';

export default defineConfig({
  base: basePath,
  plugins: [react(), generate404Plugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-qr': ['qrcode', 'html5-qrcode'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
