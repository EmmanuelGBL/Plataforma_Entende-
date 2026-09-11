/* =========================================================================
   Camada de serviço do protótipo.

   Tudo aqui devolve Promise com atraso proposital. Duas razões:

   1. Quando o back-end existir, só o corpo destas funções muda — as telas
      já esperam Promise e já tratam carregamento e erro. A troca de mock por
      HTTP não vira reescrita de interface.
   2. O atraso é o que torna testáveis os estados de "processando", que são
      metade da heurística H1 (visibilidade do status do sistema). Sem ele, o
      protótipo esconderia justamente o momento em que o professor mais
      precisa de retorno — a espera pela adaptação (RNF07 admite até 120s).
   ========================================================================= */

import { ETAPAS_PROCESSAMENTO, QUESTOES, TEXTO_ADAPTADO, METRICAS } from '../dados/conteudo.js';

const LIMITE_PAGINAS = 20; // RNF08
const LIMITE_MB = 15; // RNF08

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Erro de negócio, com motivo legível e saída sugerida (H9). */
export class ErroDeNegocio extends Error {
  constructor(titulo, motivo, saida, regra) {
    super(titulo);
    this.titulo = titulo;
    this.motivo = motivo;
    this.saida = saida;
    this.regra = regra;
  }
}

/** Validação feita antes de enviar (H5 — prevenção de erro).
 *  Devolve null quando o arquivo é aceitável. */
export function validarArquivo(arquivo) {
  const mb = Number(String(arquivo.tamanho).replace(/[^\d,]/g, '').replace(',', '.'));
  if (arquivo.paginas > LIMITE_PAGINAS || mb > LIMITE_MB) {
    return new ErroDeNegocio(
      'Este material está acima do limite aceito',
      `O arquivo tem ${arquivo.paginas} páginas e ${arquivo.tamanho}. O limite é de ` +
        `${LIMITE_PAGINAS} páginas e ${LIMITE_MB} MB por envio.`,
      'Separe o material em partes menores — por exemplo, um capítulo por envio — e envie de novo.',
      'RNF08',
    );
  }
  return null;
}

export async function enviarMaterial(arquivo) {
  await esperar(700);

  const problema = validarArquivo(arquivo);
  if (problema) throw problema;

  if (!arquivo.extraivel) {
    // RN09: recusa explícita. Não existe adaptação parcial.
    throw new ErroDeNegocio(
      'Não foi possível ler o texto deste material',
      'O arquivo enviado contém apenas imagens digitalizadas. Não há texto que o sistema ' +
        'consiga ler, e adaptar um material lido pela metade produziria um resultado errado ' +
        'sem avisar você.',
      'Envie o arquivo original em PDF ou Word, ou passe o material por um programa de ' +
        'reconhecimento de texto (OCR) antes de enviar novamente.',
      'RN09',
    );
  }

  return {
    id: `m-${Math.floor(Math.random() * 900 + 100)}`,
    nome: arquivo.nome,
    paginas: arquivo.paginas,
  };
}

/** Processamento com retorno de progresso etapa por etapa.
 *  `aoProgredir` recebe (percentual, rótulo da etapa). */
export async function processarAdaptacao(aoProgredir, sinal) {
  for (let i = 0; i < ETAPAS_PROCESSAMENTO.length; i += 1) {
    await esperar(900);
    if (sinal?.cancelado) throw new ErroDeNegocio('Processamento cancelado', '', '', null);
    const percentual = Math.round(((i + 1) / ETAPAS_PROCESSAMENTO.length) * 100);
    aoProgredir(percentual, ETAPAS_PROCESSAMENTO[i]);
  }
  return { blocos: TEXTO_ADAPTADO, metricas: METRICAS, questoes: QUESTOES };
}

export async function aprovarEExportar() {
  await esperar(900);
  return { arquivo: 'Ciencias-5ano-Fotossintese-ADAPTADO.pdf', geradoEm: agora() };
}

export async function publicarAtividade() {
  await esperar(700);
  return { codigo: gerarCodigo(), publicadaEm: agora() };
}

export async function revogarLink() {
  await esperar(500);
  return { revogadaEm: agora() };
}

export async function excluirMaterial() {
  await esperar(500);
  return true;
}

function gerarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1 — o código é ditado em voz alta
  return Array.from({ length: 6 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');
}

function agora() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
