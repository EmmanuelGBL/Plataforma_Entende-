import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleCheck,
  CircleSlash,
  CircleUserRound,
  Copy,
  Gauge,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react';
import { Aviso, Botao, Campo, Etiqueta } from '../componentes/basicos.jsx';
import { Dialogo, Janela } from '../componentes/Dialogo.jsx';
import { MenuAcoes } from '../componentes/MenuAcoes.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { emCreditos, fraseDoSaldo, saldoDe, TOKENS_POR_CREDITO } from '../servicos/creditos.js';

/* Tela Contas, só para o administrador e só no modo servidor: cria, edita,
   desativa e exclui contas de professor (RF24) e define a cota (RN13). A cota
   aparece em créditos; para o servidor, vai em tokens.

   A senha aparece uma única vez, numa janela que só fecha pelo botão. Conta de
   administrador só muda nome e cota por aqui; o resto é no servidor. */

const COTA_PADRAO = '40';

// Segura o engano de digitar a cota em tokens: 40000 créditos seriam 40 milhões.
const COTA_MAXIMA = 1000;

const SITUACOES = {
  administrador: { tom: 'info', icone: ShieldCheck, rotulo: 'Administrador' },
  desativada: { tom: 'neutra', icone: CircleSlash, rotulo: 'Desativada' },
  esgotada: { tom: 'atencao', icone: Gauge, rotulo: 'Sem créditos' },
  ativa: { tom: 'boa', icone: CircleCheck, rotulo: 'Ativa' },
};

function situacaoDa(conta) {
  if (conta.administrador) return 'administrador';
  if (!conta.ativo) return 'desativada';
  if (saldoDe(conta).esgotada) return 'esgotada';
  return 'ativa';
}

const numero = (n) => n.toLocaleString('pt-BR');
const materiais = (n) => (n === 1 ? '1 material' : `${numero(n)} materiais`);

