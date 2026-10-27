import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAdaptacao, usarApp } from '../contextos/Aplicacao.jsx';
import '../estilos/impressao.css';

/* RF23 — folha imprimível das questões da atividade, com gabarito opcional
   em página separada. O PDF sai pela impressão do navegador, como em
   Impressao.jsx. */

export function QuestionarioImpresso() {
  const { id } = useParams();
  const { material } = usarApp();
  const { dados: adaptacao, carregando } = usarAdaptacao(id);
  const dados = material(id);
  const [comGabarito, setComGabarito] = useState(false);

  usarTituloDaPagina(dados ? `Questionário — ${dados.nome}` : 'Material não encontrado');

  if (!dados) {
    return (
      <main className="conteudo">
        <Aviso tipo="erro" titulo="Material não encontrado" nivel={1}>
          <p>
            Este material não existe ou foi excluído.{' '}
            <Link to="/painel">Voltar para meus materiais</Link>
          </p>
        </Aviso>
      </main>
    );
  }

  if (!adaptacao) {
    return (
      <main className="conteudo">
        <p role="status" className="campo__dica">
          {carregando ? 'Carregando as questões…' : 'Este material ainda não foi adaptado.'}
        </p>
      </main>
    );
  }

  const { questoes, conjunto } = adaptacao;

  return (
    <>
      <header className="barra-impressao" aria-label="Ações do questionário">
        <div className="barra-impressao__interna">
          <Botao onClick={() => window.print()}>Salvar como PDF ou imprimir</Botao>

          <Botao como="link" para={`/materiais/${id}/atividade`} variante="secundario">
            Voltar para a atividade
          </Botao>

          <label className="opcao-impressao">
            <input
              type="checkbox"
              checked={comGabarito}
              onChange={(e) => setComGabarito(e.target.checked)}
            />
            Incluir o gabarito
          </label>

          <p className="barra-impressao__aviso">
            Na janela que abrir, escolha <strong>“Salvar como PDF”</strong> no campo de destino ou
            impressora. Deixe as margens no padrão. Esta barra não sai no papel.
            {comGabarito
              ? ' O gabarito sai em uma página separada, ao final: ele é para você, não para o estudante.'
              : ''}
          </p>
        </div>
      </header>

      <main className="folha">
        <h1>Atividade — {dados.conteudoProprio ? (dados.disciplina ?? 'Material') : 'Ciências'}</h1>

        <div className="folha__identificacao">
          <dl>
            <dt>Material:</dt>
            <dd>{dados.nome}</dd>
            <dt>Etapa:</dt>
            <dd>{dados.etapa}</dd>
            <dt>Perfil de adaptação:</dt>
            <dd>{dados.perfil} — Transtorno do Espectro Autista</dd>
            <dt>Conjunto de regras:</dt>
            <dd>{dados.versaoRegras}</dd>
            {!dados.conteudoProprio && (
              <>
                <dt>Observação:</dt>
                <dd>
                  Conteúdo de demonstração — as questões abaixo são as do material Ciências —
                  Fotossíntese, único incluído neste protótipo.
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* Sem campo de nome, turma ou nota (RN05). */}
        <p className="folha__instrucao">
          Leia cada pergunta e marque a resposta que você acha certa.
        </p>

        {questoes.length === 0 ? (
          <p>Esta atividade está sem questões.</p>
        ) : (
          <ol className="folha__questoes">
            {questoes.map((questao) => (
              <li key={questao.id} className="folha__questao">
                <p className="folha__enunciado">{questao.enunciado}</p>
                <ul className="folha__alternativas">
                  {questao.alternativas.map((alternativa, posicao) => (
                    <li key={alternativa}>
                      <span className="folha__caixa" aria-hidden="true" />
                      <span className="folha__letra">{String.fromCharCode(65 + posicao)})</span>
                      <span>{alternativa}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}

        <p className="folha__rodape">
          Questões geradas pelo Entende+ a partir do material adaptado, e só dele. A revisão e a
          aprovação pedagógica são do professor responsável.
          <br />
          Conjunto de regras {dados.versaoRegras}, publicado em {conjunto.publicadoEm}.
        </p>

        {comGabarito && questoes.length > 0 && (
          <section className="folha__ficha">
            <h2>Gabarito</h2>
            <p>
              Documento de controle do professor — não faz parte da folha entregue ao estudante.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Questão</th>
                  <th scope="col">Resposta</th>
                  <th scope="col">Trecho do material de onde ela saiu</th>
                </tr>
              </thead>
              <tbody>
                {questoes.map((questao, indice) => (
                  <tr key={questao.id}>
                    <th scope="row">{indice + 1}</th>
                    <td>
                      {String.fromCharCode(65 + questao.correta)}){' '}
                      {questao.alternativas[questao.correta]}
                    </td>
                    <td>{questao.trecho}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="folha__rodape">
              A coluna da direita é o que permite conferir a RN04 sem confiar na nossa palavra: cada
              questão aponta o trecho do material que a originou.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
