import { CircleCheck, Star, Trophy } from 'lucide-react';

/* Peças visuais comuns ao jogo (RF21) e à lista de perguntas (RF16):
   progresso em segmentos, pontos e tela de conclusão.

   Pela G05 (RN11), nenhuma delas conta erro: os pontos vêm só dos acertos e
   a conclusão mostra pontos e acertos, nunca erros. */

export const PONTOS_POR_ACERTO = 20;

/** Progresso "Pergunta 2 de 5" em texto e em segmentos (G14). Os segmentos
 *  são decorativos para o leitor de tela, porque o texto já diz o mesmo. */
export function ProgressoPerguntas({ total, atual, feitas, unidade = 'Pergunta' }) {
  return (
    <div className="progresso-perguntas">
      <ol className="progresso-perguntas__segmentos" aria-hidden="true">
        {Array.from({ length: total }, (_, posicao) => (
          <li
            key={posicao}
            data-estado={posicao === atual ? 'atual' : feitas.includes(posicao) ? 'feita' : 'pendente'}
          />
        ))}
      </ol>
      <p className="progresso-perguntas__texto">
        {unidade} <strong>{atual + 1}</strong> de <strong>{total}</strong>
      </p>
    </div>
  );
}

/** Pontos acumulados. Só sobem: errar não tira ponto (G04). */
export function Pontos({ acertos }) {
  const pontos = acertos * PONTOS_POR_ACERTO;
  return (
    <p className="pontos">
      <Star aria-hidden="true" className="pontos__estrela" />
      <span className="pontos__texto">
        <span className="pontos__rotulo">Pontos</span>
        <strong>{pontos}</strong>
      </span>
    </p>
  );
}

/** Mensagem de encerramento: sempre positiva, nunca sobre erro. */
function mensagem(acertos, total, assunto) {
  if (acertos === total) return ['Você acertou todas as perguntas!', `Você sabe muito sobre ${assunto}.`];
  if (acertos > 0) return ['Você se saiu bem!', `Continue aprendendo sobre ${assunto}.`];
  return ['Você chegou até o fim!', 'Que tal treinar de novo? A dica mostra onde procurar a resposta.'];
}

export function ConclusaoAtividade({ acertos, total, assunto, acoes, aviso }) {
  const [titulo, texto] = mensagem(acertos, total, assunto);
  return (
    <div className="conclusao">
      <div className="conclusao__confete" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} />
        ))}
      </div>

      <Trophy aria-hidden="true" className="conclusao__trofeu" />
      <h1 className="conclusao__titulo">Parabéns!</h1>
      <p className="conclusao__subtitulo">Você concluiu a atividade!</p>

      <div className="conclusao__cartao">
        <dl className="conclusao__numeros">
          <div>
            <dt>
              <Star aria-hidden="true" className="pontos__estrela" />
              <span>pontos</span>
            </dt>
            <dd>{acertos * PONTOS_POR_ACERTO}</dd>
          </div>
          <div>
            <dt>
              <CircleCheck aria-hidden="true" className="conclusao__certo" />
              <span>
                {acertos === 1 ? 'acerto' : 'acertos'} em {total}{' '}
                {total === 1 ? 'pergunta' : 'perguntas'}
              </span>
            </dt>
            <dd>{acertos}</dd>
          </div>
        </dl>

        <div className="conclusao__mensagem">
          <Trophy aria-hidden="true" />
          <p>
            <strong>{titulo}</strong>
            <span>{texto}</span>
          </p>
        </div>
      </div>

      {aviso}

      <div className="conclusao__acoes">{acoes}</div>

      <p className="conclusao__privacidade">
        Nada do que você respondeu foi guardado. O Entende+ não registra nome, e-mail nem nota.
      </p>
    </div>
  );
}
