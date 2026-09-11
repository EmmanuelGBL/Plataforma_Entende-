import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PainelPreferencias } from './PainelPreferencias.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* =========================================================================
   Esqueleto das telas do professor.

   Três coisas aqui não são decoração:

   1. Links de salto com accesskey (1 conteúdo, 2 menu). O salto para o
      conteúdo é o SC 2.4.1 da WCAG; os accesskeys nessa numeração são
      exigência do e-MAG (recomendação 1.5), que a WCAG não faz.
      A tecla 4 (rodapé) da mesma recomendação ainda NÃO está implementada: o
      <footer> já tem id e tabIndex prontos para recebê-la, mas o accessKey
      nunca foi ligado. As telas de Ajuda e Acessibilidade anunciam só as
      teclas 1 e 2, então o sistema não promete o que não entrega — mas a
      recomendação segue parcialmente atendida, e está registrada assim na
      seção 6.3 do documento.
   2. Foco e título por rota. Em aplicação de página única, trocar de rota não
      recarrega o documento: quem usa leitor de tela não recebe aviso nenhum
      e o foco fica onde estava. Por isso o <main> recebe o foco a cada troca
      e o título da página é anunciado.
   3. O painel de exibição fica no mesmo lugar em todas as telas (SC 3.2.6).
   ========================================================================= */

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
  return (
    <footer className="rodape" id="rodape" tabIndex={-1}>
      <div className="rodape-interno">
        <p>
          Entende+ — protótipo acadêmico. Trabalho de Conclusão de Curso em Sistemas de
          Informação, CEUNI FAMETRO. Os dados exibidos são de demonstração.
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

/** Layout sem menu do professor: telas públicas e a atividade do estudante,
 *  que por RN05 não tem conta, não tem painel e não coleta dado nenhum. */
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
