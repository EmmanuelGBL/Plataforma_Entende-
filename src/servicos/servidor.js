/* =========================================================================
   Cliente HTTP do servidor do Entende+ (pasta servidor/).

   Só é usado quando o build recebe VITE_API_URL. Sem ela, o sistema roda no
   modo de demonstração de api.js — que é o que o GitHub Pages e o arquivo
   offline publicam, porque nenhum dos dois tem servidor por trás.

   Os erros do servidor já vêm no formato do ErroDeNegocio (título, motivo,
   saída, regra), e são repassados às telas sem tradução.
   ========================================================================= */

import { ErroDeNegocio } from './api.js';

export const URL_API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const modoServidor = Boolean(URL_API);

const CHAVE_TOKEN = 'entende.token';

/* sessionStorage, e não localStorage: a sessão some quando a aba fecha. O
   computador da sala dos professores é compartilhado. */
export function lerToken() {
  try {
    return window.sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) window.sessionStorage.setItem(CHAVE_TOKEN, token);
    else window.sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* sem armazenamento: a sessão dura até recarregar a página */
  }
}

let aoExpirar = () => {};
/** O contexto da aplicação registra aqui o que fazer quando o servidor
 *  responde 401: limpar a sessão e voltar para a tela de entrada. */
export function quandoSessaoExpirar(funcao) {
  aoExpirar = funcao;
}

