/* =========================================================================
   Indicadores de progresso — heurística H1 (visibilidade do status).

   Passos: mostra onde o professor está dentro do envio e quantas etapas
   faltam. `aria-current="step"` é o que informa isso a quem não vê a cor.

   BarraProgresso: usa <progress> nativo por baixo? Não — foi preferido o
   role="progressbar" com valores ARIA porque <progress> tem estilização
   inconsistente entre navegadores, e RNF04 exige Chrome e Firefox iguais.
   O texto ao lado repete o percentual, então a informação não depende da
   barra (SC 1.4.1).
   ========================================================================= */

export function Passos({ passos, atual }) {
  return (
    <nav aria-label="Etapas do envio">
      <ol className="passos">
        {passos.map((passo, indice) => {
          const estado = indice < atual ? 'concluido' : indice === atual ? 'atual' : 'pendente';
          return (
            <li
              key={passo}
              data-estado={estado}
              aria-current={estado === 'atual' ? 'step' : undefined}
            >
              <span className="passos__numero" aria-hidden="true">
                {estado === 'concluido' ? '✓' : indice + 1}
              </span>
              <span>
                <span className="apenas-leitor">
                  {`Etapa ${indice + 1} de ${passos.length}, ${
                    estado === 'concluido' ? 'concluída' : estado === 'atual' ? 'etapa atual' : 'ainda não iniciada'
                  }: `}
                </span>
                {passo}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BarraProgresso({ valor, etapa, rotulo = 'Progresso da adaptação' }) {
  return (
    <div className="progresso">
      <div
        className="progresso__trilho"
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
      >
        <div className="progresso__barra" style={{ width: `${valor}%` }} />
      </div>
      <p className="progresso__texto">{valor}% concluído</p>
      {etapa && <p className="progresso__etapa">{etapa}…</p>}
    </div>
  );
}
