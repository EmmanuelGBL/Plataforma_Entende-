# Entende+

Sistema de adaptação de material didático para estudantes com Transtorno do Espectro Autista do
5º ano do ensino fundamental: a interface (React) e o servidor (Python, em [`servidor/`](servidor/README.md)).

Trabalho de Conclusão de Curso em Sistemas de Informação — CEUNI FAMETRO.
**Emmanuel Gabriel Martins Monteiro** e **Hugo Macedo Lima**.
Orientação: Profa. Msc. Luana Leal.

---

## Dois modos, o mesmo código

| | Modo servidor | Modo demonstração |
| --- | --- | --- |
| Como liga | `VITE_API_URL` apontando para o servidor | sem `VITE_API_URL` |
| Conta | Real, com criação de conta | Qualquer senha entra |
| Material | Arquivo do seu computador, lido de verdade | Quatro exemplos fixos |
| Adaptação | Motor com regras versionadas e Claude | Texto escrito pela dupla |
| Link da atividade | Abre em qualquer navegador | Só neste navegador |
| Onde está | Localmente, por enquanto | GitHub Pages e arquivo offline |

**O endereço publicado no GitHub Pages é o modo demonstração**, porque o Pages só serve arquivo
estático e não há servidor publicado. Os textos, métricas e questões que ele mostra são dados
fixos, em `src/dados/conteudo.js`. Para usar o sistema de verdade, siga o
[`servidor/README.md`](servidor/README.md).

Nos dois modos, a **exportação em PDF** funciona de verdade — a folha é formatada por
`@media print` e o arquivo sai pela função de impressão do navegador, com texto selecionável —, e
a **atividade gamificada** é jogável do começo ao fim.

O texto didático da demonstração foi redigido por nós no estilo de um material de Ciências do
5º ano — não é material de terceiros.

## A atividade, em três formas

A mesma atividade, com as mesmas questões, por três caminhos. Quem escolhe entre os dois primeiros
é a criança, ao abrir o link; o terceiro é do professor.

| Forma | O que é |
| --- | --- |
| **Jogo** | Treino de pênalti (ou de pontaria, no tema neutro). A criança escolhe onde mirar, responde e vê o resultado. |
| **Lista de perguntas** | Uma questão por vez, sem cena e sem desenho. |
| **Folha impressa** | PDF das questões, com gabarito opcional em página separada. |

O desenho do jogo segue catorze regras derivadas de diretrizes publicadas para o perfil TEA. As que
mais o definem:

- **Estrutura de turno sempre igual**, e nenhum cronômetro ou elemento que comunique urgência.
- **Erro gera dica e nova tentativa, nunca perda.** A contagem registra acerto e não registra erro.
- **A dica está disponível antes de responder**, de graça e sem ser contabilizada — é aprendizagem
  sem erro, não prêmio de consolação.
- **Tema é preferência, com opção neutra como padrão**; futebol é escolha, não imposição.
- **Estilo plano e caricato, não fotorrealista**, e paleta de tom frio com um único acento quente
  fora do centro visual — as duas coisas por recomendação medida, não por gosto.

Cada regra tem a diretriz de origem declarada na documentação do TCC.

O que se afirma com isso é sobre o **desenho**, não sobre o **efeito**: não há base na literatura
para dizer que a mecânica melhora a aprendizagem de criança autista, e o trabalho não diz.

## Rodar

```
npm install
npm run dev       # http://localhost:5173
```

```
npm run build     # gera dist/ — para servidor HTTP
npm run offline   # gera "Entende+ (protótipo).html" — arquivo único, abre por duplo clique
```

A pasta `dist/` **não** abre por duplo clique: o navegador bloqueia `<script type="module">` em
`file://`. Para pendrive, sessão presencial ou anexo de e-mail, use o arquivo único.

## Acessibilidade

Alvo: **WCAG 2.2 nível AA** e **e-MAG 3.1**. Três critérios AAA foram adotados por serem o
objeto do trabalho.

Auditoria executada em 11/09/2026 com axe-core 4.10.2 nas dez rotas então existentes, mais medição
de reflow em viewport de 320 px e percurso por teclado. **Quatro violações encontradas, todas
corrigidas; as dez rotas fecham com zero violação.** O relatório, com o antes e o depois de cada
achado e os dados brutos, está na pasta de documentação do TCC.

Pendentes e declarados: validação pelo ASES, que exige endereço público; leitura com NVDA; e
**repetir a auditoria automática sobre as três rotas acrescentadas em 20/09** (escolha da forma,
jogo e folha de questões), que ainda não passaram pelo axe-core. Na cena do jogo, o SVG é
`aria-hidden` e tudo que acontece nele é dito em texto e anunciado na região de status — mas isso é
decisão de projeto, não resultado de medição, e a diferença fica registrada.

O sistema tem painel de preferências de exibição em todas as telas — tamanho do texto,
espaçamento, alto contraste e redução de movimento —, e as escolhas ficam gravadas entre sessões.

## Onde continuar

`LEIA-ME.md` traz a estrutura do código, as rotas com os respectivos casos de uso, e as cinco
decisões técnicas que quebram o protótipo se forem alteradas sem contexto.

## Licença e uso

Trabalho acadêmico. O código está aberto para consulta e avaliação; o nome **Entende+** e a
identidade visual são do projeto.
