import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Aviso, Botao, Etiqueta } from '../componentes/basicos.jsx';
import { Dialogo } from '../componentes/Dialogo.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { excluirMaterial } from '../servicos/api.js';

/* =========================================================================
   UC19 — Consultar materiais processados (RF19)
   UC20 — Excluir material e adaptações (RF20)

   O cartão mostra perfil, etapa, data e versão do conjunto de regras sem
   exigir clique: é a heurística H6 (reconhecer em vez de lembrar). Duas
   adaptações do mesmo material com versões diferentes de regra precisam ser
   distinguíveis de relance, senão o professor reabre o material errado.
   ========================================================================= */

const ESTADOS = {
  adaptado: { tom: 'info', rotulo: 'Adaptado, aguardando sua revisão' },
  aprovado: { tom: 'boa', rotulo: 'Aprovado por você' },
  processando: { tom: 'atencao', rotulo: 'Em processamento' },
};

const ESTADOS_ATIVIDADE = {
  rascunho: { tom: 'neutra', rotulo: 'Atividade em rascunho' },
  publicada: { tom: 'boa', rotulo: 'Atividade publicada' },
  revogada: { tom: 'atencao', rotulo: 'Link revogado' },
};

export function Painel() {
  usarTituloDaPagina('Meus materiais');
  const { professor, materiais, removerMaterial } = usarApp();
  const { anunciar } = usarAnuncios();
  const [aExcluir, setAExcluir] = useState(null);

  async function confirmarExclusao() {
    const alvo = aExcluir;
    setAExcluir(null);
    await excluirMaterial(alvo.id);
    removerMaterial(alvo.id);
    anunciar(`Material ${alvo.nome} e todas as suas adaptações foram excluídos.`);
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Meus materiais</h1>
        <p>
          {professor
            ? `${professor.nome} · ${professor.turma} · ${professor.escola}`
            : 'Materiais enviados por você.'}
        </p>
      </div>

      <div className="linha" style={{ marginBottom: 'var(--e5)' }}>
        <Botao como="link" para="/enviar">
          Enviar novo material
        </Botao>
      </div>

      {materiais.length === 0 ? (
        <div className="cartao vazio">
          <h2>Você ainda não enviou nenhum material</h2>
          <p>
            Envie um PDF ou um arquivo do Word que você já usa em aula. O Entende+ devolve a versão
            adaptada e uma atividade sobre o mesmo conteúdo.
          </p>
          <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e4)' }}>
            <Botao como="link" para="/enviar">
              Enviar meu primeiro material
            </Botao>
          </div>
        </div>
      ) : (
        <ul className="cartao-lista" style={{ listStyle: 'none', padding: 0 }}>
          {materiais.map((material) => {
            const estado = ESTADOS[material.estado] ?? ESTADOS.adaptado;
            const atividade = ESTADOS_ATIVIDADE[material.atividade?.estado];
            return (
              <li key={material.id}>
                <article className="cartao cartao-material">
                  <div>
                    <h2 style={{ fontSize: '1.125rem' }}>
                      <Link to={`/materiais/${material.id}/adaptacao`}>{material.nome}</Link>
                    </h2>

                    <div className="linha" style={{ marginTop: 'var(--e2)' }}>
                      <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
                      {atividade && <Etiqueta tom={atividade.tom}>{atividade.rotulo}</Etiqueta>}
                    </div>

                    <dl>
                      <dt>Perfil:</dt>
                      <dd>{material.perfil}</dd>
                      <dt>Etapa:</dt>
                      <dd>{material.etapa}</dd>
                      <dt>Enviado em:</dt>
                      <dd>{material.enviadoEm}</dd>
                      <dt>Páginas:</dt>
                      <dd>{material.paginas}</dd>
                      <dt>Conjunto de regras:</dt>
                      <dd>{material.versaoRegras}</dd>
                    </dl>
                  </div>

                  <div className="linha" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <Botao
                      como="link"
                      para={`/materiais/${material.id}/adaptacao`}
                      variante="secundario"
                    >
                      Abrir adaptação
                    </Botao>
                    <Botao
                      como="link"
                      para={`/materiais/${material.id}/atividade`}
                      variante="secundario"
                    >
                      Ver atividade
                    </Botao>
                    <Botao variante="discreto" onClick={() => setAExcluir(material)}>
                      Excluir
                      <span className="apenas-leitor"> o material {material.nome}</span>
                    </Botao>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Aviso tipo="info" titulo="Sobre os materiais guardados aqui">
        <p>
          Só você tem acesso aos materiais que enviou. Ao excluir um material, a adaptação e a
          atividade gerada a partir dele são apagadas junto, e a ação não pode ser desfeita.
        </p>
      </Aviso>

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
