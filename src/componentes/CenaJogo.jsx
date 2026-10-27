/* Cena do jogo em SVG (só desenho). O SVG é aria-hidden: tudo o que acontece
   na cena também está escrito na tela e é anunciado.

   Estilo plano, sem fotorrealismo (G13), com tons frios e um único acento
   quente, as luvas, fora do centro (G12).

   Regras de movimento:
   1. a bola só se move depois da resposta confirmada (G03);
   2. o goleiro pula sempre para a ponta oposta ao canto escolhido, então
      acerto é sempre gol (G02);
   3. no erro a bola passa por cima do gol, nunca vai para a mão do goleiro (G04);
   4. enquanto a criança lê, o goleiro só balança devagar.

   Tudo é transition/animation, e o base.css zera os dois quando o movimento
   reduzido está ligado (G09). */

/* O alvo do meio fica mais alto que os laterais, abaixo do travessão (y=42). */
export const CANTOS = [
  { x: 96, y: 80 },
  { x: 160, y: 62 },
  { x: 224, y: 80 },
];

const REPOUSO = { x: 160, y: 156 };
const ALTURA_POR_CIMA = 20;

/** Linha do gol: é onde o goleiro tem os pés. */
const LINHA_DO_GOL = 128;

export function CenaJogo({ tema, canto, fase, resultado, comemorar, sobreposicao }) {
  const mirou = canto !== null && canto !== undefined;
  const mostrandoResultado = fase === 'resultado' && mirou;
  const foiGol = mostrandoResultado && resultado === 'acerto';

  let bola = REPOUSO;
  if (mostrandoResultado) {
    bola = foiGol ? CANTOS[canto] : { x: CANTOS[canto].x, y: ALTURA_POR_CIMA };
  }

  // Sempre a ponta oposta à escolhida (regra 2 acima).
  const ladoDoPulo = mostrandoResultado ? (canto === 2 ? -1 : 1) : 0;
  const guardiao = {
    x: mostrandoResultado ? CANTOS[canto === 2 ? 0 : 2].x : 160,
    y: mostrandoResultado ? LINHA_DO_GOL - 12 : LINHA_DO_GOL,
    giro: ladoDoPulo * 24,
  };

  /* A bola encolhe ao entrar, para dar a ideia de profundidade da rede. */
  const escalaDaBola = foiGol ? 0.78 : 1;

  return (
    <div
      className="jogo__cena"
      data-tema={tema}
      data-resultado={mostrandoResultado ? resultado : undefined}
    >
      <svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">
        {tema === 'futebol' ? <Campo /> : <Quadra />}

        <g
          className="jogo__guardiao"
          transform={`translate(${guardiao.x} ${guardiao.y}) rotate(${guardiao.giro})`}
        >
          <g className="jogo__guardiao-espera">
            <Guardiao />
          </g>
        </g>

        {/* Balanço da rede no gol: efeito visual do acerto (G08). */}
        {foiGol && comemorar && (
          <g className="jogo__balanco" transform={`translate(${bola.x} ${bola.y})`}>
            <circle r="14" />
            <circle r="22" />
          </g>
        )}

        {/* Marca do canto escolhido, visível até o fim da rodada. */}
        {mirou && (
          <g className="jogo__mira" transform={`translate(${CANTOS[canto].x} ${CANTOS[canto].y})`}>
            <circle r="16" />
            <path d="M -7 0 H 7 M 0 -7 V 7" />
          </g>
        )}

        <g
          className="jogo__movel"
          transform={`translate(${bola.x} ${bola.y}) scale(${escalaDaBola})`}
        >
          {tema === 'futebol' ? <Bola /> : <Disco />}
        </g>
      </svg>

      {/* O resultado aparece no centro da cena, com o botão de seguir junto. */}
      {sobreposicao && <div className="jogo__aviso-cena">{sobreposicao}</div>}
    </div>
  );
}

/* --- Goleiro --------------------------------------------------------------
      Desenhado com a origem nos pés e reduzido por `scale` para ocupar cerca
      de três quartos da altura do gol. */
