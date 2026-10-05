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

/* =========================================================================
   UC21 — Jogar a mecânica gamificada (RF21)
   RN04 — as questões são as do material enviado, e só dele.
   RN05 — sem cadastro e sem nenhum dado que identifique o estudante.
   RN11 — as catorze regras de desenho G01 a G14.

   O desenho desta tela vem de `Entrega-14-09/mecanica-atividade-gamificada.md`,
   que registra a ideia original (jogo de pênalti), a pesquisa sobre jogo sério
   para TEA e as mudanças que a pesquisa impôs à ideia. Cada regra G citada
   abaixo está naquele documento com a diretriz de origem.

   A estrutura de turno é sempre a mesma, do começo ao fim (G01):

       mirar  →  responder  →  resultado  →  próxima

   As decisões que sustentam a tela, e que não devem ser "melhoradas" sem
   reler a pesquisa:

   · **A dica está disponível ANTES de errar** (G11). É a aplicação da
     aprendizagem sem erro, prática consolidada no ensino a pessoas autistas: o
     apoio vem antes da resposta e vai sendo retirado, em vez de a criança
     errar primeiro para só então receber ajuda. Pedir dica não custa nada, não
     é contado em lugar nenhum e não aparece no resumo do treino.
   · **Errar não tira nada** (G04, G05). A conta mostra só acerto. Não existe
     contador de erro, de tentativa nem de tempo. Quem erra recebe a dica e
     tenta de novo, ou passa para a próxima se preferir — as duas saídas ficam
     visíveis ao mesmo tempo, e nenhuma delas é apresentada como desistência.
   · **A questão é o portão da ação.** A criança não responde para ganhar
     ponto: responder é o que move a bola. É o que amarra a mecânica ao
     conteúdo, em vez de pendurar conteúdo num jogo pronto.
   · **Sem cronômetro, nunca** (G03). A bola espera. Não há nada na tela que
     comunique urgência, e a cena só se mexe depois da resposta confirmada.
   · **Tema é pele, não estrutura** (G07). Futebol é opção; o padrão é neutro.
     Interesse circunscrito é motivador quando é o interesse *daquela* criança,
     e tema fixo de futebol engaja quem gosta de futebol e perde o resto da
     turma. A mecânica é idêntica nas duas peles.
   · **O acerto tem reconhecimento visual, e ele vem ligado** (G08). Até 20/09
     o jogo oferecia como recompensa apenas um contador — e contador é medida
     quantitativa, justamente a forma de recompensa que a literatura descreve
     como a MENOS preferida por criança autista, atrás de animação. O balanço
     da rede é curto, silencioso e não pisca. O que continua desligado por
     padrão é o som e qualquer efeito intenso.

   Sobre o que se pode afirmar disso no artigo: que o desenho segue diretrizes
   publicadas para TEA, com a diretriz declarada decisão a decisão. **Não** que
   a mecânica melhore a aprendizagem de criança autista — não há base para
   isso, e a seção 5 daquele documento explica por quê.
   ========================================================================= */

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
   Guardados em localStorage pelo mesmo motivo das preferências de exibição:
   quem já escolheu o tema não deveria escolher de novo a cada atividade (H6).

   Isto não conflita com RN05 nem com RNF11. O que fica gravado é a preferência
   de apresentação no navegador da própria criança — não há identificador, não
   há resposta, não há nota, e nada disso sai da máquina. O que a RN05 proíbe é
   o sistema registrar dado que identifique o estudante, e preferência de tema
   não identifica ninguém.                                                   */

const CHAVE_AJUSTES = 'entende-mais:jogo';

