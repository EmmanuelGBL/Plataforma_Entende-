import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, House, RotateCcw } from 'lucide-react';
import { Aviso, Botao } from '../componentes/basicos.jsx';
import { ConclusaoAtividade, Pontos, ProgressoPerguntas } from '../componentes/AtividadeVisual.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import {
  AtividadeIndisponivel,
  assuntoDaAtividade,
  usarAtividadeDoCodigo,
} from '../componentes/AtividadeAcesso.jsx';

/* Lista de perguntas, a forma da atividade sem jogo (RF16, RF17).
   Uma questão por vez, sem cronômetro; depois de responder, mostra se acertou
   e qual é a resposta certa. Não guarda nenhum dado do estudante (RN05). */

export function AtividadeEstudante() {
  const { codigo } = useParams();
  const { material, valida, questoes } = usarAtividadeDoCodigo(codigo);
  const { anunciar } = usarAnuncios();

  usarTituloDaPagina(valida ? 'Atividade' : 'Atividade indisponível');

  const [indice, setIndice] = useState(0);
  const [escolhida, setEscolhida] = useState(null);
  const [acertos, setAcertos] = useState(0);
  const [terminou, setTerminou] = useState(false);

  if (!valida) return <AtividadeIndisponivel />;

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
      <ConclusaoAtividade
        acertos={acertos}
        total={questoes.length}
        assunto={assuntoDaAtividade(material)}
        acoes={
          <>
            <Botao como="link" para={`/atividade/${codigo}`} variante="secundario">
              <House aria-hidden="true" />
              Voltar para a escolha
            </Botao>
            <Botao onClick={recomecar}>
              <RotateCcw aria-hidden="true" />
              Responder de novo
            </Botao>
          </>
        }
      />
    );
  }

  return (
    <div className="atividade">
      {/* Título só para leitor de tela, com o assunto da atividade. */}
      <h1 className="apenas-leitor">Atividade sobre {assuntoDaAtividade(material)}</h1>

      <div className="jogo__topo">
        <Pontos acertos={acertos} />
        <ProgressoPerguntas
          total={questoes.length}
          atual={indice}
          feitas={Array.from({ length: indice }, (_, posicao) => posicao)}
        />
      </div>

      <div className="cartao atividade__cartao">
        <h2 className="atividade__pergunta">{questao.enunciado}</h2>

        <ul className="atividade__opcoes atividade__opcoes--grade">
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
      </div>

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

          <div className="linha linha-fim">
            <Botao onClick={avancar}>
              {ultima ? 'Terminar a atividade' : 'Próxima pergunta'}
              <ArrowRight aria-hidden="true" />
            </Botao>
          </div>
        </div>
      )}

      <p className="campo__dica atividade__troca">
        Prefere com jogo? <Link to={`/atividade/${codigo}/jogo`}>Jogar estas perguntas</Link>.
      </p>
    </div>
  );
}
