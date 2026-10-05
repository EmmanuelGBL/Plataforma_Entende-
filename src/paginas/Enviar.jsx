import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Aviso, Botao, Cartao, Etiqueta, Migalhas } from '../componentes/basicos.jsx';
import { BarraProgresso, Passos } from '../componentes/Passos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp, usarCatalogo } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { ARQUIVOS_DEMO, CONJUNTO_REGRAS } from '../dados/conteudo.js';
import { enviarMaterial, processarAdaptacao, validarArquivo } from '../servicos/api.js';

/* =========================================================================
   UC02 — Enviar material (RF02)   ·   UC03 — Extrair conteúdo (RF03)
   UC04 — Configurar adaptação (RF04)

   Por que três passos e não um formulário só: cada passo tem uma decisão e
   uma só. Um formulário único com arquivo, perfil, etapa e disciplina junto
   é mais rápido para quem já conhece o sistema e pior para quem está na
   primeira vez — e o público aqui é professor sem formação técnica, no fim
   do dia de trabalho (H8 e H2).

   O passo 1 valida antes de enviar (H5). O erro de extração da RN09 é
   deliberadamente demonstrável: o arquivo "Aula-digitalizada-scanner.pdf"
   sempre recusa, e é o que sustenta a heurística H9 na avaliação.
   ========================================================================= */

const PASSOS = ['Escolher o material', 'Configurar a adaptação', 'Processar'];

const LIMITE_MB = 15; // RNF08 — o servidor confere de novo, e confere também as páginas

