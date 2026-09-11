import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/* =========================================================================
   Preferências de exibição do usuário.
   Não é enfeite: é a implementação dos critérios de sucesso da WCAG 2.2
   1.4.4 (redimensionar texto), 1.4.12 (espaçamento do texto), 1.4.3/1.4.11
   (contraste) e 2.3.3 (animação a partir de interação), somados à
   recomendação 1.6 do e-MAG (alto contraste).

   As escolhas são gravadas em localStorage. Um professor que aumenta a fonte
   não deveria precisar refazer isso a cada aula — e "lembrar do usuário" é a
   heurística H6.
   ========================================================================= */

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
