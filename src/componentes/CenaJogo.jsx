/* =========================================================================
   Cena do jogo — desenho, e só desenho.

   O SVG inteiro é `aria-hidden`: tudo que acontece aqui já está dito em texto
   na tela e anunciado na região de status. Quem usa leitor de tela joga o jogo
   completo sem depender de nada deste arquivo.

   ---------------------------------------------------------------------------
   POR QUE O DESENHO É ASSIM, E NÃO FOTORREALISTA
   ---------------------------------------------------------------------------
   O pedido foi "mais real". A pesquisa diz onde investir esse realismo e onde
   ele trabalha contra:

   · **Estilo plano e caricato, não fotorrealista** (RN11/G13). Crianças
     autistas apresentam orientação social reduzida diante de estímulo
     realista, mas não diante de estímulo em desenho — a diferença some quando
     o material é caricato. E o estudo de design de jogo para autismo que
     prescreve estilo o faz explicitamente: *simple, cartoon, flat design
     style*.

     Então o que ficou "mais real" foi a **legibilidade**: o goleiro tem
     uniforme, luvas, chuteiras e postura de espera; o gol tem rede com
     profundidade, trave e pequena área; a bola tem gomos e costuras. O que NÃO
     entrou foi textura, sombra realista, torcida e rosto expressivo — isso é
     detalhe que compete com o enunciado (G10).

   · **Cor faz diferença, e não é enfeite** (RN11/G12). Tom frio, alta
     luminosidade e alta saturação são o que atrai a atenção da criança autista,
     na proporção aproximada de 7 partes frias para 3 quentes, com o acento
     saturado fora do centro visual. Por isso o campo é verde, o uniforme é o
     teal da marca, e o único quente da cena são as **luvas** — que ficam nas
     mãos, longe do centro, e marcam justamente o lugar onde a defesa
     aconteceria.

     Imagem colorida é cerca de duas vezes mais eficaz que preto e branco para
     essa população. A primeira versão desta cena era um contorno escuro sobre
     cinza claro: legível, e abaixo do que a literatura recomenda.

     Amarelo ficou de fora de propósito: é a cor que crianças autistas rejeitam
     mais que as demais, atribuída a sobrecarga sensorial. Ele só aparece no
     modo de alto contraste, que é o esquema do e-MAG e é escolha explícita de
     quem liga.

   As fontes de cada afirmação estão em
   `Entrega-14-09/mecanica-atividade-gamificada.md`, seção 7.

   ---------------------------------------------------------------------------
   AS QUATRO REGRAS DE MOVIMENTO
   ---------------------------------------------------------------------------
   1. **A bola nunca se move antes da resposta confirmada** (G03). Movimento
      enquanto se lê o enunciado comunica urgência, e pressão de tempo é item
      explícito de evitar no perfil.
   2. **O goleiro pula sempre para o lado contrário ao escolhido**, por cálculo
      determinístico (G02). O canto escolhido está sempre aberto, e a regra do
      jogo fica visível: quem decide o gol é a resposta, não a sorte.

      A primeira versão usava `(canto + 1) % 3`, que também garantia canto
      aberto — mas, para quem mirava à esquerda, mandava o goleiro do centro
      para o centro, e ele parecia não ter saído do lugar. Pular sempre para a
      ponta oposta é igualmente determinístico e, além disso, visível.
   3. **No erro a bola vai por cima, nunca para a mão do goleiro** (G04). Bola
      alta é chute a ajustar; defesa é o goleiro ganhar da criança. A diferença
      parece pequena no desenho e é a coisa toda no que a criança entende.
   4. **A espera tem vida, sem ter pressa.** O goleiro balança devagar enquanto
      a criança lê. Tela completamente estática perde a atenção e favorece
      comportamento estereotipado; o que não pode existir é elemento que
      comunique tempo correndo. Balanço lento de três segundos não é cronômetro.

   Tudo é `transition` e `animation`, e a raiz do documento zera as duas quando
   a preferência de movimento está em "reduzido" ou quando o sistema pede
   movimento reduzido (ver base.css). A cena obedece a G09 e ao SC 2.3.3 sem ter
   uma linha de código sobre o assunto.
   ========================================================================= */

/* O alvo do meio fica mais alto que os laterais — é por cima do goleiro que se
   chuta no meio — mas não tão alto que encoste no travessão, que está em y=42.
   Alvo saindo para fora do gol lê como defeito de desenho, não como jogada. */
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

  // Ver regra 2 no cabeçalho: sempre a ponta oposta à escolhida.
  const ladoDoPulo = mostrandoResultado ? (canto === 2 ? -1 : 1) : 0;
  const guardiao = {
    x: mostrandoResultado ? CANTOS[canto === 2 ? 0 : 2].x : 160,
    y: mostrandoResultado ? LINHA_DO_GOL - 12 : LINHA_DO_GOL,
    giro: ladoDoPulo * 24,
  };

  /* A bola encolhe ao entrar no gol: ela vai para o fundo da rede, e sem isso a
     profundidade que a rede desenha some no momento em que mais importa. */
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

        {/* Balanço da rede no gol: reconhecimento visual do acerto, curto e
            silencioso. Ver G08 em requisitos.md §4.1 — a literatura mostra que
            criança autista responde melhor a recompensa em forma de animação
            que a contador numérico, e por isso esta vem ligada; o que fica
            desligado por padrão é o efeito intenso e o som. */}
        {foiGol && comemorar && (
          <g className="jogo__balanco" transform={`translate(${bola.x} ${bola.y})`}>
            <circle r="14" />
            <circle r="22" />
          </g>
        )}

        {/* Marca do canto escolhido. Entra assim que a criança mira e fica até o
            fim da cobrança: ela não precisa lembrar onde mirou (H6). Desenhada
            depois do goleiro para nunca ficar por baixo do boneco. */}
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

      {/* O que aconteceu é dito NO lugar onde aconteceu. Antes, o resultado do
          erro aparecia num aviso abaixo da lista de alternativas: a criança via
          a bola sair e precisava procurar o texto no rodapé da tela para saber
          o que fazer. Dizer no centro da cena e pôr o botão ali junto elimina
          essa procura — e transição curta entre estados do jogo é, ela mesma,
          recomendação da literatura para manter a atenção. */}
      {sobreposicao && <div className="jogo__aviso-cena">{sobreposicao}</div>}
    </div>
  );
}

