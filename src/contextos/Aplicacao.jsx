import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CONJUNTO_REGRAS,
  ETAPAS_PROCESSAMENTO,
  MATERIAIS_INICIAIS,
  METRICAS,
  QUESTOES,
  REGRAS,
  TEXTO_ADAPTADO,
  TEXTO_ORIGINAL,
} from '../dados/conteudo.js';
import * as demo from '../servicos/api.js';
import {
  converterAdaptacao,
  converterConjunto,
  converterMaterial,
  converterQuestao,
  guardarToken,
  lerToken,
  modoServidor,
  questaoParaServidor,
  quandoSessaoExpirar,
  servidor,
} from '../servicos/servidor.js';

/* =========================================================================
   Estado da aplicação e todas as operações sobre ele.

   Dois modos, com a mesma interface para as telas:

   - DEMONSTRAÇÃO (sem VITE_API_URL): tudo em memória, com os dados fixos de
     dados/conteudo.js. Recarregar a página devolve o protótipo ao estado
     inicial — o que é o que se quer entre uma sessão de teste de usabilidade
     e a seguinte. É o modo publicado no GitHub Pages e no arquivo offline.
   - SERVIDOR (com VITE_API_URL): conta real, envio de arquivo de verdade,
     adaptação pelo motor, atividade publicada com link que funciona fora
     deste navegador.

   As telas não sabem em qual modo estão, salvo onde a interação é outra de
   fato (escolher arquivo do computador × escolher exemplo da lista).
   ========================================================================= */

const ContextoApp = createContext(null);

const PROFESSORA_DEMO = {
  nome: 'Ana Paula Ribeiro',
  email: 'professor@escola.manaus.br',
  escola: 'Escola Municipal (rede Semed)',
  turma: '5º ano B',
};

const CATALOGO_DEMO = { conjunto: CONJUNTO_REGRAS, regras: REGRAS };

function adaptacaoDemo({ blocos, questoes }) {
  return {
    status: 'GERADA',
    blocos,
    questoes,
    original: TEXTO_ORIGINAL.map((texto) => ({ tipo: 'paragrafo', texto })),
    metricas: METRICAS,
    conjunto: CONJUNTO_REGRAS,
    regras: REGRAS,
  };
}

/** O servidor não informa progresso da adaptação: o pedido volta quando
 *  termina. A barra avança pelas etapas em ritmo estimado e só chega a 100%
 *  com a resposta — nunca diz que terminou antes de terminar (H1). */
async function comProgresso(promessa, aoProgredir) {
  let etapa = 0;
  aoProgredir?.(5, ETAPAS_PROCESSAMENTO[0]);
  const relogio = window.setInterval(() => {
    etapa = Math.min(etapa + 1, ETAPAS_PROCESSAMENTO.length - 1);
    aoProgredir?.(Math.round(((etapa + 1) / ETAPAS_PROCESSAMENTO.length) * 90), ETAPAS_PROCESSAMENTO[etapa]);
  }, 6000);
  try {
    const resultado = await promessa;
    aoProgredir?.(100, 'Concluído');
    return resultado;
  } finally {
    window.clearInterval(relogio);
  }
}

