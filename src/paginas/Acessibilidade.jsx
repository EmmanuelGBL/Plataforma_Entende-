import { Aviso, Cartao } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';

/* =========================================================================
   Declaração de acessibilidade.

   Não é página de enfeite: o e-MAG (recomendação 6.2) pede que o sítio
   tenha uma página descrevendo os recursos de acessibilidade, os atalhos e
   as limitações conhecidas. A WCAG não exige isso — é uma das diferenças
   entre os dois modelos, e ter a página é o que permite afirmar no artigo
   que o e-MAG foi aplicado, e não apenas citado.

   O trecho das limitações conhecidas é deliberado. Declaração de
   acessibilidade que afirma conformidade total costuma ser falsa, e a banca
   pergunta. Registrar o que ainda não está conforme vale mais.
   ========================================================================= */

export function Acessibilidade() {
  usarTituloDaPagina('Acessibilidade');

  return (
    <div className="pagina-leitura">
      <div className="cabecalho-pagina">
        <h1>Acessibilidade no Entende+</h1>
        <p>
          Como este sistema foi construído para ser usado por todo mundo, o que já está pronto e o
          que ainda não está.
        </p>
      </div>

      <div className="pilha-g">
        <Cartao>
          <h2>Padrões adotados</h2>
          <p>
            A interface segue as <strong>Diretrizes de Acessibilidade para Conteúdo Web (WCAG)
            2.2, no nível AA</strong>, do W3C, e o <strong>Modelo de Acessibilidade em Governo
            Eletrônico (e-MAG), versão 3.1</strong>, do Governo Federal brasileiro.
          </p>
          <p>
            Alguns critérios de nível AAA também foram adotados, por serem diretamente ligados ao
            objeto deste trabalho: apresentação visual do texto (critério 1.4.8) e nível de leitura
            (critério 3.1.5). Eles valem tanto para esta interface quanto para o material que o
            sistema produz.
          </p>
        </Cartao>

        <Cartao>
          <h2>O que você pode ajustar</h2>
          <p>
            O botão <strong>Exibição</strong>, no alto de todas as telas, permite mudar quatro
            coisas. A escolha fica guardada no seu navegador e continua valendo na próxima vez.
          </p>
          <ul>
            <li>
              <strong>Tamanho do texto</strong> — três níveis, até 125% do padrão. O sistema
              também acompanha o zoom do navegador até 200% sem perder conteúdo.
            </li>
            <li>
              <strong>Espaçamento</strong> — aumenta a distância entre linhas, letras, palavras e
              parágrafos, nos valores previstos no critério 1.4.12 da WCAG.
            </li>
            <li>
              <strong>Alto contraste</strong> — esquema preto e amarelo, o mesmo usado nos portais
              do governo federal.
            </li>
            <li>
              <strong>Animações</strong> — reduz o movimento na tela. Se o seu sistema operacional
              já pede menos movimento, o site obedece automaticamente.
            </li>
          </ul>
        </Cartao>

        <Cartao>
          <h2>Navegação por teclado e teclas de acesso</h2>
          <p>
            Todo o sistema funciona sem mouse. O primeiro item ao pressionar <kbd>Tab</kbd> é o
            link <em>Ir para o conteúdo</em>. O elemento em foco sempre fica visível, com um
            contorno de 3 pixels.
          </p>
          <ul>
            <li>
              <strong>Tecla de acesso 1</strong> — conteúdo principal
            </li>
            <li>
              <strong>Tecla de acesso 2</strong> — menu de navegação
            </li>
          </ul>
          <p className="campo__dica">
            No Chrome e no Edge, em Windows, use <kbd>Alt</kbd> + a tecla. No Firefox,{' '}
            <kbd>Alt</kbd> + <kbd>Shift</kbd> + a tecla.
          </p>
        </Cartao>

        <Cartao>
          <h2>Outros recursos</h2>
          <ul>
            <li>Estrutura de títulos sem saltos de nível, e marcos de página (cabeçalho, navegação, conteúdo, rodapé).</li>
            <li>Todo campo de formulário tem rótulo visível; erros dizem o que fazer, não só o que está errado.</li>
            <li>Nenhuma informação é passada só pela cor — sempre há texto ou símbolo junto.</li>
            <li>Mudanças de estado são anunciadas para leitores de tela.</li>
            <li>Áreas clicáveis com no mínimo 44 por 44 pixels.</li>
            <li>Nenhuma função depende de arrastar elementos com o mouse.</li>
            <li>O campo de senha aceita colar, para funcionar com gerenciadores de senha.</li>
          </ul>
        </Cartao>

        <Aviso tipo="atencao" titulo="Limitações conhecidas">
          <p>Nesta versão, sabemos que ainda faltam:</p>
          <ul>
            <li>
              Legenda e transcrição de vídeos de apoio — não há vídeo no protótipo, mas haverá na
              versão final, e o critério 1.2.2 passará a se aplicar.
            </li>
            <li>
              Verificação com usuários de leitor de tela. A auditoria feita até aqui usou
              ferramenta automatizada, conferência manual e teste com o NVDA pela própria equipe —
              o que não substitui teste com quem usa a tecnologia no dia a dia.
            </li>
            <li>
              O documento adaptado exportado em PDF ainda não foi auditado quanto à marcação de
              PDF acessível (PDF/UA).
            </li>
          </ul>
        </Aviso>

        <Cartao>
          <h2>Fale com a gente</h2>
          <p>
            Este é um protótipo acadêmico, desenvolvido como Trabalho de Conclusão de Curso em
            Sistemas de Informação no CEUNI FAMETRO, por Emmanuel Gabriel Martins Monteiro e Hugo
            Macedo Lima. Encontrou uma barreira de acesso? Ela é um problema do sistema, não seu, e
            queremos saber — o retorno entra na próxima versão do trabalho.
          </p>
          <p className="campo__dica">Declaração revisada em 8 de setembro de 2026.</p>
        </Cartao>
      </div>
    </div>
  );
}
