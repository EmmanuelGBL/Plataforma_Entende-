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
copy .env.exemplo .env          # preencha ENTENDE_SEGREDO_TOKEN e ANTHROPIC_API_KEY

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

### Chave da API do Claude

O motor de adaptação e o gerador de questões usam o modelo **Claude Opus 5** (`claude-opus-5`)
pela API da Anthropic. Sem `ANTHROPIC_API_KEY` no `.env`, conta, envio e extração funcionam, e
adaptar responde 503 com a explicação. Cada adaptação custa uma chamada por seção do material, e
mais uma para as questões. O modelo usado fica registrado em cada adaptação (RN08); para trocar,
`ENTENDE_MODELO` no `.env`.

Os pedidos usam o **fallback do lado do servidor** da Anthropic (`fallbacks="default"`): se o
modelo principal recusar um trecho, o próprio serviço tenta o modelo reserva recomendado para
aquele motivo.

### Banco

Sem `ENTENDE_BANCO_URL`, o banco é um SQLite em `entende.db`, nesta pasta. Para PostgreSQL, basta
apontar a variável para ele; as tabelas são criadas na primeira partida.

### Testes e ferramentas

```
.venv\Scripts\python -m pytest                 # 92 testes, sem rede e sem custo
.venv\Scripts\python extrair.py material.pdf   # ver a extração de um arquivo real
```

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
regras/tea.json           Conjunto de regras TEA v1.3 — RNF13
app/
  principal.py            Monta a aplicação (criar_app)
  config.py               Variáveis ENTENDE_* e ANTHROPIC_API_KEY
  modelos.py              As classes do diagrama 02, em SQLAlchemy
  esquemas.py, apresentacao.py   Formato das respostas
  seguranca.py            Argon2id (RNF09) e token
  rotas/                  autenticacao, materiais, adaptacoes, atividades
  servicos/
    extrator.py           ExtratorConteudo — RF03, RN09, RNF08
    regras.py             Leitura do arquivo e registro da versão — RNF13, RN08
    cliente_llm.py        ClienteLLM — a única porta para o modelo de linguagem
    motor.py              MotorAdaptacao — RF05, RF06
    legibilidade.py       CalculadoraLegibilidade — RF07, RN10
    questoes.py           GeradorQuestoes — RF13, RN04
    processamento.py      A ordem do diagrama de sequência 03
    texto.py              Leitura e escrita do Markdown interno
```

## Como o motor funciona

1. O texto extraído é dividido por seção (no máximo ~3.500 caracteres por trecho), e os trechos
   são adaptados **em paralelo**, para caber nos 120 s de RNF07.
2. Cada trecho vai ao modelo com as **instruções das regras do arquivo** — nunca um "adapte este
   texto" livre — e volta num **esquema JSON fixo**: cada bloco adaptado diz quais regras recebeu
   e de que trecho do original saiu. É isso que vira o registro de RF06.
3. **TEA-09** (antecipar a estrutura) é aplicada pelo código, a partir dos títulos do texto já
   adaptado. **TEA-08 e TEA-10** são de apresentação: valem na folha impressa, não no texto.
4. Se um trecho falha, **a adaptação inteira falha**. Não existe adaptação pela metade, pelo mesmo
   motivo da RN09.

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
   com senha errada dá a mesma resposta, no mesmo tempo.
6. **Não existe tabela de estudante** (RN05, RNF11). A rota da criança devolve as questões com a
   resposta certa — a atividade é formativa, sem nota nem registro de resposta, e as duas telas da
   criança mostram a resposta certa depois de responder —, mas **não** devolve o trecho de origem,
   que é a frase da resposta. A dica vai no lugar dele.

## Limites conhecidos

- **As métricas não são o NILC-Metrix.** O servidor calcula o índice de Flesch adaptado ao
  português (Martins et al., 1996), palavras por frase, palavras longas e total de palavras, com
  contagem de sílabas heurística. O NILC-Metrix continua sendo o instrumento da verificação de
  RNF03 na validação do trabalho.
- **A qualidade da reescrita não é medida pelos testes.** Os testes garantem que cada regra chega
  ao modelo e que o registro é feito; se o modelo reescreveu bem é a validação com especialistas
  (OE3).
- **A adaptação é síncrona**: o pedido volta quando termina, e a barra de progresso da interface
  avança em ritmo estimado. Cancelar na interface descarta o material.
- **PDF em duas colunas** sai com as colunas misturadas. **Tabela de PDF** sai como texto corrido;
  a de DOCX sai como tabela. **Caixa de texto do Word** não é lida. O nível dos títulos do PDF é
  **inferido** pelo tamanho da fonte e pelo negrito.
- **Falta passar material real do 5º ano** pelo extrator e pelo motor — `extrair.py` existe para
  isso.
- Sem ferramenta de migração: `create_all` cria tabela que falta, mas não altera tabela
  existente. Banco SQLite de desenvolvimento criado antes de 05/10/2026 precisa ser apagado.
- **HTTPS (RNF10)** depende de onde o servidor for publicado; localmente é HTTP. Sem limite de
  tentativas de entrada.
