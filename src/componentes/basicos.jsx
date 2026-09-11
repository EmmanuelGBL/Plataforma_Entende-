import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* =========================================================================
   Componentes de base do design system.
   Existem para que a heurística H4 (consistência) seja consequência do
   código, e não de disciplina: se todo botão é <Botao>, não há como um
   ecrã ter altura de alvo diferente do outro.
   ========================================================================= */

export function Botao({ variante = 'principal', como = 'button', para, largo, children, ...resto }) {
  const classe = `botao botao--${variante}${largo ? ' botao--largo' : ''}`;
  if (como === 'link') {
    return (
      <Link className={classe} to={para} {...resto}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classe} {...resto}>
      {children}
    </button>
  );
}

/**
 * Campo de formulário com rótulo sempre visível.
 *
 * Rótulo dentro do campo (placeholder como rótulo) reprova em SC 3.3.2 e
 * some no momento em que o usuário mais precisa dele — quando está digitando.
 * A mensagem de erro é ligada por aria-describedby e traz o que fazer, não só
 * o que está errado (SC 3.3.1 e 3.3.3).
 */
export function Campo({
  rotulo,
  dica,
  erro,
  obrigatorio,
  tipo = 'text',
  multilinha,
  className = '',
  ...resto
}) {
  const id = useId();
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;
  const descrito = [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(' ');
  const Elemento = multilinha ? 'textarea' : 'input';

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {rotulo}
        {obrigatorio && (
          <span className="campo__obrigatorio" aria-hidden="true">
            {' *'}
          </span>
        )}
        {obrigatorio && <span className="apenas-leitor"> (campo obrigatório)</span>}
      </label>
      {dica && (
        <span className="campo__dica" id={idDica}>
          {dica}
        </span>
      )}
      <Elemento
        id={id}
        className={`${multilinha ? 'area-texto' : 'entrada'} ${className}`.trim()}
        type={multilinha ? undefined : tipo}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={descrito || undefined}
        required={obrigatorio || undefined}
        {...resto}
      />
      {erro && (
        <p className="campo__erro" id={idErro}>
          <span aria-hidden="true">⚠</span>
          <span>{erro}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Bloco de mensagem. O ícone é decorativo — quem lê por leitor de tela
 * recebe a natureza da mensagem pelo texto do título, nunca pela cor
 * (SC 1.4.1).
 */
/**
 * `nivel` existe porque o título do aviso entra na estrutura de títulos da
 * página, e nível de título não pode pular degrau (SC 1.3.1). O padrão é h3,
 * que é o correto quando o aviso vem dentro de uma seção com h2. Numa tela em
 * que o aviso é o primeiro título depois do h1 — a de entrar, por exemplo —
 * passa-se `nivel={2}`.
 */
export function Aviso({ tipo = 'info', titulo, children, papel, nivel = 3 }) {
  const icones = { info: 'ℹ', boa: '✓', atencao: '!', erro: '⚠' };
  const Titulo = `h${nivel}`;
  return (
    <div className={`aviso aviso--${tipo}`} role={papel}>
      <span className="aviso__icone" aria-hidden="true">
        {icones[tipo]}
      </span>
      <div>
        {titulo && <Titulo>{titulo}</Titulo>}
        {children}
      </div>
    </div>
  );
}

/**
 * Invólucro das tabelas largas.
 *
 * A tabela rola na horizontal quando não cabe. Região que rola precisa ser
 * alcançável por teclado, senão quem não usa mouse não chega ao conteúdo que
 * ficou fora da área visível (SC 2.1.1) — foi exatamente o defeito encontrado
 * nos painéis de comparação na auditoria de 11/09.
 *
 * O `tabindex` só é aplicado quando a tabela de fato transborda: parada de
 * tabulação que não leva a lugar nenhum é ruído para quem navega por teclado
 * (H7), e em tela larga a tabela cabe inteira.
 */
export function TabelaEnvolvente({ rotulo, children }) {
  const caixa = useRef(null);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return undefined;
    const medir = () => setTransborda(elemento.scrollWidth > elemento.clientWidth + 1);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [children]);

  return (
    <div
      ref={caixa}
      className="tabela-envolvente"
      tabIndex={transborda ? 0 : undefined}
      role={transborda ? 'region' : undefined}
      aria-label={transborda ? rotulo : undefined}
    >
      {children}
    </div>
  );
}

export function Etiqueta({ tom = 'neutra', children }) {
  return <span className={`etiqueta etiqueta--${tom}`}>{children}</span>;
}

export function Cartao({ compacto, children, ...resto }) {
  return (
    <section className={`cartao${compacto ? ' cartao--compacto' : ''}`} {...resto}>
      {children}
    </section>
  );
}

/**
 * Aviso exibido quando o material aberto não é o de Ciências, o único desta
 * demonstração que tem texto adaptado escrito para ele.
 *
 * A alternativa seria deixar o cabeçalho dizer "História" com o texto de
 * fotossíntese embaixo, e torcer para ninguém abrir. Declarar o limite custa
 * uma faixa de aviso e vale mais que parecer um defeito — é a mesma postura
 * adotada no documento e na tela de entrada.
 */
export function AvisoConteudoDemo({ material }) {
  if (material?.conteudoProprio) return null;
  return (
    <Aviso tipo="atencao" titulo="Conteúdo de demonstração">
      <p>
        Este material existe no histórico para mostrar a listagem e os estados da atividade. O
        texto adaptado e as questões exibidas abaixo são os do material{' '}
        <strong>Ciências — Fotossíntese</strong>, o único conteúdo incluído nesta demonstração.
      </p>
    </Aviso>
  );
}

/** Trilha de navegação — apoia H6 (reconhecer em vez de lembrar) e dá o
 *  caminho de volta exigido por H3. */
export function Migalhas({ itens }) {
  return (
    <nav className="migalhas" aria-label="Você está em">
      <ol>
        {itens.map((item, indice) => (
          <li key={item.rotulo}>
            {item.para && indice < itens.length - 1 ? (
              <Link to={item.para}>{item.rotulo}</Link>
            ) : (
              <span aria-current="page">{item.rotulo}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
