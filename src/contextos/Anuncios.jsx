import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, CircleX, X } from 'lucide-react';

/* Região de status única (aria-live="polite"): anuncia ao leitor de tela
   as mensagens que aparecem sem recarregar a página.

   `avisar` mostra também um aviso flutuante no canto da tela: verde com
   ✓ quando deu certo, vermelho com ✕ quando deu errado ou foi cancelado.
   O tipo vai no ícone e no texto, não só na cor. O aviso some sozinho, mas
   fica parado enquanto o ponteiro ou o foco estiverem nele. O texto vai
   para o leitor de tela pela região de status, e não pelo próprio aviso,
   para não ser lido duas vezes. */

const ContextoAnuncios = createContext(null);

const DURACAO_MS = 6000;

function AvisoFlutuante({ aviso, fechar }) {
  const [parado, setParado] = useState(false);
  const aoFechar = useCallback(() => fechar(aviso.id), [fechar, aviso.id]);
  const Icone = aviso.tipo === 'erro' ? CircleX : CircleCheck;

  useEffect(() => {
    if (parado) return undefined;
    const relogio = window.setTimeout(aoFechar, DURACAO_MS);
    return () => window.clearTimeout(relogio);
  }, [parado, aoFechar]);

  return (
    <div
      className={`toast toast--${aviso.tipo}`}
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
    >
      <Icone aria-hidden="true" className="toast__icone" />
      <div className="toast__texto">
        <p className="toast__titulo">{aviso.titulo}</p>
        {aviso.texto && <p>{aviso.texto}</p>}
      </div>
      <button type="button" className="toast__fechar" onClick={aoFechar}>
        <X aria-hidden="true" />
        <span className="apenas-leitor">Fechar aviso</span>
      </button>
    </div>
  );
}

export function ProvedorAnuncios({ children }) {
  const [mensagem, setMensagem] = useState('');
  const [avisos, setAvisos] = useState([]);
  const proximo = useRef(0);

  const anunciar = useCallback((texto) => {
    // Limpa antes de escrever: mensagens repetidas em sequência só são
    // reanunciadas se o conteúdo da região realmente mudar.
    setMensagem('');
    window.setTimeout(() => setMensagem(texto), 60);
  }, []);

  const fechar = useCallback((id) => {
    setAvisos((lista) => lista.filter((aviso) => aviso.id !== id));
  }, []);

  /** tipo: 'boa' (deu certo) ou 'erro' (deu errado ou foi cancelado). */
  const avisar = useCallback(
    (tipo, titulo, texto) => {
      proximo.current += 1;
      const id = proximo.current;
      // No máximo três na tela: o mais antigo sai primeiro.
      setAvisos((lista) => [...lista.slice(-2), { id, tipo, titulo, texto }]);
      anunciar(texto ? `${titulo}. ${texto}` : `${titulo}.`);
    },
    [anunciar],
  );

  const valor = useMemo(() => ({ anunciar, avisar }), [anunciar, avisar]);

  return (
    <ContextoAnuncios.Provider value={valor}>
      {children}
      <div className="apenas-leitor" role="status" aria-live="polite" aria-atomic="true">
        {mensagem}
      </div>
      {avisos.length > 0 && (
        <div className="toasts">
          {avisos.map((aviso) => (
            <AvisoFlutuante key={aviso.id} aviso={aviso} fechar={fechar} />
          ))}
        </div>
      )}
    </ContextoAnuncios.Provider>
  );
}

export function usarAnuncios() {
  const contexto = useContext(ContextoAnuncios);
  if (!contexto) throw new Error('usarAnuncios precisa estar dentro de ProvedorAnuncios');
  return contexto;
}
