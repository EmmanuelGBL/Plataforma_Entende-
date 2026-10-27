import { useState } from 'react';
import { Etiqueta } from './basicos.jsx';

/* Painel das regras aplicadas na adaptação (RF06, RF10), com a base
   normativa e a justificativa de cada regra. O registro não é editável (RN08). */

/** `conjunto` e `regras` são os da versão usada nesta adaptação, e não os
 *  da versão vigente. */
export function PainelRegras({ conjunto, regras, destacada, aoDestacar }) {
  const [abertas, setAbertas] = useState(() => new Set());

  function alternar(codigo) {
    setAbertas((atuais) => {
      const nova = new Set(atuais);
      if (nova.has(codigo)) nova.delete(codigo);
      else nova.add(codigo);
      return nova;
    });
    aoDestacar?.(codigo);
  }

  return (
    <section className="cartao cartao--compacto" aria-labelledby="titulo-regras">
      <h2 id="titulo-regras">Regras aplicadas</h2>

      <p className="campo__dica">
        Conjunto <strong>{conjunto.identificador} v{conjunto.versao}</strong>,
        publicado em {conjunto.publicadoEm}.{' '}
        <span aria-hidden="true">🔒</span> Este registro não pode ser alterado.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {regras.map((regra) => {
          const aberta = abertas.has(regra.codigo);
          const idDetalhe = `detalhe-${regra.codigo}`;
          return (
            <li
              key={regra.codigo}
              className="regra"
              data-destacada={destacada === regra.codigo ? 'sim' : undefined}
            >
              <button
                type="button"
                className="regra__botao"
                aria-expanded={aberta}
                aria-controls={idDetalhe}
                onClick={() => alternar(regra.codigo)}
              >
                <span className="regra__codigo">{regra.codigo}</span>
                <span>{regra.nome}</span>
                <span className="regra__seta" aria-hidden="true">
                  ›
                </span>
              </button>

              {aberta && (
                <div className="regra__detalhe" id={idDetalhe}>
                  <p style={{ maxWidth: 'none' }}>{regra.descricao}</p>
                  <dl>
                    <dt>Base normativa</dt>
                    <dd>{regra.base}</dd>
                    <dt>Por que essa regra existe</dt>
                    <dd>{regra.justificativa}</dd>
                    <dt>Aplicações neste material</dt>
                    <dd>
                      {regra.aplicacao === 'apresentacao'
                        ? 'Na formatação da folha impressa, e não no texto.'
                        : `${regra.ocorrencias} ${regra.ocorrencias === 1 ? 'trecho' : 'trechos'}`}
                    </dd>
                  </dl>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="campo__dica" style={{ marginTop: 'var(--e4)' }}>
        <Etiqueta tom="info">RN01</Etiqueta> As regras mudam a forma do material. Nenhum conceito
        é acrescentado nem retirado — a responsabilidade pedagógica continua sendo sua.
      </p>
    </section>
  );
}
