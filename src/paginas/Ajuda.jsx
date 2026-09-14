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
          <dl className="perguntas">
            {PERGUNTAS.map((item) => (
              <div key={item.pergunta}>
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
          <p className="campo__dica" style={{ marginBottom: 'var(--e5)' }}>
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

        <Cartao className="cartao--acao">
          <h2>Atalhos de teclado</h2>
          <p style={{ marginBottom: 'var(--e5)' }}>Todo o sistema pode ser usado sem mouse.</p>

          <TabelaEnvolvente rotulo="Teclas de navegação">
            <table className="dados dados--estreita">
              <caption>Para navegar em qualquer tela</caption>
              <tbody>
                <tr>
                  <th scope="row">
                    <kbd>Tab</kbd>
                  </th>
                  <td>Avança para o próximo item</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>Shift</kbd> + <kbd>Tab</kbd>
                  </th>
                  <td>Volta para o item anterior</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>Enter</kbd> ou <kbd>Espaço</kbd>
                  </th>
                  <td>Aciona o botão ou o link em foco</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>Esc</kbd>
                  </th>
                  <td>Fecha a janela de confirmação sem confirmar</td>
                </tr>
              </tbody>
            </table>
          </TabelaEnvolvente>

          <TabelaEnvolvente rotulo="Teclas de acesso">
            <table className="dados dados--estreita" style={{ marginTop: 'var(--e5)' }}>
              <caption>Para saltar direto a uma parte da página</caption>
              <tbody>
                <tr>
                  <th scope="row">
                    <kbd>Alt</kbd> + <kbd>1</kbd>
                  </th>
                  <td>Vai para o conteúdo principal</td>
                </tr>
                <tr>
                  <th scope="row">
                    <kbd>Alt</kbd> + <kbd>2</kbd>
                  </th>
                  <td>Vai para o menu de navegação</td>
                </tr>
              </tbody>
            </table>
          </TabelaEnvolvente>

          <p className="campo__dica" style={{ marginTop: 'var(--e4)' }}>
            A combinação muda conforme o navegador. No Chrome e no Edge, em Windows, é a mostrada
            acima. No Firefox, acrescente <kbd>Shift</kbd>.
          </p>
        </Cartao>
      </div>
    </>
  );
}
