import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/* Região de status única (aria-live="polite"): anuncia ao leitor de tela
   as mensagens que aparecem sem recarregar a página. */

const ContextoAnuncios = createContext(null);

export function ProvedorAnuncios({ children }) {
  const [mensagem, setMensagem] = useState('');

  const anunciar = useCallback((texto) => {
    // Limpa antes de escrever: mensagens repetidas em sequência só são
    // reanunciadas se o conteúdo da região realmente mudar.
    setMensagem('');
    window.setTimeout(() => setMensagem(texto), 60);
  }, []);

  const valor = useMemo(() => ({ anunciar }), [anunciar]);

  return (
    <ContextoAnuncios.Provider value={valor}>
      {children}
      <div className="apenas-leitor" role="status" aria-live="polite" aria-atomic="true">
        {mensagem}
      </div>
    </ContextoAnuncios.Provider>
  );
}

export function usarAnuncios() {
  const contexto = useContext(ContextoAnuncios);
  if (!contexto) throw new Error('usarAnuncios precisa estar dentro de ProvedorAnuncios');
  return contexto;
}