/* --- Goleiro --------------------------------------------------------------
   Construído com a origem nos pés, crescendo para cima, e reduzido por
   `scale` para ocupar cerca de três quartos da altura do gol — que é a
   proporção real entre um goleiro adulto e uma trave.                       */
function Guardiao() {
  return (
    <g transform="scale(0.82)">
      {/* sombra: aterra a figura na linha do gol. Não é enfeite — sem ela o
          boneco flutua sobre a grama e a cena perde o chão. */}
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

      {/* Braços na postura de espera do goleiro: ombro → cotovelo aberto →
          punho um pouco abaixo da altura do ombro. Ficam ABERTOS para os
          lados, e não levantados acima da cabeça, porque é isso que mantém o
          alvo do meio visível antes do pulo. */}
      <path className="jogo-g__manga" d="M -14 -56 L -27 -58" />
      <path className="jogo-g__manga" d="M 14 -56 L 27 -58" />
      <path className="jogo-g__pele-traco" d="M -27 -58 L -35 -50" />
      <path className="jogo-g__pele-traco" d="M 27 -58 L 35 -50" />

      {/* luvas: único elemento quente da cena, nas mãos, fora do centro
          visual — e no lugar exato onde a defesa aconteceria */}
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
   Bola de futebol de verdade, desenhada em vetor: gomo central, cinco gomos
   na borda, costuras e um brilho que dá volume à esfera.

   Por que não uma FOTO de bola, que seria mais fácil:

   · **Licença.** Foto de banco de imagem tem dono, e o trabalho declara em
     RN07 que não redistribui material de terceiros. Desenho nosso não tem
     esse problema.
   · **Arquivo único offline.** O protótipo precisa abrir por duplo clique,
     sem servidor: toda imagem vai embutida em base64 e engorda o arquivo que
     é levado no pendrive e anexado por e-mail. O vetor custa cerca de 1 KB.
   · **Coerência com o resto da cena** (G13). Uma bola fotográfica ao lado de
     um goleiro de traço plano ficaria colada, e a literatura de jogo para TEA
     é explícita em recomendar estilo plano e caricato — não fotorrealismo.
   · **Nitidez.** Vetor não pixeliza em tela grande nem no zoom de 200% que a
     WCAG exige (SC 1.4.4). Foto pixeliza.

   Desenhada com raio 20 e reduzida por `scale`: os números ficam legíveis e a
   geometria do pentágono, calculável.                                       */
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
        {/* O brilho fora do centro é o que faz o círculo ler como esfera, e
            não como adesivo. Fica no alto à esquerda, como a luz de um campo. */}
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

        {/* Os gomos da borda ficam quase todos FORA do disco visível: numa bola
            real, entre o gomo do meio e os da borda existe um anel branco (os
            hexágonos). Centro em 24 e raio 8 deixa esse anel livre — a 19 eles
            se encontravam no meio do caminho e a bola virava uma massa escura
            com uma estrela branca no meio. */}
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

/** Versão do tema neutro: um disco, sem metáfora de esporte nenhum. */
function Disco() {
  return (
    <g className="jogo__bola">
      <rect className="jogo-b__couro" x="-9" y="-9" width="18" height="18" rx="5" />
      <rect className="jogo-b__gomo" x="-4.5" y="-4.5" width="9" height="9" rx="2.5" />
      <rect className="jogo-b__contorno" x="-9" y="-9" width="18" height="18" rx="5" />
    </g>
  );
}

/* --- Pele "futebol" -------------------------------------------------------
   Campo, pequena área, gol com rede em profundidade e marca do pênalti.
   O fundo é liso de propósito: sem arquibancada, sem torcida, sem placar de
   estádio. Cada um desses seria detalhe sedutor — atraente, irrelevante ao
   conteúdo, e com efeito negativo medido sobre compreensão (G10).           */
function Campo() {
  return (
    <g className="jogo__palco">
      <rect className="jogo__ceu" x="0" y="0" width="320" height="124" />
      <rect className="jogo__gramado" x="0" y="118" width="320" height="62" />

      {/* rede: painel de fundo mais escuro que o céu, para a malha branca ler */}
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

      {/* A pequena área fica ABAIXO da linha do gol (y=128), senão o traço
          horizontal some atrás da própria trave e sobram duas diagonais
          soltas na grama. */}
      <path className="jogo__linha-campo" d="M 24 174 L 56 140 H 264 L 296 174" />

      {/* trave: posta por último entre os elementos do gol, para ficar por cima
          da rede, como na vida real */}
      <path className="jogo__trave" d="M 46 128 V 42 H 274 V 128" />

      <ellipse className="jogo__marca-penalti" cx="160" cy="162" rx="7" ry="2.4" />
    </g>
  );
}

/* --- Pele neutra ----------------------------------------------------------
   Mesma estrutura, sem esporte: um quadro com três lugares para acertar. Tema
   é preferência, não estrutura (G07) — interesse circunscrito motiva quando é
   o interesse daquela criança, e futebol fixo engajaria quem gosta de futebol
   e perderia o resto da turma.                                              */
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
