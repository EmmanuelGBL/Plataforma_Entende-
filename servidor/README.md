# Entende+ — servidor

API em Python (FastAPI) do Entende+: conta do professor, envio e extração do material, motor de
adaptação com regras versionadas, métricas de legibilidade, questões e publicação da atividade.
Cobre RF01 a RF23 do lado do servidor; o jogo e as folhas impressas rodam no navegador.

Este repositório é **público**. Chave da API, senha de banco e segredo do token vão no `.env`,
que não é versionado — nunca no código.

## Rodar

Python 3.11 ou mais recente. No PowerShell, dentro desta pasta:

```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
copy .env.exemplo .env          # preencha ENTENDE_SEGREDO_TOKEN e OPENAI_API_KEY

.venv\Scripts\python -m uvicorn app.principal:app --reload --no-access-log
```

A API sobe em `http://localhost:8000`, com documentação interativa em
**`http://localhost:8000/docs`**.

**`--no-access-log` não é opcional.** O registro de acesso padrão grava o IP de quem abre cada rota,
inclusive a da atividade da criança — e IP é dado pessoal. RN05 diz que o sistema não registra
nada que identifique o estudante.

### A interface ligada ao servidor

Na pasta de cima (`SISTEMA/`), com o servidor rodando:

```
$env:VITE_API_URL = "http://localhost:8000"; npm run dev
```

Sem `VITE_API_URL`, a interface roda no **modo de demonstração**, em memória e com dados fixos —
que é o que o GitHub Pages e o arquivo offline publicam, porque nenhum dos dois tem servidor.

Com `VITE_API_URL`, a tela de entrada mostra qual modo está aberto e um botão para trocar
("Abrir a demonstração" / "Usar o servidor ao vivo"). Na apresentação, dá para mostrar o protótipo
com os dados prontos e, em seguida, a API funcionando. A escolha fica no `localStorage` do
navegador (`entende.modo`), e a troca recarrega a página.

### Apresentar pelo GitHub Pages, com o servidor no notebook

O Pages não tem servidor, mas aberto com **`?servidor=local`** ele passa a oferecer o servidor do
próprio computador (`http://127.0.0.1:8000`). Sem o parâmetro, o visitante comum continua só na
demonstração e nunca recebe o pedido de "acessar a rede local" do navegador; com ele, o navegador
lembra até abrir com `?servidor=nenhum`. O servidor responde à pergunta de rede local do
navegador (`allow_private_network` no CORS), só para as origens de `ENTENDE_ORIGENS`.

No computador de quem apresenta, com Python 3.11+, numa **pasta de caminho curto** (`C:\Entende`:
o Windows recusa caminho com mais de 260 caracteres e a instalação quebra):

1. `preparar.cmd` uma vez — cria o `.venv` e instala as dependências;
2. o `.env` nesta pasta, recebido em particular (nunca pelo repositório);
3. `apresentar.cmd` — liga o servidor sem registro de acesso, cria a conta de apresentação no
   banco local (`admin@admin.com` / `admin123`; o servidor só escuta `127.0.0.1`) e abre o Pages.

### Chave da API do modelo de linguagem

Desde 29/10/2026 o motor de adaptação e o gerador de questões usam o **GPT-6.1 Sol**
(`gpt-6.1-sol`) pela API da OpenAI, com saída estruturada estrita (Responses API). O Claude Opus 5
continua disponível com `ENTENDE_PROVEDOR=anthropic` e `ANTHROPIC_API_KEY`. Sem a chave do provedor
escolhido (`OPENAI_API_KEY` no padrão), conta, envio e extração funcionam, e
adaptar responde 503 com a explicação. O motor é híbrido (ver abaixo): cada adaptação faz uma
chamada por seção **que tem algo a reescrever** — seção sem nada marcado pelo código não gera
chamada —, e mais uma para as questões. O terminal do servidor mostra, a cada adaptação, quantos
blocos foram ao modelo e em quantos pedidos, e cada chamada à OpenAI registra no log os tokens de
entrada e de saída e o tempo (nada do texto do material). O modelo usado fica registrado em cada adaptação (RN08); para trocar,
`ENTENDE_MODELO` no `.env`.

Com a Anthropic, os pedidos usam o **fallback do lado do servidor** (`fallbacks="default"`): se o
modelo principal recusar um trecho, o próprio serviço tenta o modelo reserva. Com a OpenAI, a
recusa vira erro explicado ao professor (422), como a resposta cortada por tamanho.

