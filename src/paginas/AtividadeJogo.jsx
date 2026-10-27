import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao, Cartao } from '../componentes/basicos.jsx';
import { CenaJogo } from '../componentes/CenaJogo.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
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

   Cada rodada tem sempre a mesma ordem:

       mirar  →  responder  →  resultado  →  próxima

   - a dica pode ser vista antes de responder e não é contada (G11);
   - errar não tira ponto: a contagem mostra só acertos (G04, G05);
   - não há cronômetro, e a cena só se mexe depois da resposta (G03);
   - o tema padrão é neutro; futebol é opção (G07);
   - som começa desligado e o efeito visual do acerto, ligado (G08). */

const TEMAS = {
  neutro: {
    rotulo: 'Alvo',
    nome: 'Treino de pontaria',
    instrucaoMirar: 'Escolha em qual alvo você vai mirar.',
    cantos: ['Alvo da esquerda', 'Alvo do meio', 'Alvo da direita'],
    unidade: 'Rodada',
    unidadePlural: 'rodadas',
    ponto: 'acerto',
    pontoPlural: 'acertos',
    verboResumo: 'acertou',
    tituloAcerto: 'Acertou o alvo!',
    textoAcerto: 'Resposta correta.',
    tituloErro: 'Passou por cima!',
    textoErro: 'Resposta incorreta.',
    repetir: 'Tentar de novo',
    proxima: 'Ir para a próxima rodada',
    terminar: 'Terminar o treino',
  },
  futebol: {
    rotulo: 'Futebol',
    nome: 'Treino de pênalti',
    instrucaoMirar: 'Escolha em qual canto do gol você vai chutar.',
    cantos: ['Canto esquerdo', 'Meio do gol', 'Canto direito'],
    unidade: 'Cobrança',
    unidadePlural: 'cobranças',
    ponto: 'gol',
    pontoPlural: 'gols',
    verboResumo: 'fez',
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
  tema: 'neutro', // G07
  som: 'desligado', // G08
  comemoracao: 'ligada', // G08
};

const OPCOES_AJUSTES = {
  tema: {
    nome: 'Tema do jogo',
    valores: [
      { valor: 'neutro', rotulo: 'Alvo' },
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
      return bruto ? { ...AJUSTES_PADRAO, ...JSON.parse(bruto) } : AJUSTES_PADRAO;
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

/** Tempo de espera antes de mostrar o cartão de resultado. Com movimento
 *  reduzido (painel Exibição ou sistema operacional), a espera é zero. */
function esperaDoAviso(resultado) {
  const semMovimento =
    document.documentElement.dataset.movimento === 'reduzido' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (semMovimento) return 0;
  /* A bola leva 540 ms para chegar (`.jogo__movel` em jogo.css); estes valores
     somam esse trajeto ao tempo de ver onde a bola parou. Mudar a duração da
     animação exige mudar aqui também. */
  return resultado === 'acerto' ? 1150 : 950;
}

/** Dica da questão (questões do servidor) ou, na demonstração, o trecho
 *  de origem. */
function textoDaDica(questao) {
  return questao.dica ? `Dica: ${questao.dica}` : `Dica: a resposta está no trecho ${questao.trecho}.`;
}

export function AtividadeJogo() {
  const { codigo } = useParams();
  const { material, valida, questoes } = usarAtividadeDoCodigo(codigo);
  const { anunciar } = usarAnuncios();
  const [ajustes, definirAjuste] = usarAjustesDoJogo();
  const [ajustesAbertos, setAjustesAbertos] = useState(false);

  const tema = TEMAS[ajustes.tema] ?? TEMAS.neutro;
  const tocar = usarSom(ajustes.som === 'ligado');

  usarTituloDaPagina(valida ? tema.nome : 'Atividade indisponível');

  /* `ordem`: questões desta rodada. Diminui quando a criança treina só as
     que ficaram para depois. */
  const [ordem, setOrdem] = useState(() => questoes.map((_, posicao) => posicao));
  const [passo, setPasso] = useState(0);
  const [fase, setFase] = useState('mirar'); // mirar | responder | resultado | fim
  const [canto, setCanto] = useState(null);
  const [escolhida, setEscolhida] = useState(null);
  const [resultado, setResultado] = useState(null); // acerto | erro
  const [acertos, setAcertos] = useState(0);
  const [faltaram, setFaltaram] = useState([]);
  /* Dicas pedidas, por questão. Não são contadas em lugar nenhum (G11). */
  const [dicasPedidas, setDicasPedidas] = useState({});

  /* O cartão do resultado entra depois que a bola chega, para não tapar o gol. */
  const [avisoVisivel, setAvisoVisivel] = useState(false);
  useEffect(() => {
    if (fase !== 'resultado') {
      setAvisoVisivel(false);
      return undefined;
    }
    const temporizador = window.setTimeout(() => setAvisoVisivel(true), esperaDoAviso(resultado));
    return () => window.clearTimeout(temporizador);
  }, [fase, resultado]);

  const botaoAviso = useRef(null);
  useEffect(() => {
    if (!avisoVisivel) return;
    /* Rola a cena inteira para a vista, e não só o botão, para a mensagem e a
        bola aparecerem juntas. */
    botaoAviso.current?.focus({ preventScroll: true });
    botaoAviso.current?.closest('.jogo__cena')?.scrollIntoView({ block: 'center' });
  }, [avisoVisivel]);

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

  function responder(posicao) {
    if (fase !== 'responder') return;
    const certa = posicao === questao.correta;
    setEscolhida(posicao);
    setResultado(certa ? 'acerto' : 'erro');
    setFase('resultado');

    if (certa) {
      setAcertos((n) => n + 1);
      tocar('acerto');
      anunciar(`Você acertou. ${tema.tituloAcerto}`);
      return;
    }

    tocar('erro');
    anunciar(`Não foi essa. ${tema.tituloErro}. Leia a dica e tente de novo, ou vá para a próxima.`);
  }

  /** Nova tentativa na mesma rodada: volta para a pergunta com a mesma mira
   *  e com todas as alternativas, na mesma ordem. */
  function tentarDeNovo() {
    setEscolhida(null);
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
    setEscolhida(null);
    setResultado(null);
    setFase('mirar');
    anunciar(`${tema.unidade} ${passo + 2} de ${total}. ${tema.instrucaoMirar}`);
  }

  function recomecar(lista) {
    setOrdem(lista);
    setPasso(0);
    setFase('mirar');
    setCanto(null);
    setEscolhida(null);
    setResultado(null);
    setDicasPedidas({});
    setAcertos(0);
    setFaltaram([]);
    anunciar(`Treino recomeçado. ${tema.unidade} 1 de ${lista.length}.`);
  }

  /* --- Fim do treino ----------------------------------------------------- */
  if (fase === 'fim') {
    const pendentes = faltaram;
    return (
      <div className="atividade">
        <Cartao>
          <h1>Você terminou o treino</h1>
          <p className="jogo__resumo">
            Você {tema.verboResumo} <strong>{acertos}</strong>{' '}
            {acertos === 1 ? tema.ponto : tema.pontoPlural} em <strong>{total}</strong>{' '}
            {total === 1 ? tema.unidade.toLowerCase() : tema.unidadePlural}.
          </p>

          {pendentes.length > 0 && (
            <p>
              {pendentes.length === 1
                ? 'Ficou uma pergunta para depois.'
                : `Ficaram ${pendentes.length} perguntas para depois.`}{' '}
              Você pode treinar só ela agora, se quiser.
            </p>
          )}

          <div className="linha" style={{ marginTop: 'var(--e5)' }}>
            {pendentes.length > 0 && (
              <Botao onClick={() => recomecar(pendentes)}>
                Treinar {pendentes.length === 1 ? 'a que faltou' : 'as que faltaram'}
              </Botao>
            )}
            <Botao
              variante={pendentes.length > 0 ? 'secundario' : 'principal'}
              onClick={() => recomecar(questoes.map((_, posicao) => posicao))}
            >
              Treinar tudo de novo
            </Botao>
            <Botao como="link" para={`/atividade/${codigo}`} variante="discreto">
              Voltar para a escolha
            </Botao>
          </div>
        </Cartao>

        <p className="campo__dica" style={{ marginTop: 'var(--e4)' }}>
          Nada do que você respondeu foi guardado. O Entende+ não registra nome, e-mail nem nota.
        </p>
      </div>
    );
  }

  /* --- Turno ------------------------------------------------------------- */
  return (
    <div className="atividade jogo">
      <h1 className="apenas-leitor">
        {tema.nome} — atividade sobre {assuntoDaAtividade(material)}
      </h1>

      <div className="jogo__topo">
        {/* G05 — só progresso e acertos; não há contador de erro nem de tempo. */}
        <p className="atividade__contador">
          {tema.unidade} {passo + 1} de {total}
        </p>
        <p className="jogo__placar">
          <strong>{acertos}</strong> {acertos === 1 ? tema.ponto : tema.pontoPlural}
        </p>
      </div>

      {/* G14 — o progresso em bolinhas. aria-hidden, porque o contador acima já
         diz o mesmo em texto. */}
      <ul className="jogo__trilha" aria-hidden="true">
        {ordem.map((indice, posicao) => (
          <li
            key={indice}
            data-estado={
              posicao === passo
                ? 'atual'
                : posicao < passo && !faltaram.includes(ordem[posicao])
                  ? 'feita'
                  : 'pendente'
            }
          />
        ))}
      </ul>

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

      <CenaJogo
        tema={ajustes.tema}
        canto={canto}
        fase={fase}
        resultado={resultado}
        comemorar={ajustes.comemoracao === 'ligada'}
        sobreposicao={
          avisoVisivel ? (
            <div
              className={`jogo__aviso-caixa jogo__aviso-caixa--${
                resultado === 'acerto' ? 'acerto' : 'erro'
              }`}
              role="status"
            >
              {/* Ícone junto da cor: o resultado não depende só da cor. */}
              <span className="jogo__aviso-icone" aria-hidden="true">
                {resultado === 'acerto' ? '✓' : '✕'}
              </span>
              <p className="jogo__aviso-titulo">
                {resultado === 'acerto' ? tema.tituloAcerto : tema.tituloErro}
              </p>
              <p className="jogo__aviso-texto">
                {resultado === 'acerto' ? tema.textoAcerto : tema.textoErro}
              </p>

              <div className="jogo__aviso-acoes">
                {resultado === 'acerto' ? (
                  <Botao ref={botaoAviso} onClick={() => avancar()}>
                    {ultima ? tema.terminar : tema.proxima}
                  </Botao>
                ) : (
                  <>
                    <Botao ref={botaoAviso} onClick={tentarDeNovo}>
                      {tema.repetir}
                    </Botao>
                    {/* G04 — a opção de seguir para a próxima fica visível junto. */}
                    <Botao variante="secundario" onClick={() => avancar({ semAcerto: true })}>
                      {ultima ? tema.terminar : tema.proxima}
                    </Botao>
                  </>
                )}
              </div>
            </div>
          ) : null
        }
      />

      {fase === 'mirar' && (
        <section aria-labelledby="titulo-mirar">
          <h2 id="titulo-mirar" className="jogo__passo">
            {tema.instrucaoMirar}
          </h2>
          <ul className="jogo__cantos">
            {tema.cantos.map((rotulo, posicao) => (
              <li key={rotulo}>
                <button type="button" className="jogo__canto" onClick={() => mirar(posicao)}>
                  {rotulo}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(fase === 'responder' || fase === 'resultado') && (
        <section aria-labelledby="titulo-pergunta">
          <p className="jogo__mirou">
            Você mirou: <strong>{tema.cantos[canto]}</strong>
          </p>

          <h2 id="titulo-pergunta" className="atividade__pergunta">
            {questao.enunciado}
          </h2>

          {/* G11 — a dica está disponível antes da resposta. */}
          {fase === 'responder' && !dicaAberta && (
            <div className="jogo__pedir-dica">
              <Botao variante="secundario" onClick={pedirDica}>
                Ver uma dica antes de responder
              </Botao>
            </div>
          )}

          {dicaAberta && fase === 'responder' && (
            <div className="jogo__dica" style={{ marginTop: 0, marginBottom: 'var(--e4)' }}>
              <h3>Dica</h3>
              {/* A dica aponta onde procurar sem entregar a resposta. */}
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
          )}

          {/* Na nova tentativa a lista volta inteira e na mesma ordem; a marcação de
             erro só aparece enquanto o resultado está na tela. */}
          <ul className="atividade__opcoes">
            {questao.alternativas.map((alternativa, posicao) => {
              const respondido = fase === 'resultado';
              const foiEscolhida = posicao === escolhida;
              const estaCerta = posicao === questao.correta;

              let classe = 'atividade__opcao';
              if (respondido && foiEscolhida && estaCerta) classe += ' atividade__opcao--certa';
              if (respondido && foiEscolhida && !estaCerta) classe += ' atividade__opcao--errada';

              return (
                <li key={alternativa}>
                  <button
                    type="button"
                    className={classe}
                    disabled={respondido}
                    onClick={() => responder(posicao)}
                  >
                    <span className="atividade__letra" aria-hidden="true">
                      {String.fromCharCode(65 + posicao)}
                    </span>
                    <span>{alternativa}</span>
                    {respondido && foiEscolhida && estaCerta && (
                      <span className="atividade__marca">
                        <span aria-hidden="true">✓</span>
                        <span className="apenas-leitor">resposta correta</span>
                      </span>
                    )}
                    {respondido && foiEscolhida && !estaCerta && (
                      <span className="atividade__marca">
                        <span aria-hidden="true">✕</span>
                        <span className="apenas-leitor">sua resposta, incorreta</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* G04 — depois do erro, a dica aparece abaixo da cena. */}
      {fase === 'resultado' && resultado === 'erro' && (
        <div className="atividade__retorno">
          <div className="jogo__dica">
            <h3>Dica</h3>
            <p>
              {questao.dica ? (
                questao.dica
              ) : (
                <>
                  A resposta está neste trecho do material: <strong>{questao.trecho}</strong>.
                </>
              )}
            </p>
            <p>
              A pergunta e as alternativas continuam as mesmas: o que muda é você ter lido onde
              procurar a resposta.
            </p>
          </div>
        </div>
      )}

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
        <span aria-hidden="true">⚙</span> Como você quer jogar
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
          As perguntas são as mesmas nos dois temas — muda só o desenho. O efeito de acerto é o
          balanço da rede, curto e sem som.
        </p>
      </Dialogo>
    </div>
  );
}
