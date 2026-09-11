import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/* =========================================================================
   Região de status única do aplicativo (aria-live="polite").

   Mudança que aparece na tela sem recarregar a página — adaptação concluída,
   questão excluída, link revogado — não chega a quem usa leitor de tela a
   menos que seja anunciada. É o SC 4.1.3 (Status Messages) da WCAG 2.2 e,
   do lado da usabilidade, a heurística H1.

   Uma região só, no fim do documento, evita o erro comum de espalhar vários
   aria-live pela página e fazer o leitor de tela falar por cima de si mesmo.
   ========================================================================= */

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
