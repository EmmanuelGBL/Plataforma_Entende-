import { Link, useParams } from 'react-router-dom';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import {
  AtividadeIndisponivel,
  assuntoDaAtividade,
  usarAtividadeDoCodigo,
} from '../componentes/AtividadeAcesso.jsx';

/* Tela de escolha da forma da atividade (RF22): jogar (RF21) ou responder
   às perguntas (RF16). As questões são as mesmas nas duas formas. */

export function AtividadeEscolha() {
  const { codigo } = useParams();
  const { material, valida } = usarAtividadeDoCodigo(codigo);

  usarTituloDaPagina(valida ? 'Escolha como fazer a atividade' : 'Atividade indisponível');

  if (!valida) return <AtividadeIndisponivel />;

  return (
    <div className="atividade">
      <h1>Atividade sobre {assuntoDaAtividade(material)}</h1>

      <p className="escolha__intro">
        Você pode fazer esta atividade de duas formas. As perguntas são as mesmas nas duas.
      </p>

      <ul className="escolha">
        <li>
          <Link className="escolha__opcao" to={`/atividade/${codigo}/jogo`}>
            <span className="escolha__figura" aria-hidden="true">
              ⚽
            </span>
            <span className="escolha__texto">
              <strong className="escolha__titulo">Jogar</strong>
              <span>
                Você escolhe onde mirar, responde a pergunta e vê o resultado. Não tem tempo para
                acabar e não tem como perder ponto.
              </span>
            </span>
          </Link>
        </li>

        <li>
          <Link className="escolha__opcao" to={`/atividade/${codigo}/perguntas`}>
            <span className="escolha__figura" aria-hidden="true">
              ☰
            </span>
            <span className="escolha__texto">
              <strong className="escolha__titulo">Responder as perguntas</strong>
              <span>
                Uma pergunta por vez, sem jogo e sem desenho. Você lê, responde e passa para a
                próxima.
              </span>
            </span>
          </Link>
        </li>
      </ul>

      <p className="campo__dica" style={{ marginTop: 'var(--e5)' }}>
        Você pode trocar de forma quando quiser. Nada do que você responder é guardado: o Entende+
        não registra nome, e-mail nem nota.
      </p>
    </div>
  );
}
