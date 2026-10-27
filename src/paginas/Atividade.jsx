import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, AvisoConteudoDemo, Botao, Cartao, Etiqueta, Migalhas } from '../componentes/basicos.jsx';
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
      <Migalhas
        itens={[
          { rotulo: 'Meus materiais', para: '/painel' },
          { rotulo: dados.nome, para: `/materiais/${id}/adaptacao` },
          { rotulo: 'Atividade' },
        ]}
      />

      <div className="cabecalho-pagina">
        <h1>Atividade sobre {dados.nome}</h1>
        <p>
          As questões abaixo foram geradas a partir do conteúdo deste material, e só dele. Revise,
          altere ou exclua o que quiser antes de publicar.
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

      {publicada && (
        <Aviso tipo="boa" titulo="Atividade publicada" papel="status">
          <p>
            Código de acesso: <strong>{atividade.codigo}</strong>
            {atividade.publicadaEm ? ` · publicada em ${atividade.publicadaEm}` : null}
          </p>
          <p style={{ wordBreak: 'break-all' }}>
            <Link to={`/atividade/${atividade.codigo}`}>Abrir a atividade como o estudante vê</Link>
          </p>
          <div className="linha" style={{ marginTop: 'var(--e3)' }}>
            <Botao variante="secundario" onClick={copiarLink}>
              {copiado ? 'Link copiado ✓' : 'Copiar o link'}
            </Botao>
            <Botao variante="perigo" onClick={() => setConfirmandoRevogacao(true)}>
              Revogar o link
            </Botao>
          </div>
          <p className="campo__dica" style={{ marginTop: 'var(--e3)' }}>
            O estudante entra pelo link, sem cadastro e sem senha. O sistema não guarda nome,
            e-mail nem nota — nenhum dado que identifique a criança.
          </p>
        </Aviso>
      )}

      {atividade.estado === 'revogada' && (
        <Aviso tipo="atencao" titulo="Link revogado">
          <p>
            O link desta atividade foi revogado e não abre mais para os estudantes. Publique de
            novo para gerar um código novo.
          </p>
        </Aviso>
      )}

      <div className="linha" style={{ marginBottom: 'var(--e5)' }}>
        <Etiqueta tom="neutra">
          {questoes.length} {questoes.length === 1 ? 'questão' : 'questões'}
        </Etiqueta>
        <Etiqueta tom="info">Geradas do próprio material (RN04)</Etiqueta>
      </div>

      {/* RF23 — folha impressa das questões, disponível antes de publicar.
         Só aparece quando há questões. */}
      {questoes.length > 0 && (
        <div className="linha" style={{ marginBottom: 'var(--e5)' }}>
          <Botao como="link" para={`/materiais/${id}/questionario`} variante="secundario">
            Imprimir as questões ou salvar em PDF
          </Botao>
        </div>
      )}

      {questoes.length === 0 ? (
        <div className="cartao vazio">
          <h2>{modoServidor ? 'Nenhuma questão nesta atividade' : 'Nenhuma questão restante'}</h2>
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
        <ol className="questao-lista">
          {questoes.map((questao, indice) => (
            <li key={questao.id}>
              {emEdicao?.id === questao.id ? (
                <EditorQuestao
                  questao={emEdicao}
                  numero={indice + 1}
                  aoMudar={setEmEdicao}
                  aoSalvar={() => salvarQuestao(emEdicao)}
                  aoCancelar={() => setEmEdicao(null)}
                />
              ) : (
                <article className="questao">
                  <div className="questao__topo">
                    <span className="questao__numero">Questão {indice + 1}</span>
                    <Etiqueta tom="neutra">{questao.mecanica}</Etiqueta>
                    {questao.trecho && (
                      <span className="campo__dica" style={{ marginBottom: 0 }}>
                        Origem: {questao.trecho}
                      </span>
                    )}
                  </div>

                  <p className="questao__enunciado">{questao.enunciado}</p>

                  <ul className="questao__alternativas">
                    {questao.alternativas.map((alternativa, i) => (
                      <li key={alternativa}>
                        <span aria-hidden="true">{String.fromCharCode(65 + i)})</span>
                        <span>
                          {alternativa}
                          {i === questao.correta && (
                            <>
                              {' '}
                              <Etiqueta tom="boa">resposta correta</Etiqueta>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="questao__acoes">
                    <Botao variante="secundario" onClick={() => setEmEdicao({ ...questao })}>
                      Editar
                      <span className="apenas-leitor"> a questão {indice + 1}</span>
                    </Botao>
                    <Botao variante="discreto" onClick={() => setAExcluir({ ...questao, numero: indice + 1 })}>
                      Excluir
                      <span className="apenas-leitor"> a questão {indice + 1}</span>
                    </Botao>
                  </div>
                </article>
              )}
            </li>
          ))}
        </ol>
      )}

      <Cartao className="cartao--acao">
        <h2>{publicada ? 'Republicar a atividade' : 'Publicar a atividade'}</h2>
        <p>
          Ao publicar, o sistema gera um link e um código de acesso. Você decide quando e como
          entregar o link à turma, e pode revogá-lo a qualquer momento.
        </p>
        <div className="linha" style={{ marginTop: 'var(--e4)' }}>
          <Botao onClick={() => setConfirmandoPublicacao(true)} disabled={questoes.length === 0}>
            {publicada ? 'Publicar de novo com um código novo' : 'Publicar atividade'}
          </Botao>
        </div>
      </Cartao>

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
    <article className="questao" aria-label={`Editando a questão ${numero}`}>
      <div className="questao__topo">
        <span className="questao__numero">Editando a questão {numero}</span>
      </div>

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
        <Botao onClick={aoSalvar}>Salvar questão</Botao>
      </div>
    </article>
  );
}
