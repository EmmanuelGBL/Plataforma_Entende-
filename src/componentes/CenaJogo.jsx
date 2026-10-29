import { MousePointerClick } from 'lucide-react';

/* Cena do jogo: desenho em SVG (aria-hidden) com as áreas de mira por cima,
   que são botões de verdade. Tudo o que acontece na cena também está escrito
   na tela e é anunciado.

   Estilo plano, sem fotorrealismo (G13), com tons frios e um único acento
   quente fora do centro (G12): as luvas do goleiro no futebol, a chama do
   foguete no espaço.

   Os dois temas têm as mesmas cinco áreas, no mesmo lugar, e a mesma ordem
   de turno (G01); muda só o desenho (G07).

   Regras de movimento:
   1. o objeto (bola ou foguete) só se move depois da resposta (G03);
   2. no futebol o goleiro pula sempre para o lado oposto ao escolhido, então
      acerto é sempre gol (G02);
   3. no erro o objeto passa por cima do alvo, nunca é defendido (G04);
   4. enquanto a criança lê, a cena fica parada, só o goleiro balança devagar.

   Tudo é transition/animation, e o base.css zera os dois quando o movimento
   reduzido está ligado (G09). */

/** As cinco áreas, em unidades do viewBox (320 × 180): o centro (onde o
 *  objeto chega) e o retângulo clicável. A do meio ocupa a coluna inteira. */
export const ZONAS = [
  { x: 95, y: 68, area: [62, 52, 66, 35] },
  { x: 95, y: 105, area: [62, 87, 66, 35] },
  { x: 160, y: 70, area: [128, 52, 64, 70] },
  { x: 225, y: 68, area: [192, 52, 66, 35] },
  { x: 225, y: 105, area: [192, 87, 66, 35] },
];

const LARGURA = 320;
const ALTURA = 180;
/* Diâmetro do círculo de mira, igual nas cinco áreas (unidades da cena). No
   espaço ele envolve o planeta (raio 13), com folga. */
const DIAMETRO_MIRA = { futebol: 30, espaco: 36 };
/* Ponto de partida: a marca do pênalti, ou a base de lançamento. */
const REPOUSO = { futebol: { x: 160, y: 156 }, espaco: { x: 160, y: 164 } };
/* Altura onde o objeto passa no erro: acima da trave, ou acima dos planetas. */
const ALTURA_POR_CIMA = { futebol: 16, espaco: 36 };
const RAIO_PLANETA = 13;

/** Linha do gol: é onde o goleiro tem os pés. */
const LINHA_DO_GOL = 128;

const porcento = (valor, total) => `${((valor / total) * 100).toFixed(3)}%`;

