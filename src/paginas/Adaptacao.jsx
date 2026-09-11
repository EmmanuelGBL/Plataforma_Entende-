import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Aviso, AvisoConteudoDemo, Botao, Cartao, Etiqueta, Migalhas } from '../componentes/basicos.jsx';
import { ComparadorTextos, TabelaMetricas } from '../componentes/Comparador.jsx';
import { PainelRegras } from '../componentes/PainelRegras.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { CONJUNTO_REGRAS, METRICAS } from '../dados/conteudo.js';
import { aprovarEExportar, processarAdaptacao } from '../servicos/api.js';
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
  const { material, adaptacao, atualizarMaterial, definirBlocos } = usarApp();
  const { anunciar } = usarAnuncios();

  const dados = material(id);
  const { blocos } = adaptacao(id);

  usarTituloDaPagina(dados ? `Adaptação — ${dados.nome}` : 'Material não encontrado');

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(() => serializar(blocos));
  const [confirmando, setConfirmando] = useState(false);
  const [exportado, setExportado] = useState(null);
  const [reprocessando, setReprocessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapaAtual, setEtapaAtual] = useState('');

  const textoOriginalSalvo = useMemo(() => serializar(blocos), [blocos]);
  const houveMudanca = rascunho !== textoOriginalSalvo;

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

  function salvarEdicao() {
    definirBlocos(id, desserializar(rascunho, blocos));
    setEditando(false);
    anunciar('Alterações salvas no texto adaptado.');
  }

  function descartarEdicao() {
    setRascunho(textoOriginalSalvo);
    setEditando(false);
    anunciar('Alterações descartadas. O texto voltou como estava.');
  }

  async function confirmarExportacao() {
    setConfirmando(false);
    const resultado = await aprovarEExportar(id);
    atualizarMaterial(id, { estado: 'aprovado' });
    setExportado(resultado);
    anunciar(`Material aprovado e exportado como ${resultado.arquivo}.`);
  }

  async function reprocessar() {
    setReprocessando(true);
    setProgresso(0);
    anunciar('Reprocessando o material com a versão atual do conjunto de regras.');
    await processarAdaptacao((percentual, etapa) => {
      setProgresso(percentual);
      setEtapaAtual(etapa);
    }, { cancelado: false });
    atualizarMaterial(id, {
      versaoRegras: `${CONJUNTO_REGRAS.identificador} v${CONJUNTO_REGRAS.versao}`,
      estado: 'adaptado',
    });
    setReprocessando(false);
    anunciar('Material reprocessado com o conjunto TEA versão 1.3.');
  }

  const versaoDesatualizada =
    dados.versaoRegras !== `${CONJUNTO_REGRAS.identificador} v${CONJUNTO_REGRAS.versao}`;

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: 'Meus materiais', para: '/painel' },
          { rotulo: dados.nome },
        ]}
      />

      <div className="cabecalho-pagina">
        <h1>{dados.nome}</h1>
        <div className="linha">
          <Etiqueta tom="info">Perfil TEA</Etiqueta>
          <Etiqueta tom="neutra">{dados.etapa}</Etiqueta>
          <Etiqueta tom="neutra">{dados.versaoRegras}</Etiqueta>
          {dados.estado === 'aprovado' && <Etiqueta tom="boa">Aprovado por você</Etiqueta>}
        </div>
      </div>

      <AvisoConteudoDemo material={dados} />

      {exportado && (
        <Aviso tipo="boa" titulo="Material aprovado" papel="status">
          <p>
            Aprovado em {exportado.geradoEm}. O material sai com fonte sem serifa, alinhamento à
            esquerda, entrelinha 1,5 e linha de no máximo 80 caracteres.
          </p>
          <p>
            <Botao como="link" para={`/materiais/${id}/impressao`}>
              Abrir o material em PDF
            </Botao>
          </p>
        </Aviso>
      )}

      {versaoDesatualizada && !reprocessando && (
        <Aviso tipo="atencao" titulo="Há uma versão mais nova do conjunto de regras">
          <p>
            Esta adaptação usou o conjunto <strong>{dados.versaoRegras}</strong>. A versão atual é
            a <strong>
              {CONJUNTO_REGRAS.identificador} v{CONJUNTO_REGRAS.versao}
            </strong>
            , publicada em {CONJUNTO_REGRAS.publicadoEm}.
          </p>
          <p>
            <Botao variante="secundario" onClick={reprocessar}>
              Reprocessar com a versão atual
            </Botao>
          </p>
          <p className="campo__dica">
            Não é preciso enviar o arquivo de novo. O material original continua guardado (RF12).
          </p>
        </Aviso>
      )}

      {reprocessando && (
        <Cartao>
          <h2>Reprocessando</h2>
          <BarraProgresso valor={progresso} etapa={etapaAtual} />
        </Cartao>
      )}

      <div className="duas-colunas">
        <div className="pilha-g">
          <section aria-labelledby="titulo-comparacao">
            <div
              className="linha"
              style={{ justifyContent: 'space-between', marginBottom: 'var(--e3)' }}
            >
              <h2 id="titulo-comparacao">Comparar original e adaptado</h2>
              {!editando && (
                <Botao variante="secundario" onClick={() => setEditando(true)}>
                  Editar o texto adaptado
                </Botao>
              )}
            </div>

            {editando ? (
              <Cartao>
                <h3>Editando o texto adaptado</h3>
                <p className="campo__dica">
                  Linhas iniciadas por <code>##</code> são subtítulos. Deixe uma linha em branco
                  entre os parágrafos. Você pode desfazer tudo enquanto não salvar.
                </p>
                <label className="campo" style={{ maxWidth: 'none' }}>
                  <span className="apenas-leitor">Texto adaptado</span>
                  <textarea
                    className="area-texto"
                    value={rascunho}
                    onChange={(e) => setRascunho(e.target.value)}
                  />
                </label>
                <div className="linha linha-fim">
                  <Botao variante="discreto" onClick={descartarEdicao}>
                    Descartar alterações
                  </Botao>
                  <Botao onClick={salvarEdicao} disabled={!houveMudanca}>
                    Salvar alterações
                  </Botao>
                </div>
              </Cartao>
            ) : (
              <ComparadorTextos blocos={blocos} />
            )}
          </section>

          <TabelaMetricas metricas={METRICAS} />

          <Cartao>
            <h2>Aprovar e exportar</h2>
            <p>
              Nenhum material é exportado sem a sua aprovação. Você é responsável pelo conteúdo
              pedagógico; o sistema só propõe a forma.
            </p>
            <div className="linha" style={{ marginTop: 'var(--e4)' }}>
              {/* RN02 — o botão do PDF só aparece depois da aprovação. Material
                  já aprovado antes continua com o PDF disponível, sem precisar
                  aprovar de novo. */}
              {dados.estado === 'aprovado' ? (
                <Botao como="link" para={`/materiais/${id}/impressao`}>
                  Abrir o material em PDF
                </Botao>
              ) : (
                <Botao onClick={() => setConfirmando(true)}>Aprovar e exportar em PDF</Botao>
              )}
              <Botao
                variante="secundario"
                onClick={() => navegar(`/materiais/${id}/atividade`)}
              >
                Ir para a atividade
              </Botao>
            </div>
          </Cartao>
        </div>

        <PainelRegras />
      </div>

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