### Banco

Sem `ENTENDE_BANCO_URL`, o banco é um SQLite em `entende.db`, nesta pasta. Para PostgreSQL, basta
apontar a variável para ele; as tabelas são criadas na primeira partida.

### Testes e ferramentas

```
.venv\Scripts\python -m pytest                 # 130 testes, sem rede e sem custo
.venv\Scripts\python extrair.py material.pdf   # ver a extração de um arquivo real
.venv\Scripts\python medir.py material.md pasta 3   # adaptar de verdade 3 vezes e medir
```

`medir.py` usa a chave do `.env` e **gasta**: roda a adaptação e as questões como o servidor, sem
gravar no banco, e grava em `pasta/` o `relatorio.md` e o `medicao.json` com o texto adaptado, as
questões, as métricas e, por chamada, tokens, tempo e custo. O preço por token e o dólar estão
fixos no início do script, com a data da consulta: conferir antes de medir de novo. A primeira
medição (29/10/2026, texto de exemplo da demonstração, 231 palavras, 3 execuções) deu 2 chamadas
por execução, 46 a 52 s e US$ 0,035 a 0,039 cada (cerca de R$ 0,20); o relatório fica fora deste
repositório, em `TCC/Artigo/medicoes/`.

Os testes usam um cliente falso no lugar do modelo de linguagem (`testes/cliente_falso.py`), e
PDFs e DOCX gerados por código (`testes/amostras.py`) — nenhum arquivo de terceiros no repositório.

## Rotas

| Método e rota | O que faz | Requisito |
| --- | --- | --- |
| `POST /api/autenticacao/cadastro` · `/entrar` | Cria conta / entra; devolve o token | RF01 |
| `GET /api/autenticacao/eu` | Professor autenticado | RF01 |
| `POST /api/materiais` | Envia PDF ou DOCX; extrai e grava o texto | RF02–RF04 |
| `GET /api/materiais` | Lista, com estado da adaptação e da atividade | RF19 |
| `GET /api/materiais/{id}` | Material com o texto extraído | RF03 |
| `DELETE /api/materiais/{id}` | Exclusão definitiva, com tudo que dependia dele | RF20 |
| `GET /api/regras` | Catálogo das regras vigentes (público) | RF10 |
| `POST /api/materiais/{id}/adaptacoes` | Adapta; chamar de novo é reprocessar | RF05, RF06, RF12 |
| `GET /api/materiais/{id}/adaptacao` | Original, adaptado, regras por trecho, métricas | RF07, RF08, RF10 |
| `PUT /api/materiais/{id}/adaptacao/texto` | Edição do professor; volta a pedir aprovação | RF09 |
| `POST /api/materiais/{id}/adaptacao/aprovacao` | Aprova | RN02 |
| `GET` · `PUT /api/materiais/{id}/questoes` | Lê / substitui as questões | RF13, RF14, RF23 |
| `POST /api/materiais/{id}/questoes/geracao` | Gera de novo a partir do texto adaptado | RF13 |
| `POST` · `DELETE /api/materiais/{id}/atividade` | Publica (gera código) / revoga | RF15, RF18 |
| `GET /api/atividades/{código}` | Atividade da criança, sem conta | RF16, RF21, RF22 |

Todo erro sai no formato do `ErroDeNegocio` de `src/servicos/api.js`, e a interface mostra a
resposta sem traduzir nada:

```json
{ "erro": { "titulo": "...", "motivo": "...", "saida": "...", "regra": "RN09" } }
```

## Onde está cada coisa

```
regras/tea.json           Conjunto de regras TEA v1.7, com gatilhos e glossário — RNF13
app/
  principal.py            Monta a aplicação (criar_app)
  config.py               Variáveis ENTENDE_*, OPENAI_API_KEY e ANTHROPIC_API_KEY
  modelos.py              As classes do diagrama 02, em SQLAlchemy
  esquemas.py, apresentacao.py   Formato das respostas
  seguranca.py            Argon2id (RNF09) e token
  rotas/                  autenticacao, materiais, adaptacoes, atividades
  servicos/
    extrator.py           ExtratorConteudo — RF03, RN09, RNF08
    regras.py             Leitura do arquivo e registro da versão — RNF13, RN08
    cliente_llm.py        ClienteLLM — a única porta para o modelo de linguagem
    gatilhos.py           O que o código detecta antes de chamar o modelo
    motor.py              MotorAdaptacao — RF05, RF06; glossário (TEA-05)
    legibilidade.py       CalculadoraLegibilidade — RF07, RN10
    questoes.py           GeradorQuestoes — RF13, RN04
    processamento.py      A ordem do diagrama de sequência 03
    texto.py              Leitura e escrita do Markdown interno
```

