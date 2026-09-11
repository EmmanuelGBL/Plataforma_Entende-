import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, AvisoConteudoDemo, Botao, Cartao, Etiqueta, Migalhas } from '../componentes/basicos.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { publicarAtividade, revogarLink } from '../servicos/api.js';

/* =========================================================================
   UC13 — Gerar banco de questões (RF13)  ·  UC14 — Revisar (RF14)
   UC15 — Publicar e gerar link (RF15)    ·  UC18 — Revogar link (RF18)
   RN04 — questões vêm só do material enviado.
   RN06 — o link pode ser revogado a qualquer momento.

   A origem de cada questão fica escrita no cartão ("Bloco 3 — ..."). É o que
   permite ao professor conferir a RN04 sem confiar na nossa palavra, e é
   também H6: ele não precisa lembrar de que parte do texto aquilo saiu.
   ========================================================================= */

export function Atividade() {
  const { id } = useParams();
  const { material, adaptacao, atualizarMaterial, definirQuestoes } = usarApp();
  const { anunciar } = usarAnuncios();

  const dados = material(id);
  const { questoes } = adaptacao(id);

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

  function salvarQuestao(questaoEditada) {
    definirQuestoes(
      id,
      questoes.map((q) => (q.id === questaoEditada.id ? questaoEditada : q)),
    );
    setEmEdicao(null);
    anunciar('Questão salva.');
  }

  function excluirQuestao() {
    const alvo = aExcluir;
    setAExcluir(null);
    definirQuestoes(id, questoes.filter((q) => q.id !== alvo.id));
    anunciar('Questão excluída da atividade.');
  }

  async function publicar() {
    setConfirmandoPublicacao(false);
    const resultado = await publicarAtividade(id);
    atualizarMaterial(id, {
      atividade: { estado: 'publicada', codigo: resultado.codigo, publicadaEm: resultado.publicadaEm },
    });
    anunciar(`Atividade publicada. O código de acesso é ${resultado.codigo.split('').join(' ')}.`);
  }

  async function revogar() {
    setConfirmandoRevogacao(false);
    await revogarLink(id);
    atualizarMaterial(id, { atividade: { ...atividade, estado: 'revogada' } });
    anunciar('Link revogado. A atividade não pode mais ser acessada pelos estudantes.');
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

      {questoes.length === 0 ? (
        <div className="cartao vazio">
          <h2>Nenhuma questão restante</h2>
          <p>Você excluiu todas as questões. Não é possível publicar uma atividade vazia.</p>
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0 }}>
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
                    <span className="campo__dica" style={{ marginBottom: 0 }}>
                      Origem: {questao.trecho}
                    </span>
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

      <Cartao>
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

      {/* Publicar de novo gera um código diferente e, com isso, mata o link que
          a turma já pode ter recebido. É uma revogação implícita, e precisa ser
          dita: o diálogo de revogação avisa a consequência com todas as letras,
          e este não pode avisar menos só porque o botão tem nome mais simpático
          (H5, e RN06 pela porta dos fundos). */}
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

/** Edição da questão no lugar onde ela está, sem abrir outra tela — evita
 *  que o professor perca o contexto das questões vizinhas (H7). */
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
