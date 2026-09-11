import { Cartao, Migalhas, TabelaEnvolvente } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { CONJUNTO_REGRAS, REGRAS } from '../dados/conteudo.js';

/* =========================================================================
   Heurística H10 — ajuda e documentação.
   Também é onde RF10 se cumpre fora do contexto de um material específico: o
   professor consegue consultar o conjunto inteiro de regras e a base
   normativa de cada uma antes mesmo de enviar o primeiro arquivo.

   A ajuda responde perguntas de professor, não de programador. "O que o
   sistema muda no meu material" vem antes de "formatos aceitos".
   ========================================================================= */

const PERGUNTAS = [
  {
    pergunta: 'O Entende+ muda o conteúdo da minha aula?',
    resposta:
      'Não. O sistema muda a forma do texto: divide períodos longos, explica termos difíceis, ' +
      'organiza o material em blocos com subtítulo. Nenhum conceito é acrescentado nem retirado. ' +
      'A responsabilidade pedagógica continua sendo sua, e nada é exportado sem a sua aprovação.',
  },
  {
    pergunta: 'Por que o texto adaptado ficou maior que o original?',
    resposta:
      'Explicar um termo entre parênteses e dividir um período longo em três frases curtas ' +
      'aumenta a quantidade de palavras. É o custo conhecido da adaptação. O quadro de métricas ' +
      'mostra esse número sempre, inclusive quando ele é desfavorável.',
  },
  {
    pergunta: 'Que arquivos posso enviar?',
    resposta:
      'PDF e Word (.docx), com até 20 páginas e 15 MB por envio. O PDF precisa ter texto ' +
      'selecionável. Se for uma folha escaneada, sem reconhecimento de texto, o sistema recusa e ' +
      'explica o motivo — adaptar um material lido pela metade sairia errado sem avisar você.',
  },
  {
    pergunta: 'Os estudantes precisam de conta para responder a atividade?',
    resposta:
      'Não. Eles entram pelo link, sem cadastro e sem senha. O sistema não guarda nome, e-mail, ' +
      'nota nem qualquer dado que identifique a criança. Você pode revogar o link quando quiser.',
  },
  {
    pergunta: 'Posso corrigir o texto que o sistema adaptou?',
    resposta:
      'Pode, e é esperado que corrija. A tela de adaptação tem o botão "Editar o texto adaptado". ' +
      'Enquanto você não salvar, dá para descartar tudo e voltar ao texto como estava.',
  },
  {
    pergunta: 'Para quem este material adaptado foi pensado?',
    resposta:
      'Para estudantes com Transtorno do Espectro Autista do 5º ano do ensino fundamental. É o ' +
      'único perfil e a única etapa desta versão. As regras foram derivadas de diretrizes de ' +
      'acessibilidade cognitiva e revisadas com professores e especialistas.',
  },
];

export function Ajuda() {
  usarTituloDaPagina('Ajuda');

  return (
    <>
      <Migalhas itens={[{ rotulo: 'Meus materiais', para: '/painel' }, { rotulo: 'Ajuda' }]} />

      <div className="cabecalho-pagina">
        <h1>Ajuda</h1>
        <p>Como o Entende+ adapta o seu material, e por quê.</p>
      </div>

      <div className="pilha-g">
        <Cartao>
          <h2>Perguntas frequentes</h2>
          <dl>
            {PERGUNTAS.map((item) => (
              <div key={item.pergunta} style={{ marginTop: 'var(--e4)' }}>
                <dt style={{ fontWeight: 600, fontSize: '1.0625rem' }}>{item.pergunta}</dt>
                <dd style={{ margin: 'var(--e1) 0 0', maxWidth: 'var(--medida-leitura)' }}>
                  {item.resposta}
                </dd>
              </div>
            ))}
          </dl>
        </Cartao>

        <Cartao>
          <h2>
            Conjunto de regras {CONJUNTO_REGRAS.identificador} v{CONJUNTO_REGRAS.versao}
          </h2>
          <p>{CONJUNTO_REGRAS.descricao}</p>
          <p className="campo__dica">
            Publicado em {CONJUNTO_REGRAS.publicadoEm}. Toda adaptação registra qual versão foi
            usada, e esse registro não pode ser alterado.
          </p>

          <TabelaEnvolvente rotulo="Regras de adaptação do perfil TEA">
            <table className="dados">
              <caption className="apenas-leitor">
                Regras de adaptação do perfil TEA, com a base normativa de cada uma
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Regra</th>
                  <th scope="col">O que ela faz</th>
                  <th scope="col">Base normativa</th>
                </tr>
              </thead>
              <tbody>
                {REGRAS.map((regra) => (
                  <tr key={regra.codigo}>
                    <th scope="row" style={{ fontFamily: 'var(--fonte-mono)', whiteSpace: 'nowrap' }}>
                      {regra.codigo}
                    </th>
                    <td>{regra.nome}</td>
                    <td>
                      {regra.descricao}
                      <span className="campo__dica" style={{ marginBottom: 0 }}>
                        {regra.justificativa}
                      </span>
                    </td>
                    <td>{regra.base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaEnvolvente>
        </Cartao>

        <Cartao>
          <h2>Atalhos de teclado</h2>
          <p>
            Todo o sistema pode ser usado sem mouse. Use <kbd>Tab</kbd> para avançar,{' '}
            <kbd>Shift</kbd> + <kbd>Tab</kbd> para voltar, <kbd>Enter</kbd> ou{' '}
            <kbd>Barra de espaço</kbd> para acionar e <kbd>Esc</kbd> para fechar uma janela de
            confirmação.
          </p>
          <TabelaEnvolvente rotulo="Atalhos de teclado">
            <table className="dados">
              <thead>
                <tr>
                  <th scope="col">Atalho</th>
                  <th scope="col">Vai para</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Tecla de acesso 1</th>
                  <td>Conteúdo principal da página</td>
                </tr>
                <tr>
                  <th scope="row">Tecla de acesso 2</th>
                  <td>Menu de navegação</td>
                </tr>
              </tbody>
            </table>
          </TabelaEnvolvente>
          <p className="campo__dica">
            A combinação que ativa a tecla de acesso muda conforme o navegador. No Chrome e no
            Edge, em Windows, é <kbd>Alt</kbd> + a tecla. No Firefox, <kbd>Alt</kbd> +{' '}
            <kbd>Shift</kbd> + a tecla.
          </p>
        </Cartao>
      </div>
    </>
  );
}