## Como o motor funciona

O motor é **híbrido**: o código faz tudo o que uma regra do arquivo consegue fazer sozinha, e o
modelo de linguagem só reescreve o que exige entender a frase. Quem decide é o arquivo de regras,
não o modelo.

| Regra | Quem aplica | Como |
| --- | --- | --- |
| TEA-01 períodos curtos | modelo, se o código disparar | período com mais de 20 palavras |
| TEA-02 uma ideia por bloco | modelo, se o código disparar | parágrafo com mais de 3 frases |
| TEA-03 linguagem literal | modelo, se o código disparar | expressão da lista do arquivo; e em todo bloco que já vai ao modelo |
| TEA-04 voz ativa | modelo, se o código disparar | forma de "ser" + particípio ("é absorvida") |
| TEA-05 vocabulário explicado | **código** | glossário do arquivo, na primeira ocorrência |
| TEA-06 conectivos explícitos | modelo | junto com TEA-01 e TEA-02 |
| TEA-07 subtítulos | modelo, se o código disparar | mais de 120 palavras desde o último título |
| TEA-08, TEA-10 apresentação | folha impressa | `src/estilos/impressao.css` |
| TEA-09 antecipar a estrutura | **código** | lista dos títulos do texto adaptado |

1. **O código marca os blocos** (`servicos/gatilhos.py`): lê cada parágrafo e item e anota as
   regras que dispararam nele. Os limites (20 palavras, 3 frases, 120 palavras, a lista de
   expressões) estão no `tea.json`, no campo `gatilho` de cada regra — mudar um limite é editar o
   arquivo e trocar a versão, sem tocar no código (RNF13, RN08).
2. **Só vai ao modelo o que foi marcado.** O texto é dividido por seção (no máximo ~3.500
   caracteres por trecho); seção sem bloco marcado não gera pedido. Bloco não marcado fica igual
   ao original.
3. **Cada pedido pede só os blocos marcados**, cada um com as instruções das regras que
   dispararam nele — nunca um "adapte este texto" livre. O resto da seção vai como contexto e não
   volta na resposta. A resposta tem um **esquema JSON fixo** que diz quais regras cada bloco
   recebeu; é isso que vira o registro de RF06. O trecho de origem é o próprio bloco marcado, que
   o código já conhece — o modelo não precisa copiá-lo de volta.
4. **O código aplica o glossário (TEA-05)** e depois a **TEA-09**.
5. Se um pedido falha, **a adaptação inteira falha**. Não existe adaptação pela metade, pelo mesmo
   motivo da RN09. Bloco marcado que o modelo não devolve, ou devolve sem texto, **fica como
   estava no original** — o modelo não apaga conteúdo por omissão (RN01).

**De onde vem a economia.** Em relação ao motor anterior (v1.3), que mandava o material inteiro:
parágrafo sem nada a corrigir não é enviado; título, item e tabela não precisam ser devolvidos;
o modelo não copia mais o trecho de origem na resposta; o pedido leva só as instruções das regras
que dispararam; e o vocabulário saiu do modelo. Quanto se economiza depende do material: texto
simples deixa parágrafos inteiros de fora; texto de períodos longos, como o da demonstração (quatro
parágrafos de uma frase só, de quase 60 palavras cada), ainda vai inteiro — e deve ir.

**O gatilho é generoso de propósito.** Marcar a mais custa um pedido; marcar a menos deixa o
texto sem adaptar. A voz passiva, por exemplo, é detectada por padrão e também pega "é rápido":
o modelo recebe o bloco, não encontra passiva, não muda nada, e o registro fica vazio para ele.

## Decisões que não são detalhe

1. **O arquivo de regras é lido a cada adaptação.** Alterar uma regra vale no próximo
   processamento, sem reiniciar o servidor (RNF13). A versão é registrada no banco com a
   impressão digital SHA-256 do arquivo: **mudar o conteúdo sem mudar a versão é recusado** (RN08),
   senão adaptações antigas passariam a parecer feitas por regras que não eram as delas.
2. **Cada adaptação guarda o texto gerado e o texto editado, separados.** O que o motor produziu
   nunca é sobrescrito; editar depois de aprovar volta a pedir aprovação (RN02).
