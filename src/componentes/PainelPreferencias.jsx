import { useEffect, useRef, useState } from 'react';
import { PersonStanding } from 'lucide-react';
import { usarPreferencias } from '../contextos/Preferencias.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Painel de preferências de exibição, no mesmo lugar em todas as telas. */

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
        className="barra__acao"
        aria-expanded={aberto}
        aria-controls="painel-preferencias"
        onClick={() => setAberto((v) => !v)}
      >
        <PersonStanding aria-hidden="true" />
        Acessibilidade
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
                    /* aria-label com o nome do grupo: o texto "Padrão" se repete em todos os
                       grupos. */
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