export function CenaJogo({
  tema,
  canto,
  fase,
  resultado,
  comemorar,
  cantos,
  convite,
  aoMirar,
  sobreposicao,
}) {
  const espaco = tema !== 'futebol';
  const mirou = canto !== null && canto !== undefined;
  const mostrandoResultado = fase === 'resultado' && mirou;
  const acertou = mostrandoResultado && resultado === 'acerto';
  const zona = mirou ? ZONAS[canto] : null;

  /* Onde o objeto para: no alvo, no acerto; acima dele, no erro. O foguete
     pousa em cima do planeta. */
  let objeto = espaco ? REPOUSO.espaco : REPOUSO.futebol;
  if (mostrandoResultado) {
    if (!acertou) objeto = { x: zona.x, y: espaco ? ALTURA_POR_CIMA.espaco : ALTURA_POR_CIMA.futebol };
    else objeto = espaco ? { x: zona.x, y: zona.y - RAIO_PLANETA + 1 } : zona;
  }
  /* O objeto encolhe ao chegar, para dar a ideia de distância. */
  const escala = acertou ? (espaco ? 0.7 : 0.78) : 1;

  // Goleiro: sempre o lado oposto ao escolhido (regra 2).
  const ladoEscolhido = mirou ? Math.sign(zona.x - 160) || -1 : 0;
  const guardiao = {
    x: mostrandoResultado ? 160 - ladoEscolhido * 65 : 160,
    y: mostrandoResultado ? LINHA_DO_GOL - 12 : LINHA_DO_GOL,
    giro: mostrandoResultado ? -ladoEscolhido * 24 : 0,
  };

  return (
    <div
      className="jogo__cena"
      data-tema={espaco ? 'espaco' : 'futebol'}
      data-fase={fase}
      data-resultado={mostrandoResultado ? resultado : undefined}
    >
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} aria-hidden="true" focusable="false">
        {espaco ? <Espaco destacado={mirou ? canto : null} /> : <Campo />}

        {!espaco && (
          <g
            className="jogo__guardiao"
            style={{
              transform: `translate(${guardiao.x}px, ${guardiao.y}px) rotate(${guardiao.giro}deg)`,
            }}
          >
            <g className="jogo__guardiao-espera">
              <Guardiao />
            </g>
          </g>
        )}

        {/* Efeito visual do acerto (G08): a rede balança ou o planeta brilha. */}
        {acertou && comemorar && (
          <g className="jogo__balanco" transform={`translate(${zona.x} ${zona.y})`}>
            <circle r="14" />
            <circle r="22" />
          </g>
        )}

        {/* Marca da área escolhida, visível até o fim da rodada. */}
        {mirou && (
          <g className="jogo__mira" transform={`translate(${zona.x} ${zona.y})`}>
            <circle r={espaco ? 18 : 16} />
            {/* No espaço a cruz taparia o planeta: fica só o anel. */}
            {!espaco && <path d="M -7 0 H 7 M 0 -7 V 7" />}
          </g>
        )}

        <g
          className="jogo__movel"
          data-em-voo={mostrandoResultado ? 'sim' : undefined}
          style={{ transform: `translate(${objeto.x}px, ${objeto.y}px) scale(${escala})` }}
        >
          {espaco ? <Foguete /> : <Bola />}
        </g>

        {/* Bandeirinha no planeta onde o foguete pousou. */}
        {acertou && espaco && (
          <g className="jogo__bandeira" transform={`translate(${zona.x + 9} ${zona.y - 8})`}>
            <path d="M 0 0 V -12" />
            <path d="M 0 -12 L 8 -9 L 0 -6 Z" />
          </g>
        )}
      </svg>

      {/* Áreas de mira: botões sobre o desenho, na mesma ordem para o teclado
          (esquerda em cima, esquerda embaixo, meio, direita em cima, direita
          embaixo). Só existem enquanto a criança escolhe. */}
      {fase === 'mirar' && (
        <>
          <p className="jogo__convite">
            <MousePointerClick aria-hidden="true" />
            {convite}
          </p>
          <ul className="jogo__zonas" aria-label={convite}>
            {ZONAS.map(({ x: alvoX, y: alvoY, area: [x, y, largura, altura] }, posicao) => (
              <li key={cantos[posicao]}>
                <button
                  type="button"
                  className="jogo__zona"
                  style={{
                    left: porcento(x, LARGURA),
                    top: porcento(y, ALTURA),
                    width: porcento(largura, LARGURA),
                    height: porcento(altura, ALTURA),
                    // O círculo fica no ponto-alvo da zona (onde a bola chega e
                    // onde o planeta é desenhado), em % da área de clique.
                    '--diametro': porcento(DIAMETRO_MIRA[espaco ? 'espaco' : 'futebol'], altura),
                    '--centro-x': porcento(alvoX - x, largura),
                    '--centro-y': porcento(alvoY - y, altura),
                  }}
                  onClick={() => aoMirar(posicao)}
                >
                  <span className="apenas-leitor">{cantos[posicao]}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {sobreposicao}
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

      {/* Braços abertos para os lados. */}
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

/* --- Foguete ---------------------------------------------------------------
      Origem na base, no centro: é o ponto que encosta no planeta. A chama só
      aparece durante o voo. */
function Foguete() {
  return (
    <g className="jogo__foguete">
      <path className="jogo-f__chama" d="M -3.5 0 Q 0 9 3.5 0 Z" />
      <path className="jogo-f__aleta" d="M -5 -4 L -9 1 L -5 -1 Z" />
      <path className="jogo-f__aleta" d="M 5 -4 L 9 1 L 5 -1 Z" />
      <path className="jogo-f__corpo" d="M -5 0 V -14 Q -5 -22 0 -26 Q 5 -22 5 -14 V 0 Z" />
      <path className="jogo-f__ponta" d="M -4.2 -18 Q -3.6 -23 0 -26 Q 3.6 -23 4.2 -18 Z" />
      <circle className="jogo-f__janela" cx="0" cy="-11" r="2.6" />
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

/* --- Tema espaço (o neutro, padrão) --------------------------------------
      Céu claro com poucas estrelas de baixo contraste (G10, G12), cinco
      planetas no lugar das cinco áreas e a base de lançamento embaixo. Sem
      adversário: ninguém defende, o foguete só precisa da resposta certa. */
const PLANETAS = ['a', 'b', 'c', 'd', 'e'];
const ESTRELAS = [
  [24, 22], [58, 140], [118, 26], [204, 30], [292, 24], [300, 118], [20, 96], [270, 150],
  [140, 118], [184, 132],
];

function Espaco({ destacado }) {
  return (
    <g className="jogo__palco">
      <rect className="jogo__ceu" x="0" y="0" width="320" height="180" />

      <g className="jogo__estrelas">
        {ESTRELAS.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M ${x} ${y - 3} L ${x + 1} ${y - 1} L ${x + 3} ${y} L ${x + 1} ${y + 1} L ${x} ${y + 3} L ${x - 1} ${y + 1} L ${x - 3} ${y} L ${x - 1} ${y - 1} Z`} />
        ))}
      </g>

      {ZONAS.map(({ x, y }, posicao) => (
        <g
          key={PLANETAS[posicao]}
          className={`jogo__planeta jogo__planeta--${PLANETAS[posicao]}`}
          data-destacado={destacado === posicao ? 'sim' : undefined}
          transform={`translate(${x} ${y})`}
        >
          <circle r={RAIO_PLANETA} />
          {/* Detalhe plano de cada planeta: faixa, cratera ou anel. */}
          {posicao === 0 && <path className="jogo__planeta-detalhe" d="M -12 -4 Q 0 -1 12 -4 V 0 Q 0 3 -12 0 Z" />}
          {posicao === 1 && <circle className="jogo__planeta-detalhe" cx="-4" cy="3" r="3" />}
          {posicao === 2 && <ellipse className="jogo__planeta-anel" rx="21" ry="5" transform="rotate(-12)" />}
          {posicao === 3 && <circle className="jogo__planeta-detalhe" cx="4" cy="-3" r="4" />}
          {posicao === 4 && <path className="jogo__planeta-detalhe" d="M -12 3 Q 0 6 12 3 V 6 Q 0 9 -12 6 Z" />}
        </g>
      ))}

      {/* base de lançamento */}
      <path className="jogo__base" d="M 140 164 H 180 L 174 170 H 146 Z" />
    </g>
  );
}