function tamanhoLegivel(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Validação antes de enviar (H5): formato e tamanho. As páginas só o
 *  servidor sabe contar. */
function problemaDoArquivo(arquivo) {
  if (!arquivo) return null;
  if (!/\.(pdf|docx)$/i.test(arquivo.name)) {
    return {
      titulo: 'Este tipo de arquivo não é aceito',
      motivo: `“${arquivo.name}” não é um PDF nem um documento do Word (.docx).`,
      saida: 'Escolha o material em PDF ou em .docx.',
    };
  }
  if (arquivo.size > LIMITE_MB * 1024 * 1024) {
    return {
      titulo: 'Este material está acima do limite aceito',
      motivo: `O arquivo tem ${tamanhoLegivel(arquivo.size)}. O limite é de ${LIMITE_MB} MB por envio.`,
      saida: 'Separe o material em partes menores — por exemplo, um capítulo por envio — e envie de novo.',
    };
  }
  return null;
}

/* Perfis fora do escopo desta versão. Aparecem na tela desligados, nunca
   selecionáveis, e sempre rotulados como extensão futura. */
const PERFIS_FUTUROS = [
  {
    sigla: 'TDAH',
    nome: 'Transtorno do Déficit de Atenção com Hiperatividade',
    apoio: 'Exigiria um conjunto de regras próprio. Não faz parte desta versão.',
  },
  {
    sigla: 'Dislexia',
    nome: 'Transtorno específico da leitura',
    apoio: 'Exigiria um conjunto de regras próprio. Não faz parte desta versão.',
  },
];

export function Enviar() {
  usarTituloDaPagina('Enviar material');
  const navegar = useNavigate();
  const { acrescentarMaterial, modoServidor, enviarArquivo, adaptarMaterial, excluir } = usarApp();
  const catalogo = usarCatalogo();
  const conjuntoVigente = catalogo?.conjunto ?? CONJUNTO_REGRAS;
  const { anunciar } = usarAnuncios();
  const [arquivoReal, setArquivoReal] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [passo, setPasso] = useState(0);
  const [arquivo, setArquivo] = useState(ARQUIVOS_DEMO[0]);
  const [disciplina, setDisciplina] = useState('Ciências');
  const [problema, setProblema] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [etapaAtual, setEtapaAtual] = useState('');
  const cancelamento = useRef({ cancelado: false });
  const areaProblema = useRef(null);

  const problemaPrevio = modoServidor ? problemaDoArquivo(arquivoReal) : validarArquivo(arquivo);
  const nomeDoMaterial = modoServidor ? (enviado?.nome_arquivo ?? arquivoReal?.name) : arquivo.nome;
  const paginasDoMaterial = modoServidor
    ? enviado?.paginas_estimadas
      ? `cerca de ${enviado.numero_paginas}`
      : enviado?.numero_paginas
    : arquivo.paginas;

  function mostrarProblema(erro) {
    setProblema(erro);
    anunciar(`Erro: ${erro.titulo}`);
    window.setTimeout(() => areaProblema.current?.focus(), 0);
  }

  async function avancarParaConfiguracao() {
    setProblema(null);
    if (modoServidor) {
      setEnviando(true);
      anunciar('Enviando o material e lendo o texto.');
      try {
        setEnviado(await enviarArquivo(arquivoReal));
        setPasso(1);
        anunciar('Material aceito. Etapa 2 de 3: configurar a adaptação.');
      } catch (erro) {
        mostrarProblema(erro);
      } finally {
        setEnviando(false);
      }
      return;
    }
    try {
      await enviarMaterial(arquivo);
      setPasso(1);
      anunciar('Material aceito. Etapa 2 de 3: configurar a adaptação.');
    } catch (erro) {
      mostrarProblema(erro);
    }
  }

  async function iniciarProcessamento() {
    setPasso(2);
    setProgresso(0);
    cancelamento.current = { cancelado: false, controle: new AbortController() };
    anunciar('Etapa 3 de 3: processando o material. Isso leva alguns segundos.');

    if (modoServidor) {
      try {
        await adaptarMaterial(enviado.id, (percentual, etapa) => {
          setProgresso(percentual);
          setEtapaAtual(etapa);
        }, cancelamento.current);
        anunciar('Adaptação concluída. Abrindo a revisão do material.');
        navegar(`/materiais/${enviado.id}/adaptacao`);
      } catch (erro) {
        if (cancelamento.current.cancelado) {
          // "Se cancelar, nada é salvo": o material já enviado sai junto.
          await excluir(enviado.id).catch(() => {});
          setEnviado(null);
          setArquivoReal(null);
          setPasso(0);
          anunciar('Processamento cancelado. Nenhum material foi salvo.');
          return;
        }
        // O material continua enviado: dá para tentar adaptar de novo daqui.
        setPasso(1);
        mostrarProblema(erro);
      }
      return;
    }

    try {
      await processarAdaptacao((percentual, etapa) => {
        setProgresso(percentual);
        setEtapaAtual(etapa);
      }, cancelamento.current);

      const id = `m-${Math.floor(Math.random() * 900 + 100)}`;
      acrescentarMaterial({
        id,
        nome: arquivo.nome,
        disciplina,
        paginas: arquivo.paginas,
        enviadoEm: new Date().toLocaleDateString('pt-BR'),
        perfil: 'TEA',
        etapa: '5º ano do ensino fundamental',
        estado: 'adaptado',
        versaoRegras: `${CONJUNTO_REGRAS.identificador} v${CONJUNTO_REGRAS.versao}`,
        // Só o arquivo de Ciências tem texto adaptado escrito para ele nesta
        // demonstração. Os demais abrem com o aviso de conteúdo de demonstração.
        conteudoProprio: arquivo.id === 'ok',
        atividade: { estado: 'rascunho', codigo: null },
      });
      anunciar('Adaptação concluída. Abrindo a revisão do material.');
      navegar(`/materiais/${id}/adaptacao`);
    } catch (erro) {
      if (cancelamento.current.cancelado) {
        setPasso(0);
        anunciar('Processamento cancelado. Nenhum material foi salvo.');
        return;
      }
      setPasso(0);
      mostrarProblema(erro);
    }
  }

  function cancelar() {
    cancelamento.current.cancelado = true;
    cancelamento.current.controle?.abort();
  }

  return (
    <div className="pagina-fluxo">
      <Migalhas itens={[{ rotulo: 'Meus materiais', para: '/painel' }, { rotulo: 'Enviar material' }]} />

      <div className="cabecalho-pagina">
        <h1>Enviar material</h1>
        <p>
          Envie um material que você já usa em aula. O Entende+ devolve a versão adaptada para o
          perfil TEA e uma atividade sobre o mesmo conteúdo.
        </p>
      </div>

      <Passos passos={PASSOS} atual={passo} />

      {problema && (
        <div ref={areaProblema} tabIndex={-1}>
          <Aviso tipo="erro" titulo={problema.titulo} papel="alert">
            <p>{problema.motivo}</p>
            <p>
              <strong>O que fazer:</strong> {problema.saida}
            </p>
            {problema.regra && (
              <p className="campo__dica">
                Regra do sistema: {problema.regra}.
                {problema.regra === 'RN09' &&
                  ' A recusa é proposital — adaptar um material lido pela metade produziria um resultado errado sem avisar você.'}
              </p>
            )}
          </Aviso>
        </div>
      )}

      {passo === 0 && (
        <Cartao className="cartao--acao">
          <h2>1. Escolher o material</h2>
          <p className="campo__dica">
            Aceitamos PDF e Word (.docx), com até 20 páginas e 15 MB por envio.
          </p>

          {/* O envio de arquivo próprio é a interação principal do produto, e
              some da tela se a demonstração mostrar só a lista de exemplos.
              Fica visível e desligado, com a razão escrita ao lado: é a mesma
              postura do aviso de conteúdo de demonstração e da declaração de
              limites na tela de entrada. */}
          {modoServidor ? (
            <div className="area-envio">
              <label className="campo" style={{ marginBottom: 0 }}>
                <span className="campo__rotulo">Arquivo do material</span>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    setArquivoReal(e.target.files?.[0] ?? null);
                    setProblema(null);
                  }}
                />
              </label>
              {arquivoReal && (
                <p className="campo__dica" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
                  {arquivoReal.name} · {tamanhoLegivel(arquivoReal.size)}
                </p>
              )}
            </div>
          ) : (
          <>
          <div className="area-envio">
            <Botao variante="secundario" disabled>
              Upload do material
            </Botao>
            <div className="linha" style={{ justifyContent: 'center' }}>
              <Etiqueta tom="neutra">Indisponível nesta demonstração</Etiqueta>
            </div>
            <p className="campo__dica" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
              O protótipo roda inteiro no navegador, sem servidor, e por isso não lê arquivo do seu
              computador. Escolha um dos materiais de exemplo abaixo.
            </p>
          </div>

          <fieldset>
            <legend>Arquivos disponíveis nesta demonstração</legend>
            {ARQUIVOS_DEMO.map((item) => {
              const marcado = arquivo.id === item.id;
              return (
                <label key={item.id} className={`opcao${marcado ? ' opcao--marcada' : ''}`}>
                  <input
                    type="radio"
                    name="arquivo"
                    value={item.id}
                    checked={marcado}
                    onChange={() => {
                      setArquivo(item);
                      setProblema(null);
                    }}
                  />
                  <span>
                    <span className="opcao__titulo">{item.nome}</span>
                    <span className="opcao__apoio">
                      {item.tamanho} · {item.paginas} páginas — {item.descricao}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          </>
          )}

          {problemaPrevio && (
            <Aviso tipo="atencao" titulo="Este arquivo não vai ser aceito">
              <p>{problemaPrevio.motivo}</p>
              <p>
                <strong>O que fazer:</strong> {problemaPrevio.saida}
              </p>
            </Aviso>
          )}

          <div className="linha linha-fim">
            <Botao como="link" para="/painel" variante="discreto">
              Cancelar
            </Botao>
            <Botao
              onClick={avancarParaConfiguracao}
              disabled={Boolean(problemaPrevio) || enviando || (modoServidor && !arquivoReal)}
            >
              {enviando ? 'Enviando…' : 'Continuar'}
            </Botao>
          </div>
        </Cartao>
      )}

      {passo === 1 && (
        <Cartao className="cartao--acao">
          <h2>2. Configurar a adaptação</h2>

          <Aviso tipo="boa" titulo="Material lido com sucesso">
            <p>
              <strong>{nomeDoMaterial}</strong> — {paginasDoMaterial} páginas, texto extraído com a
              ordem de leitura e os títulos preservados.
            </p>
          </Aviso>

          <div className="campo" style={{ maxWidth: '44rem' }}>
            <span className="campo__rotulo" id="rotulo-perfil">
              Perfil de adaptação
            </span>
            <div className="opcao opcao--marcada" aria-labelledby="rotulo-perfil">
              <span aria-hidden="true">●</span>
              <span>
                <span className="opcao__titulo">TEA — Transtorno do Espectro Autista</span>
                <span className="opcao__apoio">
                  Único perfil desta versão. Cada adaptação corresponde a um perfil só (RN03).
                </span>
              </span>
            </div>

            {/* Os dois perfis abaixo são o recorte do trabalho aparecendo na
                interface. Não são requisito, não são item de backlog e não
                podem ser escolhidos: o escopo foi fechado em TEA, e TDAH e
                dislexia constam apenas como extensão futura. Mostrá-los
                desligados, com o motivo escrito, explica ao professor por que
                a lista tem um item só — e mostra o caminho do produto sem
                prometer data. */}
            {PERFIS_FUTUROS.map((perfil) => (
              <div key={perfil.sigla} className="opcao opcao--indisponivel" aria-disabled="true">
                <span aria-hidden="true">○</span>
                <span>
                  <span className="opcao__titulo">
                    {perfil.sigla} — {perfil.nome}
                  </span>
                  <span className="opcao__apoio">{perfil.apoio}</span>
                </span>
                <span style={{ marginLeft: 'auto', flex: 'none' }}>
                  <Etiqueta tom="neutra">Extensão futura</Etiqueta>
                </span>
              </div>
            ))}

            <span className="campo__dica" style={{ marginTop: 'var(--e2)' }}>
              O conjunto de regras, os materiais de teste e a validação com professores foram
              construídos para o perfil TEA. Adaptar para outro perfil exige um conjunto de regras
              próprio, e não é o recorte deste trabalho.
            </span>
          </div>

          <label className="campo">
            <span className="campo__rotulo">Etapa escolar de destino</span>
            <select className="selecao" defaultValue="5" disabled>
              <option value="5">5º ano do ensino fundamental</option>
            </select>
            <span className="campo__dica">
              Esta versão do sistema foi construída e validada para o 5º ano.
            </span>
          </label>

          {!modoServidor && (
          <label className="campo">
            <span className="campo__rotulo">Disciplina</span>
            <select
              className="selecao"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
            >
              <option>Ciências</option>
              <option>História</option>
              <option>Geografia</option>
              <option>Língua Portuguesa</option>
              <option>Matemática</option>
            </select>
          </label>
          )}

          <div className="linha" style={{ marginTop: 'var(--e4)' }}>
            <Etiqueta tom="info">
              Conjunto {conjuntoVigente.identificador} v{conjuntoVigente.versao}
            </Etiqueta>
            <span className="campo__dica" style={{ marginBottom: 0 }}>
              A versão do conjunto de regras fica registrada junto com a adaptação e não pode ser
              alterada depois (RN08).
            </span>
          </div>

          <div className="linha linha-fim">
            {!modoServidor && (
              <Botao variante="discreto" onClick={() => setPasso(0)}>
                Voltar
              </Botao>
            )}
            <Botao onClick={iniciarProcessamento}>Adaptar material</Botao>
          </div>
        </Cartao>
      )}

      {passo === 2 && (
        <Cartao className="cartao--acao">
          <h2>3. Adaptando o material</h2>
          <p>
            Você pode acompanhar o andamento abaixo. Materiais de até 20 páginas levam menos de
            dois minutos.
          </p>

          <BarraProgresso valor={progresso} etapa={etapaAtual} />

          <div className="linha" style={{ marginTop: 'var(--e5)' }}>
            <Botao variante="secundario" onClick={cancelar}>
              Cancelar o processamento
            </Botao>
          </div>
          <p className="campo__dica" style={{ marginTop: 'var(--e3)' }}>
            Se cancelar, nada é salvo e o arquivo enviado é descartado.
          </p>
        </Cartao>
      )}
    </div>
  );
}