export function ProvedorAplicacao({ children }) {
  const [professor, setProfessor] = useState(null);
  const [pronto, setPronto] = useState(!modoServidor);
  const [materiais, setMateriais] = useState(modoServidor ? [] : MATERIAIS_INICIAIS);
  const [adaptacoes, setAdaptacoes] = useState(
    modoServidor ? {} : { 'm-102': { blocos: TEXTO_ADAPTADO, questoes: QUESTOES } },
  );
  const [catalogo, setCatalogo] = useState(modoServidor ? null : CATALOGO_DEMO);

  /* --- Sessão (RF01) ------------------------------------------------------ */

  const encerrarSessao = useCallback(() => {
    guardarToken(null);
    setProfessor(null);
    setMateriais(modoServidor ? [] : MATERIAIS_INICIAIS);
    if (modoServidor) setAdaptacoes({});
  }, []);

  const carregarMateriais = useCallback(async () => {
    if (!modoServidor) return;
    const lista = await servidor.materiais();
    setMateriais(lista.map(converterMaterial));
  }, []);

  useEffect(() => {
    if (!modoServidor) return;
    quandoSessaoExpirar(encerrarSessao);
    if (!lerToken()) {
      setPronto(true);
      return;
    }
    // Recarregar a página não derruba a sessão enquanto o token valer.
    servidor
      .eu()
      .then((eu) => {
        setProfessor(eu);
        return carregarMateriais();
      })
      .catch(() => guardarToken(null))
      .finally(() => setPronto(true));
  }, [encerrarSessao, carregarMateriais]);

  const abrirSessao = useCallback(
    async (sessao) => {
      guardarToken(sessao.token);
      setProfessor(sessao.professor);
      await carregarMateriais();
    },
    [carregarMateriais],
  );

  const entrar = useCallback(
    async (email, senha) => {
      if (!modoServidor) {
        setProfessor({ ...PROFESSORA_DEMO, email: email || PROFESSORA_DEMO.email });
        return;
      }
      await abrirSessao(await servidor.entrar(email, senha));
    },
    [abrirSessao],
  );

  const cadastrar = useCallback(
    async (nome, email, senha) => abrirSessao(await servidor.cadastrar(nome, email, senha)),
    [abrirSessao],
  );

  /* --- Leitura ------------------------------------------------------------ */

  const material = useCallback((id) => materiais.find((m) => m.id === id) ?? null, [materiais]);

  const adaptacao = useCallback(
    (id) => {
      if (modoServidor) return adaptacoes[id] ?? null;
      return adaptacaoDemo(adaptacoes[id] ?? { blocos: TEXTO_ADAPTADO, questoes: QUESTOES });
    },
    [adaptacoes],
  );

  const guardarAdaptacao = useCallback((id, dadosServidor, questoes) => {
    setAdaptacoes((atuais) => ({ ...atuais, [id]: converterAdaptacao(dadosServidor, questoes) }));
  }, []);

  const carregarAdaptacao = useCallback(
    async (id) => {
      if (!modoServidor) return;
      const [dados, questoes] = await Promise.all([servidor.adaptacao(id), servidor.questoes(id)]);
      guardarAdaptacao(id, dados, questoes);
    },
    [guardarAdaptacao],
  );

  const carregarCatalogo = useCallback(async () => {
    if (!modoServidor || catalogo) return;
    setCatalogo(converterConjunto(await servidor.regras()));
  }, [catalogo]);

  /** Usado pelas telas do estudante no modo demonstração: acha o material
   *  dono de um código de atividade publicada (RF18/RN06). */
  const materialPorCodigo = useCallback(
    (codigo) => materiais.find((m) => m.atividade?.codigo === codigo) ?? null,
    [materiais],
  );

  /* --- Escrita ------------------------------------------------------------ */

  const atualizarMaterial = useCallback((id, mudancas) => {
    setMateriais((atuais) => atuais.map((m) => (m.id === id ? { ...m, ...mudancas } : m)));
  }, []);

  const mudarDemo = useCallback((id, mudancas) => {
    setAdaptacoes((atuais) => ({
      ...atuais,
      [id]: { ...(atuais[id] ?? { blocos: TEXTO_ADAPTADO, questoes: QUESTOES }), ...mudancas },
    }));
  }, []);

  /** Só no modo demonstração: o material nasce pronto, no fim do fluxo. */
  const acrescentarMaterial = useCallback((novo) => {
    setMateriais((atuais) => [novo, ...atuais]);
    setAdaptacoes((atuais) => ({ ...atuais, [novo.id]: { blocos: TEXTO_ADAPTADO, questoes: QUESTOES } }));
  }, []);

  /** Só no modo servidor: envia o arquivo e extrai o texto (RF02, RF03). */
  const enviarArquivo = useCallback(
    async (arquivo) => {
      const enviado = await servidor.enviar(arquivo);
      await carregarMateriais();
      return enviado;
    },
    [carregarMateriais],
  );

  /** Gera a adaptação (RF05) — ou reprocessa, se já existe uma (RF12). */
  const adaptarMaterial = useCallback(
    async (id, aoProgredir, sinal) => {
      if (!modoServidor) {
        await demo.processarAdaptacao(aoProgredir, sinal);
        atualizarMaterial(id, {
          versaoRegras: `${CONJUNTO_REGRAS.identificador} v${CONJUNTO_REGRAS.versao}`,
          estado: 'adaptado',
        });
        return;
      }
      const dados = await comProgresso(servidor.adaptar(id, sinal?.controle?.signal), aoProgredir);
      guardarAdaptacao(id, dados, await servidor.questoes(id));
      await carregarMateriais();
    },
    [atualizarMaterial, guardarAdaptacao, carregarMateriais],
  );

  /** RF09. No modo servidor o texto vai como Markdown, que é o formato
   *  guardado; no de demonstração, como blocos. */
  const salvarTexto = useCallback(
    async (id, { blocos, texto }) => {
      if (!modoServidor) {
        mudarDemo(id, { blocos });
        return;
      }
      const dados = await servidor.editarTexto(id, texto);
      guardarAdaptacao(id, dados, await servidor.questoes(id));
      await carregarMateriais();
    },
    [mudarDemo, guardarAdaptacao, carregarMateriais],
  );

  /** RN02 — aprovar é o que libera a exportação e a publicação. */
  const aprovar = useCallback(
    async (id) => {
      if (!modoServidor) {
        const resultado = await demo.aprovarEExportar(id);
        atualizarMaterial(id, { estado: 'aprovado' });
        return { aprovadoEm: resultado.geradoEm };
      }
      const dados = await servidor.aprovar(id);
      guardarAdaptacao(id, dados, await servidor.questoes(id));
      await carregarMateriais();
      return { aprovadoEm: converterAdaptacao(dados).aprovadaEm };
    },
    [atualizarMaterial, guardarAdaptacao, carregarMateriais],
  );

  const salvarQuestoes = useCallback(
    async (id, questoes) => {
      if (!modoServidor) {
        mudarDemo(id, { questoes });
        return;
      }
      const salvas = await servidor.salvarQuestoes(id, questoes.map(questaoParaServidor));
      setAdaptacoes((atuais) => ({
        ...atuais,
        [id]: { ...atuais[id], questoes: salvas.map(converterQuestao) },
      }));
    },
    [mudarDemo],
  );

  const gerarQuestoes = useCallback(async (id) => {
    const geradas = await servidor.gerarQuestoes(id);
    setAdaptacoes((atuais) => ({
      ...atuais,
      [id]: { ...atuais[id], questoes: geradas.map(converterQuestao) },
    }));
  }, []);

  const publicar = useCallback(
    async (id) => {
      if (!modoServidor) {
        const resultado = await demo.publicarAtividade(id);
        atualizarMaterial(id, {
          atividade: { estado: 'publicada', codigo: resultado.codigo, publicadaEm: resultado.publicadaEm },
        });
        return resultado;
      }
      const atividade = await servidor.publicar(id);
      await carregarMateriais();
      return atividade;
    },
    [atualizarMaterial, carregarMateriais],
  );

  const revogar = useCallback(
    async (id) => {
      if (!modoServidor) {
        await demo.revogarLink(id);
        setMateriais((atuais) =>
          atuais.map((m) =>
            m.id === id ? { ...m, atividade: { ...m.atividade, estado: 'revogada' } } : m,
          ),
        );
        return;
      }
      await servidor.revogar(id);
      await carregarMateriais();
    },
    [carregarMateriais],
  );

  const excluir = useCallback(async (id) => {
    if (modoServidor) await servidor.excluir(id);
    else await demo.excluirMaterial(id);
    setMateriais((atuais) => atuais.filter((m) => m.id !== id));
    setAdaptacoes((atuais) => {
      const resto = { ...atuais };
      delete resto[id];
      return resto;
    });
  }, []);

  const valor = useMemo(
    () => ({
      modoServidor,
      pronto,
      professor,
      autenticado: Boolean(professor),
      entrar,
      cadastrar,
      sair: encerrarSessao,
      materiais,
      material,
      materialPorCodigo,
      adaptacao,
      carregarAdaptacao,
      catalogo,
      carregarCatalogo,
      acrescentarMaterial,
      enviarArquivo,
      adaptarMaterial,
      salvarTexto,
      aprovar,
      salvarQuestoes,
      gerarQuestoes,
      publicar,
      revogar,
      excluir,
    }),
    [
      pronto, professor, entrar, cadastrar, encerrarSessao, materiais, material,
      materialPorCodigo, adaptacao, carregarAdaptacao, catalogo, carregarCatalogo,
      acrescentarMaterial, enviarArquivo, adaptarMaterial, salvarTexto, aprovar,
      salvarQuestoes, gerarQuestoes, publicar, revogar, excluir,
    ],
  );

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>;
}

