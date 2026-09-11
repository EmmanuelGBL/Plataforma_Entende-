import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Aviso, Botao, Campo } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';

/* =========================================================================
   UC01 — Autenticar-se (RF01)

   Decisões de acessibilidade que valem registro:

   - O campo de senha não bloqueia colar. Bloquear impede o uso de gerenciador
     de senhas e reprova no SC 3.3.8 (Accessible Authentication), novo na
     WCAG 2.2.
   - Erro de formulário aparece em um resumo no topo, que recebe o foco. Quem
     usa leitor de tela descobre o problema sem precisar percorrer o
     formulário de novo (SC 3.3.1).
   - A mensagem de erro diz o que fazer, não só o que está errado (SC 3.3.3).
   ========================================================================= */

export function Entrar() {
  usarTituloDaPagina('Entrar');
  const { entrar } = usarApp();
  const navegar = useNavigate();
  const [email, setEmail] = useState('professor@escola.manaus.br');
  const [senha, setSenha] = useState('demonstracao');
  const [erros, setErros] = useState({});
  const resumo = useRef(null);

  function enviar(evento) {
    evento.preventDefault();
    const novos = {};
    if (!email.trim()) novos.email = 'Digite o e-mail com que você criou a conta.';
    else if (!email.includes('@')) novos.email = 'O e-mail precisa ter @. Exemplo: nome@escola.br';
    if (!senha) novos.senha = 'Digite sua senha para entrar.';

    setErros(novos);
    if (Object.keys(novos).length > 0) {
      window.setTimeout(() => resumo.current?.focus(), 0);
      return;
    }
    entrar(email);
    navegar('/painel');
  }

  const listaErros = Object.entries(erros);

  return (
    <div style={{ maxWidth: '34rem', marginInline: 'auto' }}>
      <div className="cabecalho-pagina">
        <h1>Entrar no Entende+</h1>
        <p>
          Adaptação de material didático para estudantes com autismo do 5º ano do ensino
          fundamental.
        </p>
      </div>

      {listaErros.length > 0 && (
        <div ref={resumo} tabIndex={-1}>
          <Aviso tipo="erro" titulo="Não foi possível entrar" papel="alert" nivel={2}>
            <ul>
              {listaErros.map(([campo, mensagem]) => (
                <li key={campo}>{mensagem}</li>
              ))}
            </ul>
          </Aviso>
        </div>
      )}

      <section className="cartao">
        <form onSubmit={enviar} noValidate>
          <Campo
            rotulo="E-mail"
            tipo="email"
            autoComplete="username"
            obrigatorio
            value={email}
            erro={erros.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            rotulo="Senha"
            tipo="password"
            autoComplete="current-password"
            obrigatorio
            value={senha}
            erro={erros.senha}
            dica="Você pode colar a senha, se usa um gerenciador de senhas."
            onChange={(e) => setSenha(e.target.value)}
          />

          <Botao type="submit" largo>
            Entrar
          </Botao>
        </form>
      </section>

      {/* nivel={2}: nesta tela o aviso é o primeiro título depois do h1, e h3
          aqui abriria um salto de nível (SC 1.3.1). */}
      <Aviso tipo="info" titulo="Protótipo de demonstração" nivel={2}>
        <p>
          Esta é uma demonstração de interface para o Trabalho de Conclusão de Curso. Os campos já
          vêm preenchidos e qualquer senha é aceita. Nenhum dado é enviado para servidor algum.
        </p>
      </Aviso>
    </div>
  );
}
