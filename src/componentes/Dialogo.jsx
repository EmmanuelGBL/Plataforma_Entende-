import { useEffect, useRef } from 'react';
import { Botao } from './basicos.jsx';

/* Diálogo de confirmação das ações irreversíveis (excluir, publicar, revogar).
   O foco fica preso no diálogo, Esc fecha e, ao fechar, o foco volta ao
   botão que o abriu. */

export function Dialogo({
  aberto,
  titulo,
  children,
  aoConfirmar,
  aoCancelar,
  rotuloConfirmar,
  rotuloCancelar = 'Cancelar',
  confirmarDesabilitado,
  perigo,
  largo,
  /* Substitui o par cancelar/confirmar, para diálogos que só têm "Pronto"
     (por exemplo, os ajustes do jogo, que valem na hora). */
  acoes,
}) {
  const caixa = useRef(null);
  const focoAnterior = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;

    focoAnterior.current = document.activeElement;
    const primeiro = caixa.current?.querySelector('button, [href], input, textarea, select');
    primeiro?.focus();

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        aoCancelar();
        return;
      }
      if (evento.key !== 'Tab') return;

      const focaveis = caixa.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focaveis?.length) return;
      const inicio = focaveis[0];
      const fim = focaveis[focaveis.length - 1];

      if (evento.shiftKey && document.activeElement === inicio) {
        evento.preventDefault();
        fim.focus();
      } else if (!evento.shiftKey && document.activeElement === fim) {
        evento.preventDefault();
        inicio.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      // Devolve o foco a quem abriu o diálogo.
      if (focoAnterior.current instanceof HTMLElement) focoAnterior.current.focus();
    };
  }, [aberto, aoCancelar]);

  if (!aberto) return null;

  return (
    <div
      className="dialogo-fundo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoCancelar();
      }}
    >
      <div
        className={`dialogo${largo ? ' dialogo--largo' : ''}`}
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo"
      >
        <h2 id="titulo-dialogo">{titulo}</h2>
        {children}
        <div className="linha linha-fim">
          {acoes ?? (
            <>
              <Botao variante="secundario" onClick={aoCancelar}>
                {rotuloCancelar}
              </Botao>
              <Botao
                variante={perigo ? 'perigo' : 'principal'}
                onClick={aoConfirmar}
                disabled={confirmarDesabilitado}
              >
                {rotuloConfirmar}
              </Botao>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