export function usarApp() {
  const contexto = useContext(ContextoApp);
  if (!contexto) throw new Error('usarApp precisa estar dentro de ProvedorAplicacao');
  return contexto;
}

/** Adaptação de um material, carregada do servidor quando for o caso.
 *  `dados` é null enquanto carrega, ou quando o material ainda não foi
 *  adaptado — `erro.status === 404` distingue o segundo caso. */
export function usarAdaptacao(id) {
  const { adaptacao, carregarAdaptacao } = usarApp();
  const [estado, setEstado] = useState({ carregando: modoServidor, erro: null });

  useEffect(() => {
    if (!modoServidor) return undefined;
    let vivo = true;
    setEstado({ carregando: true, erro: null });
    carregarAdaptacao(id)
      .then(() => vivo && setEstado({ carregando: false, erro: null }))
      .catch((erro) => vivo && setEstado({ carregando: false, erro }));
    return () => {
      vivo = false;
    };
  }, [id, carregarAdaptacao]);

  return { dados: adaptacao(id), ...estado };
}

/** Catálogo das regras vigentes (tela de Ajuda, passo 2 do envio). */
export function usarCatalogo() {
  const { catalogo, carregarCatalogo } = usarApp();
  useEffect(() => {
    carregarCatalogo().catch(() => {});
  }, [carregarCatalogo]);
  return catalogo;
}
