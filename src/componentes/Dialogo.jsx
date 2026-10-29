import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Botao } from './basicos.jsx';

/* Janelas modais. O foco fica preso na janela, Esc fecha e, ao fechar, o foco
   volta ao botão que a abriu.

   Janela: a moldura, com conteúdo livre (por exemplo, o formulário de envio,
   que tem os próprios botões).
   Dialogo: confirmação das ações irreversíveis (excluir, publicar, revogar),
   com o par cancelar/confirmar. */

export function Janela({ aberto, titulo, aoFechar, largo, classe = '', botaoFechar, children }) {
  const caixa = useRef(null);
  const focoAnterior = useRef(null);
  // O efeito não deve reiniciar (e roubar o foco) a cada render de quem usa a
  // janela, que costuma passar uma função nova em aoFechar.
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    if (!aberto) return undefined;

    focoAnterior.current = document.activeElement;
    const primeiro = caixa.current?.querySelector(
      'button:not(.janela__fechar), [href], input, textarea, select',
    );
    primeiro?.focus();

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        fechar.current();
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
      // Devolve o foco a quem abriu a janela, se ele ainda estiver na tela.
      if (focoAnterior.current instanceof HTMLElement && focoAnterior.current.isConnected) {
        focoAnterior.current.focus();
      }
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div
      className="dialogo-fundo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        className={`dialogo${largo ? ' dialogo--largo' : ''}${classe ? ` ${classe}` : ''}`}
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo"
      >
        {botaoFechar && (
          <button type="button" className="janela__fechar" onClick={aoFechar}>
            <X aria-hidden="true" />
            <span className="apenas-leitor">Fechar</span>
          </button>
        )}
        <h2 id="titulo-dialogo">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

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
  return (
    <Janela aberto={aberto} titulo={titulo} aoFechar={aoCancelar} largo={largo}>
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
    </Janela>
  );
}
