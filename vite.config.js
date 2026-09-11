import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' e HashRouter (ver src/main.jsx) fazem o mesmo build servir ao
// GitHub Pages e ao arquivo offline. Atenção: `dist/` funciona em servidor
// HTTP, mas NÃO abre por duplo clique — o navegador bloqueia <script
// type="module"> em file://. Para o disco, use `npm run offline`, que gera
// um HTML único com tudo embutido (ver empacotar-offline.js).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'recursos' },
  server: { port: 5173, open: true },
});
