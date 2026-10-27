import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAdaptacao, usarApp } from '../contextos/Aplicacao.jsx';
import '../estilos/impressao.css';

/* RF11 — material adaptado em PDF, no formato de RNF05.

   A página é formatada com @media print e @page (estilos/impressao.css), e
   o PDF é gerado pela função de impressão do navegador, com texto selecionável. */

export function Impressao() {
  const { id } = useParams();
  const { material } = usarApp();
  const { dados: adaptacao, carregando } = usarAdaptacao(id);
  const dados = material(id);
  const [comFicha, setComFicha] = useState(false);

  usarTituloDaPagina(dados ? `Material adaptado — ${dados.nome}` : 'Material não encontrado');

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
          {carregando ? 'Carregando o material…' : 'Este material ainda não foi adaptado.'}
        </p>
      </main>
    );
  }

  const { blocos, conjunto } = adaptacao;
  const regrasUsadas = adaptacao.regras.filter((regra) =>
    blocos.some((bloco) => (bloco.regras ?? [bloco.regra]).includes(regra.codigo)),
  );

  return (
    <>
      {/* Rota fora dos layouts: declara os próprios marcos de página (header, main). */}
      <header className="barra-impressao" aria-label="Ações do material adaptado">
        <div className="barra-impressao__interna">
          <Botao onClick={() => window.print()}>Salvar como PDF ou imprimir</Botao>

          <Botao como="link" para={`/materiais/${id}/adaptacao`} variante="secundario">
            Voltar para a revisão
          </Botao>

          <label className="opcao-impressao">
            <input
              type="checkbox"
              checked={comFicha}
              onChange={(e) => setComFicha(e.target.checked)}
            />
            Incluir a ficha da adaptação
          </label>

          <p className="barra-impressao__aviso">
            Na janela que abrir, escolha <strong>“Salvar como PDF”</strong> no campo de destino
            ou impressora. Deixe as margens no padrão — o tamanho da página e as margens já vêm
            definidos no arquivo. Esta barra não sai no papel.
            {comFicha
              ? ' A ficha da adaptação sai em uma página separada, ao final: ela é para o seu arquivo, não para o estudante.'
              : ''}
          </p>
        </div>
      </header>

      <main className="folha">
        <h1>
          {dados.conteudoProprio ? (dados.disciplina ?? 'Material') : 'Ciências'} — versão adaptada
        </h1>

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
            {/* O aviso de conteúdo de demonstração também sai no papel. */}
            {!dados.conteudoProprio && (
              <>
                <dt>Observação:</dt>
                <dd>
                  Conteúdo de demonstração — o texto abaixo é o do material Ciências —
                  Fotossíntese, único incluído neste protótipo.
                </dd>
              </>
            )}
          </dl>
        </div>

        {blocos.map((bloco, indice) => (
          <section key={indice}>
            {bloco.titulo && <h2>{bloco.titulo}</h2>}
            {bloco.paragrafos.map((paragrafo, posicao) => (
              <p key={posicao} style={{ whiteSpace: 'pre-line' }}>
                {paragrafo}
              </p>
            ))}
          </section>
        ))}

        <p className="folha__rodape">
          Material adaptado pelo Entende+ a partir do original enviado pelo professor. A adaptação
          altera a forma do texto; nenhum conceito foi acrescentado ou retirado. A revisão e a
          aprovação pedagógica são do professor responsável.
          <br />
          Conjunto de regras {dados.versaoRegras}, publicado em {conjunto.publicadoEm}.
        </p>

        {comFicha && (
          <section className="folha__ficha">
            <h2>Ficha da adaptação</h2>
            <p>
              Registro das regras aplicadas a este material. Documento de controle do professor —
              não faz parte do material entregue ao estudante.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Regra</th>
                  <th scope="col">O que ela faz</th>
                  <th scope="col">Base normativa</th>
                </tr>
              </thead>
              <tbody>
                {regrasUsadas.map((regra) => (
                  <tr key={regra.codigo}>
                    <th scope="row">{regra.codigo}</th>
                    <td>{regra.nome}</td>
                    <td>{regra.descricao}</td>
                    <td>{regra.base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="folha__rodape">
              Este registro é gerado automaticamente e não pode ser alterado. É o que permite
              auditar a adaptação e reproduzi-la depois.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