function Guardiao() {
  return (
    <g transform="scale(0.82)">
      {/* sombra na linha do gol */}
      <ellipse className="jogo-g__sombra" cx="0" cy="0" rx="21" ry="3.5" />

      {/* chuteiras, pernas abertas na postura de espera */}
      <rect className="jogo-g__calcado" x="-20" y="-6" width="14" height="6" rx="3" />
      <rect className="jogo-g__calcado" x="6" y="-6" width="14" height="6" rx="3" />
      {/* meiões */}
      <rect className="jogo-g__meiao" x="-16" y="-18" width="8" height="13" rx="3" />
      <rect className="jogo-g__meiao" x="8" y="-18" width="8" height="13" rx="3" />
      {/* pernas */}
      <rect className="jogo-g__pele" x="-15" y="-30" width="8" height="14" rx="3" />
      <rect className="jogo-g__pele" x="7" y="-30" width="8" height="14" rx="3" />
      {/* calção, com o corte entre as pernas */}
      <path className="jogo-g__calcao" d="M -16 -38 H 16 V -25 H 5 V -29 H -5 V -25 H -16 Z" />

      {/* camisa */}
      <rect className="jogo-g__camisa" x="-16" y="-60" width="32" height="25" rx="7" />
      <rect className="jogo-g__camisa-faixa" x="-16" y="-52" width="32" height="5" />
      <path className="jogo-g__camisa-gola" d="M -6 -60 H 6 L 3 -55 H -3 Z" />

      {/* Braços abertos para os lados, para não esconder o alvo do meio. */}
      <path className="jogo-g__manga" d="M -14 -56 L -27 -58" />
      <path className="jogo-g__manga" d="M 14 -56 L 27 -58" />
      <path className="jogo-g__pele-traco" d="M -27 -58 L -35 -50" />
      <path className="jogo-g__pele-traco" d="M 27 -58 L 35 -50" />

      {/* luvas: o único elemento quente da cena */}
      <g transform="translate(-37 -48) rotate(-22)">
        <rect className="jogo-g__luva" x="-5.5" y="-7" width="11" height="14" rx="4.5" />
      </g>
      <g transform="translate(37 -48) rotate(22)">
        <rect className="jogo-g__luva" x="-5.5" y="-7" width="11" height="14" rx="4.5" />
      </g>

      {/* pescoço e cabeça */}
      <rect className="jogo-g__pele" x="-4.5" y="-66" width="9" height="8" rx="2" />
      <circle className="jogo-g__pele" cx="0" cy="-72" r="9" />
      <path
        className="jogo-g__cabelo"
        d="M -9 -73 A 9 9 0 0 1 9 -73 Q 4.5 -78 0 -77 Q -4.5 -78 -9 -73 Z"
      />
      <circle className="jogo-g__olho" cx="-3.4" cy="-71" r="1.5" />
      <circle className="jogo-g__olho" cx="3.4" cy="-71" r="1.5" />
    </g>
  );
}

/* --- Bola ----------------------------------------------------------------
      Bola desenhada em vetor (gomo central, gomos da borda, costuras e brilho).
      Raio 20, reduzida por `scale`. */
function Bola() {
  const raioGomoCentral = 7;
  const anguloVertices = [-90, -18, 54, 126, 198];
  const anguloGomosBorda = [-54, 18, 90, 162, 234];

  return (
    <g className="jogo__bola" transform="scale(0.45)">
      <defs>
        <clipPath id="recorte-bola">
          <circle r="20" />
        </clipPath>
        {/* Brilho no alto à esquerda, para o círculo parecer uma esfera. */}
        <radialGradient id="brilho-bola" cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#f1f5f6" />
          <stop offset="100%" stopColor="#c9d6d9" />
        </radialGradient>
      </defs>

      <circle className="jogo-b__couro" r="20" fill="url(#brilho-bola)" />

      <g clipPath="url(#recorte-bola)">
        <g className="jogo-b__costura">
          {anguloVertices.map((grau) => {
            const rad = (grau * Math.PI) / 180;
            return (
              <line
                key={grau}
                x1={(raioGomoCentral * Math.cos(rad)).toFixed(2)}
                y1={(raioGomoCentral * Math.sin(rad)).toFixed(2)}
                x2={(21 * Math.cos(rad)).toFixed(2)}
                y2={(21 * Math.sin(rad)).toFixed(2)}
              />
            );
          })}
        </g>

        <polygon className="jogo-b__gomo" points={pentagono(0, 0, raioGomoCentral, -90)} />

        {/* Gomos da borda com centro em 24 e raio 8, para sobrar o anel branco
           entre eles e o gomo do meio. */}
        {anguloGomosBorda.map((grau) => {
          const rad = (grau * Math.PI) / 180;
          return (
            <polygon
              key={grau}
              className="jogo-b__gomo"
              points={pentagono(24 * Math.cos(rad), 24 * Math.sin(rad), 8, grau + 180)}
            />
          );
        })}
      </g>

      <circle className="jogo-b__contorno" r="20" />
    </g>
  );
}

