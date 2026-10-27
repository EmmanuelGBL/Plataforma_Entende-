import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { ProvedorAplicacao } from './contextos/Aplicacao.jsx';
import { ProvedorPreferencias } from './contextos/Preferencias.jsx';
import { ProvedorAnuncios } from './contextos/Anuncios.jsx';

import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';

/* HashRouter: o mesmo build funciona no GitHub Pages e no arquivo offline,
   que não têm servidor para reescrever as rotas. */

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ProvedorPreferencias>
      <ProvedorAnuncios>
        <ProvedorAplicacao>
          <HashRouter>
            <App />
          </HashRouter>
        </ProvedorAplicacao>
      </ProvedorAnuncios>
    </ProvedorPreferencias>
  </StrictMode>,
);
