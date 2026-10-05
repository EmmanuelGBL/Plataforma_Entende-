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
    jogo.css        Cena, alvos e ajustes da atividade gamificada (RF21)
    impressao.css   Folha do material adaptado (RF11) e das questões (RF23)
  contextos/
    Preferencias    Tamanho do texto, espaçamento, contraste e movimento
    Anuncios        Região aria-live única do aplicativo
    Aplicacao       Sessão, materiais e TODAS as operações, nos dois modos
                    (servidor e demonstração) — as telas só falam com ele
  servicos/
    servidor.js     Cliente HTTP do servidor e conversão para o formato das telas
    api.js          Modo demonstração: dados simulados com atraso proposital
  dados/conteudo.js Texto original e adaptado, dez regras, métricas, questões
  componentes/      Design system
  paginas/          As telas (13 rotas)
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

## Os dois modos

Com `VITE_API_URL` no ambiente do build, a interface usa o servidor (`servidor/`); sem ela, roda o
**modo demonstração**, com tudo em memória — que é o que o GitHub Pages e o arquivo offline
publicam. Quem decide é `servicos/servidor.js` (`modoServidor`), e quem esconde a diferença das
telas é `contextos/Aplicacao.jsx`.

```
$env:VITE_API_URL = "http://localhost:8000"; npm run dev   # modo servidor
npm run dev                                                 # modo demonstração
```

Regras para não quebrar um dos modos sem perceber:

- **Tela não importa `dados/conteudo.js`** nem chama `servicos/api.js`. Regras, versão, original,
  métricas e questões vêm de `usarAdaptacao(id)`, que nos dois modos devolve o mesmo formato. As
  únicas exceções são o envio (a lista de exemplos só existe na demonstração) e a reserva da Ajuda.
- **As regras mostradas numa adaptação são as da versão que ela usou**, e não as do arquivo de
  hoje — é o que a justificativa de RF10 precisa mostrar.
- **As rotas da criança passam por `CarregarAtividade`**: o jogo monta a ordem das questões ao
  abrir, e montá-lo antes de a atividade chegar do servidor deixaria a partida vazia.

## O que é dado fixo (modo demonstração)

Tudo em `src/dados/conteudo.js`. O atraso simulado em `servicos/api.js` é proposital: é o que
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
| `#/materiais/m-102/questionario` | Folha imprimível das questões, com gabarito opcional (RF23) |
| `#/atividade/PXK4T9` | Escolher a forma: jogar ou responder (RF22) |
| `#/atividade/PXK4T9/jogo` | Atividade gamificada (RF21) |
| `#/atividade/PXK4T9/perguntas` | Lista de perguntas, sem jogo (RF16, RF17) |
| `#/ajuda` | Ajuda e catálogo das dez regras |
| `#/acessibilidade` | Declaração de acessibilidade |

Qualquer outro endereço cai na página de erro.

## As três formas da mesma atividade

As questões são as mesmas nas três — geradas do próprio material (RF13, RN04) e revisadas pelo
professor antes de publicar. O que muda é o caminho:

| Forma | Arquivo | Para quem |
| --- | --- | --- |
| Jogo | `paginas/AtividadeJogo.jsx` | Quem quer jogar |
| Lista de perguntas | `paginas/AtividadeEstudante.jsx` | Quem quer só responder |
| Folha impressa | `paginas/QuestionarioImpresso.jsx` | Turma sem máquina para todo mundo; papel |

**A lista não é um modo degradado do jogo.** O jogo tem cena, movimento e metáfora, e nada disso é
neutro para todo estudante do perfil — é a mesma razão pela qual o tema é preferência e não
estrutura. Quem for "simplificar" juntando as duas telas está desfazendo uma decisão, não limpando
código.

### O jogo, em uma tela

Estrutura de turno fixa, sempre nesta ordem: **mirar → responder → resultado → próxima**. O
cabeçalho de `AtividadeJogo.jsx` traz as decisões que sustentam a tela e o de `CenaJogo.jsx` as do
desenho. As catorze regras estão em **RN11**, no `Entrega-24-08/requisitos.md` §4.1, cada uma com a
diretriz de origem; a pesquisa que as produziu está em
`Entrega-14-09/mecanica-atividade-gamificada.md`, seções 4 e 7.

O que é mais fácil de quebrar sem perceber:

- **Não existe contagem de erro em lugar nenhum** (G05). Acrescentar "3 erros" ao placar parece
  informação e é registro de fracasso exibido à criança pela atividade inteira. A trilha de
  bolinhas também não distingue "pulou" de "ainda não chegou", pelo mesmo motivo.
- **Nada na tela pode comunicar urgência** (G03). Sem cronômetro, sem barra que enche, sem
  movimento da bola antes da resposta confirmada. O balanço do goleiro durante a leitura é lento e
  sem começo nem fim marcados — é o oposto de um relógio.
- **Acerto sempre vira gol** (G02). "Dar realismo" deixando o goleiro pegar às vezes quebra a
  previsibilidade que sustenta o desenho inteiro.
- **A dica existe antes do erro, e é de graça** (G11). Transformá-la em recurso limitado, ou
  contá-la no resumo, desfaz a aprendizagem sem erro que ela implementa.
- **Tema neutro é o padrão e o som começa desligado** (G07, G08). O reconhecimento visual do acerto,
  esse **vem ligado** — só contador numérico é a forma de recompensa menos preferida pelo perfil.
- **A paleta não é escolha de gosto** (G12). Frio dominante, um único acento quente nas luvas, e
  amarelo fora da paleta padrão. As variáveis estão no topo de `jogo.css`.
- **Estilo plano, nunca fotorrealista** (G13) — inclusive a bola, que é vetor desenhado e não foto.
  O cabeçalho de `CenaJogo.jsx` explica os quatro motivos.
- A preferência de movimento reduzido do painel de Exibição já zera as transições na raiz do
  documento, e a cena usa `transition` justamente para obedecer sem saber que a preferência existe
  (G09). `esperaDoAviso` lê a mesma preferência para não fazer ninguém esperar em tela parada.

**Tempos que andam juntos.** A bola leva 540 ms para chegar (`.jogo__movel`), o balanço da rede
espera 520 ms para começar, e o cartão de resultado entra em 1150 ms no gol e 950 ms no erro
(`esperaDoAviso`). Mexer em um sem mexer nos outros faz o cartão voltar a aparecer por cima da bola
em movimento — que era o defeito da primeira versão.
