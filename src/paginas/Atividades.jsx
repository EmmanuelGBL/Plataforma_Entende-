import { Link } from 'react-router-dom';
import { CircleCheck, CircleSlash, Copy, ExternalLink, FilePen, Hourglass } from 'lucide-react';
import { Botao, Etiqueta } from '../componentes/basicos.jsx';
import { IconeDisciplina } from '../componentes/IconeDisciplina.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* Tela Atividades: as atividades de todos os materiais num lugar só, com a
   situação do link (RF15, RF18). Publicar, revogar e editar as questões
   continuam na tela da atividade de cada material. */

const GRUPOS = [
  {
    chave: 'publicada',
    titulo: 'Publicadas',
    vazio: 'Nenhuma atividade publicada.',
    etiqueta: { tom: 'boa', icone: CircleCheck, rotulo: 'Publicada' },
  },
  {
    chave: 'rascunho',
    titulo: 'Em rascunho',
    vazio: 'Nenhuma atividade em rascunho.',
    etiqueta: { tom: 'info', icone: FilePen, rotulo: 'Em rascunho' },
  },
  {
    chave: 'aguardando',
    titulo: 'Aguardando a aprovação do material',
    vazio: null,
    etiqueta: { tom: 'neutra', icone: Hourglass, rotulo: 'Material em revisão' },
  },
  {
    chave: 'revogada',
    titulo: 'Link revogado',
    vazio: null,
    etiqueta: { tom: 'atencao', icone: CircleSlash, rotulo: 'Link revogado' },
  },
];

/** A atividade só pode ser publicada depois que o material é aprovado (RN02). */
function grupoDa(material) {
  const estado = material.atividade?.estado ?? 'rascunho';
  if (estado === 'rascunho' && material.estado !== 'aprovado') return 'aguardando';
  return estado;
}

function enderecoDa(codigo) {
  return `${window.location.origin}${window.location.pathname}#/atividade/${codigo}`;
}

function nomeSemExtensao(nome) {
  const ponto = nome.lastIndexOf('.');
  return ponto > 0 ? nome.slice(0, ponto) : nome;
}

export function Atividades() {
  usarTituloDaPagina('Atividades');
  const { materiais } = usarApp();
  const { avisar } = usarAnuncios();

  async function copiar(codigo) {
    try {
      await navigator.clipboard.writeText(enderecoDa(codigo));
      avisar('boa', 'Link copiado');
    } catch {
      avisar('erro', 'Não foi possível copiar', 'Abra a atividade e copie o link de lá.');
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Atividades</h1>
        <p>As atividades geradas a partir dos seus materiais.</p>
      </div>

      {materiais.length === 0 ? (
        <div className="cartao vazio">
          <h2>Nenhuma atividade ainda</h2>
          <p>Cada material que você envia gera uma atividade sobre o mesmo conteúdo.</p>
          <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e4)' }}>
            <Botao como="link" para="/painel?enviar=1">
              Enviar material
            </Botao>
          </div>
        </div>
      ) : (
        <div className="pilha-g">
          {GRUPOS.map((grupo) => {
            const itens = materiais.filter((m) => grupoDa(m) === grupo.chave);
            if (itens.length === 0 && !grupo.vazio) return null;
            const { tom, icone, rotulo } = grupo.etiqueta;
            return (
              <section key={grupo.chave} aria-labelledby={`grupo-${grupo.chave}`}>
                <h2 id={`grupo-${grupo.chave}`} className="grupo-titulo">
                  {grupo.titulo} <span className="grupo-titulo__total">{itens.length}</span>
                </h2>
                {itens.length === 0 ? (
                  <p className="campo__dica">{grupo.vazio}</p>
                ) : (
                  <ul className="lista-materiais lista-materiais--grupos">
                    {itens.map((material) => {
                      const titulo = nomeSemExtensao(material.nome);
                      const codigo = material.atividade?.codigo;
                      return (
                        <li key={material.id}>
                          <article className="item-material">
                            <IconeDisciplina material={material} />
                            <div className="item-material__dados">
                              <h3>
                                <Link to={`/materiais/${material.id}/atividade`}>{titulo}</Link>
                              </h3>
                              <p className="item-material__meta">
                                {grupo.chave === 'publicada' && codigo
                                  ? `Código de acesso ${codigo}`
                                  : `Material enviado em ${material.enviadoEm}`}
                              </p>
                            </div>
                            <div className="item-material__situacao">
                              <Etiqueta tom={tom} icone={icone}>
                                {rotulo}
                              </Etiqueta>
                            </div>
                            <div className="item-material__acoes">
                              {grupo.chave === 'publicada' && codigo && (
                                <Botao variante="discreto" onClick={() => copiar(codigo)}>
                                  <Copy aria-hidden="true" />
                                  Copiar link
                                  <span className="apenas-leitor">: {titulo}</span>
                                </Botao>
                              )}
                              <Botao
                                como="link"
                                para={
                                  grupo.chave === 'aguardando'
                                    ? `/materiais/${material.id}/adaptacao`
                                    : `/materiais/${material.id}/atividade`
                                }
                                variante="secundario"
                              >
                                <ExternalLink aria-hidden="true" />
                                {grupo.chave === 'aguardando' ? 'Revisar material' : 'Abrir'}
                                <span className="apenas-leitor">: {titulo}</span>
                              </Botao>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
