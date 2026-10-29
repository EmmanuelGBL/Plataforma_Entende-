import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  FolderOpen,
  Gamepad2,
  ListChecks,
  LogOut,
  PanelLeftClose,
} from 'lucide-react';
import { PainelPreferencias } from './PainelPreferencias.jsx';
import { JanelaEnviar } from './JanelaEnviar.jsx';
import { ALTURA, LARGURA, MAIS, PALAVRA, SIMBOLO } from './marcaVetorial.js';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Esqueleto das telas: link de salto, menu lateral com o logo (só nas telas
   do professor), barra superior e conteúdo. O rodapé saiu em 29/10/2026; a
   Declaração de acessibilidade abre pelo painel Acessibilidade.

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

/** Logotipo em SVG embutido, com os traçados de Logo/gerar-logo.py. A palavra
 *  usa a cor do texto e o "+" a cor da marca, e os dois acompanham o alto
 *  contraste. Decorativo: quem o usa dá o nome acessível. Com `simbolo`, só
 *  o livro, que ocupa o quadrado 64 × 64 do início do desenho. */
export function LogoEntende({ className, simbolo }) {
  if (simbolo) {
    return (
      <svg viewBox={`0 0 ${ALTURA} ${ALTURA}`} className={className} aria-hidden="true" focusable="false">
        {SIMBOLO.map((elemento) => (
          <path key={elemento.d} {...elemento} />
        ))}
      </svg>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {SIMBOLO.map((elemento) => (
        <path key={elemento.d} {...elemento} />
      ))}
      <path d={PALAVRA} fill="currentColor" />
      <g fill="var(--cor-marca-mais)">
        {MAIS.map(([x, y, largura, altura]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={largura} height={altura} rx="2.4" />
        ))}
      </g>
    </svg>
  );
}

/** Logotipo. Com `para`, vira link (telas do professor); sem, é só a marca. */
export function Marca({ para }) {
  const conteudo = (
    <>
      <LogoEntende className="marca__logo" />
      <span className="apenas-leitor">Entende+</span>
    </>
  );
  if (!para) return <span className="marca">{conteudo}</span>;
  return (
    <Link to={para} className="marca">
      {conteudo}
      <span className="apenas-leitor">— início</span>
    </Link>
  );
}

function LinkAjuda() {
  return (
    <Link to="/ajuda" className="barra__acao">
      <CircleHelp aria-hidden="true" />
      <span className="barra__rotulo">Ajuda</span>
    </Link>
  );
}

/** Menu do professor: nome e o botão Sair. */
function MenuProfessor() {
  const { professor, sair } = usarApp();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const area = useRef(null);
  const gatilho = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(evento) {
      if (!area.current?.contains(evento.target)) setAberto(false);
    }
    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        setAberto(false);
        gatilho.current?.focus();
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  if (!professor) return null;
  const primeiroNome = professor.nome?.split(' ')[0] ?? 'Professor';

  return (
    <div className="menu-professor" ref={area}>
      <button
        type="button"
        ref={gatilho}
        className="barra__acao"
        aria-expanded={aberto}
        aria-controls="menu-professor"
        onClick={() => setAberto((v) => !v)}
      >
        <CircleUserRound aria-hidden="true" className="menu-professor__avatar" />
        <span className="barra__rotulo">{primeiroNome}</span>
        <ChevronDown aria-hidden="true" className="menu-professor__seta" />
      </button>
      {aberto && (
        <div className="menu-professor__painel" id="menu-professor">
          <p className="menu-professor__nome">{professor.nome}</p>
          {professor.email && <p className="menu-professor__email">{professor.email}</p>}
          <button
            type="button"
            className="botao botao--secundario botao--largo"
            onClick={() => {
              sair();
              navegar('/');
            }}
          >
            <LogOut aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

/** Itens fixos do menu. O envio de material não é item de menu: abre em
 *  janela pelo botão "Enviar material" de Meus materiais. */
const ITENS_MENU = [
  ['/painel', FolderOpen, 'Meus materiais'],
  ['/atividades', Gamepad2, 'Atividades'],
  ['/regras', ListChecks, 'Regras de adaptação'],
  ['/ajuda', CircleHelp, 'Ajuda'],
];

/** Menu lateral, com o logo no topo. Adaptação e Atividade do material
 *  aberto não entram aqui desde 29/10/2026: as duas telas já têm os botões
 *  de ir de uma para a outra.
 *
 *  Fechado, o topo mostra só o símbolo do livro, que é também o botão de
 *  abrir; em tela larga os itens ficam só com o ícone (o nome aparece ao
 *  passar o mouse e continua para o leitor de tela), e em tela estreita
 *  somem. */
function MenuLateral({ fechado, aoAlternar }) {
  // O botão de abrir e o de recolher são elementos diferentes: depois de
  // alternar, o foco passa para o que apareceu, e não se perde.
  const botao = useRef(null);
  const alternou = useRef(false);
  useEffect(() => {
    if (!alternou.current) return;
    alternou.current = false;
    botao.current?.focus();
  }, [fechado]);
  function alternar() {
    alternou.current = true;
    aoAlternar();
  }

  return (
    <nav className="menu-lateral" id="menu" aria-label="Navegação principal" accessKey="2">
      <div className="menu-lateral__topo">
        {fechado ? (
          <button
            type="button"
            ref={botao}
            className="menu-lateral__alternar menu-lateral__alternar--simbolo"
            aria-expanded="false"
            aria-controls="menu-itens"
            title="Abrir o menu"
            onClick={alternar}
          >
            <LogoEntende simbolo className="menu-lateral__simbolo" />
            <span className="apenas-leitor">Menu</span>
          </button>
        ) : (
          <>
            <Marca para="/painel" />
            <button
              type="button"
              ref={botao}
              className="menu-lateral__alternar"
              aria-expanded="true"
              aria-controls="menu-itens"
              title="Recolher o menu"
              onClick={alternar}
            >
              <PanelLeftClose aria-hidden="true" />
              <span className="apenas-leitor">Menu</span>
            </button>
          </>
        )}
      </div>

      <div className="menu-lateral__itens" id="menu-itens">
        <ul>
          {ITENS_MENU.map(([caminho, Icone, rotulo]) => (
            <li key={caminho}>
              <NavLink to={caminho} title={fechado ? rotulo : undefined}>
                <Icone aria-hidden="true" />
                <span className="menu-lateral__rotulo">{rotulo}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Coloca o foco no <main> a cada troca de rota (menos na primeira carga). */
function usarFocoNaTroca(principal, focarNaPrimeira) {
  const local = useLocation();
  const primeiraCarga = useRef(!focarNaPrimeira);
  useEffect(() => {
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    principal.current?.focus();
    window.scrollTo(0, 0);
  }, [local.pathname, principal]);
}

/** A janela de envio abre por `?enviar=1` na URL: assim o botão Voltar do
 *  navegador também a fecha, e o endereço antigo /enviar continua valendo. */
export const PARAMETRO_ENVIO = 'enviar';

function usarJanelaEnvio() {
  const [busca, setBusca] = useSearchParams();
  const aberta = busca.get(PARAMETRO_ENVIO) === '1';
  function fechar() {
    setBusca(
      (atual) => {
        const nova = new URLSearchParams(atual);
        nova.delete(PARAMETRO_ENVIO);
        return nova;
      },
      { replace: true },
    );
  }
  return { aberta, fechar };
}

const CHAVE_MENU = 'entende-menu-fechado';

/** Menu lateral aberto ou fechado. A escolha fica neste navegador; se o
 *  armazenamento estiver bloqueado, o menu só começa aberto. */
function usarMenuFechado() {
  const [fechado, setFechado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MENU) === 'sim';
    } catch {
      return false;
    }
  });
  function alternar() {
    setFechado((atual) => {
      try {
        localStorage.setItem(CHAVE_MENU, atual ? 'nao' : 'sim');
      } catch {
        /* sem armazenamento: vale só nesta visita */
      }
      return !atual;
    });
  }
  return [fechado, alternar];
}

export function Layout() {
  const { professor } = usarApp();
  const principal = useRef(null);
  const envio = usarJanelaEnvio();
  const [menuFechado, alternarMenu] = usarMenuFechado();
  usarFocoNaTroca(principal, false);

  const classeApp = professor
    ? `app app--com-menu${menuFechado ? ' app--menu-fechado' : ''}`
    : 'app';

  return (
    <div className={classeApp}>
      <LinksDeSalto />

      {professor && <MenuLateral fechado={menuFechado} aoAlternar={alternarMenu} />}

      <header className="barra">
        <div className="barra-interna">
          {/* Com sessão, o logo fica no topo do menu lateral. */}
          {!professor && <Marca />}
          <div className="barra__acoes">
            {/* Com sessão, a Ajuda está no menu lateral. */}
            {!professor && <LinkAjuda />}
            <PainelPreferencias />
            <MenuProfessor />
          </div>
        </div>
      </header>

      {/* Ajuda e Acessibilidade também abrem sem sessão: aí não há menu lateral. */}
      <div className="corpo">
        <main className="conteudo" id="conteudo" ref={principal} tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {professor && envio.aberta && <JanelaEnviar aoFechar={envio.fechar} />}
    </div>
  );
}

/** Layout sem o menu do professor: entrada e telas do estudante. */
export function LayoutSimples() {
  const principal = useRef(null);
  const naEntrada = useLocation().pathname === '/';
  usarFocoNaTroca(principal, true);

  return (
    <div className={naEntrada ? 'app app--tela-cheia' : 'app'}>
      <LinksDeSalto />
      <header className="barra">
        <div className="barra-interna">
          <Marca />
          <div className="barra__acoes">
            {naEntrada && <LinkAjuda />}
            <PainelPreferencias />
          </div>
        </div>
      </header>
      <main className="conteudo" id="conteudo" ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
