/* Barra de progresso: role="progressbar" com valores ARIA e o percentual
   repetido em texto. */

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
