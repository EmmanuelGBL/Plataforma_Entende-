import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Aviso, AvisoConteudoDemo, Botao, Cartao, Etiqueta, Migalhas } from '../componentes/basicos.jsx';
import { ComparadorTextos, TabelaMetricas } from '../componentes/Comparador.jsx';
import { PainelRegras } from '../componentes/PainelRegras.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAdaptacao, usarApp, usarCatalogo } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { BarraProgresso } from '../componentes/Passos.jsx';

/* =========================================================================
   TELA NÚCLEO DO PROJETO.

   UC05 a UC12 — gerar adaptação, registrar regras, calcular métricas,
   revisar, editar, consultar justificativa, aprovar e exportar, reprocessar.
   RF05 a RF12; RN01, RN02, RN08, RN10.

   É aqui que o diferencial declarado no pré-projeto vira algo que se vê: o
   critério de adaptação fica exposto ao lado do texto, com base normativa,
   e a métrica aparece mesmo quando piora. Uma ferramenta de IA genérica
   entrega o texto reescrito e nada mais; a diferença do Entende+ não está no
   texto de saída, está nesta coluna da direita.
   ========================================================================= */

/* Edição no modo de demonstração: os blocos viram texto com "##" e voltam. */
function serializar(blocos) {
  return blocos
    .map((bloco) => `## ${bloco.titulo}\n\n${bloco.paragrafos.join('\n\n')}`)
    .join('\n\n');
}

