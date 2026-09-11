import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Botao, Cartao } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';

/* =========================================================================
   UC16 — Executar a atividade (RF16)  ·  UC17 — Retorno de acerto ou erro (RF17)
   RN05 — sem cadastro e sem nenhum dado que identifique o estudante.
   RNF04 — funciona de 360 px a 1920 px, em Chrome e Firefox, sem instalar nada.

   As decisões desta tela vêm do perfil, não do gosto:

   - Uma questão por vez, sem rolagem: reduz a quantidade de coisa disputando
     a atenção.
   - Sem cronômetro e sem placar de tempo. Pressão de tempo é fonte conhecida
     de ansiedade e não mede compreensão.
   - O retorno é imediato e literal ("Você acertou" / "A resposta certa era"),
     sem ironia, sem emoji ambíguo, sem som.
   - Errar não bloqueia: a criança vê a resposta certa e segue. A atividade é
     de leitura, não de avaliação.
   - Alvo grande (56 px de altura), bem acima do mínimo da WCAG.
   ========================================================================= */

export function AtividadeEstudante() {
  const { codigo } = useParams();
  const { materialPorCodigo, adaptacao } = usarApp();
  const { anunciar } = usarAnuncios();

  const material = materialPorCodigo(codigo);
  const valida = material && material.atividade?.estado === 'publicada';

  usarTituloDaPagina(valida ? 'Atividade' : 'Atividade indisponível');

  const [indice, setIndice] = useState(0);
  const [escolhida, setEscolhida] = useState(null);
  const [acertos, setAcertos] = useState(0);
  const [terminou, setTerminou] = useState(false);

  if (!valida) {
    return (
      <div className="atividade">
        <Aviso tipo="atencao" titulo="Esta atividade não está disponível">
          <p>
            O link pode ter sido revogado pelo professor, ou o código pode estar digitado errado.
          </p>
          <p>Peça um link novo ao seu professor.</p>
        </Aviso>
        <p>
          <Link to="/">Ir para a página inicial do Entende+</Link>
        </p>
      </div>
    );
  }

  const { questoes } = adaptacao(material.id);
  const questao = questoes[indice];
  const ultima = indice === questoes.length - 1;

  function responder(posicao) {
    if (escolhida !== null) return;
    setEscolhida(posicao);
    const certa = posicao === questao.correta;
    if (certa) setAcertos((n) => n + 1);
    anunciar(
      certa
        ? 'Você acertou.'
        : `Não foi essa. A resposta certa era: ${questao.alternativas[questao.correta]}.`,
    );
  }

  function avancar() {
    if (ultima) {
      setTerminou(true);
      anunciar(`Atividade terminada. Você acertou ${acertos} de ${questoes.length}.`);
      return;
    }
    setIndice((i) => i + 1);
    setEscolhida(null);
    anunciar(`Pergunta ${indice + 2} de ${questoes.length}.`);
  }

  function recomecar() {
    setIndice(0);
    setEscolhida(null);
    setAcertos(0);
    setTerminou(false);
    anunciar('Atividade reiniciada na pergunta 1.');
  }

  if (terminou) {
    return (
      <div className="atividade">
        <Cartao>
          <h1>Você terminou a atividade</h1>
          <p style={{ fontSize: '1.25rem' }}>
            Você acertou <strong>{acertos}</strong> de <strong>{questoes.length}</strong> perguntas.
          </p>
          <p>Você pode responder de novo quantas vezes quiser.</p>
          <div className="linha" style={{ marginTop: 'var(--e5)' }}>
            <Botao onClick={recomecar}>Responder de novo</Botao>
          </div>
        </Cartao>
        <p className="campo__dica" style={{ marginTop: 'var(--e4)' }}>
          Nada do que você respondeu foi guardado. O Entende+ não registra nome, e-mail nem nota.
        </p>
      </div>
    );
  }

  return (
    <div className="atividade">
      {/* A disciplina anunciada tem de ser a do conteúdo que está na tela, e não
          a do material no histórico. Nesta demonstração as questões são sempre
          as de Ciências, então um material de História anunciaria "Atividade
          sobre História" com perguntas sobre fotossíntese — e quem ouviria o
          erro seria justamente quem usa leitor de tela, porque este título é
          `apenas-leitor`. As telas do professor já tratam esse descompasso com
          o AvisoConteudoDemo; esta era a única que não tratava. */}
      <h1 className="apenas-leitor">
        Atividade sobre{' '}
        {material.conteudoProprio ? (material.disciplina ?? 'o material da aula') : 'Ciências'}
      </h1>

      <p className="atividade__contador">
        Pergunta {indice + 1} de {questoes.length}
      </p>

      <h2 className="atividade__pergunta">{questao.enunciado}</h2>

      <ul className="atividade__opcoes">
        {questao.alternativas.map((alternativa, posicao) => {
          const respondida = escolhida !== null;
          const estaCerta = posicao === questao.correta;
          const foiEscolhida = posicao === escolhida;
          let classe = 'atividade__opcao';
          if (respondida && estaCerta) classe += ' atividade__opcao--certa';
          if (respondida && foiEscolhida && !estaCerta) classe += ' atividade__opcao--errada';

          return (
            <li key={alternativa}>
              <button
                type="button"
                className={classe}
                disabled={respondida}
                onClick={() => responder(posicao)}
              >
                <span className="atividade__letra" aria-hidden="true">
                  {String.fromCharCode(65 + posicao)}
                </span>
                <span>{alternativa}</span>
                {respondida && estaCerta && (
                  <span className="atividade__marca">
                    <span aria-hidden="true">✓</span>
                    <span className="apenas-leitor">resposta correta</span>
                  </span>
                )}
                {respondida && foiEscolhida && !estaCerta && (
                  <span className="atividade__marca">
                    <span aria-hidden="true">✕</span>
                    <span className="apenas-leitor">sua resposta, incorreta</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {escolhida !== null && (
        <div className="atividade__retorno">
          {escolhida === questao.correta ? (
            <Aviso tipo="boa" titulo="Você acertou" papel="status">
              <p>Essa é a resposta certa.</p>
            </Aviso>
          ) : (
            <Aviso tipo="info" titulo="Não foi essa" papel="status">
              <p>
                A resposta certa é: <strong>{questao.alternativas[questao.correta]}</strong>.
              </p>
              <p>Tudo bem errar. Você pode continuar.</p>
            </Aviso>
          )}

          <Botao onClick={avancar} largo>
            {ultima ? 'Terminar a atividade' : 'Próxima pergunta'}
          </Botao>
        </div>
      )}
    </div>
  );
}
