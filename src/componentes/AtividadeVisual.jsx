import { useEffect, useState } from 'react';
import { CircleCheck, Rocket, Star, Trophy } from 'lucide-react';

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

/** O sistema ou o painel Exibição pedem movimento reduzido. */
function semMovimento() {
  return (
    document.documentElement.dataset.movimento === 'reduzido' ||
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}

/** Número que sobe de 0 até `valor` em cerca de um segundo. Sem animação
 *  quando o movimento reduzido está ligado. */
function usarContagem(valor, ligado) {
  const [atual, setAtual] = useState(() => (ligado && !semMovimento() ? 0 : valor));
  useEffect(() => {
    if (!ligado || semMovimento()) {
      setAtual(valor);
      return undefined;
    }
    let quadro;
    const inicio = { tempo: 0 };
    const DURACAO = 1000;
    function passo(agora) {
      if (!inicio.tempo) inicio.tempo = agora;
      const t = Math.min(1, (agora - inicio.tempo) / DURACAO);
      setAtual(Math.round(valor * (1 - (1 - t) ** 3)));
      if (t < 1) quadro = requestAnimationFrame(passo);
    }
    // Começa quando o troféu já entrou.
    const espera = window.setTimeout(() => {
      quadro = requestAnimationFrame(passo);
    }, 900);
    return () => {
      window.clearTimeout(espera);
      cancelAnimationFrame(quadro);
    };
  }, [valor, ligado]);
  return atual;
}

/* Confete: 40 peças que caem pela tela inteira em ondas, com posição,
   atraso, giro e deriva próprios, e somem. Do início ao fim são 5 s no
   máximo (0,4 s de espera + até 1,6 s de atraso + 3 s de queda): acima disso
   a WCAG 2.2.2 exigiria um botão de pausa. Não pisca e não se repete sozinho
   (2.3.1); tocar no troféu lança de novo. */
const PECAS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 37) % 100,
  atraso: ((i * 53) % 1600) / 1000,
  giro: ((i * 71) % 540) - 270,
  deriva: ((i * 29) % 80) - 40,
}));

function Confete() {
  return (
    <div className="conclusao__confete" aria-hidden="true">
      {PECAS.map((peca, i) => (
        <span
          key={i}
          style={{
            '--x': `${peca.x}%`,
            '--atraso': `${peca.atraso}s`,
            '--giro': `${peca.giro}deg`,
            '--deriva': `${peca.deriva}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Bola de futebol simples, no traço dos ícones do lucide. */
function BolaPequena(props) {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5l4.3 3.1-1.6 5h-5.4l-1.6-5z" fill="currentColor" />
    </svg>
  );
}

/** Tela de conclusão. No jogo, a bola ou o foguete do tema chega voando até o
 *  troféu, que entra com um pulo; depois os pontos sobem e o confete cai.
 *  Tocar no troféu comemora de novo. Com o efeito desligado (ajuste do jogo)
 *  ou com movimento reduzido, tudo aparece parado. */
export function ConclusaoAtividade({ acertos, total, assunto, acoes, aviso, tema, comemorar = true }) {
  const [titulo, texto] = mensagem(acertos, total, assunto);
  const [rodada, setRodada] = useState(0);
  const pontos = usarContagem(acertos * PONTOS_POR_ACERTO, comemorar);
  const Voador = tema === 'futebol' ? BolaPequena : tema === 'espaco' ? Rocket : null;

  return (
    <div className={`conclusao${comemorar ? ' conclusao--festa' : ''}`}>
      {comemorar && <Confete key={rodada} />}

      <div className="conclusao__palco">
        {comemorar && Voador && (
          <Voador key={`voo-${rodada}`} aria-hidden="true" className="conclusao__voo" />
        )}
        <button
          type="button"
          className="conclusao__trofeu-botao"
          onClick={() => setRodada((n) => n + 1)}
          disabled={!comemorar}
        >
          <span className="conclusao__brilho" aria-hidden="true" key={`brilho-${rodada}`} />
          <Trophy aria-hidden="true" className="conclusao__trofeu" key={`trofeu-${rodada}`} />
          <span className="apenas-leitor">Comemorar de novo</span>
        </button>
      </div>
      <h1 className="conclusao__titulo">Parabéns!</h1>
      <p className="conclusao__subtitulo">Você concluiu a atividade!</p>

      <div className="conclusao__cartao">
        <dl className="conclusao__numeros">
          <div>
            <dt>
              <Star aria-hidden="true" className="pontos__estrela" />
              <span>pontos</span>
            </dt>
            {/* O leitor de tela recebe o valor final, não a contagem. */}
            <dd>
              <span aria-hidden="true">{pontos}</span>
              <span className="apenas-leitor">{acertos * PONTOS_POR_ACERTO}</span>
            </dd>
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