function desserializar(texto, blocosOriginais) {
  const partes = texto.split(/\n(?=## )/).filter((p) => p.trim());
  return partes.map((parte, indice) => {
    const linhas = parte.split('\n');
    const titulo = linhas[0].replace(/^##\s*/, '').trim();
    const corpo = linhas.slice(1).join('\n').trim();
    return {
      titulo,
      // A regra que originou o bloco continua atribuída a ele: o professor
      // edita o texto, não o registro do que o sistema fez (RN08).
      regra: blocosOriginais[indice]?.regra,
      paragrafos: corpo.split(/\n\s*\n/).filter(Boolean),
    };
  });
}

export function Adaptacao() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { material, modoServidor, adaptarMaterial, salvarTexto, aprovar } = usarApp();
  const { dados: adaptacao, carregando, erro } = usarAdaptacao(id);
  const catalogo = usarCatalogo();
  const { anunciar } = usarAnuncios();

  const dados = material(id);

  usarTituloDaPagina(dados ? `Adaptação — ${dados.nome}` : 'Material não encontrado');

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [exportado, setExportado] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapaAtual, setEtapaAtual] = useState('');
  const [falha, setFalha] = useState(null);

  // No modo servidor, edita-se o Markdown que o servidor guarda, sem perda.
  const textoSalvo = useMemo(() => {
    if (!adaptacao) return '';
    return modoServidor ? adaptacao.textoAdaptado : serializar(adaptacao.blocos);
  }, [adaptacao, modoServidor]);
  const houveMudanca = rascunho !== textoSalvo;

  if (!dados) {
    return (
      <Aviso tipo="erro" titulo="Material não encontrado">
        <p>
          Este material não existe ou foi excluído.{' '}
          <Botao como="link" para="/painel" variante="discreto">
            Voltar para meus materiais
          </Botao>
        </p>
      </Aviso>
    );
  }

  function mostrarFalha(problema) {
    setFalha(problema);
    anunciar(`Erro: ${problema.titulo}`);
  }

  function abrirEdicao() {
    // Reabrir sempre parte do que está salvo. Sem isto, um rascunho
    // descartado ressuscitaria na próxima abertura do diálogo.
    setRascunho(textoSalvo);
    setEditando(true);
  }

  async function salvarEdicao() {
    try {
      await salvarTexto(
        id,
        modoServidor ? { texto: rascunho } : { blocos: desserializar(rascunho, adaptacao.blocos) },
      );
      setEditando(false);
      setExportado(null);
      anunciar(
        modoServidor
          ? 'Alterações salvas. As métricas foram recalculadas, e o material precisa ser aprovado de novo.'
          : 'Alterações salvas no texto adaptado.',
      );
    } catch (problema) {
      setEditando(false);
      mostrarFalha(problema);
    }
  }

  function descartarEdicao() {
    const tinhaMudanca = houveMudanca;
    setRascunho(textoSalvo);
    setEditando(false);
    anunciar(
      tinhaMudanca
        ? 'Alterações descartadas. O texto voltou como estava.'
        : 'Edição fechada. Nada foi alterado.',
    );
  }

  async function confirmarExportacao() {
    setConfirmando(false);
    try {
      const resultado = await aprovar(id);
      setExportado(resultado);
      anunciar('Material aprovado. O botão no topo da tela agora abre o PDF.');
    } catch (problema) {
      mostrarFalha(problema);
    }
  }

  /** Adaptar pela primeira vez, ou reprocessar com a versão atual (RF12). */
  async function processar() {
    setProcessando(true);
    setFalha(null);
    setProgresso(0);
    anunciar('Processando o material com a versão atual do conjunto de regras.');
    try {
      await adaptarMaterial(
        id,
        (percentual, etapa) => {
          setProgresso(percentual);
          setEtapaAtual(etapa);
        },
        { cancelado: false },
      );
      anunciar('Material processado com a versão atual do conjunto de regras.');
    } catch (problema) {
      mostrarFalha(problema);
    } finally {
      setProcessando(false);
    }
  }

  const vigente = catalogo?.conjunto;
  const versaoDesatualizada =
    Boolean(vigente) && Boolean(adaptacao) &&
    dados.versaoRegras !== `${vigente.identificador} v${vigente.versao}`;
  const naoAdaptado = !adaptacao && erro?.status === 404;

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: 'Meus materiais', para: '/painel' },
          { rotulo: dados.nome },
        ]}
      />

      <div className="cabecalho-pagina cabecalho-acoes">
        <div>
          <h1>{dados.nome}</h1>
          <div className="linha" style={{ marginTop: 'var(--e2)' }}>
            <Etiqueta tom="info">Perfil TEA</Etiqueta>
            <Etiqueta tom="neutra">{dados.etapa}</Etiqueta>
            <Etiqueta tom="neutra">{dados.versaoRegras}</Etiqueta>
            {dados.estado === 'aprovado' && <Etiqueta tom="boa">Aprovado por você</Etiqueta>}
            {adaptacao?.editada && <Etiqueta tom="neutra">Editado por você</Etiqueta>}
          </div>
        </div>

        {/* RN02 — o botão do PDF só aparece depois da aprovação. Material já
            aprovado antes continua com o PDF disponível, sem aprovar de novo.
            A garantia de que nada sai sem aprovação continua dita onde ela
            importa: no diálogo de confirmação, no instante da decisão. */}
        {adaptacao && (
          <div className="linha">
            {dados.estado === 'aprovado' ? (
              <Botao como="link" para={`/materiais/${id}/impressao`}>
                Abrir o material em PDF
              </Botao>
            ) : (
              <Botao onClick={() => setConfirmando(true)}>Aprovar e exportar em PDF</Botao>
            )}
            <Botao variante="secundario" onClick={() => navegar(`/materiais/${id}/atividade`)}>
              Ir para a atividade
            </Botao>
          </div>
        )}
      </div>

      <AvisoConteudoDemo material={dados} />

      {falha && (
        <Aviso tipo="erro" titulo={falha.titulo} papel="alert">
          <p>{falha.motivo}</p>
          {falha.saida && (
            <p>
              <strong>O que fazer:</strong> {falha.saida}
            </p>
          )}
        </Aviso>
      )}

      {exportado && (
        <Aviso tipo="boa" titulo="Material aprovado" papel="status">
          {/* O botão do PDF não se repete aqui: depois da aprovação ele passa
              a ocupar, de forma permanente, o lugar do "Aprovar e exportar"
              no topo da tela, a dois centímetros deste aviso. */}
          <p>
            Aprovado em {exportado.aprovadoEm}. O material sai com fonte sem serifa, alinhamento à
            esquerda, entrelinha 1,5 e linha de no máximo 80 caracteres. O botão no topo da tela
            agora abre o PDF.
          </p>
        </Aviso>
      )}

      {versaoDesatualizada && !processando && (
        <Aviso tipo="atencao" titulo="Há uma versão mais nova do conjunto de regras">
          <p>
            Esta adaptação usou o conjunto <strong>{dados.versaoRegras}</strong>. A versão atual é
            a <strong>
              {vigente.identificador} v{vigente.versao}
            </strong>
            , publicada em {vigente.publicadoEm}.
          </p>
          <p>
            <Botao variante="secundario" onClick={processar}>
              Reprocessar com a versão atual
            </Botao>
          </p>
          <p className="campo__dica">
            Não é preciso enviar o arquivo de novo. O texto do material original continua guardado
            (RF12).
          </p>
        </Aviso>
      )}

      {processando && (
        <Cartao className="cartao--acao">
          <h2>Processando</h2>
          <BarraProgresso valor={progresso} etapa={etapaAtual} />
        </Cartao>
      )}

      {carregando && (
        <p role="status" className="campo__dica">
          Carregando a adaptação…
        </p>
      )}

      {naoAdaptado && !processando && (
        <Cartao className="cartao--acao">
          <h2>Este material ainda não foi adaptado</h2>
          <p>
            O texto foi lido e está guardado, mas a adaptação não chegou a ser feita — por exemplo,
            porque o processamento foi interrompido.
          </p>
          <Botao onClick={processar}>Adaptar agora</Botao>
        </Cartao>
      )}

      {erro && !naoAdaptado && (
        <Aviso tipo="erro" titulo={erro.titulo} papel="alert">
          <p>{erro.motivo}</p>
        </Aviso>
      )}

      {adaptacao && (
        <div className="duas-colunas">
          <div className="pilha-g">
            <section aria-labelledby="titulo-comparacao">
              <h2 id="titulo-comparacao" style={{ marginBottom: 'var(--e3)' }}>
                Comparar original e adaptado
              </h2>

              {/* A edição virou diálogo em vez de trocar o conteúdo da seção.
                  Trocando, a comparação sumia justamente enquanto o professor
                  corrigia o texto, e era ela a referência da correção. No
                  diálogo, o comparador continua atrás e volta inteiro ao
                  fechar. */}
              <ComparadorTextos
                original={adaptacao.original}
                blocos={adaptacao.blocos}
                regras={adaptacao.regras}
                acaoAdaptado={
                  <Botao variante="secundario" onClick={abrirEdicao}>
                    Editar o texto adaptado
                  </Botao>
                }
              />
            </section>

            <TabelaMetricas metricas={adaptacao.metricas} />
          </div>

          <PainelRegras conjunto={adaptacao.conjunto} regras={adaptacao.regras} />
        </div>
      )}

      <Dialogo
        aberto={editando}
        titulo="Editar o texto adaptado"
        largo
        rotuloCancelar="Descartar alterações"
        rotuloConfirmar="Salvar alterações"
        confirmarDesabilitado={!houveMudanca}
        aoCancelar={descartarEdicao}
        aoConfirmar={salvarEdicao}
      >
        <p className="campo__dica">
          {modoServidor ? (
            <>
              Linhas iniciadas por <code>#</code> são títulos (<code>##</code> e <code>###</code>{' '}
              são subtítulos), e por <code>-</code> são itens de lista. Deixe uma linha em branco
              entre os parágrafos. Salvar recalcula as métricas, e o material volta a precisar da
              sua aprovação.
            </>
          ) : (
            <>
              Linhas iniciadas por <code>##</code> são subtítulos. Deixe uma linha em branco entre
              os parágrafos. Enquanto você não salvar, dá para descartar tudo e voltar ao texto
              como estava.
            </>
          )}
        </p>
        <label className="campo">
          <span className="apenas-leitor">Texto adaptado</span>
          <textarea
            className="area-texto"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
          />
        </label>
      </Dialogo>

      <Dialogo
        aberto={confirmando}
        titulo="Aprovar este material?"
        rotuloConfirmar="Aprovar e exportar"
        aoCancelar={() => setConfirmando(false)}
        aoConfirmar={confirmarExportacao}
      >
        <p>
          Ao aprovar, você declara que conferiu o material adaptado e que ele mantém o conteúdo
          pedagógico do original.
        </p>
        <p>
          O registro das regras aplicadas e da versão do conjunto fica guardado junto com o
          arquivo, e não pode ser alterado depois.
        </p>
      </Dialogo>
    </>
  );
}