/** Pontos de um pentágono regular, para o `points` de um `<polygon>`. */
function pentagono(cx, cy, raio, rotacaoGraus) {
  return Array.from({ length: 5 }, (_, indice) => {
    const rad = ((rotacaoGraus + indice * 72) * Math.PI) / 180;
    return `${(cx + raio * Math.cos(rad)).toFixed(2)},${(cy + raio * Math.sin(rad)).toFixed(2)}`;
  }).join(' ');
}

/** Versão do tema neutro: um disco. */
function Disco() {
  return (
    <g className="jogo__bola">
      <rect className="jogo-b__couro" x="-9" y="-9" width="18" height="18" rx="5" />
      <rect className="jogo-b__gomo" x="-4.5" y="-4.5" width="9" height="9" rx="2.5" />
      <rect className="jogo-b__contorno" x="-9" y="-9" width="18" height="18" rx="5" />
    </g>
  );
}

/* --- Tema futebol --------------------------------------------------------
      Campo, pequena área, gol com rede e marca do pênalti. Fundo liso, sem
      torcida nem placar (G10). */
function Campo() {
  return (
    <g className="jogo__palco">
      <rect className="jogo__ceu" x="0" y="0" width="320" height="124" />
      <rect className="jogo__gramado" x="0" y="118" width="320" height="62" />

      {/* rede: fundo mais escuro que o céu, para a malha branca aparecer */}
      <path className="jogo__rede-fundo" d="M 62 52 H 258 V 122 H 62 Z" />
      <path className="jogo__rede-lateral" d="M 46 42 L 62 52 V 122 L 46 128 Z" />
      <path className="jogo__rede-lateral" d="M 274 42 L 258 52 V 122 L 274 128 Z" />
      <path className="jogo__rede-topo" d="M 46 42 L 62 52 H 258 L 274 42 Z" />

      <g className="jogo__malha">
        {[74, 86, 98, 110, 122, 134, 146, 158, 170, 182, 194, 206, 218, 230, 242].map((x) => (
          <line key={`v${x}`} x1={x} y1="52" x2={x} y2="122" />
        ))}
        {[64, 76, 88, 100, 112].map((y) => (
          <line key={`h${y}`} x1="62" y1={y} x2="258" y2={y} />
        ))}
      </g>

      {/* A pequena área fica abaixo da linha do gol (y=128). */}
      <path className="jogo__linha-campo" d="M 24 174 L 56 140 H 264 L 296 174" />

      {/* trave desenhada por último, por cima da rede */}
      <path className="jogo__trave" d="M 46 128 V 42 H 274 V 128" />

      <ellipse className="jogo__marca-penalti" cx="160" cy="162" rx="7" ry="2.4" />
    </g>
  );
}

/* --- Tema neutro ---------------------------------------------------------
      Mesma estrutura, sem esporte: um quadro com três alvos (G07). */
function Quadra() {
  return (
    <g className="jogo__palco">
      <rect className="jogo__ceu" x="0" y="0" width="320" height="124" />
      <rect className="jogo__gramado" x="0" y="118" width="320" height="62" />

      <rect className="jogo__rede-fundo" x="46" y="42" width="228" height="86" rx="8" />

      {CANTOS.map((posicao) => (
        <g key={posicao.x}>
          <circle className="jogo__lugar" cx={posicao.x} cy={posicao.y} r="17" />
          <circle className="jogo__lugar-centro" cx={posicao.x} cy={posicao.y} r="6" />
        </g>
      ))}

      <path className="jogo__linha-campo" d="M 24 174 L 56 140 H 264 L 296 174" />
      <rect className="jogo__trave" x="46" y="42" width="228" height="86" rx="8" />
      <ellipse className="jogo__marca-penalti" cx="160" cy="162" rx="7" ry="2.4" />
    </g>
  );
}
