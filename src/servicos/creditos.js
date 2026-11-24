/* Crédito é só o jeito de mostrar a cota: o servidor conta e guarda tokens
   (RF25, RN13), e 1 crédito vale 1.000 deles. */

export const TOKENS_POR_CREDITO = 1000;

const formato = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Quantidade de tokens escrita em créditos: 40000 vira "40". */
export const emCreditos = (tokens) => formato.format(tokens / TOKENS_POR_CREDITO);

/** Saldo de uma conta. O que resta é arredondado para baixo; abaixo de 1 vira
 *  "menos de 1", porque o servidor ainda aceita uma operação (RN13). */
export function saldoDe({ tokens_consumidos: consumidos, cota_tokens: cota }) {
  const restantes = Math.max(0, cota - consumidos);
  const esgotada = restantes === 0;
  const inteiros = Math.floor(restantes / TOKENS_POR_CREDITO);
  return {
    esgotada,
    restam: !esgotada && inteiros === 0 ? 'menos de 1' : formato.format(inteiros),
    total: emCreditos(cota),
  };
}

/** "Restam 34 de 40 créditos", com a concordância de "Resta". */
export function fraseDoSaldo({ restam, total }) {
  if (restam === 'menos de 1') return `Resta menos de 1 crédito de ${total}`;
  return `${restam === '1' ? 'Resta' : 'Restam'} ${restam} de ${total} ${total === '1' ? 'crédito' : 'créditos'}`;
}