function enderecoDoSistema() {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Erro devolvido pelo servidor. Recebe o foco ao aparecer. */
function Falha({ erro, nivel }) {
  const caixa = useRef(null);
  useEffect(() => {
    if (erro) caixa.current?.focus();
  }, [erro]);
  if (!erro) return null;
  return (
    <div ref={caixa} tabIndex={-1}>
      <Aviso tipo="erro" titulo={erro.titulo} papel="alert" nivel={nivel}>
        {erro.motivo && <p>{erro.motivo}</p>}
        {erro.saida && (
          <p>
            <strong>O que fazer:</strong> {erro.saida}
          </p>
        )}
      </Aviso>
    </div>
  );
}

const SENHA_MINIMA = 8;

function erroDaSenha(senha) {
  const tamanho = senha.trim().length;
  return tamanho > 0 && tamanho < SENHA_MINIMA
    ? `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
    : undefined;
}

/** Senha escolhida pelo administrador (provisório, para o teste de uso). Fica
 *  visível: ele precisa conferir o que vai mandar ao professor. */
function CampoSenha({ valor, erro, aoMudar }) {
  return (
    <Campo
      rotulo="Senha"
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={128}
      value={valor}
      erro={erro}
      dica={`Pelo menos ${SENHA_MINIMA} caracteres. Em branco, o sistema cria uma senha aleatória.`}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

/** Mudar a senha de uma conta que já existe. */
function JanelaMudarSenha({ conta, aoSalvar, aoFechar }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState({});
  const [falha, setFalha] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const formulario = useRef(null);

  useEffect(() => {
    if (erro.senha) formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [erro]);

  async function enviar(evento) {
    evento.preventDefault();
    const problema = erroDaSenha(senha);
    setErro({ senha: problema });
    setFalha(null);
    if (problema) return;
    setSalvando(true);
    try {
      await aoSalvar(conta, senha.trim());
    } catch (recusa) {
      setFalha(recusa);
      setSalvando(false);
    }
  }

  return (
    <Janela aberto titulo={`Mudar a senha de ${conta.nome}`} aoFechar={aoFechar}>
      <Falha erro={falha} />
      <p>A senha atual deixa de valer, e a sessão aberta é encerrada.</p>
      <form ref={formulario} onSubmit={enviar} noValidate>
        <CampoSenha valor={senha} erro={erro.senha} aoMudar={setSenha} />
        <div className="linha linha-fim">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            {salvando ? 'Aguarde…' : 'Mudar senha'}
          </Botao>
        </div>
      </form>
    </Janela>
  );
}

/** Criação (sem `conta`) e edição. */
function JanelaConta({ conta, aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(conta?.nome ?? '');
  const [email, setEmail] = useState(conta?.email ?? '');
  const cotaInicial = conta ? String(conta.cota_tokens / TOKENS_POR_CREDITO) : COTA_PADRAO;
  const [cota, setCota] = useState(cotaInicial);
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const formulario = useRef(null);

  // Depois de renderizar, o foco vai ao primeiro campo com erro.
  useEffect(() => {
    if (Object.keys(erros).length) formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [erros]);

  async function enviar(evento) {
    evento.preventDefault();
    const creditos = Number(cota);
    // Cota definida no servidor pode não ser redonda: sem mexer no campo, ela fica.
    const mantida = conta?.cota_tokens > 0 && cota === cotaInicial;
    const novos = {};
    if (nome.trim().length < 2) novos.nome = 'Digite o nome, com pelo menos 2 letras.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      novos.email = 'Digite um e-mail completo. Exemplo: nome@escola.br';
    }
    if (!mantida && (!Number.isInteger(creditos) || creditos < 1 || creditos > COTA_MAXIMA)) {
      novos.cota = `Digite um número inteiro de 1 a ${numero(COTA_MAXIMA)}. Exemplo: 40`;
    }
    if (erroDaSenha(senha)) novos.senha = erroDaSenha(senha);
    setErros(novos);
    setFalha(null);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      const dados = {
        nome: nome.trim(),
        email: email.trim(),
        cota: mantida ? conta.cota_tokens : creditos * TOKENS_POR_CREDITO,
      };
      await aoSalvar(conta ? dados : { ...dados, nova_senha: senha.trim() || null });
    } catch (problema) {
      setFalha(problema);
      setSalvando(false);
    }
  }

  return (
    <Janela aberto titulo={conta ? 'Editar conta' : 'Nova conta de professor'} aoFechar={aoFechar}>
      <Falha erro={falha} />
      <form ref={formulario} onSubmit={enviar} noValidate>
        <Campo
          rotulo="Nome"
          obrigatorio
          autoComplete="off"
          value={nome}
          erro={erros.nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Campo
          rotulo="E-mail"
          tipo="email"
          obrigatorio
          autoComplete="off"
          value={email}
          erro={erros.email}
          readOnly={conta?.administrador}
          dica={conta?.administrador ? 'O e-mail de um administrador só muda no servidor.' : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          rotulo="Créditos"
          tipo="number"
          obrigatorio
          min="1"
          max={COTA_MAXIMA}
          step="1"
          value={cota}
          erro={erros.cota}
          dica="Uma página de texto gasta cerca de 9. O total inclui o que já foi usado."
          onChange={(e) => setCota(e.target.value)}
        />
        {!conta && <CampoSenha valor={senha} erro={erros.senha} aoMudar={setSenha} />}
        <div className="linha linha-fim">
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            {salvando ? 'Aguarde…' : conta ? 'Salvar' : 'Criar conta'}
          </Botao>
        </div>
      </form>
    </Janela>
  );
}

/** A senha só existe aqui. Clicar fora ou Esc não fecham, para ela não se
 *  perder sem querer. */
function JanelaSenha({ acesso, aoFechar }) {
  const { avisar } = usarAnuncios();
  const texto = `Entende+: ${enderecoDoSistema()}\nE-mail: ${acesso.conta.email}\nSenha: ${acesso.senha}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      avisar('boa', 'Acesso copiado', 'Cole numa mensagem particular para o professor.');
    } catch {
      avisar('erro', 'Não foi possível copiar', 'Selecione o e-mail e a senha e copie à mão.');
    }
  }

  return (
    <Janela
      aberto
      titulo={acesso.nova ? `Conta de ${acesso.conta.nome} criada` : `Nova senha de ${acesso.conta.nome}`}
      aoFechar={() => {}}
    >
      <Aviso tipo="atencao" titulo="Copie agora: a senha não aparece de novo">
        <p>Envie só para o professor, em particular.</p>
      </Aviso>
      <dl className="acesso-conta">
        <dt>Endereço</dt>
        <dd>{enderecoDoSistema()}</dd>
        <dt>E-mail</dt>
        <dd>{acesso.conta.email}</dd>
        <dt>Senha</dt>
        <dd className="acesso-conta__senha">{acesso.senha}</dd>
      </dl>
      <div className="linha linha-fim">
        {/* "Copiar" vem primeiro porque recebe o foco: um Enter a mais, depois de
            criar a conta, não pode fechar a janela e perder a senha. */}
        <Botao onClick={copiar}>
          <Copy aria-hidden="true" />
          Copiar acesso
        </Botao>
        <Botao variante="secundario" onClick={aoFechar}>
          Já guardei, fechar
        </Botao>
      </div>
    </Janela>
  );
}

