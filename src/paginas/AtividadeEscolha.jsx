import { Link, useParams } from 'react-router-dom';
import { ListChecks, Target } from 'lucide-react';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import {
  AtividadeIndisponivel,
  assuntoDaAtividade,
  usarAtividadeDoCodigo,
} from '../componentes/AtividadeAcesso.jsx';

/* Tela de escolha (RF22): jogar (RF21), em um dos temas, ou responder às
   perguntas (RF16). As questões são as mesmas em todas as opções.

   O tema é preferência do estudante, e o neutro (Alvo) vem primeiro e é o
   padrão (G07). Escolher o tema aqui abre o jogo já nele; dentro do jogo dá
   para trocar em "Como você quer jogar". */

/** Bola de futebol no mesmo traço dos ícones do lucide. */
function BolaFutebol(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5l4.3 3.1-1.6 5h-5.4l-1.6-5z" />
      <path d="M12 7.5V2.2M16.3 10.6l5-1.6M14.7 15.6l3.1 4.3M9.3 15.6l-3.1 4.3M7.7 10.6l-5-1.6" />
    </svg>
  );
}

const OPCOES = [
  {
    chave: 'neutro',
    titulo: 'Alvo',
    texto: 'Mire no alvo e responda. Um tema calmo, sem barulho.',
    Icone: Target,
    caminho: 'jogo',
    tema: 'neutro',
  },
  {
    chave: 'futebol',
    titulo: 'Futebol',
    texto: 'Escolha o canto do gol e responda para fazer o gol.',
    Icone: BolaFutebol,
    caminho: 'jogo',
    tema: 'futebol',
  },
  {
    chave: 'perguntas',
    titulo: 'Só as perguntas',
    texto: 'Uma pergunta por vez, sem jogo e sem desenho.',
    Icone: ListChecks,
    caminho: 'perguntas',
  },
];

export function AtividadeEscolha() {
  const { codigo } = useParams();
  const { material, valida } = usarAtividadeDoCodigo(codigo);

  usarTituloDaPagina(valida ? 'Escolha como fazer a atividade' : 'Atividade indisponível');

  if (!valida) return <AtividadeIndisponivel />;

  return (
    <div className="escolha-tela">
      <div className="escolha-tela__cabecalho">
        <p className="escolha-tela__assunto">Atividade sobre {assuntoDaAtividade(material)}</p>
        <h1>Escolha como você quer fazer a atividade</h1>
        <p>As perguntas são as mesmas em todas as opções. Muda só o desenho.</p>
      </div>

      <ul className="escolha">
        {OPCOES.map(({ chave, titulo, texto, Icone, caminho, tema }) => (
          <li key={chave}>
            <Link
              className={`escolha__opcao escolha__opcao--${chave}`}
              to={`/atividade/${codigo}/${caminho}`}
              state={tema ? { tema } : undefined}
            >
              <span className="escolha__figura" aria-hidden="true">
                <Icone />
              </span>
              <span className="escolha__texto">
                <strong className="escolha__titulo">{titulo}</strong>
                <span>{texto}</span>
              </span>
              <span className="escolha__botao" aria-hidden="true">
                Escolher
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
