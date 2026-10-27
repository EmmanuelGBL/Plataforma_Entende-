import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' e HashRouter fazem o mesmo build servir ao GitHub Pages e ao
// arquivo offline. dist/ precisa de servidor HTTP; para abrir do disco, use
// `npm run offline`.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'recursos' },
  server: { port: 5173, open: true },
});
