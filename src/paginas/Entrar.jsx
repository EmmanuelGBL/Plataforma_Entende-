import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChartNoAxesColumnIncreasing,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  Info,
  Lock,
  Mail,
  Radio,
} from 'lucide-react';
import { Aviso, Botao, Campo } from '../componentes/basicos.jsx';
import { LogoEntende, usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { escolherModo, servidorDisponivel } from '../servicos/servidor.js';

/* Tela de entrada (RF01): apresentação à esquerda e formulário à direita; em
   tela estreita, o formulário vem primeiro. Não cria conta: quem cria é a
   administração, no servidor (RF24, RN12).

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
      <div className="entrada-apresentacao__figura">
        <img className="entrada-apresentacao__ilustracao" src="./ilustracoes/entrada.webp" alt="" />
      </div>
    </section>
  );
}

export function Entrar() {
  const { entrar, modoServidor } = usarApp();
  usarTituloDaPagina('Entrar');
  const navegar = useNavigate();
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
    if (!email.trim()) novos.email = 'Digite o e-mail da sua conta.';
    else if (!email.includes('@')) novos.email = 'O e-mail precisa ter @. Exemplo: nome@escola.br';
    if (!senha) novos.senha = 'Digite sua senha para entrar.';

    setErros(novos);
    if (Object.keys(novos).length > 0) {
      focarResumo();
      return;
    }

    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      navegar('/painel');
    } catch (erro) {
      // Mostra o motivo devolvido pelo servidor, que diz qual campo foi recusado.
      setErros({ servidor: [erro.motivo || erro.titulo, erro.saida].filter(Boolean).join(' ') });
      focarResumo();
    } finally {
      setEnviando(false);
    }
  }

  const listaErros = Object.entries(erros);

  return (
    <div className="entrada-tela">
      <div className="entrada-formulario">
        <section className="cartao entrada-cartao" aria-labelledby="titulo-entrada">
          <LogoEntende className="entrada-cartao__logo" />
          <h1 id="titulo-entrada">Acesse sua conta de professor</h1>

          {listaErros.length > 0 && (
            <div ref={resumo} tabIndex={-1}>
              <Aviso
                tipo="erro"
                titulo="Não foi possível entrar"
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
              autoComplete="current-password"
              obrigatorio
              placeholder="Sua senha"
              value={senha}
              erro={erros.senha}
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
              {enviando ? 'Aguarde…' : 'Entrar'}
            </Botao>
          </form>

          {servidorDisponivel && (
            <div className={'entrada-modo' + (modoServidor ? ' entrada-modo--ao-vivo' : '')}>
              <p>
                <Radio aria-hidden="true" />
                {modoServidor ? (
                  <span>
                    <strong>Ao vivo.</strong> Envio, adaptação e questões passam pelo servidor e
                    pelo modelo de linguagem.
                  </span>
                ) : (
                  <span>
                    <strong>Demonstração.</strong> Materiais e adaptações prontos, sem servidor.
                  </span>
                )}
              </p>
              <Botao variante="discreto" onClick={() => escolherModo(!modoServidor)}>
                {modoServidor ? 'Abrir a demonstração' : 'Usar o servidor ao vivo'}
              </Botao>
            </div>
          )}

          {modoServidor && (
            <p className="entrada-cartao__nota">
              <Info aria-hidden="true" />
              A conta é criada pela equipe do Entende+. Guardamos seu nome, seu e-mail, a senha
              cifrada, os materiais que você enviar e quanto da sua cota foi usado. Só você vê seus
              materiais.
            </p>
          )}
        </section>

        <p className="entrada-formulario__rodape">
          <Link to="/acessibilidade">Declaração de acessibilidade</Link>
          <span aria-hidden="true"> · </span>
          Protótipo acadêmico — TCC em Sistemas de Informação, CEUNI FAMETRO
        </p>
      </div>

      <Apresentacao />
    </div>
  );
}
