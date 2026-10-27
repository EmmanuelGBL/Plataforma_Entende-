/* Gera um HTML único, com CSS, JavaScript e a marca embutidos, que abre
   por duplo clique. A pasta dist/ não abre direto do disco porque o navegador
   bloqueia <script type="module"> em file://.

   Uso:  npm run build && node empacotar-offline.js */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(raiz, 'dist');
const saida = path.join(raiz, 'Entende+ (protótipo).html');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('Não achei dist/index.html. Rode `npm run build` antes.');
  process.exit(1);
}

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const ler = (arquivo) => fs.readFileSync(path.join(dist, arquivo), 'utf8');

// --- CSS -------------------------------------------------------------------
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/,
  (_, arquivo) => `<style>\n${ler(arquivo)}\n</style>`,
);

// --- Marca, como data URI --------------------------------------------------
const svg = fs.readFileSync(path.join(dist, 'marca', 'entende-mais-icone.svg'), 'utf8');
const svgEmbutido = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

// --- JavaScript ------------------------------------------------------------
html = html.replace(
  /<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/,
  (_, arquivo) => {
    const codigo = ler(arquivo).split('./marca/entende-mais-icone.svg').join(svgEmbutido);
    // A tag de fechamento não pode aparecer literal dentro do script.
    return `<script type="module">\n${codigo.split('</script>').join('<\\/script>')}\n</script>`;
  },
);

html = html.replace(/href="\.\/marca\/entende-mais-icone\.svg"/, `href="${svgEmbutido}"`);

// Aviso para quem abrir o arquivo sem saber o que é.
html = html.replace(
  '<div id="raiz"></div>',
  '<div id="raiz"></div>\n    <!-- Entende+ — protótipo do TCC de Emmanuel e Hugo (CEUNI FAMETRO).\n' +
    '         Arquivo único e offline, gerado por empacotar-offline.js.\n' +
    '         Não editar aqui: a fonte é a pasta src/. -->',
);

fs.writeFileSync(saida, html, 'utf8');

const kb = (fs.statSync(saida).size / 1024).toFixed(0);
console.log(`Arquivo único gerado: ${path.basename(saida)} (${kb} KB)`);
console.log('Abre por duplo clique, sem servidor e sem internet.');