const AJUSTES_PADRAO = {
  tema: 'neutro', // G07 — opção neutra é o padrão
  som: 'desligado', // G08 — som desligado por padrão
  comemoracao: 'ligada', // G08 — o reconhecimento visual do acerto vem ligado
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
   Duas notas curtas geradas por oscilador. Nenhum arquivo de áudio: o
   protótipo precisa abrir por duplo clique, sem servidor e sem internet, e um
   .mp3 embutido em base64 pesaria mais que o resto do aplicativo.

   Desligado por padrão (G08) e só toca a partir de um clique da criança, que é
   o gesto que os navegadores exigem para liberar áudio.                     */
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

/**
 * Quanto o cartão do resultado espera antes de entrar.
 *
 * Lê os mesmos dois sinais que o `base.css` usa para zerar animação: o
 * atributo do painel de Exibição e a preferência do sistema operacional. Sem
 * isto, quem liga movimento reduzido veria a bola aparecer no destino
 * instantaneamente e depois encararia quase um segundo de tela parada.
 */
function esperaDoAviso(resultado) {
  const semMovimento =
    document.documentElement.dataset.movimento === 'reduzido' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (semMovimento) return 0;
  /* A bola leva 540 ms para chegar (`.jogo__movel` em jogo.css). Estes números
     são esse trajeto MAIS o tempo de a criança ver onde a bola parou:
     - no gol, ainda espera o balanço da rede terminar;
     - no erro, basta ver a bola sair por cima.
     Mexer na duração da transição da bola sem mexer aqui faz o cartão voltar a
     aparecer por cima da bola em movimento, que era o defeito original. */
  return resultado === 'acerto' ? 1150 : 950;
}

/** A dica escrita para a questão, quando existe (questões do servidor); senão,
 *  o trecho de origem, que é o que a demonstração tem. */
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

  /* `ordem` é a lista de questões desta rodada. Começa com todas e encolhe
     quando a criança escolhe treinar só as que faltaram — é o que permite
     voltar no que ficou para trás sem refazer o que já saiu. */
  const [ordem, setOrdem] = useState(() => questoes.map((_, posicao) => posicao));
  const [passo, setPasso] = useState(0);
  const [fase, setFase] = useState('mirar'); // mirar | responder | resultado | fim
  const [canto, setCanto] = useState(null);
  const [escolhida, setEscolhida] = useState(null);
  const [resultado, setResultado] = useState(null); // acerto | erro
  const [acertos, setAcertos] = useState(0);
  const [faltaram, setFaltaram] = useState([]);
  /* Dica pedida fica por questão, e não por tentativa: quem pediu ajuda não
     tem de pedir de novo ao tentar outra vez na mesma cobrança. Isto NÃO é
     contado em lugar nenhum — ver G11. */
  const [dicasPedidas, setDicasPedidas] = useState({});

  /* O cartão do resultado entra DEPOIS que a bola chega, e não junto com ela.
     No gol isso é o essencial: o cartão fica no meio da cena, e aparecer na
     hora taparia justamente a bola entrando na rede, que é a recompensa. */
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
    /* `preventScroll` e depois rolar a CENA, não o botão: o navegador levaria
       só o botão para dentro da janela e deixaria o título acima da borda — a
       criança receberia o foco num botão sem ter lido o que aconteceu. Rolar o
       quadro inteiro mostra a mensagem e a bola junto. */
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

  /**
   * Nova tentativa na mesma cobrança.
   *
   * Volta direto para a pergunta, com a mira que a criança já escolheu e com a
   * lista de alternativas inteira.
   *
   * - **Não refaz a mira.** A primeira versão mandava o turno recomeçar do
   *   começo, em nome de G01. Mas a mira já foi feita e não foi ela que errou;
   *   repeti-la é um passo a mais entre o erro e a nova tentativa, e transição
   *   longa entre estados do jogo é justamente o que a literatura aponta como
   *   perda de concentração. G01 continua valendo para o turno
   *   (mirar → responder → resultado); a repetição reentra em "responder".
   * - **Nenhuma alternativa é retirada.** Uma versão intermediária tirava da
   *   lista a que tinha sido marcada. Parecia ajuda e era outra coisa: a tela
   *   mudava de forma a cada tentativa, e a criança que tivesse decorado a
   *   posição das opções perdia a referência. Previsibilidade vale mais aqui
   *   que o atalho, e o apoio à criança que travou já existe na dica (G11).
   */
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
        {/* G05 — a conta mostra só progresso e acerto. Não existe, em lugar
            nenhum da tela, contador de erro, de tentativa ou de tempo. */}
        <p className="atividade__contador">
          {tema.unidade} {passo + 1} de {total}
        </p>
        <p className="jogo__placar">
          <strong>{acertos}</strong> {acertos === 1 ? tema.ponto : tema.pontoPlural}
        </p>
      </div>

      {/* G14 — o mesmo progresso, em forma não textual. `aria-hidden` porque o
          contador acima já diz exatamente isto por escrito, e repetir os dois
          faria o leitor de tela anunciar a mesma informação duas vezes. */}
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
              {/* O símbolo é redundância, não decoração: nenhum estado neste
                  sistema é comunicado só por cor (SC 1.4.1). Quem não distingue
                  verde de vermelho recebe o ícone e o texto. */}
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
                    {/* G04 — a saída de seguir adiante fica visível junto, e
                        não escondida atrás de um menu. Quem travou numa questão
                        precisa de um caminho que não seja nem fracassar nem
                        ficar preso. */}
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

          {/* G11 — aprendizagem sem erro: o apoio fica disponível ANTES da
              resposta, e não como consolo depois da falha. Não custa nada, não
              é contado e não aparece no resumo. */}
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
              {/* Com questões geradas pelo servidor, a dica foi escrita para
                  apontar onde procurar sem entregar a resposta. O trecho de
                  origem não vai à criança: ele É a frase da resposta. */}
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

          {/* Na nova tentativa a lista volta inteira, com as mesmas quatro
              alternativas na mesma ordem. Uma versão intermediária retirava da
              lista a que a criança tinha marcado; a tela ficava diferente a
              cada tentativa, e tela que muda de forma no meio da cobrança é
              exatamente o que G01 existe para impedir. Marcação de erro só
              enquanto o resultado daquela tentativa está visível. */}
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

      {/* G04 — erro gera dica e nova tentativa, nunca perda. O aviso e os
          botões estão por cima da cena; aqui fica só a dica, que é texto para
          ler com calma e não caberia dentro do quadro. */}
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

/**
 * Ajustes do jogo, num diálogo.
 *
 * Era uma sanfona que empurrava a cena para baixo ao abrir: a criança clicava
 * para trocar o tema e o campo saía da tela. O diálogo resolve isso — a cena
 * fica onde está e os ajustes vêm por cima, com o foco preso dentro, Esc para
 * sair e o foco voltando ao botão que abriu (tudo isso já vem do `Dialogo`,
 * que é o mesmo das ações irreversíveis do professor).
 *
 * O gatilho fica no mesmo lugar em toda partida (SC 3.2.6), e não existe
 * "Cancelar": cada escolha vale no instante do clique, e um Cancelar prometeria
 * um desfazer que não existe.
 */
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
