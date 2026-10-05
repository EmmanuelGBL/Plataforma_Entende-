import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso } from './basicos.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { servidor } from '../servicos/servidor.js';

/* =========================================================================
   Porta de entrada das três telas do estudante: a escolha do modo, o jogo e
   a lista de perguntas.

   RF18 e RN06 dizem que o professor revoga o link quando quiser, e as três
   telas precisam recusar o acesso do mesmo jeito. Enquanto havia uma tela só,
   a verificação morava dentro dela; com três, repetir o bloco em cada uma
   seria combinar para as mensagens divergirem no primeiro ajuste de texto.

   No modo servidor, a atividade vem da rota pública /api/atividades/{código},
   que não pede conta e não guarda nada sobre quem abriu (RN05).
   ========================================================================= */

const ContextoAtividade = createContext(null);

/** Envolve as rotas do estudante. Busca a atividade uma vez e só monta a tela
 *  quando ela chegou: o jogo monta a ordem das questões ao abrir, e montá-lo
 *  com a lista ainda vazia deixaria a partida sem questão nenhuma. */
export function CarregarAtividade({ children }) {
  const { modoServidor } = usarApp();
  const { codigo } = useParams();
  const [estado, setEstado] = useState({ carregando: modoServidor, dados: null });

  useEffect(() => {
    if (!modoServidor) return undefined;
    let vivo = true;
    setEstado({ carregando: true, dados: null });
    servidor
      .atividade(codigo)
      .then((dados) => vivo && setEstado({ carregando: false, dados }))
      .catch(() => vivo && setEstado({ carregando: false, dados: null }));
    return () => {
      vivo = false;
    };
  }, [codigo, modoServidor]);

  if (estado.carregando) {
    return (
      <p role="status" className="campo__dica">
        Abrindo a atividade…
      </p>
    );
  }
  return <ContextoAtividade.Provider value={estado.dados}>{children}</ContextoAtividade.Provider>;
}

/** Resolve o código do link em material, questões e validade do acesso. */
export function usarAtividadeDoCodigo(codigo) {
  const { modoServidor, materialPorCodigo, adaptacao } = usarApp();
  const doServidor = useContext(ContextoAtividade);

  const daAtividade = useMemo(() => {
    if (!modoServidor || !doServidor) return null;
    return {
      material: { conteudoProprio: true, disciplina: doServidor.titulo },
      valida: true,
      questoes: doServidor.questoes.map((q) => ({ ...q, mecanica: 'Escolha única' })),
    };
  }, [modoServidor, doServidor]);

  if (modoServidor) return daAtividade ?? { material: null, valida: false, questoes: [] };

  const material = materialPorCodigo(codigo);
  const valida = Boolean(material) && material.atividade?.estado === 'publicada';
  const questoes = valida ? adaptacao(material.id).questoes : [];

  return { material, valida, questoes };
}

/**
 * Assunto anunciado ao leitor de tela.
 *
 * Nesta demonstração as questões são sempre as de Ciências. Um material de
 * História anunciaria "Atividade sobre História" com perguntas sobre
 * fotossíntese, e quem ouviria o erro seria justamente quem depende do
 * anúncio. As telas do professor tratam o descompasso com o AvisoConteudoDemo;
 * nas do estudante o tratamento é este. No modo servidor, o assunto é o
 * primeiro título do material adaptado.
 */
export function assuntoDaAtividade(material) {
  if (!material) return 'o material da aula';
  return material.conteudoProprio ? (material.disciplina ?? 'o material da aula') : 'Ciências';
}

export function AtividadeIndisponivel() {
  return (
    <div className="atividade">
      <Aviso tipo="atencao" titulo="Esta atividade não está disponível" nivel={1}>
        <p>O link pode ter sido revogado pelo professor, ou o código pode estar digitado errado.</p>
        <p>Peça um link novo ao seu professor.</p>
      </Aviso>
      <p>
        <Link to="/">Ir para a página inicial do Entende+</Link>
      </p>
    </div>
  );
}
