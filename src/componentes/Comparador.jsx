import { Etiqueta, TabelaEnvolvente } from './basicos.jsx';
import { REGRAS, TEXTO_ORIGINAL } from '../dados/conteudo.js';

/* =========================================================================
   Comparação original × adaptado (RF08) e quadro de métricas (RF07).
   ========================================================================= */

/**
 * O painel do original imita deliberadamente o material como ele chega hoje:
 * justificado, entrelinha apertada, sem subtítulo. É a única parte do
 * aplicativo que desobedece às próprias regras tipográficas — e desobedece de
 * propósito, para que a diferença entre os dois lados seja visível na tela e
 * não só nos números. Está registrado no documento para não parecer descuido
 * numa auditoria.
 */
export function ComparadorTextos({ blocos }) {
  return (
    <div className="comparador">
      <article className="painel-texto" aria-labelledby="titulo-original">
        <header className="painel-texto__cabecalho">
          <h3 id="titulo-original">Material original</h3>
          <Etiqueta tom="neutra">como foi enviado</Etiqueta>
        </header>
        {/* tabIndex=0 porque o painel rola: sem ele, quem navega só por teclado
            não alcança o conteúdo que passa da altura visível (SC 2.1.1). Com
            role="region" e nome acessível, o leitor de tela anuncia onde entrou. */}
        <div
          className="painel-texto__corpo texto-original"
          tabIndex={0}
          role="region"
          aria-labelledby="titulo-original"
        >
          {TEXTO_ORIGINAL.map((paragrafo) => (
            <p key={paragrafo.slice(0, 40)}>{paragrafo}</p>
          ))}
        </div>
      </article>

      <article className="painel-texto" aria-labelledby="titulo-adaptado">
        <header className="painel-texto__cabecalho">
          <h3 id="titulo-adaptado">Material adaptado</h3>
          <Etiqueta tom="info">perfil TEA · 5º ano</Etiqueta>
        </header>
        <div
          className="painel-texto__corpo texto-adaptado"
          tabIndex={0}
          role="region"
          aria-labelledby="titulo-adaptado"
        >
          {blocos.map((bloco) => {
            const regra = REGRAS.find((r) => r.codigo === bloco.regra);
            return (
              <section key={bloco.titulo}>
                <h4>{bloco.titulo}</h4>
                {/* A etiqueta vem logo abaixo do subtítulo, e não no fim do
                    bloco: no fim, ela ficava colada no subtítulo seguinte e
                    parecia rotular o bloco errado. */}
                {regra && (
                  <p className="campo__dica">
                    <span className="marca-regra" title={regra.descricao}>
                      {regra.codigo} — {regra.nome}
                    </span>
                  </p>
                )}
                {bloco.paragrafos.map((paragrafo) => (
                  <p key={paragrafo.slice(0, 40)} style={{ whiteSpace: 'pre-line' }}>
                    {paragrafo}
                  </p>
                ))}
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}

/**
 * Quadro de métricas de legibilidade.
 *
 * RN10 manda exibir sempre, inclusive quando o número piora — e é o que a
 * linha "Total de palavras" faz. A coluna de situação traz texto ("melhorou"
 * / "atenção"), não só cor, senão a informação sumiria em escala de cinza ou
 * para quem não distingue as cores (SC 1.4.1).
 */
export function TabelaMetricas({ metricas }) {
  return (
    <section className="cartao" aria-labelledby="titulo-metricas">
      <h2 id="titulo-metricas">Métricas de legibilidade</h2>
      <p className="campo__dica">
        Comparação entre o texto original e o adaptado. As métricas aparecem sempre, inclusive
        quando o resultado é desfavorável — é o que permite conferir a adaptação em vez de
        confiar nela.
      </p>

      <TabelaEnvolvente rotulo="Métricas de legibilidade">
        <table className="dados">
          <caption className="apenas-leitor">
            Métricas de legibilidade do material original e do material adaptado
          </caption>
          <thead>
            <tr>
              <th scope="col">Métrica</th>
              <th scope="col">Original</th>
              <th scope="col">Adaptado</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {metricas.map((metrica) => (
              <tr key={metrica.nome}>
                <th scope="row" style={{ fontWeight: 600 }}>
                  {metrica.nome}
                  <span className="campo__dica" style={{ marginBottom: 0 }}>
                    {metrica.leitura}
                  </span>
                </th>
                <td className="numero">{metrica.original}</td>
                <td className="numero">{metrica.adaptado}</td>
                <td>
                  {metrica.situacao === 'melhora' ? (
                    <Etiqueta tom="boa">melhorou</Etiqueta>
                  ) : (
                    <Etiqueta tom="atencao">atenção</Etiqueta>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaEnvolvente>
    </section>
  );
}
