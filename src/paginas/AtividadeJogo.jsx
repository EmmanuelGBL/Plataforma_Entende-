import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, House, Lightbulb, Play, RotateCcw, Settings } from 'lucide-react';
import { Aviso, Botao } from '../componentes/basicos.jsx';
import { ConclusaoAtividade, Pontos, ProgressoPerguntas } from '../componentes/AtividadeVisual.jsx';
import { CenaJogo } from '../componentes/CenaJogo.jsx';
import { Dialogo, usarFocoPreso } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import {
  AtividadeIndisponivel,
  assuntoDaAtividade,
  usarAtividadeDoCodigo,
} from '../componentes/AtividadeAcesso.jsx';
import '../estilos/jogo.css';

/* Atividade em forma de jogo (RF21), com as questões do material (RN04)
   e sem nenhum dado do estudante (RN05). Segue as regras de desenho G01–G14
   (RN11).

   A cena é a peça principal. Cada rodada tem sempre a mesma ordem:

       mirar na cena  →  responder na janela  →  resultado na janela  →  próxima

   - a criança mira tocando numa das cinco áreas da cena;
   - a pergunta abre numa janela dentro do jogo, com a cena esmaecida atrás;
   - a dica pode ser vista antes de responder e não é contada (G11);
   - errar não tira ponto: a contagem mostra só acertos (G04, G05);
   - não há cronômetro, e a cena só se mexe depois da resposta (G03);
   - o tema padrão é o neutro (espaço); futebol é opção (G07);
   - som começa desligado e o efeito visual do acerto, ligado (G08). */

const TEMAS = {
  espaco: {
    nome: 'Viagem pelo espaço',
    convite: 'Selecione o planeta',
    instrucaoMirar: 'Escolha em qual planeta o foguete vai pousar.',
    cantos: [
      'Planeta de cima, à esquerda',
      'Planeta de baixo, à esquerda',
      'Planeta do meio',
      'Planeta de cima, à direita',
      'Planeta de baixo, à direita',
    ],
    unidade: 'Viagem',
    tituloAcerto: 'Pousou no planeta!',
    textoAcerto: 'Resposta correta.',
    tituloErro: 'Passou do planeta!',
    textoErro: 'Resposta incorreta.',
    repetir: 'Tentar de novo',
    proxima: 'Ir para a próxima viagem',
    terminar: 'Terminar a viagem',
  },
  futebol: {
    nome: 'Treino de pênalti',
    convite: 'Selecione o canto do gol',
    instrucaoMirar: 'Escolha em qual canto do gol você vai chutar.',
    cantos: [
      'Canto esquerdo, em cima',
      'Canto esquerdo, embaixo',
      'Meio do gol',
      'Canto direito, em cima',
      'Canto direito, embaixo',
    ],
    unidade: 'Cobrança',
    tituloAcerto: 'É gol!',
    textoAcerto: 'Resposta correta.',
    tituloErro: 'Chutou pra fora!',
    textoErro: 'Resposta incorreta.',
    repetir: 'Tentar de novo',
    proxima: 'Ir para a próxima cobrança',
    terminar: 'Terminar o treino',
  },
};

/* --- Ajustes do jogo -----------------------------------------------------
      Tema, som e efeito ficam no localStorage do navegador. É só preferência
      de apresentação, sem nenhum dado que identifique o estudante. */

const CHAVE_AJUSTES = 'entende-mais:jogo';

const AJUSTES_PADRAO = {
  tema: 'espaco', // G07
  som: 'desligado', // G08
  comemoracao: 'ligada', // G08
};

const OPCOES_AJUSTES = {
  tema: {
    nome: 'Tema do jogo',
    valores: [
      { valor: 'espaco', rotulo: 'Espaço' },
      { valor: 'futebol', rotulo: 'Futebol' },
    ],
  },
  som: {
    nome: 'Som',
    valores: [
      { valor: 'desligado', rotulo: 'Desligado' },
      { valor: 'ligado', rotulo: 'Ligado' },
    ],
  },
  comemoracao: {
    nome: 'Efeito quando acerta',
    valores: [
      { valor: 'ligada', rotulo: 'Ligado' },
      { valor: 'desligada', rotulo: 'Desligado' },
    ],
  },
};

