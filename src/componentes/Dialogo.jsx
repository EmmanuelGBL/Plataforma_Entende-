import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Botao } from './basicos.jsx';

/* Janelas modais. O foco fica preso na janela, Esc fecha e, ao fechar, o foco
   volta ao botão que a abriu.

   Janela: a moldura, com conteúdo livre (por exemplo, o formulário de envio,
   que tem os próprios botões).
   Dialogo: confirmação das ações irreversíveis (excluir, publicar, revogar),
   com o par cancelar/confirmar. */

/** Prende o foco dentro de `caixa` enquanto `ativo`: foca o primeiro item,
 *  Tab circula só pelos itens da caixa, Esc chama `aoEscape`, e ao terminar
 *  o foco volta a quem estava com ele (se ainda estiver na tela). Usado pelas
 *  janelas daqui e pela janela da pergunta, dentro do jogo. */
export function usarFocoPreso(caixa, ativo, aoEscape, seletorInicial) {
  // O efeito não deve reiniciar (e roubar o foco) a cada render de quem usa,
  // que costuma passar uma função nova em aoEscape.
  const escape = useRef(aoEscape);
  escape.current = aoEscape;

  useEffect(() => {
    if (!ativo) return undefined;

    const focoAnterior = document.activeElement;
    const primeiro = caixa.current?.querySelector(
      seletorInicial ?? 'button:not(.janela__fechar), [href], input, textarea, select',
    );
    primeiro?.focus();

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        escape.current?.();
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
      if (focoAnterior instanceof HTMLElement && focoAnterior.isConnected) focoAnterior.focus();
    };
  }, [ativo, caixa, seletorInicial]);
}

export function Janela({ aberto, titulo, aoFechar, largo, classe = '', botaoFechar, children }) {
  const caixa = useRef(null);
  usarFocoPreso(caixa, aberto, aoFechar);

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
