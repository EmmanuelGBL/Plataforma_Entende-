import { FileText } from 'lucide-react';
import { Etiqueta, TabelaEnvolvente } from './basicos.jsx';

/* Comparação original × adaptado (RF08) e quadro de métricas (RF07). */

/** O painel do original mostra o material como ele chegou: justificado,
 *  entrelinha apertada e sem subtítulos, para a diferença ficar visível. */
export function ComparadorTextos({ original, blocos, regras, acaoAdaptado }) {
  const paragrafosOriginal = original.filter((trecho) => trecho.tipo !== 'titulo').length;
  const paragrafosAdaptado = blocos.reduce((total, bloco) => total + bloco.paragrafos.length, 0);
  const contagem = (n) => `${n} ${n === 1 ? 'parágrafo' : 'parágrafos'}`;

  return (
    <div className="comparador">
      <article className="painel-texto painel-texto--original" aria-labelledby="titulo-original">
        <header className="painel-texto__cabecalho">
          <h3 id="titulo-original">
            <FileText aria-hidden="true" />
            Texto original
          </h3>
          <Etiqueta tom="neutra">{contagem(paragrafosOriginal)}</Etiqueta>
        </header>
        {/* tabIndex=0: o painel rola e precisa ser alcançável pelo teclado. */}
        <div
          className="painel-texto__corpo texto-original"
          tabIndex={0}
          role="region"
          aria-labelledby="titulo-original"
        >
          {/* Títulos do original em negrito, e não como cabeçalho, para não entrarem
             na estrutura de títulos da página. */}
          {original.map((trecho, indice) =>
            trecho.tipo === 'titulo' ? (
              <p key={indice}>
                <strong>{trecho.texto}</strong>
              </p>
            ) : (
              <p key={indice} style={{ whiteSpace: 'pre-line' }}>
                {trecho.tipo === 'item' ? `• ${trecho.texto}` : trecho.texto}
              </p>
            ),
          )}
        </div>
      </article>

      <article className="painel-texto painel-texto--adaptado" aria-labelledby="titulo-adaptado">
        {/* A ação de editar fica no cabeçalho do painel do adaptado, no lugar
           da contagem. */}
        <header className="painel-texto__cabecalho">
          <h3 id="titulo-adaptado">
            <FileText aria-hidden="true" />
            Texto adaptado
          </h3>
          {acaoAdaptado ?? <Etiqueta tom="boa">{contagem(paragrafosAdaptado)}</Etiqueta>}
        </header>
        <div
          className="painel-texto__corpo texto-adaptado"
          tabIndex={0}
          role="region"
          aria-labelledby="titulo-adaptado"
        >
          {blocos.map((bloco, indice) => {
            const aplicadas = (bloco.regras ?? [bloco.regra])
              .map((codigo) => regras.find((r) => r.codigo === codigo))
              .filter(Boolean);
            return (
              <section key={indice}>
                {bloco.titulo && <h4>{bloco.titulo}</h4>}
                {/* Etiqueta da regra logo abaixo do subtítulo do bloco. */}
                {aplicadas.length > 0 && (
                  <p className="campo__dica">
                    {aplicadas.map((regra) => (
                      <span
                        key={regra.codigo}
                        className="marca-regra"
                        title={regra.descricao}
                        style={{ marginRight: 'var(--e2)' }}
                      >
                        {regra.codigo} — {regra.nome}
                      </span>
                    ))}
                  </p>
                )}
                {bloco.paragrafos.map((paragrafo, posicao) => (
                  <p key={posicao} style={{ whiteSpace: 'pre-line' }}>
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

/** Quadro de métricas de legibilidade. Mostra sempre as duas medidas,
 *  inclusive quando o número piora (RN10), com a situação em texto. */
const SITUACOES = {
  melhora: { tom: 'boa', rotulo: 'melhorou' },
  piora: { tom: 'atencao', rotulo: 'piorou' },
  igual: { tom: 'neutra', rotulo: 'sem mudança' },
  atencao: { tom: 'atencao', rotulo: 'atenção' },
};

export function TabelaMetricas({ metricas }) {
  return (
    <section className="cartao" aria-labelledby="titulo-metricas">
      <h2 id="titulo-metricas" tabIndex={-1}>
        Métricas de legibilidade
      </h2>
      <p className="campo__dica">
        Comparação entre o texto original e o adaptado. As métricas aparecem sempre, inclusive
        quando o resultado é desfavorável.
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
                  <Etiqueta tom={SITUACOES[metrica.situacao]?.tom ?? 'atencao'}>
                    {SITUACOES[metrica.situacao]?.rotulo ?? 'atenção'}
                  </Etiqueta>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaEnvolvente>
    </section>
  );
}