async function pedir(caminho, { metodo = 'GET', corpo, formulario, sinal } = {}) {
  const cabecalhos = {};
  const token = lerToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  let resposta;
  try {
    resposta = await fetch(`${URL_API}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: formulario ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined),
      signal: sinal,
    });
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro;
    throw new ErroDeNegocio(
      'Não foi possível falar com o servidor',
      'A conexão com o servidor do Entende+ falhou.',
      'Confira a sua conexão com a internet e tente de novo.',
      null,
    );
  }

  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 401 && token) aoExpirar();
    const erro = dados?.erro;
    const falha = erro
      ? new ErroDeNegocio(erro.titulo, erro.motivo, erro.saida, erro.regra)
      : new ErroDeNegocio(
          'Algo deu errado no servidor',
          `O servidor respondeu com o código ${resposta.status}.`,
          'Tente de novo. Se continuar, avise quem cuida do sistema.',
          null,
        );
    falha.status = resposta.status;
    throw falha;
  }
  return dados;
}

/* --- Conta (RF01) -------------------------------------------------------- */

export const servidor = {
  cadastrar: (nome, email, senha) =>
    pedir('/api/autenticacao/cadastro', { metodo: 'POST', corpo: { nome, email, senha } }),
  entrar: (email, senha) =>
    pedir('/api/autenticacao/entrar', { metodo: 'POST', corpo: { email, senha } }),
  eu: () => pedir('/api/autenticacao/eu'),

  /* --- Materiais (RF02–RF04, RF19, RF20) --- */
  materiais: () => pedir('/api/materiais'),
  enviar: (arquivo) => {
    const formulario = new FormData();
    formulario.append('arquivo', arquivo);
    return pedir('/api/materiais', { metodo: 'POST', formulario });
  },
  excluir: (id) => pedir(`/api/materiais/${id}`, { metodo: 'DELETE' }),

  /* --- Adaptação (RF05–RF12) --- */
  regras: () => pedir('/api/regras'),
  adaptar: (id, sinal) => pedir(`/api/materiais/${id}/adaptacoes`, { metodo: 'POST', sinal }),
  adaptacao: (id) => pedir(`/api/materiais/${id}/adaptacao`),
  editarTexto: (id, texto) =>
    pedir(`/api/materiais/${id}/adaptacao/texto`, { metodo: 'PUT', corpo: { texto } }),
  aprovar: (id) => pedir(`/api/materiais/${id}/adaptacao/aprovacao`, { metodo: 'POST' }),

  /* --- Atividade (RF13–RF18, RF21–RF23) --- */
  questoes: (id) => pedir(`/api/materiais/${id}/questoes`),
  salvarQuestoes: (id, questoes) =>
    pedir(`/api/materiais/${id}/questoes`, { metodo: 'PUT', corpo: questoes }),
  gerarQuestoes: (id) => pedir(`/api/materiais/${id}/questoes/geracao`, { metodo: 'POST' }),
  publicar: (id) => pedir(`/api/materiais/${id}/atividade`, { metodo: 'POST' }),
  revogar: (id) => pedir(`/api/materiais/${id}/atividade`, { metodo: 'DELETE' }),
  atividade: (codigo) => pedir(`/api/atividades/${encodeURIComponent(codigo)}`),
};

/* =========================================================================
   Conversão: formato da API → formato que as telas já usavam com os dados
   de demonstração. Fica aqui para que nenhuma tela precise saber de onde o
   dado veio.
   ========================================================================= */

const ETAPA = '5º ano do ensino fundamental';

const ESTADO_MATERIAL = {
  enviado: 'enviado',
  gerada: 'adaptado',
  em_revisao: 'adaptado',
  aprovada: 'aprovado',
};

function data(iso) {
  if (!iso) return '';
  // Data sem hora ("2026-09-02"): o Date a lê como meia-noite UTC, que em
  // Manaus ainda é o dia anterior. Monta-se a data local direto.
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function dataHora(iso) {
  return iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';
}

export function converterMaterial(m) {
  return {
    id: m.id,
    nome: m.nome_arquivo,
    paginas: m.paginas_estimadas ? `cerca de ${m.numero_paginas}` : m.numero_paginas,
    enviadoEm: data(m.data_envio),
    perfil: m.perfil,
    etapa: ETAPA,
    estado: ESTADO_MATERIAL[m.estado] ?? 'adaptado',
    versaoRegras: m.versao_regras ?? '—',
    // Dado real: nunca é o conteúdo de demonstração (ver AvisoConteudoDemo).
    conteudoProprio: true,
    atividade: {
      estado: m.atividade.estado,
      codigo: m.atividade.codigo,
      publicadaEm: dataHora(m.atividade.data_publicacao),
    },
  };
}

/** Blocos do servidor (título, parágrafo, item, tabela) → seções com
 *  subtítulo, que é como o comparador e a folha impressa desenham. */
export function blocosEmSecoes(blocos) {
  const secoes = [];
  let atual = null;
  let ultimoFoiItem = false;

  for (const bloco of blocos) {
    if (bloco.tipo === 'titulo') {
      atual = { titulo: bloco.texto, nivel: bloco.nivel, regras: [...bloco.regras], paragrafos: [] };
      secoes.push(atual);
      ultimoFoiItem = false;
      continue;
    }
    if (!atual) {
      atual = { titulo: '', nivel: 2, regras: [], paragrafos: [] };
      secoes.push(atual);
    }
    for (const regra of bloco.regras) if (!atual.regras.includes(regra)) atual.regras.push(regra);

    if (bloco.tipo === 'item') {
      const linha = /^\d+[.)]\s/.test(bloco.texto) ? bloco.texto : `• ${bloco.texto}`;
      if (ultimoFoiItem) atual.paragrafos[atual.paragrafos.length - 1] += `\n${linha}`;
      else atual.paragrafos.push(linha);
      ultimoFoiItem = true;
    } else {
      atual.paragrafos.push(bloco.texto);
      ultimoFoiItem = false;
    }
  }
  return secoes.map((s) => ({ ...s, regra: s.regras[0] }));
}

const decimal = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const FORMATO_METRICA = {
  palavras_por_frase: decimal,
  palavras_longas: (n) => `${decimal(n)}%`,
  indice_flesch: decimal,
  total_palavras: (n) => Math.round(n).toLocaleString('pt-BR'),
};

export function converterAdaptacao(a, questoes) {
  const flesch = a.metricas.find((m) => m.codigo === 'indice_flesch');
  const metricas = a.metricas.map((m) => ({
    nome: m.nome,
    original: (FORMATO_METRICA[m.codigo] ?? decimal)(m.original),
    adaptado: (FORMATO_METRICA[m.codigo] ?? decimal)(m.adaptado),
    situacao: m.situacao,
    leitura: m.leitura,
  }));
  if (flesch) {
    metricas.push({
      nome: 'Nível de leitura estimado',
      original: a.nivel_original,
      adaptado: a.nivel_adaptado,
      situacao: flesch.situacao,
      leitura:
        'Pelo índice acima, nas faixas de Martins et al. (1996). Meta de RNF03: anos iniciais do ' +
        'fundamental.',
    });
  }

  return {
    status: a.status,
    modelo: a.modelo,
    editada: a.editada,
    aprovadaEm: dataHora(a.data_aprovacao),
    textoAdaptado: a.texto_adaptado,
    blocos: blocosEmSecoes(a.blocos),
    original: a.blocos_original.map((b) => ({ tipo: b.tipo, texto: b.texto })),
    metricas,
    conjunto: {
      identificador: a.conjunto.perfil,
      versao: a.conjunto.versao,
      publicadoEm: data(a.conjunto.data_publicacao),
      descricao: a.conjunto.descricao,
    },
    regras: a.conjunto.regras.map((r) => ({ ...r, ocorrencias: a.ocorrencias[r.codigo] ?? 0 })),
    questoes: (questoes ?? []).map(converterQuestao),
  };
}

export function converterQuestao(q) {
  return {
    id: q.id,
    mecanica: 'Escolha única',
    enunciado: q.enunciado,
    alternativas: q.alternativas,
    correta: q.correta,
    trecho: q.trecho,
    dica: q.dica,
  };
}

/** Questão da tela → corpo do PUT /questoes. */
export function questaoParaServidor(q) {
  return {
    enunciado: q.enunciado,
    alternativas: q.alternativas,
    correta: q.correta,
    trecho: q.trecho ?? '',
    dica: q.dica ?? '',
  };
}

export function converterConjunto(c) {
  return {
    conjunto: {
      identificador: c.perfil,
      versao: c.versao,
      publicadoEm: data(c.data_publicacao),
      descricao: c.descricao,
    },
    regras: c.regras,
  };
}
