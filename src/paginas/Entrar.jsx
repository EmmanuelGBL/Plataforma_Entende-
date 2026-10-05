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

   No modo servidor a mesma tela cria a conta: um formulário a mais, com o
   campo de nome. Duas telas separadas dobrariam o caminho para quem só quer
   entrar, que é o caso de todos os dias.
   ========================================================================= */

export function Entrar() {
  const { entrar, cadastrar, modoServidor } = usarApp();
  const [criando, setCriando] = useState(false);
  usarTituloDaPagina(criando ? 'Criar conta' : 'Entrar');
  const navegar = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState(modoServidor ? '' : 'professor@escola.manaus.br');
  const [senha, setSenha] = useState(modoServidor ? '' : 'demonstracao');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const resumo = useRef(null);

  function focarResumo() {
    window.setTimeout(() => resumo.current?.focus(), 0);
  }

  async function enviar(evento) {
    evento.preventDefault();
    const novos = {};
    if (criando && nome.trim().length < 2) novos.nome = 'Digite o seu nome, com pelo menos 2 letras.';
    if (!email.trim()) novos.email = 'Digite o e-mail com que você criou a conta.';
    else if (!email.includes('@')) novos.email = 'O e-mail precisa ter @. Exemplo: nome@escola.br';
    if (!senha) novos.senha = 'Digite sua senha para entrar.';
    else if (criando && senha.length < 8) novos.senha = 'A senha precisa ter pelo menos 8 caracteres.';

    setErros(novos);
    if (Object.keys(novos).length > 0) {
      focarResumo();
      return;
    }

    setEnviando(true);
    try {
      if (criando) await cadastrar(nome.trim(), email.trim(), senha);
      else await entrar(email.trim(), senha);
      navegar('/painel');
    } catch (erro) {
      // O motivo é o que diz qual campo o servidor recusou; sem ele, a
      // mensagem seria só "alguns dados não foram aceitos".
      setErros({ servidor: [erro.motivo || erro.titulo, erro.saida].filter(Boolean).join(' ') });
      focarResumo();
    } finally {
      setEnviando(false);
    }
  }

  function alternarModo() {
    setCriando((atual) => !atual);
    setErros({});
  }

  const listaErros = Object.entries(erros);

  return (
    <div style={{ maxWidth: '34rem', marginInline: 'auto' }}>
      <div className="cabecalho-pagina">
        <h1>{criando ? 'Criar conta no Entende+' : 'Entrar no Entende+'}</h1>
        <p>
          Adaptação de material didático para estudantes com autismo do 5º ano do ensino
          fundamental.
        </p>
      </div>

      {listaErros.length > 0 && (
        <div ref={resumo} tabIndex={-1}>
          <Aviso
            tipo="erro"
            titulo={criando ? 'Não foi possível criar a conta' : 'Não foi possível entrar'}
            papel="alert"
            nivel={2}
          >
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
          {criando && (
            <Campo
              rotulo="Nome"
              autoComplete="name"
              obrigatorio
              value={nome}
              erro={erros.nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
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
            autoComplete={criando ? 'new-password' : 'current-password'}
            obrigatorio
            value={senha}
            erro={erros.senha}
            dica={
              criando
                ? 'Pelo menos 8 caracteres. Você pode colar a senha, se usa um gerenciador de senhas.'
                : 'Você pode colar a senha, se usa um gerenciador de senhas.'
            }
            onChange={(e) => setSenha(e.target.value)}
          />

          <Botao type="submit" largo disabled={enviando}>
            {enviando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
          </Botao>
        </form>

        {modoServidor && (
          <p style={{ marginTop: 'var(--e4)', marginBottom: 0 }}>
            {criando ? 'Já tem conta? ' : 'Ainda não tem conta? '}
            <Botao variante="discreto" onClick={alternarModo}>
              {criando ? 'Entrar' : 'Criar uma conta'}
            </Botao>
          </p>
        )}
      </section>

      {/* nivel={2}: nesta tela o aviso é o primeiro título depois do h1, e h3
          aqui abriria um salto de nível (SC 1.3.1). */}
      {modoServidor ? (
        <Aviso tipo="info" titulo="Sobre os seus dados" nivel={2}>
          <p>
            O Entende+ guarda o seu nome, o seu e-mail e a sua senha cifrada, e o texto dos
            materiais que você enviar. Os materiais só podem ser vistos por você.
          </p>
        </Aviso>
      ) : (
        <Aviso tipo="info" titulo="Protótipo de demonstração" nivel={2}>
          <p>
            Esta é uma demonstração de interface para o Trabalho de Conclusão de Curso. Os campos
            já vêm preenchidos e qualquer senha é aceita. Nenhum dado é enviado para servidor
            algum.
          </p>
        </Aviso>
      )}
    </div>
  );
}
