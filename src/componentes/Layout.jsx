import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  FileText,
  FolderOpen,
  Gamepad2,
  ListChecks,
  LogOut,
  Settings,
} from 'lucide-react';
import { PainelPreferencias } from './PainelPreferencias.jsx';
import { JanelaEnviar } from './JanelaEnviar.jsx';
import { ALTURA, LARGURA, MAIS, PALAVRA, SIMBOLO } from './marcaVetorial.js';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Esqueleto das telas: link de salto, barra superior, menu lateral (só nas
   telas do professor), conteúdo e rodapé.

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
 *  contraste. Decorativo: quem o usa dá o nome acessível. */
export function LogoEntende({ className }) {
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
          <Link
            to="/configuracoes"
            className="botao botao--discreto botao--largo"
            onClick={() => setAberto(false)}
          >
            <Settings aria-hidden="true" />
            Configurações
          </Link>
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
  ['/configuracoes', Settings, 'Configurações'],
  ['/ajuda', CircleHelp, 'Ajuda'],
];

/** Menu lateral. Adaptação e Atividade dependem do material, então só
 *  aparecem quando um material está aberto. */
function MenuLateral() {
  const rotaMaterial = useMatch('/materiais/:id/*');
  const { material } = usarApp();
  const id = rotaMaterial?.params.id;
  const aberto = id ? material(id) : null;

  return (
    <nav className="menu-lateral" id="menu" aria-label="Navegação principal" accessKey="2">
      <ul>
        {ITENS_MENU.map(([caminho, Icone, rotulo]) => (
          <li key={caminho}>
            <NavLink to={caminho}>
              <Icone aria-hidden="true" />
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>

      {aberto && (
        <>
          <p className="menu-lateral__grupo" id="menu-material">
            Material aberto
            <span className="menu-lateral__material">{aberto.nome}</span>
          </p>
          <ul aria-labelledby="menu-material">
            <li>
              <NavLink to={`/materiais/${id}/adaptacao`}>
                <FileText aria-hidden="true" />
                Adaptação
              </NavLink>
            </li>
            <li>
              <NavLink to={`/materiais/${id}/atividade`}>
                <Gamepad2 aria-hidden="true" />
                Atividade
              </NavLink>
            </li>
          </ul>
        </>
      )}
    </nav>
  );
}

function Rodape() {
  return (
    <footer className="rodape" id="rodape" tabIndex={-1}>
      <div className="rodape-interno">
        <p>
          Entende+, protótipo acadêmico. Trabalho de Conclusão de Curso em Sistemas de Informação,
          CEUNI FAMETRO.
        </p>
        <ul>
          <li>
            <Link to="/acessibilidade">Declaração de acessibilidade</Link>
          </li>
          <li>
            <Link to="/ajuda">Ajuda</Link>
          </li>
        </ul>
      </div>
    </footer>
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

export function Layout() {
  const { professor } = usarApp();
  const principal = useRef(null);
  const envio = usarJanelaEnvio();
  usarFocoNaTroca(principal, false);

  return (
    <div className="app">
      <LinksDeSalto />

      <header className="barra">
        <div className="barra-interna">
          <Marca para="/painel" />
          <div className="barra__acoes">
            {/* Com sessão, a Ajuda está no menu lateral. */}
            {!professor && <LinkAjuda />}
            <PainelPreferencias />
            <MenuProfessor />
          </div>
        </div>
      </header>

      {/* Ajuda e Acessibilidade também abrem sem sessão: aí não há menu lateral. */}
      <div className={professor ? 'corpo corpo--com-menu' : 'corpo'}>
        {professor && <MenuLateral />}
        <main className="conteudo" id="conteudo" ref={principal} tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Rodape />

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
      {/* A entrada ocupa a tela inteira; o link da declaração fica sob o cartão. */}
      {!naEntrada && <Rodape />}
    </div>
  );
}
