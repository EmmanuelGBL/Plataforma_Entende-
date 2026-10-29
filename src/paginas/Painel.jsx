import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CircleCheck,
  CircleSlash,
  Clock,
  CloudUpload,
  EllipsisVertical,
  FileText,
  Gamepad2,
  LoaderCircle,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { Aviso, Botao, Etiqueta } from '../componentes/basicos.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { IconeDisciplina } from '../componentes/IconeDisciplina.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Tela Meus materiais: lista os materiais do professor (RF19), com busca e
   filtros, e exclui um material com tudo o que depende dele (RF20). */

/* Uma situação só por material, juntando a do material e a da atividade:
   o que importa na lista é em que ponto ele está e qual é o próximo passo. */
const SITUACOES = {
  processando: { tom: 'atencao', icone: LoaderCircle, rotulo: 'Em processamento' },
  enviado: { tom: 'neutra', icone: Upload, rotulo: 'Ainda não adaptado' },
  revisar: { tom: 'info', icone: Clock, rotulo: 'Aguardando sua revisão' },
  aprovado: { tom: 'boa', icone: CircleCheck, rotulo: 'Aprovado' },
  publicado: { tom: 'boa', icone: Send, rotulo: 'Atividade publicada' },
  revogado: { tom: 'atencao', icone: CircleSlash, rotulo: 'Link revogado' },
};

function situacaoDo(material) {
  if (material.estado === 'processando') return 'processando';
  if (material.estado === 'enviado') return 'enviado';
  if (material.estado !== 'aprovado') return 'revisar';
  if (material.atividade?.estado === 'publicada') return 'publicado';
  if (material.atividade?.estado === 'revogada') return 'revogado';
  return 'aprovado';
}

/** "Ciências — Fotossíntese.pdf" → { titulo: "Ciências — Fotossíntese", formato: "PDF" } */
function partesDoNome(nome) {
  const ponto = nome.lastIndexOf('.');
  if (ponto <= 0) return { titulo: nome, formato: 'Arquivo' };
  return { titulo: nome.slice(0, ponto), formato: nome.slice(ponto + 1).toUpperCase() };
}

