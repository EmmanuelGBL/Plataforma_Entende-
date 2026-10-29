import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChartColumnBig, Check, FileText, Gamepad2, Pencil } from 'lucide-react';
import { Aviso, Botao, Cartao, Etiqueta } from '../componentes/basicos.jsx';
import { ComparadorTextos, TabelaMetricas } from '../componentes/Comparador.jsx';
import { PainelRegras } from '../componentes/PainelRegras.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAdaptacao, usarApp, usarCatalogo } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { BarraProgresso } from '../componentes/Passos.jsx';

/* Revisão da adaptação: comparação original × adaptado, métricas, regras
   aplicadas, edição, aprovação e reprocessamento (RF05–RF12). */

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
      // O bloco mantém a regra que o originou: o professor edita o texto, não
      // o registro (RN08).
      regra: blocosOriginais[indice]?.regra,
      paragrafos: corpo.split(/\n\s*\n/).filter(Boolean),
    };
  });
}

/** Resumo das métricas na coluna lateral: o nível de leitura estimado
 *  (índice de Flesch adaptado). O quadro completo fica abaixo da comparação. */
function ResumoMetricas({ metricas }) {
  const nivel = metricas.find((m) => m.nome === 'Nível de leitura estimado');
  if (!nivel) return null;
  return (
    <section className="cartao cartao--compacto resumo-metricas" aria-labelledby="titulo-resumo-metricas">
      <h2 id="titulo-resumo-metricas">Métricas de legibilidade</h2>
      <dl>
        <div className="resumo-metricas__item resumo-metricas__item--original">
          <dt>Texto original</dt>
          <dd>
            <ChartColumnBig aria-hidden="true" />
            {nivel.original}
          </dd>
        </div>
        <div className="resumo-metricas__item resumo-metricas__item--adaptado">
          <dt>Texto adaptado</dt>
          <dd>
            <ChartColumnBig aria-hidden="true" />
            {nivel.adaptado}
          </dd>
        </div>
      </dl>
      <p className="campo__dica">
        Nível de leitura estimado.{' '}
        <button
          type="button"
          className="link-botao"
          onClick={() => {
            const titulo = document.getElementById('titulo-metricas');
            titulo?.scrollIntoView({ block: 'start' });
            titulo?.focus();
          }}
        >
          Ver todas as métricas
        </button>
      </p>
    </section>
  );
}

export function Adaptacao() {
  const { id } = useParams();
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

  // No modo servidor, edita-se o Markdown guardado pelo servidor.
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
    // Sempre reabre a partir do texto salvo, para não recuperar um rascunho
    // descartado.
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
      anunciar('Material aprovado. O botão Abrir o material em PDF agora abre o arquivo.');
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

  const aprovado = dados.estado === 'aprovado';

  return (
    <>
      <Link to="/painel" className="voltar">
        <ArrowLeft aria-hidden="true" />
        Voltar para Meus materiais
      </Link>

      <div className="cabecalho-pagina cabecalho-acoes">
        <div>
          <h1>Adaptação do material</h1>
          <p>
            O Entende+ aplicou o conjunto de regras para TEA. Revise, edite se necessário e aprove
            a versão.
          </p>
          <div className="material-resumo">
            <span className="material-resumo__icone" aria-hidden="true">
              <FileText />
            </span>
            <div>
              <p className="material-resumo__nome">{dados.nome}</p>
              <p className="material-resumo__meta">
                {[dados.disciplina, `Enviado em ${dados.enviadoEm}`, dados.versaoRegras]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
              {(aprovado || adaptacao?.editada) && (
                <div className="linha" style={{ marginTop: 'var(--e2)', gap: 'var(--e2)' }}>
                  {aprovado && <Etiqueta tom="boa">Aprovado por você</Etiqueta>}
                  {adaptacao?.editada && <Etiqueta tom="neutra">Editado por você</Etiqueta>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RN02 — o PDF só existe depois da aprovação. */}
        {adaptacao && (
          <div className="adaptacao-acoes">
            {aprovado ? (
              <Botao como="link" para={`/materiais/${id}/impressao`} largo>
                <FileText aria-hidden="true" />
                Abrir o material em PDF
              </Botao>
            ) : (
              <Botao onClick={() => setConfirmando(true)} largo>
                <Check aria-hidden="true" />
                Aprovar e gerar PDF
              </Botao>
            )}
            <Botao como="link" para={`/materiais/${id}/atividade`} variante="secundario" largo>
              <Gamepad2 aria-hidden="true" />
              Ir para a atividade
            </Botao>
          </div>
        )}
      </div>

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
          <p>
            Aprovado em {exportado.aprovadoEm}. O material sai com fonte sem serifa, alinhamento à
            esquerda, entrelinha 1,5 e linha de no máximo 80 caracteres. O botão “Abrir o material
            em PDF”, ao lado do título, agora abre o arquivo.
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
          <p className="campo__dica">Não é preciso enviar o arquivo de novo.</p>
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
        <>
          <div className="adaptacao-grade">
            <div className="pilha-g">
              <section aria-labelledby="titulo-comparacao">
                <h2 id="titulo-comparacao" className="apenas-leitor">
                  Comparar original e adaptado
                </h2>

                {/* A edição abre em diálogo, e a comparação continua visível atrás. */}
                <ComparadorTextos
                  original={adaptacao.original}
                  blocos={adaptacao.blocos}
                  regras={adaptacao.regras}
                  acaoAdaptado={
                    <Botao variante="secundario" onClick={abrirEdicao}>
                      <Pencil aria-hidden="true" />
                      Editar texto
                    </Botao>
                  }
                />
              </section>

              <TabelaMetricas metricas={adaptacao.metricas} />
            </div>

            <div className="adaptacao-lateral">
              <PainelRegras conjunto={adaptacao.conjunto} regras={adaptacao.regras} />
              <ResumoMetricas metricas={adaptacao.metricas} />
            </div>
          </div>
        </>
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
