import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    // Hashed bundles go to /static so they never mix with the original /assets folder.
    assetsDir: 'static',
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