function ItemConta({ conta, aoAgir }) {
  const chave = situacaoDa(conta);
  const { tom, icone, rotulo } = SITUACOES[chave];
  return (
    <li>
      <article className="item-material">
        <span className="icone-disciplina icone-disciplina--azul" aria-hidden="true">
          <CircleUserRound />
        </span>
        <div className="item-material__dados">
          <h2>{conta.nome}</h2>
          <p className="item-material__meta item-conta__meta">
            {conta.email}
            <span aria-hidden="true"> · </span>
            <span>{fraseDoSaldo(saldoDe(conta))}</span>
            <span aria-hidden="true"> · </span>
            <span>{materiais(conta.quantidade_materiais)}</span>
          </p>
        </div>
        <div className="item-material__situacao">
          <Etiqueta tom={tom} icone={icone}>
            {rotulo}
          </Etiqueta>
        </div>
        <div className="item-material__acoes">
          <Botao variante="secundario" onClick={() => aoAgir('editar', conta)}>
            <Pencil aria-hidden="true" />
            Editar
            <span className="apenas-leitor">: {conta.nome}</span>
          </Botao>
          {conta.administrador ? (
            // Mantém o botão Editar alinhado com o das outras linhas.
            <span className="item-conta__sem-menu" aria-hidden="true" />
          ) : (
            <MenuAcoes rotulo={`Mais ações para ${conta.nome}`}>
              <li>
                <button type="button" onClick={() => aoAgir('senha', conta)}>
                  <KeyRound aria-hidden="true" />
                  Mudar senha
                </button>
              </li>
              <li>
                {conta.ativo ? (
                  <button type="button" onClick={() => aoAgir('desativar', conta)}>
                    <UserRoundX aria-hidden="true" />
                    Desativar conta
                  </button>
                ) : (
                  <button type="button" onClick={() => aoAgir('reativar', conta)}>
                    <UserRoundCheck aria-hidden="true" />
                    Reativar conta
                  </button>
                )}
              </li>
              <li>
                <button type="button" className="menu-acoes__perigo" onClick={() => aoAgir('excluir', conta)}>
                  <Trash2 aria-hidden="true" />
                  Excluir conta
                </button>
              </li>
            </MenuAcoes>
          )}
        </div>
      </article>
    </li>
  );
}

