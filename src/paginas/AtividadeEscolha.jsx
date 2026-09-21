import { Link, useParams } from 'react-router-dom';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import {
  AtividadeIndisponivel,
  assuntoDaAtividade,
  usarAtividadeDoCodigo,
} from '../componentes/AtividadeAcesso.jsx';

/* =========================================================================
   UC22 — Escolher a forma da atividade (RF22)
   O estudante escolhe, ao abrir o link, entre a mecânica gamificada (RF21) e
   a lista de perguntas (RF16/RF17). A atividade é a mesma nas duas: as
   questões saem do mesmo banco gerado do material (RF13, RN04).

   Por que existe uma tela antes da atividade, em vez de o link já cair no
   jogo:

   - Quem não quer jogar não deve ser obrigado a jogar. A lista de perguntas
     continua sendo um caminho completo, e não um modo degradado — é ela que
     corresponde à folha impressa que o professor entrega (RF23).
   - Escolher antes de começar é agência sobre a atividade, e vem antes de
     qualquer parte em que a criança possa errar. É a mesma razão pela qual,
     dentro do jogo, ela mira antes de responder.
   - Duas opções, com uma frase cada, ditas no mesmo lugar toda vez. Escolha
     curta e estável não é o mesmo que excesso de escolha.

   RN05 continua valendo: nada aqui pergunta quem é a criança.
   ========================================================================= */

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
