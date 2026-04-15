import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/meshtastic-dashboard/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-scale') || id.includes('d3-shape')) return 'charts';
            if (id.includes('d3-force') || id.includes('d3-selection') || id.includes('d3-zoom') || id.includes('d3-drag')) return 'd3';
            if (id.includes('gsap')) return 'gsap';
            if (id.includes('react-router')) return 'router';
            if (id.includes('react')) return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 4173,
  },
});
