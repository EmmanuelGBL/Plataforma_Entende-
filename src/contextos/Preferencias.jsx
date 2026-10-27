import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/* Preferências de exibição (tamanho do texto, espaçamento, contraste e
   animações), gravadas em localStorage e aplicadas como atributos na raiz
   do documento. */

const CHAVE = 'entende-mais:preferencias';

const PADRAO = {
  fonte: 'normal', // normal | grande | maior
  espacamento: 'normal', // normal | amplo
  contraste: 'padrao', // padrao | alto
  movimento: 'padrao', // padrao | reduzido
};

const ContextoPreferencias = createContext(null);

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...PADRAO, ...JSON.parse(bruto) } : PADRAO;
  } catch {
    // Modo anônimo ou storage bloqueado: segue com o padrão, sem quebrar.
    return PADRAO;
  }
}

export function ProvedorPreferencias({ children }) {
  const [preferencias, setPreferencias] = useState(ler);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.fonte = preferencias.fonte;
    raiz.dataset.espacamento = preferencias.espacamento;
    raiz.dataset.contraste = preferencias.contraste;
    raiz.dataset.movimento = preferencias.movimento;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(preferencias));
    } catch {
      /* preferência não persistida; a sessão atual continua valendo */
    }
  }, [preferencias]);

  const valor = useMemo(
    () => ({
      preferencias,
      definir: (chave, novoValor) =>
        setPreferencias((atual) => ({ ...atual, [chave]: novoValor })),
      restaurar: () => setPreferencias(PADRAO),
      ehPadrao: JSON.stringify(preferencias) === JSON.stringify(PADRAO),
    }),
    [preferencias],
  );

  return <ContextoPreferencias.Provider value={valor}>{children}</ContextoPreferencias.Provider>;
}

export function usarPreferencias() {
  const contexto = useContext(ContextoPreferencias);
  if (!contexto) throw new Error('usarPreferencias precisa estar dentro de ProvedorPreferencias');
  return contexto;
}