function usarAjustesDoJogo() {
  const [ajustes, setAjustes] = useState(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_AJUSTES);
      const lidos = bruto ? { ...AJUSTES_PADRAO, ...JSON.parse(bruto) } : AJUSTES_PADRAO;
      // O tema neutro antigo (Alvo) foi substituído pelo espaço.
      return TEMAS[lidos.tema] ? lidos : { ...lidos, tema: AJUSTES_PADRAO.tema };
    } catch {
      // Modo anônimo ou storage bloqueado: segue no padrão, sem quebrar.
      return AJUSTES_PADRAO;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_AJUSTES, JSON.stringify(ajustes));
    } catch {
      /* ajuste não persistido; a sessão atual continua valendo */
    }
  }, [ajustes]);

  const definir = useCallback(
    (chave, valor) => setAjustes((atuais) => ({ ...atuais, [chave]: valor })),
    [],
  );

  return [ajustes, definir];
}

/* --- Som ------------------------------------------------------------------
      Duas notas curtas geradas por oscilador (Web Audio), sem arquivo de áudio.
      Só toca se o som estiver ligado e a partir de um clique. */
function usarSom(ligado) {
  const contexto = useRef(null);

  return useCallback(
    (tipo) => {
      if (!ligado) return;
      try {
        const Fabrica = window.AudioContext ?? window.webkitAudioContext;
        if (!Fabrica) return;
        if (!contexto.current) contexto.current = new Fabrica();
        const ctx = contexto.current;
        if (ctx.state === 'suspended') ctx.resume();

        const notas = tipo === 'acerto' ? [523.25, 783.99] : [196.0];
        notas.forEach((frequencia, posicao) => {
          const oscilador = ctx.createOscillator();
          const ganho = ctx.createGain();
          oscilador.type = 'sine';
          oscilador.frequency.value = frequencia;
          const inicio = ctx.currentTime + posicao * 0.13;
          ganho.gain.setValueAtTime(0.0001, inicio);
          ganho.gain.exponentialRampToValueAtTime(0.12, inicio + 0.02);
          ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.24);
          oscilador.connect(ganho).connect(ctx.destination);
          oscilador.start(inicio);
          oscilador.stop(inicio + 0.26);
        });
      } catch {
        /* navegador sem WebAudio ou com áudio bloqueado: o jogo segue mudo */
      }
    },
    [ligado],
  );
}

/** Tempo de espera antes de mostrar o resultado. Com movimento reduzido
 *  (painel Acessibilidade ou sistema operacional), a espera é zero. */
function esperaDoAviso(resultado) {
  const semMovimento =
    document.documentElement.dataset.movimento === 'reduzido' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (semMovimento) return 0;
  /* O objeto leva 700 ms para chegar (`.jogo__movel` em jogo.css); estes valores
     somam esse trajeto ao tempo de ver onde ele parou. Mudar a duração da
     animação exige mudar aqui também. */
  return resultado === 'acerto' ? 1300 : 1100;
}

/** Dica da questão (questões do servidor) ou, na demonstração, o trecho
 *  de origem. */
function textoDaDica(questao) {
  return questao.dica ? `Dica: ${questao.dica}` : `Dica: a resposta está no trecho ${questao.trecho}.`;
}

/** Janela dentro do jogo: cobre a cena com um véu e mostra a pergunta ou o
 *  resultado no meio. No celular vira uma folha presa embaixo da tela. O foco
 *  fica dentro dela enquanto está aberta. */
