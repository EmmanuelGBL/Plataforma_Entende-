# Protótipo do Entende+ — front-end

React 19 + Vite 7 + react-router-dom 7. CSS escrito à mão, sem framework de estilo.

```
npm install     # só na primeira vez
npm run dev     # abre em http://localhost:5173
npm run build   # gera dist/ — para servidor HTTP (GitHub Pages)
npm run offline # gera "Entende+ (protótipo).html" — arquivo único, abre por duplo clique
```

**A pasta `dist/` não abre por duplo clique**: o `index.html` do Vite carrega o pacote como
`<script type="module">`, e o navegador bloqueia módulo em `file://`. Para o disco — pendrive,
sessão presencial, anexo de e-mail — use o arquivo único do `npm run offline`.

## Onde está cada coisa

```
src/
  main.jsx          Providers e HashRouter
  App.jsx           Rotas, com a tabela rota → caso de uso → requisito
  estilos/
    tokens.css      Paleta, tipografia, espaçamento, foco, alvo mínimo,
                    e os quatro modos do painel de exibição
    base.css        Reset, tipografia, marcos de página, foco, links de salto
    componentes.css Botões, campos, cartões, diálogo, comparador, atividade
  contextos/
    Preferencias    Tamanho do texto, espaçamento, contraste e movimento
    Anuncios        Região aria-live única do aplicativo
    Aplicacao       Professor autenticado e materiais (em memória)
  servicos/api.js   Camada de dados simulada — trocar por HTTP depois
  dados/conteudo.js Texto original e adaptado, dez regras, métricas, questões
  componentes/      Design system
  paginas/          As dez telas
```

## Cinco coisas que não são estilo, e que quebram se mexerem

1. **`base: './'` no `vite.config.js` + `HashRouter` no `main.jsx`.** É o par que permite o mesmo
   build servir para o GitHub Pages e para o arquivo único offline. Com `BrowserRouter`, abrir
   do disco daria tela branca, e no Pages qualquer rota recarregada daria 404.

2. **`color: inherit` em `button`, `input`, `textarea` e `select`, no `base.css`.** Sem isso, no
   modo de alto contraste os controles caem no preto padrão do navegador, sobre fundo preto, e o
   texto some. Foi um defeito real, encontrado e corrigido em 08/09.

3. **O `<main>` recebe o foco a cada troca de rota**, no `Layout.jsx`. Em aplicação de página
   única, mudar de rota não recarrega o documento: sem isso, quem usa leitor de tela não recebe
   aviso nenhum de que a tela mudou.

4. **`tabIndex={0}` nos dois painéis do `Comparador.jsx`.** Os painéis rolam, e região que rola
   precisa receber foco — senão quem navega só por teclado não alcança o texto que passa da
   altura visível. Era um defeito real: o painel do adaptado tem 2098 px de conteúdo numa caixa
   de 544 px, ou seja, dois terços do material estavam inacessíveis. Encontrado e corrigido na
   auditoria de 11/09. Pela mesma razão existe o componente `TabelaEnvolvente`, que só se torna
   focável quando a tabela de fato transborda.

5. **`min-inline-size: 0` no `fieldset` e `min-width: 0` no nome da regra**, no `componentes.css`.
   O padrão do navegador é as duas caixas se recusarem a encolher abaixo do próprio conteúdo, e
   isso abria rolagem horizontal em tela estreita quando o professor aumentava o corpo do texto
   pelo painel de exibição — um recurso de acessibilidade quebrando outro.

## O que é dado fixo

Tudo em `src/dados/conteudo.js`. Não existe motor de adaptação, chamada a modelo de linguagem
nem banco de dados nesta entrega. O atraso simulado em `servicos/api.js` é proposital: é o que
permite testar os estados de espera.

**A exportação em PDF, essa funciona** — `paginas/Impressao.jsx` mais `estilos/impressao.css`
formatam a folha e a função de impressão do navegador gera o arquivo. Cada valor daquela folha
atende a um parâmetro de RNF02 ou RNF05, e está comentado ao lado.

Dos três materiais do histórico, só o de Ciências tem texto adaptado escrito para ele
(`conteudoProprio: true`). Abrir os outros dois mostra um aviso dizendo isso, em vez de exibir
o texto de fotossíntese sob o título de História como se fosse certo.

Recarregar a página devolve o protótipo ao estado inicial — conveniente entre uma sessão de
teste e a seguinte.

## Rotas

| Rota | Tela |
| --- | --- |
| `#/` | Entrar |
| `#/painel` | Meus materiais |
| `#/enviar` | Enviar material, em três passos |
| `#/materiais/m-102/adaptacao` | Revisar a adaptação — **a tela núcleo** |
| `#/materiais/m-102/impressao` | Material adaptado em PDF (botão Salvar como PDF) |
| `#/materiais/m-102/atividade` | Revisar e publicar a atividade |
| `#/atividade/PXK4T9` | Atividade na visão do estudante |
| `#/ajuda` | Ajuda e catálogo das dez regras |
| `#/acessibilidade` | Declaração de acessibilidade |

Qualquer outro endereço cai na página de erro.
