# Entende+ — protótipo do front-end

Protótipo navegável da interface do **Entende+**, sistema de adaptação de material didático para
estudantes com Transtorno do Espectro Autista do 5º ano do ensino fundamental.

Trabalho de Conclusão de Curso em Sistemas de Informação — CEUNI FAMETRO.
**Emmanuel Gabriel Martins Monteiro** e **Hugo Macedo Lima**.
Orientação: Profa. Msc. Luana Leal.

---

## O que este repositório é, e o que não é

**É** o front-end: dez telas, o design system, a folha de impressão que gera o PDF do material
adaptado, e as decisões de acessibilidade que sustentam o trabalho.

**Não é** o sistema funcionando. Não existem aqui motor de adaptação, chamada a modelo de
linguagem, banco de dados nem autenticação real. Os textos, as métricas de legibilidade e as
questões da atividade são **dados fixos**, escritos pela dupla, e estão em
`src/dados/conteudo.js`.

A exceção é a **exportação em PDF**, que funciona de verdade: a folha é formatada por
`@media print` e o arquivo sai pela função de impressão do navegador, com texto selecionável.

O texto didático da demonstração foi redigido por nós no estilo de um material de Ciências do
5º ano — não é material de terceiros.

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

Auditoria executada em 11/09/2026 com axe-core 4.10.2 nas dez rotas, mais medição de reflow em
viewport de 320 px e percurso por teclado. **Quatro violações encontradas, todas corrigidas; as
dez rotas fecham com zero violação.** O relatório, com o antes e o depois de cada achado e os
dados brutos, está na pasta de documentação do TCC.

Pendentes e declarados: validação pelo ASES, que exige endereço público, e leitura com NVDA.

O sistema tem painel de preferências de exibição em todas as telas — tamanho do texto,
espaçamento, alto contraste e redução de movimento —, e as escolhas ficam gravadas entre sessões.

## Onde continuar

`LEIA-ME.md` traz a estrutura do código, as rotas com os respectivos casos de uso, e as cinco
decisões técnicas que quebram o protótipo se forem alteradas sem contexto.

## Licença e uso

Trabalho acadêmico. O código está aberto para consulta e avaliação; o nome **Entende+** e a
identidade visual são do projeto.