/** Menu ⋮ de um material: botão que abre e fecha uma lista de ações. */
function MenuAcoes({ material, aoExcluir }) {
  const [aberto, setAberto] = useState(false);
  const area = useRef(null);
  const gatilho = useRef(null);
  const id = `acoes-${material.id}`;

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

  return (
    <div className="menu-acoes" ref={area}>
      <button
        type="button"
        ref={gatilho}
        className="menu-acoes__gatilho"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((v) => !v)}
      >
        <EllipsisVertical aria-hidden="true" />
        <span className="apenas-leitor">Mais ações para {material.nome}</span>
      </button>
      {aberto && (
        <ul className="menu-acoes__lista" id={id}>
          <li>
            <Link to={`/materiais/${material.id}/atividade`}>
              <Gamepad2 aria-hidden="true" />
              Ver atividade
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="menu-acoes__perigo"
              onClick={() => {
                setAberto(false);
                aoExcluir(material);
              }}
            >
              <Trash2 aria-hidden="true" />
              Excluir material
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function Painel() {
  usarTituloDaPagina('Meus materiais');
  const { professor, materiais, excluir } = usarApp();
  const { anunciar, avisar } = usarAnuncios();
  const [aExcluir, setAExcluir] = useState(null);
  const [falha, setFalha] = useState(null);
  const [busca, setBusca] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [situacao, setSituacao] = useState('');

  async function confirmarExclusao() {
    const alvo = aExcluir;
    setAExcluir(null);
    setFalha(null);
    try {
      await excluir(alvo.id);
      avisar('erro', 'Material excluído', `${alvo.nome} e a atividade dele foram apagados.`);
    } catch (erro) {
      setFalha(erro);
      avisar('erro', erro.titulo, erro.saida);
    }
  }

  // Só o modo demonstração tem disciplina; no servidor o filtro não aparece.
  const disciplinas = useMemo(
    () => [...new Set(materiais.map((m) => m.disciplina).filter(Boolean))].sort(),
    [materiais],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return materiais.filter(
      (m) =>
        (!termo || `${m.nome} ${m.disciplina ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
        (!disciplina || m.disciplina === disciplina) &&
        (!situacao || situacaoDo(m) === situacao),
    );
  }, [materiais, busca, disciplina, situacao]);

  const filtrando = Boolean(busca.trim() || disciplina || situacao);

  // Anuncia o resultado da busca para quem usa leitor de tela.
  useEffect(() => {
    if (!filtrando) return;
    const total = filtrados.length;
    anunciar(total === 1 ? '1 material encontrado.' : `${total} materiais encontrados.`);
  }, [filtrados.length, filtrando, anunciar]);

  return (
    <>
      <div className="cabecalho-pagina cabecalho-acoes">
        <div>
          <h1>Meus materiais</h1>
          <p>Aqui estão os materiais que você enviou e adaptou no Entende+.</p>
        </div>
        <Botao como="link" para="?enviar=1">
          <CloudUpload aria-hidden="true" />
          Enviar material
        </Botao>
      </div>

      {falha && (
        <Aviso tipo="erro" titulo={falha.titulo} papel="alert">
          <p>{falha.motivo}</p>
          {falha.saida && (
            <p>
              <strong>O que fazer:</strong> {falha.saida}
            </p>
          )}
        </Aviso>
      )}

      {materiais.length === 0 ? (
        <div className="cartao vazio">
          <h2>Você ainda não enviou nenhum material</h2>
          <p>
            Envie um PDF ou um arquivo do Word que você já usa em aula. O Entende+ devolve a versão
            adaptada e uma atividade sobre o mesmo conteúdo.
          </p>
          <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e4)' }}>
            <Botao como="link" para="?enviar=1">
              Enviar meu primeiro material
            </Botao>
          </div>
        </div>
      ) : (
        <>
          <search className="filtros" aria-label="Filtrar materiais">
            <div className="filtros__campo filtros__campo--busca">
              <label htmlFor="busca-material">Buscar</label>
              <div className="entrada-composta">
                <Search aria-hidden="true" className="entrada-composta__icone" />
                <input
                  id="busca-material"
                  className="entrada"
                  type="search"
                  placeholder="Título ou disciplina"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            {disciplinas.length > 1 && (
              <div className="filtros__campo">
                <label htmlFor="filtro-disciplina">Disciplina</label>
                <select
                  id="filtro-disciplina"
                  className="selecao"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                >
                  <option value="">Todas as disciplinas</option>
                  {disciplinas.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="filtros__campo">
              <label htmlFor="filtro-situacao">Situação</label>
              <select
                id="filtro-situacao"
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

          {filtrados.length === 0 ? (
            <div className="cartao vazio">
              <h2>Nenhum material encontrado</h2>
              <p>Nenhum material combina com a busca e os filtros escolhidos.</p>
              <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e4)' }}>
                <Botao
                  variante="secundario"
                  onClick={() => {
                    setBusca('');
                    setDisciplina('');
                    setSituacao('');
                  }}
                >
                  Limpar filtros
                </Botao>
              </div>
            </div>
          ) : (
            <ul className="lista-materiais">
              {filtrados.map((material) => {
                const situacao = SITUACOES[situacaoDo(material)];
                const { titulo, formato } = partesDoNome(material.nome);
                const meta = [
                  material.disciplina,
                  [formato, material.paginas && `${material.paginas} páginas`]
                    .filter(Boolean)
                    .join(', '),
                  `Perfil ${material.perfil}`,
                  `Enviado em ${material.enviadoEm}`,
                ].filter(Boolean);
                return (
                  <li key={material.id}>
                    <article className="item-material">
                      <IconeDisciplina material={material} />

                      <div className="item-material__dados">
                        <h2>
                          <Link to={`/materiais/${material.id}/adaptacao`}>{titulo}</Link>
                        </h2>
                        <p className="item-material__meta">
                          {meta.map((parte, i) => (
                            <span key={parte}>
                              {i > 0 && <span aria-hidden="true"> · </span>}
                              {parte}
                            </span>
                          ))}
                        </p>
                      </div>

                      <div className="item-material__situacao">
                        <Etiqueta tom={situacao.tom} icone={situacao.icone}>
                          {situacao.rotulo}
                        </Etiqueta>
                      </div>

                      <div className="item-material__acoes">
                        <Botao
                          como="link"
                          para={`/materiais/${material.id}/adaptacao`}
                          variante="secundario"
                        >
                          <FileText aria-hidden="true" />
                          {material.estado === 'aprovado' ? 'Ver material' : 'Revisar'}
                          <span className="apenas-leitor">: {titulo}</span>
                        </Botao>
                        <MenuAcoes material={material} aoExcluir={setAExcluir} />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Dialogo
        aberto={Boolean(aExcluir)}
        titulo="Excluir este material?"
        rotuloConfirmar="Sim, excluir tudo"
        perigo
        aoCancelar={() => setAExcluir(null)}
        aoConfirmar={confirmarExclusao}
      >
        <p>
          Vai ser apagado o material <strong>{aExcluir?.nome}</strong>, a versão adaptada e a
          atividade gerada a partir dele.
        </p>
        <p>
          <strong>Esta ação não pode ser desfeita.</strong> Se a atividade estiver publicada, o
          link deixa de funcionar para os estudantes.
        </p>
      </Dialogo>
    </>
  );
}
