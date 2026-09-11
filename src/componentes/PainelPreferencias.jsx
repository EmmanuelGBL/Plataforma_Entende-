import { useEffect, useRef, useState } from 'react';
import { usarPreferencias } from '../contextos/Preferencias.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* =========================================================================
   Painel de preferências de exibição, na barra superior de toda página.

   Está em todas as telas de propósito: o SC 3.2.6 (Consistent Help), novo na
   WCAG 2.2, pede que o mesmo recurso de ajuda esteja sempre no mesmo lugar.
   E vale como argumento no artigo: um sistema cujo objeto é acessibilidade
   cognitiva deixar o próprio ajuste de leitura escondido seria contradição.
   ========================================================================= */

const OPCOES = {
  fonte: [
    { valor: 'normal', rotulo: 'Padrão' },
    { valor: 'grande', rotulo: 'Grande' },
    { valor: 'maior', rotulo: 'Maior' },
  ],
  espacamento: [
    { valor: 'normal', rotulo: 'Padrão' },
    { valor: 'amplo', rotulo: 'Amplo' },
  ],
  contraste: [
    { valor: 'padrao', rotulo: 'Padrão' },
    { valor: 'alto', rotulo: 'Alto contraste' },
  ],
  movimento: [
    { valor: 'padrao', rotulo: 'Padrão' },
    { valor: 'reduzido', rotulo: 'Reduzido' },
  ],
};

const NOMES = {
  fonte: 'Tamanho do texto',
  espacamento: 'Espaçamento entre linhas e letras',
  contraste: 'Contraste',
  movimento: 'Animações',
};

export function PainelPreferencias() {
  const { preferencias, definir, restaurar, ehPadrao } = usarPreferencias();
  const { anunciar } = usarAnuncios();
  const [aberto, setAberto] = useState(false);
  const area = useRef(null);
  const gatilho = useRef(null);

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

  function trocar(chave, valor, rotulo) {
    definir(chave, valor);
    anunciar(`${NOMES[chave]}: ${rotulo}.`);
  }

  return (
    <div className="preferencias" ref={area}>
      <button
        type="button"
        ref={gatilho}
        className="preferencias__gatilho"
        aria-expanded={aberto}
        aria-controls="painel-preferencias"
        onClick={() => setAberto((v) => !v)}
      >
        <span aria-hidden="true">◑</span>
        Exibição
      </button>

      {aberto && (
        <div className="preferencias__painel" id="painel-preferencias">
          <h2 className="apenas-leitor">Preferências de exibição</h2>
          {Object.keys(OPCOES).map((chave) => (
            <fieldset key={chave}>
              <legend>{NOMES[chave]}</legend>
              <div className="grupo-botoes">
                {OPCOES[chave].map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    /* Sem o aria-label, quem navega por lista de botões ouve
                       "Padrão, Padrão, Padrão, Padrão" — o texto visível se
                       repete em todos os grupos e a legenda do fieldset nem
                       sempre é anunciada fora do contexto do formulário. */
                    aria-label={`${NOMES[chave]}: ${opcao.rotulo}`}
                    aria-pressed={preferencias[chave] === opcao.valor}
                    onClick={() => trocar(chave, opcao.valor, opcao.rotulo)}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <button
            type="button"
            className="botao botao--discreto"
            disabled={ehPadrao}
            onClick={() => {
              restaurar();
              anunciar('Preferências de exibição restauradas para o padrão.');
            }}
          >
            Restaurar o padrão
          </button>
        </div>
      )}
    </div>
  );
}
