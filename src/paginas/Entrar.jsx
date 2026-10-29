import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartNoAxesColumnIncreasing, Eye, EyeOff, FileText, Gamepad2, Lock, Mail, UserPlus, UserRound } from 'lucide-react';
import { Aviso, Botao, Campo } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';

/* Tela de entrada e criação de conta (RF01): apresentação à esquerda e
   formulário à direita; em tela estreita, o formulário vem primeiro.

   O campo de senha aceita colar (gerenciador de senhas) e tem o botão
   "Mostrar senha". Os erros aparecem em um resumo no topo do cartão, que
   recebe o foco. */

const DESTAQUES = [
  { Icone: FileText, tom: 'azul', texto: 'Adapta textos e atividades com regras para TEA' },
  { Icone: Gamepad2, tom: 'verde', texto: 'Gera atividades gamificadas para os estudantes' },
  { Icone: ChartNoAxesColumnIncreasing, tom: 'amarelo', texto: 'Mais tempo para o que realmente importa: seus alunos' },
];

function Apresentacao() {
  return (
    <section className="entrada-apresentacao" aria-labelledby="titulo-apresentacao">
      <h2 id="titulo-apresentacao">Mais tempo para ensinar.</h2>
      <p>
        O Entende+ ajuda o professor do 5º ano a adaptar materiais didáticos para estudantes com
        TEA, aplicando um conjunto de regras de forma simples e segura.
      </p>
      <ul className="entrada-destaques">
        {DESTAQUES.map(({ Icone, tom, texto }) => (
          <li key={texto}>
            <span className={`entrada-destaques__icone entrada-destaques__icone--${tom}`}>
              <Icone aria-hidden="true" />
            </span>
            {texto}
          </li>
        ))}
      </ul>
      <img className="entrada-apresentacao__ilustracao" src="./ilustracoes/entrada.webp" alt="" />
    </section>
  );
}

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
  const [senhaVisivel, setSenhaVisivel] = useState(false);
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
      // Mostra o motivo devolvido pelo servidor, que diz qual campo foi recusado.
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
    <div className="entrada-tela">
      <div className="entrada-formulario">
        <section className="cartao entrada-cartao" aria-labelledby="titulo-entrada">
          <div className="entrada-cartao__marca" aria-hidden="true">
            <img src="./marca/entende-mais-icone.svg" alt="" />
            <span>
              Entende<span className="mais">+</span>
            </span>
          </div>
          <h1 id="titulo-entrada">{criando ? 'Crie sua conta de professor' : 'Acesse sua conta de professor'}</h1>

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

          <form onSubmit={enviar} noValidate>
            {criando && (
              <Campo
                rotulo="Nome"
                icone={UserRound}
                autoComplete="name"
                obrigatorio
                placeholder="Seu nome completo"
                value={nome}
                erro={erros.nome}
                onChange={(e) => setNome(e.target.value)}
              />
            )}
            <Campo
              rotulo="E-mail"
              tipo="email"
              icone={Mail}
              autoComplete="username"
              obrigatorio
              placeholder="Seu e-mail institucional ou pessoal"
              value={email}
              erro={erros.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Campo
              rotulo="Senha"
              tipo={senhaVisivel ? 'text' : 'password'}
              icone={Lock}
              autoComplete={criando ? 'new-password' : 'current-password'}
              obrigatorio
              placeholder="Sua senha"
              value={senha}
              erro={erros.senha}
              dica={criando ? 'Pelo menos 8 caracteres.' : undefined}
              onChange={(e) => setSenha(e.target.value)}
              final={
                <button
                  type="button"
                  className="entrada-composta__final"
                  aria-pressed={senhaVisivel}
                  aria-label="Mostrar senha"
                  onClick={() => setSenhaVisivel((v) => !v)}
                >
                  {senhaVisivel ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              }
            />

            <Botao type="submit" largo disabled={enviando}>
              {enviando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
            </Botao>
          </form>

          {modoServidor && (
            <>
              <p className="entrada-cartao__ou">
                <span>ou</span>
              </p>
              <Botao variante="secundario" largo onClick={alternarModo}>
                {!criando && <UserPlus aria-hidden="true" />}
                {criando ? 'Já tenho conta: entrar' : 'Criar uma nova conta'}
              </Botao>
            </>
          )}
        </section>

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
              Os campos já vêm preenchidos e qualquer senha é aceita. Nenhum dado é enviado para
              servidor algum.
            </p>
          </Aviso>
        )}
      </div>

      <Apresentacao />
    </div>
  );
}