/** Confirmações: o que cada ação faz e o texto do diálogo. */
const CONFIRMACOES = {
  desativar: {
    titulo: 'Desativar esta conta?',
    confirmar: 'Sim, desativar',
    texto: (conta) => (
      <p>
        <strong>{conta.nome}</strong> deixa de entrar agora mesmo. Os materiais ficam guardados, os
        links já publicados continuam abrindo, e dá para reativar depois.
      </p>
    ),
  },
  excluir: {
    titulo: 'Excluir esta conta?',
    confirmar: 'Sim, excluir tudo',
    perigo: true,
    texto: (conta) => (
      <>
        <p>
          Vão ser apagados a conta de <strong>{conta.nome}</strong> ({conta.email}) e{' '}
          <strong>{materiais(conta.quantidade_materiais)}</strong>, com as adaptações e as atividades.
          Os links publicados deixam de funcionar.
        </p>
        <p>
          <strong>Esta ação não pode ser desfeita.</strong>
        </p>
      </>
    ),
  },
};

export function Contas() {
  usarTituloDaPagina('Contas');
  const { administracao, atualizarProfessor } = usarApp();
  const { anunciar, avisar } = usarAnuncios();
  const [contas, setContas] = useState(null);
  const [falha, setFalha] = useState(null);
  const [formulario, setFormulario] = useState(null); // null | {} (nova) | { conta }
  const [mudando, setMudando] = useState(null); // conta que vai mudar de senha
  const [acesso, setAcesso] = useState(null);
  const [pedido, setPedido] = useState(null); // { acao, conta }
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');

  function carregar() {
    setFalha(null);
    return administracao
      .listar()
      .then(setContas)
      .catch(setFalha);
  }

  useEffect(() => {
    carregar();
    // Carrega uma vez, ao abrir a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocar(conta) {
    setContas((atuais) => atuais.map((c) => (c.id === conta.id ? conta : c)));
  }

  async function salvar(dados) {
    if (formulario.conta) {
      const conta = await administracao.editar(formulario.conta.id, dados);
      trocar(conta);
      setFormulario(null);
      avisar('boa', 'Conta salva', conta.nome);
      // Quem edita a própria conta vê o nome e os créditos novos.
      atualizarProfessor();
      return;
    }
    const criada = await administracao.criar(dados);
    setContas((atuais) =>
      [...atuais, criada.conta].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    );
    setFormulario(null);
    setAcesso({ ...criada, nova: true });
  }

  async function mudarSenha(conta, senha) {
    const novo = await administracao.redefinirSenha(conta.id, senha);
    setMudando(null);
    setAcesso(novo);
  }

  const executar = {
    desativar: async (conta) => {
      trocar(await administracao.desativar(conta.id));
      avisar('erro', 'Conta desativada', `${conta.nome} não entra mais.`);
    },
    reativar: async (conta) => {
      trocar(await administracao.reativar(conta.id));
      avisar('boa', 'Conta reativada', `${conta.nome} entra com a mesma senha.`);
    },
    excluir: async (conta) => {
      await administracao.excluir(conta.id);
      setContas((atuais) => atuais.filter((c) => c.id !== conta.id));
      avisar('erro', 'Conta excluída', `${conta.nome} e os materiais foram apagados.`);
    },
  };

  async function realizar(acao, conta) {
    setFalha(null);
    setOcupado(true);
    try {
      await executar[acao](conta);
    } catch (problema) {
      setFalha(problema);
    } finally {
      setOcupado(false);
      setPedido(null);
    }
  }

  function aoAgir(acao, conta) {
    if (acao === 'editar') setFormulario({ conta });
    else if (acao === 'senha') setMudando(conta);
    else if (CONFIRMACOES[acao]) setPedido({ acao, conta });
    else realizar(acao, conta);
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return (contas ?? []).filter(
      (c) =>
        (!termo || `${c.nome} ${c.email}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
        (!situacao || situacaoDa(c) === situacao),
    );
  }, [contas, busca, situacao]);

  const filtrando = Boolean(busca.trim() || situacao);
  useEffect(() => {
    if (!filtrando) return;
    const total = filtradas.length;
    anunciar(total === 1 ? '1 conta encontrada.' : `${total} contas encontradas.`);
  }, [filtradas.length, filtrando, anunciar]);

  const totais = useMemo(
    () => ({
      cota: (contas ?? []).reduce((soma, c) => soma + c.cota_tokens, 0),
      consumo: (contas ?? []).reduce((soma, c) => soma + c.tokens_consumidos, 0),
    }),
    [contas],
  );

  const confirmacao = pedido && CONFIRMACOES[pedido.acao];

  return (
    <>
      <div className="cabecalho-pagina cabecalho-acoes">
        <div>
          <h1>Contas</h1>
          <p>Crie o acesso dos professores e acompanhe os créditos de cada um.</p>
        </div>
        <Botao onClick={() => setFormulario({})} disabled={!contas}>
          <UserPlus aria-hidden="true" />
          Nova conta
        </Botao>
      </div>

      <Falha erro={falha} nivel={2} />

      {!contas &&
        (falha ? (
          <Botao variante="secundario" onClick={carregar}>
            Tentar de novo
          </Botao>
        ) : (
          <p role="status" className="campo__dica">
            Carregando as contas…
          </p>
        ))}

      {contas && (
        <>
          <dl className="blocos contas-totais">
            <div className="bloco">
              <dt>Contas</dt>
              <dd>{numero(contas.length)}</dd>
            </div>
            <div className="bloco">
              <dt>Créditos distribuídos</dt>
              <dd>{emCreditos(totais.cota)}</dd>
            </div>
            <div className="bloco">
              <dt>Créditos usados</dt>
              <dd>{emCreditos(totais.consumo)}</dd>
            </div>
          </dl>

          <search className="filtros" aria-label="Filtrar contas">
            <div className="filtros__campo filtros__campo--busca">
              <label htmlFor="busca-conta">Buscar</label>
              <div className="entrada-composta">
                <Search aria-hidden="true" className="entrada-composta__icone" />
                <input
                  id="busca-conta"
                  className="entrada"
                  type="search"
                  placeholder="Nome ou e-mail"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            <div className="filtros__campo">
              <label htmlFor="situacao-conta">Situação</label>
              <select
                id="situacao-conta"
                className="selecao"
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
              >
                <option value="">Todas as situações</option>
                {Object.entries(SITUACOES).map(([valor, { rotulo }]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
          </search>

          {filtradas.length === 0 ? (
            <div className="cartao vazio">
              <h2>Nenhuma conta encontrada</h2>
              <p>Nenhuma conta combina com a busca e o filtro escolhidos.</p>
              <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e4)' }}>
                <Botao
                  variante="secundario"
                  onClick={() => {
                    setBusca('');
                    setSituacao('');
                  }}
                >
                  Limpar filtros
                </Botao>
              </div>
            </div>
          ) : (
            <ul className="lista-materiais">
              {filtradas.map((conta) => (
                <ItemConta key={conta.id} conta={conta} aoAgir={aoAgir} />
              ))}
            </ul>
          )}
        </>
      )}

      {formulario && (
        <JanelaConta conta={formulario.conta} aoSalvar={salvar} aoFechar={() => setFormulario(null)} />
      )}
      {mudando && (
        <JanelaMudarSenha conta={mudando} aoSalvar={mudarSenha} aoFechar={() => setMudando(null)} />
      )}
      {acesso && <JanelaSenha acesso={acesso} aoFechar={() => setAcesso(null)} />}
      <Dialogo
        aberto={Boolean(confirmacao)}
        titulo={confirmacao?.titulo}
        rotuloConfirmar={ocupado ? 'Aguarde…' : confirmacao?.confirmar}
        confirmarDesabilitado={ocupado}
        perigo={confirmacao?.perigo}
        aoCancelar={() => setPedido(null)}
        aoConfirmar={() => realizar(pedido.acao, pedido.conta)}
      >
        {confirmacao?.texto(pedido.conta)}
      </Dialogo>
    </>
  );
}
