import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Aviso, Botao, Cartao, Etiqueta, Migalhas } from '../componentes/basicos.jsx';
import { BarraProgresso, Passos } from '../componentes/Passos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
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

export function Enviar() {
  usarTituloDaPagina('Enviar material');
  const navegar = useNavigate();
  const { acrescentarMaterial } = usarApp();
  const { anunciar } = usarAnuncios();

  const [passo, setPasso] = useState(0);
  const [arquivo, setArquivo] = useState(ARQUIVOS_DEMO[0]);
  const [disciplina, setDisciplina] = useState('Ciências');
  const [problema, setProblema] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [etapaAtual, setEtapaAtual] = useState('');
  const cancelamento = useRef({ cancelado: false });
  const areaProblema = useRef(null);

  const problemaPrevio = validarArquivo(arquivo);

  function mostrarProblema(erro) {
    setProblema(erro);
    anunciar(`Erro: ${erro.titulo}`);
    window.setTimeout(() => areaProblema.current?.focus(), 0);
  }

  async function avancarParaConfiguracao() {
    setProblema(null);
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
    cancelamento.current = { cancelado: false };
    anunciar('Etapa 3 de 3: processando o material. Isso leva alguns segundos.');

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
  }

  return (
    <>
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
                Regra do sistema: {problema.regra}. A recusa é proposital — adaptar um material
                lido pela metade produziria um resultado errado sem avisar você.
              </p>
            )}
          </Aviso>
        </div>
      )}

      {passo === 0 && (
        <Cartao>
          <h2>1. Escolher o material</h2>
          <p className="campo__dica">
            Aceitamos PDF e Word (.docx), com até 20 páginas e 15 MB por envio.
          </p>

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
            <Botao onClick={avancarParaConfiguracao} disabled={Boolean(problemaPrevio)}>
              Continuar
            </Botao>
          </div>
        </Cartao>
      )}

      {passo === 1 && (
        <Cartao>
          <h2>2. Configurar a adaptação</h2>

          <Aviso tipo="boa" titulo="Material lido com sucesso">
            <p>
              <strong>{arquivo.nome}</strong> — {arquivo.paginas} páginas, texto extraído com a
              ordem de leitura e os títulos preservados.
            </p>
          </Aviso>

          <div className="campo">
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

          <div className="linha" style={{ marginTop: 'var(--e4)' }}>
            <Etiqueta tom="info">
              Conjunto {CONJUNTO_REGRAS.identificador} v{CONJUNTO_REGRAS.versao}
            </Etiqueta>
            <span className="campo__dica" style={{ marginBottom: 0 }}>
              A versão do conjunto de regras fica registrada junto com a adaptação e não pode ser
              alterada depois (RN08).
            </span>
          </div>

          <div className="linha linha-fim">
            <Botao variante="discreto" onClick={() => setPasso(0)}>
              Voltar
            </Botao>
            <Botao onClick={iniciarProcessamento}>Adaptar material</Botao>
          </div>
        </Cartao>
      )}

      {passo === 2 && (
        <Cartao>
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
    </>
  );
}
