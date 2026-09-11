import { useState } from 'react';
import { CONJUNTO_REGRAS, REGRAS } from '../dados/conteudo.js';
import { Etiqueta } from './basicos.jsx';

/* =========================================================================
   Painel das regras aplicadas — o diferencial do projeto virado interface.

   RF06 manda registrar quais regras foram aplicadas e a versão do conjunto.
   RF10 manda deixar o professor consultar a justificativa normativa de cada
   uma. RN08 diz que esse registro não é editável.

   Sem esta tela, o Entende+ é indistinguível de jogar o PDF no ChatGPT: o
   que separa adaptação estruturada de adaptação não estruturada é o critério
   ficar visível e auditável. É por isso que ela ocupa a coluna fixa da tela
   de adaptação, e não uma aba escondida.

   Sanfona feita com <button aria-expanded> em vez de <details>: precisa
   anunciar estado e caber no mesmo padrão de foco do resto do app.
   ========================================================================= */

export function PainelRegras({ destacada, aoDestacar }) {
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
        Conjunto <strong>{CONJUNTO_REGRAS.identificador} v{CONJUNTO_REGRAS.versao}</strong>,
        publicado em {CONJUNTO_REGRAS.publicadoEm}.{' '}
        <span aria-hidden="true">🔒</span> Este registro não pode ser alterado.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {REGRAS.map((regra) => {
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
                      {regra.ocorrencias} {regra.ocorrencias === 1 ? 'trecho' : 'trechos'}
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
