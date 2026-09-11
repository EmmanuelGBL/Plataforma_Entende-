import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { MATERIAIS_INICIAIS, QUESTOES, TEXTO_ADAPTADO } from '../dados/conteudo.js';

/* =========================================================================
   Estado do protótipo: professor autenticado e materiais.

   Guardado em memória de propósito. Recarregar a página devolve o protótipo
   ao estado inicial, o que é exatamente o que se quer entre uma sessão de
   teste de usabilidade e a seguinte — cada participante começa igual, sem
   depender de a gente lembrar de limpar alguma coisa.
   ========================================================================= */

const ContextoApp = createContext(null);

const PROFESSORA_DEMO = {
  nome: 'Ana Paula Ribeiro',
  email: 'professor@escola.manaus.br',
  escola: 'Escola Municipal (rede Semed)',
  turma: '5º ano B',
};

export function ProvedorAplicacao({ children }) {
  const [professor, setProfessor] = useState(null);
  const [materiais, setMateriais] = useState(MATERIAIS_INICIAIS);
  const [adaptacoes, setAdaptacoes] = useState({
    'm-102': { blocos: TEXTO_ADAPTADO, questoes: QUESTOES },
  });

  const entrar = useCallback((email) => {
    setProfessor({ ...PROFESSORA_DEMO, email: email || PROFESSORA_DEMO.email });
  }, []);

  const sair = useCallback(() => setProfessor(null), []);

  const acrescentarMaterial = useCallback((material) => {
    setMateriais((atuais) => [material, ...atuais]);
    setAdaptacoes((atuais) => ({
      ...atuais,
      [material.id]: { blocos: TEXTO_ADAPTADO, questoes: QUESTOES },
    }));
  }, []);

  const atualizarMaterial = useCallback((id, mudancas) => {
    setMateriais((atuais) =>
      atuais.map((m) => (m.id === id ? { ...m, ...mudancas } : m)),
    );
  }, []);

  const removerMaterial = useCallback((id) => {
    setMateriais((atuais) => atuais.filter((m) => m.id !== id));
  }, []);

  const definirQuestoes = useCallback((id, questoes) => {
    setAdaptacoes((atuais) => ({
      ...atuais,
      [id]: { ...(atuais[id] ?? {}), questoes },
    }));
  }, []);

  const definirBlocos = useCallback((id, blocos) => {
    setAdaptacoes((atuais) => ({
      ...atuais,
      [id]: { ...(atuais[id] ?? {}), blocos },
    }));
  }, []);

  const material = useCallback((id) => materiais.find((m) => m.id === id) ?? null, [materiais]);

  const adaptacao = useCallback(
    (id) => adaptacoes[id] ?? { blocos: TEXTO_ADAPTADO, questoes: QUESTOES },
    [adaptacoes],
  );

  /** Usado pela tela do estudante: acha o material dono de um código de
   *  atividade publicada, para saber se o link ainda vale (RF18/RN06). */
  const materialPorCodigo = useCallback(
    (codigo) => materiais.find((m) => m.atividade?.codigo === codigo) ?? null,
    [materiais],
  );

  const valor = useMemo(
    () => ({
      professor,
      autenticado: Boolean(professor),
      entrar,
      sair,
      materiais,
      material,
      materialPorCodigo,
      acrescentarMaterial,
      atualizarMaterial,
      removerMaterial,
      adaptacao,
      definirQuestoes,
      definirBlocos,
    }),
    [
      professor, entrar, sair, materiais, material, materialPorCodigo,
      acrescentarMaterial, atualizarMaterial, removerMaterial, adaptacao,
      definirQuestoes, definirBlocos,
    ],
  );

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>;
}

export function usarApp() {
  const contexto = useContext(ContextoApp);
  if (!contexto) throw new Error('usarApp precisa estar dentro de ProvedorAplicacao');
  return contexto;
}
