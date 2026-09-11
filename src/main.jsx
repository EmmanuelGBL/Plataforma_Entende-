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

/* HashRouter, e não BrowserRouter: o mesmo build precisa funcionar no GitHub
   Pages (onde recarregar uma rota daria 404) e no arquivo único offline
   levado às sessões presenciais de teste, onde não há servidor. */

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
