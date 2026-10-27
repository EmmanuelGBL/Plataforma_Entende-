import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso } from './basicos.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { servidor } from '../servicos/servidor.js';

/* Acesso às três telas do estudante (escolha, jogo e lista de perguntas).
   Centraliza a busca da atividade pelo código e a mensagem de link revogado.
   No modo servidor, usa a rota pública /api/atividades/{código}, sem conta. */

const ContextoAtividade = createContext(null);

/** Busca a atividade uma vez e só monta a tela quando ela chega, para o
 *  jogo não começar sem questões. */
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

/** Assunto da atividade mostrado ao estudante. No modo servidor é o
 *  primeiro título do material adaptado; na demonstração, Ciências. */
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
