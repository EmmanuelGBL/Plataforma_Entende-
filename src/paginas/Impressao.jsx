import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { CONJUNTO_REGRAS, REGRAS } from '../dados/conteudo.js';
import '../estilos/impressao.css';

/* =========================================================================
   RF11 — exportar o material adaptado em PDF, no formato de RNF05.

   Como isso funciona sem back-end: a saída é uma página formatada com
   `@media print` e regra `@page`, e o PDF é gerado pela própria função de
   impressão do navegador ("Salvar como PDF" no destino). O arquivo que sai
   é um PDF de verdade, com texto selecionável — não é imagem.

   Isso não é um contorno preguiçoso. É a forma correta de gerar documento
   paginado a partir de HTML, e tem uma vantagem sobre montar o PDF no
   servidor: o texto do PDF é o mesmo nó de texto que está na tela, então a
   conformidade com RNF02 e RNF05 é verificável olhando o CSS, e não
   confiando numa biblioteca.

   O que continua sendo do back-end na versão final: guardar o arquivo
   gerado, versioná-lo junto ao registro da adaptação e permitir baixá-lo de
   novo depois. A formatação, que é o que os requisitos exigem, é aqui.

   A folha `impressao.css` traz, comentado, qual parâmetro atende a qual
   requisito.
   ========================================================================= */

export function Impressao() {
  const { id } = useParams();
  const { material, adaptacao } = usarApp();
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

  const { blocos } = adaptacao(id);
  const regrasUsadas = REGRAS.filter((regra) =>
    blocos.some((bloco) => bloco.regra === regra.codigo),
  );

  return (
    <>
      {/* Esta rota fica fora dos dois layouts, então precisa declarar os próprios
          marcos de página: sem eles, a barra e a folha ficariam fora de qualquer
          landmark e a página não teria `main` (SC 1.3.1, recomendação 1.4 do e-MAG). */}
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
            {/* Sai impresso de propósito: um PDF cujo cabeçalho diz "História" e
                cujo texto é de Ciências, circulando fora da tela, seria pior que
                a linha de aviso. */}
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

        {blocos.map((bloco) => (
          <section key={bloco.titulo}>
            <h2>{bloco.titulo}</h2>
            {bloco.paragrafos.map((paragrafo) => (
              <p key={paragrafo.slice(0, 40)} style={{ whiteSpace: 'pre-line' }}>
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
          Conjunto de regras {dados.versaoRegras}, publicado em {CONJUNTO_REGRAS.publicadoEm}.
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
