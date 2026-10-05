"""RF01, RF02, RF19, RF20 pela API; verificações de RNF09 e RNF12 como o
requisitos.md as descreve ("inspeção do esquema do banco" e "teste de acesso
cruzado entre duas contas")."""

from sqlalchemy import select

from app.modelos import Material, Professor

from . import amostras
from .conftest import cadastrar

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _enviar(cliente, cabecalho, conteudo=None, nome="ciencias.pdf", tipo=PDF):
    conteudo = amostras.pdf_didatico() if conteudo is None else conteudo
    return cliente.post("/api/materiais", headers=cabecalho, files={"arquivo": (nome, conteudo, tipo)})


# --- RF01 — conta -----------------------------------------------------------

def test_cadastro_devolve_token_e_professor(cliente):
    resposta = cliente.post(
        "/api/autenticacao/cadastro",
        json={"nome": "Ana", "email": "Ana@Escola.am.gov.br", "senha": "senha-forte-123"},
    )
    corpo = resposta.json()
    assert resposta.status_code == 201
    assert corpo["token"]
    assert corpo["professor"]["email"] == "ana@escola.am.gov.br"
    assert set(corpo["professor"]) == {"id", "nome", "email"}  # nada de hash na resposta


def test_email_repetido_e_recusado_sem_diferenca_de_caixa(cliente):
    cadastrar(cliente, "ana@escola.am.gov.br")
    resposta = cliente.post(
        "/api/autenticacao/cadastro",
        json={"nome": "Outra", "email": "ANA@escola.am.gov.br", "senha": "outra-senha-456"},
    )
    assert resposta.status_code == 409
    assert resposta.json()["erro"]["titulo"] == "Já existe uma conta com este e-mail"


def test_senha_curta_e_recusada_com_motivo_legivel(cliente):
    resposta = cliente.post(
        "/api/autenticacao/cadastro", json={"nome": "Ana", "email": "ana@x.com", "senha": "123"}
    )
    assert resposta.status_code == 422
    assert "entre 8 e 128 caracteres" in resposta.json()["erro"]["motivo"]


def test_entrar_com_senha_certa(cliente):
    cadastrar(cliente)
    resposta = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": "ana@escola.am.gov.br", "senha": "senha-forte-123"},
    )
    assert resposta.status_code == 200
    eu = cliente.get(
        "/api/autenticacao/eu", headers={"Authorization": f"Bearer {resposta.json()['token']}"}
    )
    assert eu.json()["nome"] == "Ana Professora"


def test_senha_errada_e_email_inexistente_tem_a_mesma_resposta(cliente):
    cadastrar(cliente)
    senha_errada = cliente.post(
        "/api/autenticacao/entrar", json={"email": "ana@escola.am.gov.br", "senha": "errada-000"}
    )
    sem_conta = cliente.post(
        "/api/autenticacao/entrar", json={"email": "ninguem@escola.am.gov.br", "senha": "errada-000"}
    )
    assert senha_errada.status_code == sem_conta.status_code == 401
    assert senha_errada.json() == sem_conta.json()


def test_rota_protegida_sem_token_ou_com_token_falso(cliente):
    assert cliente.get("/api/materiais").status_code == 401
    falso = cliente.get("/api/materiais", headers={"Authorization": "Bearer nao-e-um-token"})
    assert falso.status_code == 401
    assert falso.json()["erro"]["saida"].startswith("Entre de novo")


def test_rnf09_senha_gravada_so_como_hash_argon2(cliente):
    cadastrar(cliente)
    with cliente.app.state.fabrica_sessao() as sessao:
        professor = sessao.scalar(select(Professor))
    assert professor.senha_hash.startswith("$argon2id$")
    assert "senha-forte-123" not in professor.senha_hash


# --- RF02, RF03, RF04 — envio ----------------------------------------------

def test_envio_de_pdf_extrai_texto_e_registra_perfil_e_etapa(cliente):
    resposta = _enviar(cliente, cadastrar(cliente))
    corpo = resposta.json()

    assert resposta.status_code == 201, resposta.text
    assert corpo["formato"] == "PDF"
    assert corpo["numero_paginas"] == 2
    assert corpo["perfil"] == "TEA"
    assert corpo["etapa_escolar"] == "ANOS_INICIAIS_5_ANO"
    assert corpo["texto_extraido"].startswith("# Capítulo 3 - A fotossíntese")


def test_envio_de_docx(cliente):
    resposta = _enviar(cliente, cadastrar(cliente), amostras.docx_didatico(), "ciencias.docx", DOCX)
    assert resposta.status_code == 201, resposta.text
    assert resposta.json()["formato"] == "DOCX"


def test_rn09_material_recusado_nao_e_gravado(cliente):
    cabecalho = cadastrar(cliente)
    resposta = _enviar(cliente, cabecalho, amostras.pdf_paginas_de_imagem([True, False]), "misto.pdf")

    assert resposta.status_code == 422
    assert resposta.json()["erro"]["regra"] == "RN09"
    assert cliente.get("/api/materiais", headers=cabecalho).json() == []


def test_rnf08_arquivo_acima_do_limite_de_tamanho(cliente_limite_1mb):
    cabecalho = cadastrar(cliente_limite_1mb)
    grande = b"%PDF-1.7\n" + b"0" * (1024 * 1024 + 10)
    resposta = _enviar(cliente_limite_1mb, cabecalho, grande, "grande.pdf")

    assert resposta.status_code == 413
    assert resposta.json()["erro"]["regra"] == "RNF08"


# --- RF19, RF20 — histórico e exclusão -------------------------------------

def test_lista_consulta_e_exclusao_definitiva(cliente):
    cabecalho = cadastrar(cliente)
    material_id = _enviar(cliente, cabecalho).json()["id"]

    lista = cliente.get("/api/materiais", headers=cabecalho).json()
    assert [m["id"] for m in lista] == [material_id]
    assert "texto_extraido" not in lista[0]

    assert cliente.get(f"/api/materiais/{material_id}", headers=cabecalho).status_code == 200
    assert cliente.delete(f"/api/materiais/{material_id}", headers=cabecalho).status_code == 204
    assert cliente.get(f"/api/materiais/{material_id}", headers=cabecalho).status_code == 404

    with cliente.app.state.fabrica_sessao() as sessao:
        assert sessao.scalar(select(Material)) is None


# --- RNF12 — acesso cruzado entre duas contas -------------------------------

def test_rnf12_professor_nao_ve_nem_exclui_material_de_outro(cliente):
    ana = cadastrar(cliente, "ana@escola.am.gov.br")
    bruno = cadastrar(cliente, "bruno@escola.am.gov.br")
    material_da_ana = _enviar(cliente, ana).json()["id"]

    assert cliente.get("/api/materiais", headers=bruno).json() == []
    assert cliente.get(f"/api/materiais/{material_da_ana}", headers=bruno).status_code == 404
    assert cliente.delete(f"/api/materiais/{material_da_ana}", headers=bruno).status_code == 404
    # e o material continua lá para a dona
    assert cliente.get(f"/api/materiais/{material_da_ana}", headers=ana).status_code == 200
