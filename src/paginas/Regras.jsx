import { Lock } from 'lucide-react';
import { aparenciaDaRegra } from '../componentes/PainelRegras.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarCatalogo } from '../contextos/Aplicacao.jsx';
import { CONJUNTO_REGRAS, REGRAS } from '../dados/conteudo.js';

/* Tela Regras de adaptação: o conjunto vigente do perfil TEA, com o que cada
   regra faz, por que existe e a base normativa (RF10). Abre também sem
   sessão, como a Ajuda. */

export function Regras() {
  usarTituloDaPagina('Regras de adaptação');
  // Enquanto o servidor não responde, mostra o catálogo que acompanha a
  // interface.
  const catalogo = usarCatalogo();
  const conjunto = catalogo?.conjunto ?? CONJUNTO_REGRAS;
  const regras = catalogo?.regras ?? REGRAS;

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Regras de adaptação</h1>
        <p>{conjunto.descricao}</p>
        <p className="regras-versao">
          <Lock aria-hidden="true" />
          Conjunto {conjunto.identificador} v{conjunto.versao}, publicado em {conjunto.publicadoEm}
        </p>
      </div>

      <ul className="grade-regras">
        {regras.map((regra) => {
          const { Icone, tom } = aparenciaDaRegra(regra.codigo);
          return (
            <li key={regra.codigo} className="cartao cartao-regra">
              <div className="cartao-regra__topo">
                <span className={`regra__icone regra__icone--${tom}`} aria-hidden="true">
                  <Icone />
                </span>
                <div>
                  <span className="regra__codigo">{regra.codigo}</span>
                  <h2>{regra.nome}</h2>
                </div>
              </div>
              <p>{regra.descricao}</p>
              <dl>
                <dt>Por que existe</dt>
                <dd>{regra.justificativa}</dd>
                <dt>Base normativa</dt>
                <dd>{regra.base}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
