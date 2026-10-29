import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  Eye,
  FileText,
  Info,
  Link2Off,
  Pencil,
  Printer,
  Send,
  Trash2,
} from 'lucide-react';
import { Aviso, AvisoConteudoDemo, Botao, Etiqueta } from '../componentes/basicos.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAdaptacao, usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Tela da atividade: revisar, editar e excluir as questões (RF13, RF14),
   publicar e revogar o link (RF15, RF18). Cada questão mostra o trecho do
   material de onde saiu (RN04). */

export function Atividade() {
  const { id } = useParams();
  const { material, modoServidor, salvarQuestoes, gerarQuestoes, publicar: publicarNoSistema, revogar: revogarNoSistema } =
    usarApp();
  const { dados: adaptacao, carregando, erro: erroCarga } = usarAdaptacao(id);
  const { anunciar } = usarAnuncios();

  const dados = material(id);
  const questoes = adaptacao?.questoes ?? [];
  const [falha, setFalha] = useState(null);
  const [gerando, setGerando] = useState(false);

  usarTituloDaPagina(dados ? `Atividade — ${dados.nome}` : 'Material não encontrado');

  const [emEdicao, setEmEdicao] = useState(null);
  const [aExcluir, setAExcluir] = useState(null);
  const [confirmandoPublicacao, setConfirmandoPublicacao] = useState(false);
  const [confirmandoRevogacao, setConfirmandoRevogacao] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [abertas, setAbertas] = useState(() => new Set());

  function alternar(idQuestao) {
    setAbertas((atuais) => {
      const nova = new Set(atuais);
      if (nova.has(idQuestao)) nova.delete(idQuestao);
      else nova.add(idQuestao);
      return nova;
    });
  }

  if (!dados) {
    return (
      <Aviso tipo="erro" titulo="Material não encontrado">
        <p>
          Este material não existe ou foi excluído.{' '}
          <Link to="/painel">Voltar para meus materiais</Link>
        </p>
      </Aviso>
    );
  }

  const atividade = dados.atividade ?? { estado: 'rascunho', codigo: null };
  const publicada = atividade.estado === 'publicada';
  const endereco = atividade.codigo
    ? `${window.location.origin}${window.location.pathname}#/atividade/${atividade.codigo}`
    : null;

  /** Executa uma operação e, se falhar, mostra o erro do servidor na tela. */
  async function tentar(operacao, aviso) {
    setFalha(null);
    try {
      await operacao();
      if (aviso) anunciar(aviso);
      return true;
    } catch (problema) {
      setFalha(problema);
      anunciar(`Erro: ${problema.titulo}`);
      return false;
    }
  }

  async function salvarQuestao(questaoEditada) {
    const salvou = await tentar(
      () => salvarQuestoes(id, questoes.map((q) => (q.id === questaoEditada.id ? questaoEditada : q))),
      'Questão salva.',
    );
    if (salvou) setEmEdicao(null);
  }

  async function excluirQuestao() {
    const alvo = aExcluir;
    setAExcluir(null);
    await tentar(
      () => salvarQuestoes(id, questoes.filter((q) => q.id !== alvo.id)),
      'Questão excluída da atividade.',
    );
  }

  async function gerar() {
    setGerando(true);
    await tentar(() => gerarQuestoes(id), 'Questões geradas a partir do material.');
    setGerando(false);
  }

  async function publicar() {
    setConfirmandoPublicacao(false);
    let codigo = '';
    const publicou = await tentar(async () => {
      codigo = (await publicarNoSistema(id)).codigo;
    });
    if (publicou) anunciar(`Atividade publicada. O código de acesso é ${codigo.split('').join(' ')}.`);
  }

  async function revogar() {
    setConfirmandoRevogacao(false);
    await tentar(
      () => revogarNoSistema(id),
      'Link revogado. A atividade não pode mais ser acessada pelos estudantes.',
    );
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      anunciar('Link copiado.');
      window.setTimeout(() => setCopiado(false), 4000);
    } catch {
      anunciar('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.');
    }
  }

  return (
    <>
      <Link to={`/materiais/${id}/adaptacao`} className="voltar">
        <ArrowLeft aria-hidden="true" />
        Voltar para a adaptação
      </Link>

      <div className="cabecalho-pagina">
        <h1>Atividade</h1>
        <p>
          Revise as perguntas e publique a atividade para os estudantes. As perguntas foram geradas
          a partir deste material, e só dele.
        </p>
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

      {carregando && (
        <p role="status" className="campo__dica">
          Carregando as questões…
        </p>
      )}

      {erroCarga?.status === 404 && (
        <Aviso tipo="atencao" titulo="Este material ainda não foi adaptado">
          <p>
            As questões são geradas a partir do texto adaptado.{' '}
            <Link to={`/materiais/${id}/adaptacao`}>Abrir a adaptação</Link>
          </p>
        </Aviso>
      )}

      <div className="atividade-grade">
        <div className="pilha">
          <section className="cartao origem" aria-labelledby="titulo-origem">
            <h2 id="titulo-origem">Material de origem</h2>
            <div className="origem__corpo">
              <span className="material-resumo__icone" aria-hidden="true">
                <FileText />
              </span>
              <div>
                <p className="material-resumo__nome">{dados.nome}</p>
                <p className="material-resumo__meta">
                  {[dados.disciplina, `${dados.paginas} páginas`, `Enviado em ${dados.enviadoEm}`]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>
              <Botao como="link" para={`/materiais/${id}/adaptacao`} variante="secundario">
                <FileText aria-hidden="true" />
                Ver material adaptado
              </Botao>
            </div>
          </section>

          <section className="cartao" aria-labelledby="titulo-perguntas">
            <h2 id="titulo-perguntas">Perguntas da atividade</h2>
            <p className="campo__dica">
              {questoes.length === 0
                ? 'Nenhuma pergunta nesta atividade.'
                : `${questoes.length} ${questoes.length === 1 ? 'pergunta gerada' : 'perguntas geradas'} com base no seu material adaptado (RN04). Abra uma pergunta para ver as alternativas, editar ou excluir.`}
            </p>

            {questoes.length === 0 ? (
              <div className="vazio" style={{ padding: 'var(--e5) var(--e4)' }}>
                <p>
                  {modoServidor
                    ? 'As questões não foram geradas, ou todas foram excluídas. Não é possível publicar uma atividade vazia.'
                    : 'Você excluiu todas as questões. Não é possível publicar uma atividade vazia.'}
                </p>
                {modoServidor && adaptacao && (
                  <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e4)' }}>
                    <Botao onClick={gerar} disabled={gerando}>
                      {gerando ? 'Gerando as questões…' : 'Gerar as questões a partir do material'}
                    </Botao>
                  </div>
                )}
              </div>
            ) : (
              <ol className="perguntas-lista">
                {questoes.map((questao, indice) => {
                  const aberta = abertas.has(questao.id) || emEdicao?.id === questao.id;
                  const idDetalhe = `pergunta-${questao.id}`;
                  return (
                    <li key={questao.id} className="pergunta" data-aberta={aberta ? 'sim' : undefined}>
                      <h3 className="pergunta__cabecalho">
                        <button
                          type="button"
                          className="pergunta__botao"
                          aria-expanded={aberta}
                          aria-controls={idDetalhe}
                          onClick={() => alternar(questao.id)}
                        >
                          <span className="pergunta__numero" aria-hidden="true">
                            {indice + 1}
                          </span>
                          <span className="apenas-leitor">Pergunta {indice + 1}: </span>
                          <span className="pergunta__enunciado">{questao.enunciado}</span>
                          <Etiqueta tom="neutra">{questao.mecanica}</Etiqueta>
                          <ChevronDown className="pergunta__seta" aria-hidden="true" />
                        </button>
                      </h3>

                      {aberta && (
                        <div className="pergunta__detalhe" id={idDetalhe}>
                          {emEdicao?.id === questao.id ? (
                            <EditorQuestao
                              questao={emEdicao}
                              numero={indice + 1}
                              aoMudar={setEmEdicao}
                              aoSalvar={() => salvarQuestao(emEdicao)}
                              aoCancelar={() => setEmEdicao(null)}
                            />
                          ) : (
                            <>
                              <ul className="questao__alternativas">
                                {questao.alternativas.map((alternativa, i) => (
                                  <li
                                    key={alternativa}
                                    className={i === questao.correta ? 'questao__alternativa--correta' : undefined}
                                  >
                                    <span aria-hidden="true">{String.fromCharCode(65 + i)})</span>
                                    <span>
                                      {alternativa}
                                      {i === questao.correta && (
                                        <>
                                          {' '}
                                          <Etiqueta tom="boa" icone={CircleCheck}>
                                            resposta correta
                                          </Etiqueta>
                                        </>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {questao.trecho && (
                                <p className="campo__dica" style={{ marginTop: 'var(--e3)' }}>
                                  Origem no material: {questao.trecho}
                                </p>
                              )}
                              <div className="questao__acoes">
                                <Botao variante="secundario" onClick={() => setEmEdicao({ ...questao })}>
                                  <Pencil aria-hidden="true" />
                                  Editar
                                  <span className="apenas-leitor"> a pergunta {indice + 1}</span>
                                </Botao>
                                <Botao
                                  variante="discreto"
                                  onClick={() => setAExcluir({ ...questao, numero: indice + 1 })}
                                >
                                  <Trash2 aria-hidden="true" />
                                  Excluir
                                  <span className="apenas-leitor"> a pergunta {indice + 1}</span>
                                </Botao>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="pilha" aria-label="Publicação">
          <section className="cartao" aria-labelledby="titulo-link">
            <h2 id="titulo-link">Link para os estudantes</h2>

            {publicada ? (
              <>
                <p className="campo__dica">Copie o link e compartilhe com a turma.</p>
                <div className="link-copiar">
                  <label htmlFor="link-atividade" className="apenas-leitor">
                    Link da atividade
                  </label>
                  <input id="link-atividade" className="entrada" readOnly value={endereco} />
                  <button type="button" className="link-copiar__botao" onClick={copiarLink}>
                    {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    <span className="apenas-leitor">{copiado ? 'Link copiado' : 'Copiar o link'}</span>
                  </button>
                </div>
                <p className="link-copiar__codigo">
                  Código de acesso: <strong>{atividade.codigo}</strong>
                  {atividade.publicadaEm ? ` · publicada em ${atividade.publicadaEm}` : null}
                </p>
              </>
            ) : (
              <p className="campo__dica">
                {atividade.estado === 'revogada'
                  ? 'O link anterior foi revogado e não abre mais. Publique de novo para gerar um código novo.'
                  : 'O link aparece aqui depois que você publicar a atividade.'}
              </p>
            )}

            <div className="nota-info">
              <Info aria-hidden="true" />
              <p>
                <strong>Os estudantes não precisam de conta.</strong> A atividade abre direto no
                link. O sistema não guarda nome, e-mail nem nota da criança.
              </p>
            </div>

            <div className="pilha" style={{ marginTop: 'var(--e4)' }}>
              <Botao
                largo
                onClick={() => setConfirmandoPublicacao(true)}
                disabled={questoes.length === 0}
              >
                <Send aria-hidden="true" />
                {publicada ? 'Publicar de novo com código novo' : 'Publicar atividade'}
              </Botao>
              {publicada && (
                <>
                  <Botao como="link" para={`/atividade/${atividade.codigo}`} variante="secundario" largo>
                    <Eye aria-hidden="true" />
                    Abrir como o estudante vê
                  </Botao>
                  <Botao variante="perigo" largo onClick={() => setConfirmandoRevogacao(true)}>
                    <Link2Off aria-hidden="true" />
                    Revogar o link
                  </Botao>
                </>
              )}
            </div>
            <p className="campo__dica" style={{ marginTop: 'var(--e3)', marginBottom: 0 }}>
              {publicada
                ? 'Publicar de novo gera um código novo e o link antigo deixa de funcionar.'
                : 'Depois de publicar, a atividade fica disponível para quem tiver o link.'}
            </p>
          </section>

          {/* RF23 — folha impressa das questões, disponível antes de publicar. */}
          {questoes.length > 0 && (
            <section className="cartao cartao--compacto" aria-labelledby="titulo-impressao">
              <h2 id="titulo-impressao">Versão impressa</h2>
              <p className="campo__dica">Folha com as perguntas, com e sem gabarito (RF23).</p>
              <Botao como="link" para={`/materiais/${id}/questionario`} variante="secundario" largo>
                <Printer aria-hidden="true" />
                Imprimir ou salvar em PDF
              </Botao>
            </section>
          )}
        </aside>
      </div>

      {/* Publicar de novo gera código novo e invalida o link anterior; o diálogo
         avisa isso. */}
      <Dialogo
        aberto={confirmandoPublicacao}
        titulo={publicada ? 'Publicar de novo com um código novo?' : 'Publicar a atividade?'}
        rotuloConfirmar={publicada ? 'Sim, gerar código novo' : 'Publicar'}
        perigo={publicada}
        aoCancelar={() => setConfirmandoPublicacao(false)}
        aoConfirmar={publicar}
      >
        <p>
          Vão ser publicadas {questoes.length}{' '}
          {questoes.length === 1 ? 'questão' : 'questões'} sobre <strong>{dados.nome}</strong>.
        </p>
        {publicada ? (
          <p>
            O código atual <strong>{dados.atividade.codigo}</strong> deixa de funcionar
            imediatamente. Quem já tiver o link antigo perde o acesso, e você vai precisar
            entregar o novo link à turma.
          </p>
        ) : (
          <p>Qualquer pessoa com o link vai conseguir responder, sem precisar de conta.</p>
        )}
      </Dialogo>

      <Dialogo
        aberto={confirmandoRevogacao}
        titulo="Revogar o link desta atividade?"
        rotuloConfirmar="Sim, revogar"
        perigo
        aoCancelar={() => setConfirmandoRevogacao(false)}
        aoConfirmar={revogar}
      >
        <p>
          O link deixa de funcionar imediatamente. Estudantes que estiverem respondendo perdem o
          acesso.
        </p>
        <p>Você pode publicar de novo depois, e o sistema gera um código diferente.</p>
      </Dialogo>

      <Dialogo
        aberto={Boolean(aExcluir)}
        titulo={`Excluir a questão ${aExcluir?.numero}?`}
        rotuloConfirmar="Sim, excluir"
        perigo
        aoCancelar={() => setAExcluir(null)}
        aoConfirmar={excluirQuestao}
      >
        <p>{aExcluir?.enunciado}</p>
        <p>A questão sai da atividade. As demais continuam como estão.</p>
      </Dialogo>
    </>
  );
}

/** Edição da questão no próprio lugar, sem trocar de tela. */
function EditorQuestao({ questao, numero, aoMudar, aoSalvar, aoCancelar }) {
  return (
    <div className="editor-questao" aria-label={`Editando a pergunta ${numero}`} role="group">

      <label className="campo" style={{ maxWidth: 'none' }}>
        <span className="campo__rotulo">Pergunta</span>
        <textarea
          className="area-texto"
          style={{ minHeight: '5rem' }}
          value={questao.enunciado}
          onChange={(e) => aoMudar({ ...questao, enunciado: e.target.value })}
        />
      </label>

      <fieldset>
        <legend>Alternativas — marque a resposta correta</legend>
        {questao.alternativas.map((alternativa, i) => (
          <div key={i} className="linha" style={{ marginBottom: 'var(--e2)', flexWrap: 'nowrap' }}>
            <input
              type="radio"
              name={`correta-${questao.id}`}
              id={`correta-${questao.id}-${i}`}
              checked={questao.correta === i}
              onChange={() => aoMudar({ ...questao, correta: i })}
              style={{ width: '1.15rem', height: '1.15rem', flex: 'none' }}
            />
            <label htmlFor={`correta-${questao.id}-${i}`} className="apenas-leitor">
              Marcar a alternativa {String.fromCharCode(65 + i)} como correta
            </label>
            <input
              className="entrada"
              aria-label={`Texto da alternativa ${String.fromCharCode(65 + i)}`}
              value={alternativa}
              onChange={(e) => {
                const novas = [...questao.alternativas];
                novas[i] = e.target.value;
                aoMudar({ ...questao, alternativas: novas });
              }}
            />
          </div>
        ))}
      </fieldset>

      <div className="questao__acoes">
        <Botao variante="discreto" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao onClick={aoSalvar}>Salvar pergunta</Botao>
      </div>
    </div>
  );
}