function JanelaDoJogo({ rotulo, tipo, aoEscape, focoInicial, children }) {
  const caixa = useRef(null);
  usarFocoPreso(caixa, true, aoEscape, focoInicial);
  // O resultado fica na base da cena, com véu leve: a criança vê onde o
  // objeto parou.
  return (
    <div className={`jogo__janela-fundo${tipo ? ' jogo__janela-fundo--resultado' : ''}`}>
      <div
        ref={caixa}
        className={`jogo__janela${tipo ? ` jogo__janela--${tipo}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={rotulo}
      >
        {children}
      </div>
    </div>
  );
}

/** Dica: aponta onde procurar, sem entregar a resposta. */
function Dica({ questao }) {
  return (
    <div className="jogo__dica">
      <p className="jogo__dica-titulo">
        <Lightbulb aria-hidden="true" />
        Dica
      </p>
      <p>
        {questao.dica ? (
          questao.dica
        ) : (
          <>
            A resposta está neste trecho do material: <strong>{questao.trecho}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

export function AtividadeJogo() {
  const { codigo } = useParams();
  const { material, valida, questoes } = usarAtividadeDoCodigo(codigo);
  const { anunciar } = usarAnuncios();
  const [ajustes, definirAjuste] = usarAjustesDoJogo();
  const [ajustesAbertos, setAjustesAbertos] = useState(false);

  /* Tema escolhido na tela de escolha (G07). Vale como preferência: fica
     guardado e pode ser trocado em "Como você quer jogar". */
  const temaEscolhido = useLocation().state?.tema;
  useEffect(() => {
    if (temaEscolhido && TEMAS[temaEscolhido]) definirAjuste('tema', temaEscolhido);
  }, [temaEscolhido, definirAjuste]);

  const chaveTema = TEMAS[ajustes.tema] ? ajustes.tema : AJUSTES_PADRAO.tema;
  const tema = TEMAS[chaveTema];
  const tocar = usarSom(ajustes.som === 'ligado');

  usarTituloDaPagina(valida ? tema.nome : 'Atividade indisponível');

  /* `ordem`: questões desta rodada. Diminui quando a criança treina só as
     que ficaram para depois. */
  const [ordem, setOrdem] = useState(() => questoes.map((_, posicao) => posicao));
  const [passo, setPasso] = useState(0);
  const [fase, setFase] = useState('mirar'); // mirar | responder | resultado | fim
  const [canto, setCanto] = useState(null);
  const [resultado, setResultado] = useState(null); // acerto | erro
  const [acertos, setAcertos] = useState(0);
  const [faltaram, setFaltaram] = useState([]);
  /* Dicas pedidas, por questão. Não são contadas em lugar nenhum (G11). */
  const [dicasPedidas, setDicasPedidas] = useState({});

  /* O resultado entra depois que o objeto chega, para a criança ver onde ele
     parou. */
  const [resultadoVisivel, setResultadoVisivel] = useState(false);
  useEffect(() => {
    if (fase !== 'resultado') {
      setResultadoVisivel(false);
      return undefined;
    }
    const temporizador = window.setTimeout(() => setResultadoVisivel(true), esperaDoAviso(resultado));
    return () => window.clearTimeout(temporizador);
  }, [fase, resultado]);

  /* Ao voltar para a mira (próxima rodada ou "Trocar"), o foco vai para a
     primeira área da cena. Na abertura do jogo, não: pareceria já escolhida. */
  const arena = useRef(null);
  const faseAnterior = useRef(fase);
  useEffect(() => {
    const vinhaDeOutraFase = faseAnterior.current !== 'mirar';
    faseAnterior.current = fase;
    if (fase === 'mirar' && vinhaDeOutraFase) {
      arena.current?.querySelector('.jogo__zona')?.focus({ preventScroll: true });
    }
  }, [fase, passo]);

  if (!valida) return <AtividadeIndisponivel />;

  if (questoes.length === 0) {
    return (
      <div className="atividade">
        <Aviso tipo="atencao" titulo="Esta atividade está sem perguntas" nivel={1}>
          <p>Peça ao seu professor para publicar a atividade de novo.</p>
        </Aviso>
      </div>
    );
  }

  const total = ordem.length;
  const indiceDaQuestao = ordem[passo];
  const questao = questoes[indiceDaQuestao];
  const dicaAberta = Boolean(dicasPedidas[questao?.id]);
  const ultima = passo === total - 1;

  function pedirDica() {
    setDicasPedidas((atuais) => ({ ...atuais, [questao.id]: true }));
    anunciar(textoDaDica(questao));
  }

  function mirar(posicao) {
    setCanto(posicao);
    setFase('responder');
    anunciar(`${tema.cantos[posicao]}. Agora responda a pergunta.`);
  }

  function trocarMira() {
    setCanto(null);
    setFase('mirar');
    anunciar(tema.instrucaoMirar);
  }

  function responder(posicao) {
    if (fase !== 'responder') return;
    const certa = posicao === questao.correta;
    setResultado(certa ? 'acerto' : 'erro');
    setFase('resultado');

    if (certa) {
      setAcertos((n) => n + 1);
      tocar('acerto');
      anunciar(`Você acertou. ${tema.tituloAcerto}`);
      return;
    }

    tocar('erro');
    // Depois do erro a dica fica aberta: aparece no resultado e na nova tentativa (G04).
    setDicasPedidas((atuais) => ({ ...atuais, [questao.id]: true }));
    anunciar(`Não foi essa. ${tema.tituloErro}. Leia a dica e tente de novo, ou vá para a próxima.`);
  }

  /** Nova tentativa na mesma rodada: volta para a pergunta com a mesma mira
   *  e com todas as alternativas, na mesma ordem. */
  function tentarDeNovo() {
    setResultado(null);
    setFase('responder');
    anunciar('Tente de novo. A pergunta e as alternativas são as mesmas.');
  }

  function avancar({ semAcerto } = {}) {
    if (semAcerto) setFaltaram((atuais) => [...atuais, indiceDaQuestao]);

    if (ultima) {
      setFase('fim');
      return;
    }
    setPasso((p) => p + 1);
    setCanto(null);
    setResultado(null);
    setFase('mirar');
    anunciar(`${tema.unidade} ${passo + 2} de ${total}. ${tema.instrucaoMirar}`);
  }

  function recomecar(lista) {
    setOrdem(lista);
    setPasso(0);
    setFase('mirar');
    setCanto(null);
    setResultado(null);
    setDicasPedidas({});
    setAcertos(0);
    setFaltaram([]);
    anunciar(`Jogo recomeçado. ${tema.unidade} 1 de ${lista.length}.`);
  }

  /* --- Fim do jogo ------------------------------------------------------- */
  if (fase === 'fim') {
    const pendentes = faltaram;
    return (
      <ConclusaoAtividade
        acertos={acertos}
        total={total}
        assunto={assuntoDaAtividade(material)}
        tema={chaveTema}
        comemorar={ajustes.comemoracao === 'ligada'}
        aviso={
          pendentes.length > 0 && (
            <p className="conclusao__pendentes">
              {pendentes.length === 1
                ? 'Ficou uma pergunta para depois.'
                : `Ficaram ${pendentes.length} perguntas para depois.`}{' '}
              Você pode treinar só {pendentes.length === 1 ? 'ela' : 'elas'} agora, se quiser.
            </p>
          )
        }
        acoes={
          <>
            <Botao como="link" para={`/atividade/${codigo}`} variante="secundario">
              <House aria-hidden="true" />
              Escolher outro tema
            </Botao>
            {pendentes.length > 0 && (
              <Botao variante="secundario" onClick={() => recomecar(pendentes)}>
                <RotateCcw aria-hidden="true" />
                Treinar {pendentes.length === 1 ? 'a que faltou' : 'as que faltaram'}
              </Botao>
            )}
            <Botao onClick={() => recomecar(questoes.map((_, posicao) => posicao))}>
              <Play aria-hidden="true" />
              Jogar novamente
            </Botao>
          </>
        }
      />
    );
  }

  /* --- Janela da pergunta e do resultado ---------------------------------- */
  let janela = null;
  if (fase === 'responder') {
    janela = (
      <JanelaDoJogo rotulo="titulo-pergunta" aoEscape={trocarMira} focoInicial="#titulo-pergunta">
        <div className="jogo__janela-topo">
          <p className="jogo__mirou">
            {tema.unidade} {passo + 1} de {total} · <strong>{tema.cantos[canto]}</strong>
          </p>
          <button type="button" className="link-botao jogo__trocar" onClick={trocarMira}>
            <ArrowLeft aria-hidden="true" />
            Trocar
          </button>
        </div>

        <h2 id="titulo-pergunta" className="atividade__pergunta" tabIndex={-1}>
          {questao.enunciado}
        </h2>

        {/* G11 — a dica está disponível antes da resposta. */}
        {dicaAberta ? (
          <Dica questao={questao} />
        ) : (
          <div className="jogo__pedir-dica">
            <Botao variante="secundario" onClick={pedirDica}>
              <Lightbulb aria-hidden="true" />
              Ver uma dica
            </Botao>
          </div>
        )}

        {/* Na nova tentativa a lista volta inteira e na mesma ordem. */}
        <ul className="atividade__opcoes atividade__opcoes--grade">
          {questao.alternativas.map((alternativa, posicao) => (
            <li key={alternativa}>
              <button type="button" className="atividade__opcao" onClick={() => responder(posicao)}>
                <span className="atividade__letra" aria-hidden="true">
                  {String.fromCharCode(65 + posicao)}
                </span>
                <span>{alternativa}</span>
              </button>
            </li>
          ))}
        </ul>
      </JanelaDoJogo>
    );
  } else if (fase === 'resultado' && resultadoVisivel) {
    const acertou = resultado === 'acerto';
    janela = (
      <JanelaDoJogo
        rotulo="titulo-resultado"
        tipo={acertou ? 'acerto' : 'erro'}
        focoInicial=".jogo__janela-acoes .botao"
      >
        <div className="jogo__resultado">
          {/* Ícone junto da cor: o resultado não depende só da cor. */}
          <span className="jogo__aviso-icone" aria-hidden="true">
            {acertou ? '✓' : '✕'}
          </span>
          <div>
            <h2 id="titulo-resultado" className="jogo__aviso-titulo">
              {acertou ? tema.tituloAcerto : tema.tituloErro}
            </h2>
            <p className="jogo__aviso-texto">{acertou ? tema.textoAcerto : tema.textoErro}</p>
          </div>
        </div>

        {/* G04 — depois do erro, a dica e a nova tentativa, sem perder nada. */}
        {!acertou && <Dica questao={questao} />}

        <div className="jogo__janela-acoes">
          {acertou ? (
            <Botao onClick={() => avancar()}>{ultima ? tema.terminar : tema.proxima}</Botao>
          ) : (
            <>
              <Botao onClick={tentarDeNovo}>{tema.repetir}</Botao>
              <Botao variante="secundario" onClick={() => avancar({ semAcerto: true })}>
                {ultima ? tema.terminar : tema.proxima}
              </Botao>
            </>
          )}
        </div>
      </JanelaDoJogo>
    );
  }

  /* --- Turno ------------------------------------------------------------- */
  return (
    <div className="atividade jogo">
      <h1 className="apenas-leitor">
        {tema.nome} — atividade sobre {assuntoDaAtividade(material)}
      </h1>

      {/* G05 — só progresso e pontos de acerto; não há contador de erro nem de
         tempo. G14 — o progresso também em segmentos. */}
      <div className="jogo__topo">
        <Pontos acertos={acertos} />
        <ProgressoPerguntas
          total={total}
          atual={passo}
          unidade={tema.unidade}
          feitas={ordem
            .map((indice, posicao) => (posicao < passo && !faltaram.includes(indice) ? posicao : -1))
            .filter((posicao) => posicao >= 0)}
        />
        <AjustesDoJogo
          aberto={ajustesAbertos}
          aoAbrir={() => setAjustesAbertos(true)}
          aoFechar={() => setAjustesAbertos(false)}
          ajustes={ajustes}
          aoDefinir={(chave, valor, rotulo) => {
            definirAjuste(chave, valor);
            anunciar(`${OPCOES_AJUSTES[chave].nome}: ${rotulo}.`);
          }}
        />
      </div>

      {/* A cena é a peça principal e não muda de tamanho entre as fases (G01). */}
      <div className="jogo__arena" ref={arena}>
        <CenaJogo
          tema={chaveTema}
          canto={canto}
          fase={fase}
          resultado={resultado}
          comemorar={ajustes.comemoracao === 'ligada'}
          cantos={tema.cantos}
          convite={tema.convite}
          aoMirar={mirar}
          sobreposicao={janela}
        />
      </div>

      <p className="campo__dica atividade__troca">
        Prefere sem jogo?{' '}
        <Link to={`/atividade/${codigo}/perguntas`}>Responder só as perguntas</Link>.
      </p>
    </div>
  );
}

/** Ajustes do jogo num diálogo, para a cena não sair do lugar ao abrir.
 *  Cada escolha vale na hora, por isso não há botão Cancelar. */
function AjustesDoJogo({ aberto, aoAbrir, aoFechar, ajustes, aoDefinir }) {
  return (
    <div className="jogo__ajustes">
      <button
        type="button"
        className="jogo__ajustes-gatilho"
        aria-haspopup="dialog"
        onClick={aoAbrir}
      >
        <Settings aria-hidden="true" />
        <span className="jogo__ajustes-rotulo">Como você quer jogar</span>
      </button>

      <Dialogo
        aberto={aberto}
        titulo="Como você quer jogar"
        aoCancelar={aoFechar}
        acoes={<Botao onClick={aoFechar}>Pronto</Botao>}
      >
        <div className="jogo__ajustes-grupos">
          {Object.entries(OPCOES_AJUSTES).map(([chave, grupo]) => (
            <fieldset key={chave}>
              <legend>{grupo.nome}</legend>
              <div className="grupo-botoes">
                {grupo.valores.map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    aria-label={`${grupo.nome}: ${opcao.rotulo}`}
                    aria-pressed={ajustes[chave] === opcao.valor}
                    onClick={() => aoDefinir(chave, opcao.valor, opcao.rotulo)}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <p className="campo__dica" style={{ marginBottom: 0 }}>
          As perguntas são as mesmas nos dois temas. Muda só o desenho.
        </p>
      </Dialogo>
    </div>
  );
}
