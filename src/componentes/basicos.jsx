import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* Componentes de base da interface (botão, campo, aviso, etiqueta, cartão,
   trilha de navegação), usados por todas as telas. */

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

/** Campo de formulário com rótulo sempre visível. Dica e mensagem de erro
 *  são ligadas ao campo por aria-describedby. */
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

/** Bloco de mensagem (informação, sucesso, atenção ou erro). O tipo é dito
 *  no texto e no ícone, não só pela cor. */
/** `nivel` define o nível do título do aviso, para não pular nível de título
 *  na página. O padrão é h3. */
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

/** Envolve tabelas largas. Quando a tabela transborda, ela rola na horizontal
 *  e passa a receber foco pelo teclado. */
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

export function Cartao({ compacto, className = '', children, ...resto }) {
  return (
    <section
      className={`cartao${compacto ? ' cartao--compacto' : ''}${className ? ` ${className}` : ''}`}
      {...resto}
    >
      {children}
    </section>
  );
}

/** Aviso do modo demonstração para materiais que não têm texto adaptado
 *  próprio (só o de Ciências tem). */
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

/** Trilha de navegação ("Meus materiais › ..."). */
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