3. **RN04 é conferida, não só pedida.** Questão cujo trecho de origem não está no texto é
   descartada na geração.
4. **O arquivo enviado não é guardado — só o texto extraído.** Material com página só de imagem é
   recusado inteiro (RN09). O formato é decidido pelo conteúdo, não pela extensão.
5. **Material de outro professor responde 404, não 403** (RNF12). Entrar com e-mail inexistente e
   com senha errada dá a mesma resposta, no mesmo tempo. Depois de 5 senhas erradas seguidas para
   o mesmo e-mail, a entrada com ele fica bloqueada por até 15 minutos (429), exista a conta ou
   não, para o bloqueio também não revelar quais e-mails têm conta. A contagem fica em memória e
   não guarda IP; acertar a senha a zera. Os limites são `ENTENDE_TENTATIVAS_ENTRADA` e
   `ENTENDE_BLOQUEIO_ENTRADA_MINUTOS`.
6. **O material é dado, nunca instrução para o modelo.** O pedido põe o material entre marcadores
   (`<trecho>`, `<texto>`), e o prompt manda não seguir ordem que esteja lá dentro ("ignore as
   regras..."). Marcador escrito no próprio material é trocado por um sinal parecido, para o
   material não conseguir fechar o marcador e falar como se fosse o sistema. O resto da defesa é
   de arquitetura: o modelo não tem ferramenta nem acesso ao banco, o registro só aceita regra que
   o código marcou, e nada sai sem a aprovação do professor (RN02).
7. **Não existe tabela de estudante** (RN05, RNF11). A rota da criança devolve as questões com a
   resposta certa — a atividade é formativa, sem nota nem registro de resposta, e as duas telas da
   criança mostram a resposta certa depois de responder —, mas **não** devolve o trecho de origem,
   que é a frase da resposta. A dica vai no lugar dele.

## Limites conhecidos

- **As métricas não são o NILC-Metrix.** O servidor calcula o índice de Flesch adaptado ao
  português (Martins et al., 1996), palavras por frase, palavras longas e total de palavras, com
  contagem de sílabas heurística. O NILC-Metrix continua sendo o instrumento da verificação de
  RNF03 na validação do trabalho.
- **O glossário da TEA-05 cobre só os termos cadastrados.** Termo do conteúdo que não está no
  `tea.json` não é explicado. Os termos iniciais (Ciências do 5º ano) foram escritos pela dupla e
  precisam passar pela revisão das especialistas, como o resto do conjunto.
- **Metáfora fora da lista de expressões só é tratada se o bloco já for ao modelo** por outro
  motivo (TEA-03 acompanha qualquer regra). Uma frase curta, na voz ativa, com metáfora nova, passa
  sem adaptação.
- **A qualidade da reescrita não é medida pelos testes.** Os testes garantem que cada regra chega
  ao modelo e que o registro é feito; se o modelo reescreveu bem é a validação com especialistas
  (OE3).
- **A adaptação é síncrona**: o pedido volta quando termina, e a barra de progresso da interface
  avança em ritmo estimado. Cancelar na interface descarta o material.
- **PDF em duas colunas** sai com as colunas misturadas. **Tabela de PDF** sai como texto corrido;
  a de DOCX sai como tabela. **Caixa de texto do Word** não é lida. O nível dos títulos do PDF é
  **inferido** pelo tamanho da fonte e pelo negrito.
- **Trocar a metáfora pode deixar uma ressalva sem referente.** Na medição de 29/10, nas três
  execuções, "as florestas são o pulmão do mundo, expressão que [...] deve ser compreendida com
  cautela" virou uma afirmação literal seguida de "devemos compreendê-la com cautela". As métricas
  não pegam isso; é o que a revisão do professor (RN02) e a validação existem para pegar.
- **Falta passar material real do 5º ano** pelo extrator e pelo motor — `extrair.py` e `medir.py`
  existem para isso. Até aqui, só o texto de exemplo da demonstração foi adaptado de verdade.
- Sem ferramenta de migração: `create_all` cria tabela que falta, mas não altera tabela
  existente. Banco SQLite de desenvolvimento criado antes de 05/10/2026 precisa ser apagado.
- **HTTPS (RNF10)** depende de onde o servidor for publicado; localmente é HTTP. O bloqueio de
  entrada é por e-mail: quem souber o e-mail de um professor pode bloqueá-lo por 15 minutos
  errando a senha de propósito. É a troca aceita para não guardar IP.
