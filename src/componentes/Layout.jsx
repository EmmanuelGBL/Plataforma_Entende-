import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PainelPreferencias } from './PainelPreferencias.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Esqueleto das telas do professor: link de salto, barra superior com menu,
   painel de exibição e rodapé.

   A cada troca de rota o <main> recebe o foco e o título da página muda,
   para que o leitor de tela perceba a nova tela. Atalhos: accesskey 1
   (conteúdo) e 2 (menu). */

/** Define o título do documento e anuncia a chegada na tela. */
export function usarTituloDaPagina(titulo) {
  const { anunciar } = usarAnuncios();
  useEffect(() => {
    document.title = `${titulo} — Entende+`;
    anunciar(`${titulo}.`);
  }, [titulo, anunciar]);
}

function LinksDeSalto() {
  return (
    <div className="saltos">
      <a href="#conteudo" accessKey="1">
        Ir para o conteúdo <span aria-hidden="true">[1]</span>
      </a>
    </div>
  );
}

function Marca() {
  return (
    <Link to="/painel" className="marca">
      <img src="./marca/entende-mais-icone.svg" alt="" />
      <span>
        Entende<span className="mais">+</span>
      </span>
      <span className="apenas-leitor">— início</span>
    </Link>
  );
}

function Rodape() {
  const { modoServidor } = usarApp();
  return (
    <footer className="rodape" id="rodape" tabIndex={-1}>
      <div className="rodape-interno">
        <p>
          Entende+, protótipo acadêmico. Trabalho de Conclusão de Curso em Sistemas de Informação,
          CEUNI FAMETRO.{modoServidor ? '' : ' Os dados exibidos são de demonstração.'}
        </p>
        <ul>
          <li>
            <Link to="/acessibilidade">Acessibilidade</Link>
          </li>
          <li>
            <Link to="/ajuda">Ajuda</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export function Layout() {
  const { professor, sair } = usarApp();
  const navegar = useNavigate();
  const local = useLocation();
  const principal = useRef(null);
  const primeiraCarga = useRef(true);

  useEffect(() => {
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    principal.current?.focus();
    window.scrollTo(0, 0);
  }, [local.pathname]);

  return (
    <div className="app">
      <LinksDeSalto />

      <header className="barra">
        <div className="barra-interna">
          <Marca />

          <nav className="navegacao" id="menu" aria-label="Navegação principal" accessKey="2">
            <NavLink to="/painel">Meus materiais</NavLink>
            <NavLink to="/enviar">Enviar material</NavLink>
            <NavLink to="/ajuda">Ajuda</NavLink>
          </nav>

          <div className="barra-espaco linha">
            <PainelPreferencias />
            {professor && (
              <button
                type="button"
                className="preferencias__gatilho"
                onClick={() => {
                  sair();
                  navegar('/');
                }}
              >
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="conteudo" id="conteudo" ref={principal} tabIndex={-1}>
        <Outlet />
      </main>

      <Rodape />
    </div>
  );
}

/** Layout sem o menu do professor: entrada e telas do estudante. */
export function LayoutSimples() {
  const local = useLocation();
  const principal = useRef(null);

  useEffect(() => {
    principal.current?.focus();
  }, [local.pathname]);

  return (
    <div className="app">
      <LinksDeSalto />
      <header className="barra">
        <div className="barra-interna">
          <span className="marca">
            <img src="./marca/entende-mais-icone.svg" alt="" />
            <span>
              Entende<span className="mais">+</span>
            </span>
          </span>
          <div className="barra-espaco">
            <PainelPreferencias />
          </div>
        </div>
      </header>
      <main className="conteudo" id="conteudo" ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
      <Rodape />
    </div>
  );
}
