import { useEffect, useId, useRef, useState } from 'react';
import { EllipsisVertical } from 'lucide-react';

/** Menu ⋮ de um item de lista: botão que abre e fecha uma lista de ações.
 *  `children` são os <li>; escolher uma ação fecha o menu. */
export function MenuAcoes({ rotulo, children }) {
  const [aberto, setAberto] = useState(false);
  const area = useRef(null);
  const gatilho = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(evento) {
      if (!area.current?.contains(evento.target)) setAberto(false);
    }
    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        setAberto(false);
        gatilho.current?.focus();
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="menu-acoes" ref={area}>
      <button
        type="button"
        ref={gatilho}
        className="menu-acoes__gatilho"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((v) => !v)}
      >
        <EllipsisVertical aria-hidden="true" />
        <span className="apenas-leitor">{rotulo}</span>
      </button>
      {aberto && (
        <ul
          className="menu-acoes__lista"
          id={id}
          onClick={(evento) => {
            if (!evento.target.closest('button, a')) return;
            // O foco volta ao ⋮ antes de a janela da ação abrir: é para ele que
            // a janela devolve o foco ao fechar.
            gatilho.current?.focus();
            setAberto(false);
          }}
        >
          {children}
        </ul>
      )}
    </div>
  );
}
