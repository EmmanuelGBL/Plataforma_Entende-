import { useState } from 'react';
import {
  AlignLeft,
  ArrowRightLeft,
  BookOpen,
  ChevronRight,
  Eraser,
  Heading,
  Info,
  Link2,
  ListChecks,
  ListOrdered,
  Lock,
  MessageSquareText,
  Rows3,
  Type,
} from 'lucide-react';

/* Painel das regras aplicadas na adaptação (RF06, RF10), com a base
   normativa e a justificativa de cada regra. O registro não é editável (RN08). */

/** Ícone e cor de cada regra do conjunto TEA. Regra nova sem entrada aqui
 *  aparece com o ícone genérico. */
const APARENCIA = {
  'TEA-01': { Icone: MessageSquareText, tom: 'azul' },
  'TEA-02': { Icone: Rows3, tom: 'roxo' },
  'TEA-03': { Icone: Type, tom: 'verde' },
  'TEA-04': { Icone: ArrowRightLeft, tom: 'azul' },
  'TEA-05': { Icone: BookOpen, tom: 'amarelo' },
  'TEA-06': { Icone: Link2, tom: 'verde' },
  'TEA-07': { Icone: Heading, tom: 'roxo' },
  'TEA-08': { Icone: AlignLeft, tom: 'azul' },
  'TEA-09': { Icone: ListOrdered, tom: 'amarelo' },
  'TEA-10': { Icone: Eraser, tom: 'verde' },
};

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
    <section className="cartao cartao--compacto painel-regras" aria-labelledby="titulo-regras">
      <h2 id="titulo-regras">Regras aplicadas</h2>

      <p className="painel-regras__conjunto">
        <Lock aria-hidden="true" />
        <span>
          Conjunto <strong>{conjunto.identificador} v{conjunto.versao}</strong>, publicado em{' '}
          {conjunto.publicadoEm}. Este registro não pode ser alterado.
        </span>
      </p>

      <ul className="painel-regras__lista">
        {regras.map((regra) => {
          const aberta = abertas.has(regra.codigo);
          const idDetalhe = `detalhe-${regra.codigo}`;
          const { Icone, tom } = APARENCIA[regra.codigo] ?? { Icone: ListChecks, tom: 'azul' };
          const ocorrencias =
            regra.aplicacao === 'apresentacao'
              ? 'na folha'
              : `${regra.ocorrencias} ${regra.ocorrencias === 1 ? 'trecho' : 'trechos'}`;
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
                <span className={`regra__icone regra__icone--${tom}`} aria-hidden="true">
                  <Icone />
                </span>
                <span className="regra__texto">
                  <span className="regra__nome">{regra.nome}</span>
                  <span className="regra__resumo">
                    <span className="regra__codigo">{regra.codigo}</span> · {ocorrencias}
                  </span>
                </span>
                <ChevronRight className="regra__seta" aria-hidden="true" />
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

      <p className="painel-regras__nota">
        <Info aria-hidden="true" />
        <span>
          As regras mudam a forma do material. Nenhum conceito é acrescentado nem retirado — a
          responsabilidade pedagógica continua sendo sua (RN01).
        </span>
      </p>
    </section>
  );
}
