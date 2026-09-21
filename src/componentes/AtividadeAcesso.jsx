import { Link } from 'react-router-dom';
import { Aviso } from './basicos.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';

/* =========================================================================
   Porta de entrada das três telas do estudante: a escolha do modo, o jogo e
   a lista de perguntas.

   RF18 e RN06 dizem que o professor revoga o link quando quiser, e as três
   telas precisam recusar o acesso do mesmo jeito. Enquanto havia uma tela só,
   a verificação morava dentro dela; com três, repetir o bloco em cada uma
   seria combinar para as mensagens divergirem no primeiro ajuste de texto.
   ========================================================================= */

/** Resolve o código do link em material, questões e validade do acesso. */
export function usarAtividadeDoCodigo(codigo) {
  const { materialPorCodigo, adaptacao } = usarApp();

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
 * nas do estudante o tratamento é este.
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
