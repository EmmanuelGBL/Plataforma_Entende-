# Entende+ — servidor

API em Python (FastAPI) do Entende+. Começou em 05/10/2026 com a entrega da semana 6 do
cronograma: **conta do professor, envio de material e extração de texto** (RF01 a RF03).

Este repositório é **público**. Senha de banco e segredo do token vão no `.env`, que não é
versionado — nunca no código.

## Rodar

Python 3.11 ou mais recente. No PowerShell, dentro desta pasta:

```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
copy .env.exemplo .env          # e preencha ENTENDE_SEGREDO_TOKEN

.venv\Scripts\python -m uvicorn app.principal:app --reload
```

A API sobe em `http://localhost:8000`, e a documentação interativa — onde dá para criar conta e
enviar arquivo pelo navegador — fica em **`http://localhost:8000/docs`**.

Sem `ENTENDE_BANCO_URL`, o banco é um SQLite em `entende.db`, nesta pasta. Para PostgreSQL, basta
apontar a variável para ele; as tabelas são criadas na primeira partida.

```
.venv\Scripts\python -m pytest              # testes
.venv\Scripts\python extrair.py material.pdf  # ver a extração de um arquivo real, sem servidor
```

## Rotas

| Método e rota | O que faz | Requisito |
| --- | --- | --- |
| `POST /api/autenticacao/cadastro` | Cria a conta e já devolve o token | RF01 |
| `POST /api/autenticacao/entrar` | Devolve o token | RF01 |
| `GET /api/autenticacao/eu` | Professor autenticado | RF01 |
| `POST /api/materiais` | Envia PDF ou DOCX; extrai e grava o texto | RF02, RF03, RF04 |
| `GET /api/materiais` | Lista os materiais do professor | RF19 |
| `GET /api/materiais/{id}` | Material com o texto extraído | RF03 |
| `DELETE /api/materiais/{id}` | Exclusão definitiva | RF20 |

O token vai no cabeçalho `Authorization: Bearer <token>` e vale 8 horas.

Todo erro sai no mesmo formato do `ErroDeNegocio` de `src/servicos/api.js` — o front-end mostra a
resposta sem traduzir nada:

```json
{ "erro": { "titulo": "...", "motivo": "...", "saida": "...", "regra": "RN09" } }
```

## Onde está cada coisa

```
app/
  principal.py         Monta a aplicação (criar_app) — CORS, erros, rotas
  config.py            Variáveis ENTENDE_*; limites de RNF08
  banco.py, modelos.py SQLAlchemy; Professor e Material do diagrama de classes
  seguranca.py         Argon2id (RNF09) e token JWT
  erros.py             ErroDeNegocio
  rotas/               autenticacao.py, materiais.py
  servicos/extrator.py ExtratorConteudo — RF03, RN09, RNF08
testes/
  amostras.py          PDFs e DOCX de teste gerados por código
```

## Decisões que não são detalhe

1. **O arquivo enviado não é guardado — só o texto extraído.** É o que o motor de adaptação e o
   reprocessamento (RF12) precisam. Guardar o PDF seria reter mais do que a finalidade exige.
2. **Material com página só de imagem é recusado inteiro** (RN09), com o número das páginas no
   motivo. Não existe adaptação parcial.
3. **O formato é decidido pelo conteúdo, não pela extensão.** Imagem renomeada para `.pdf` e `.doc`
   antigo recebem a explicação certa.
4. **Material de outro professor responde 404, não 403** (RNF12): a resposta não confirma que o
   identificador existe.
5. **Entrar com e-mail inexistente e com senha errada dá a mesma resposta, no mesmo tempo.** A tela
   de entrada não revela quem tem conta.
6. **Não existe tabela de estudante** (RN05, RNF11), e não vai existir.

## Limites conhecidos

- **PDF em duas colunas** sai na ordem das linhas da página, misturando as colunas.
- **Tabela de PDF** sai como texto corrido (a de DOCX sai como tabela). **Caixa de texto do Word**
  não é lida.
- O nível dos títulos do PDF é **inferido** pelo tamanho da fonte e pelo negrito, porque o PDF não
  guarda o que é título. Os testes usam PDFs gerados por código; **falta passar material real de
  5º ano** — é o critério de pronto da semana 6, e é para isso que existe o `extrair.py`.
- Sem ferramenta de migração: `create_all` cria tabela que falta, mas não altera tabela existente.
  Entra junto com as tabelas do motor (semana 7).
- **HTTPS (RNF10)** depende de onde o servidor for publicado; localmente é HTTP.
- Sem limite de tentativas de entrada.
