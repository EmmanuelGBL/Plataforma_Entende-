"""Tela Contas: só administrador entra, o administrador não vê o conteúdo dos
professores e não consegue trancar outro administrador para fora."""

import uuid

import pytest


from administrar import principal
from app.modelos import (
    Adaptacao,
    Alternativa,
    AplicacaoRegra,
    AtividadePublicada,
    Material,
    MetricaLegibilidade,
    Professor,
    Questao,
)
from app.servicos import contas

from .conftest import SENHA, cadastrar
from .test_contas_cota import EMAIL, _adaptar, _contar, _entrar, _enviar

URL = "/api/administracao/contas"
ADMIN = "dupla@entende.com.br"
NOVA = {"nome": "Bia Lima", "email": "Bia@Escola.am.gov.br", "cota": 40_000}


@pytest.fixture
def admin(cliente) -> dict:
    cabecalho = cadastrar(cliente, ADMIN)
    with cliente.app.state.fabrica_sessao() as sessao:
        contas.definir_administrador(sessao, contas.por_email(sessao, ADMIN), True)
    return cabecalho


def _id(cliente, email=EMAIL) -> str:
    with cliente.app.state.fabrica_sessao() as sessao:
        return str(contas.por_email(sessao, email).id)


def _rotas(conta_id) -> list[tuple]:
    return [
        ("GET", URL, None),
        ("POST", URL, NOVA),
        ("PUT", f"{URL}/{conta_id}", NOVA),
        ("POST", f"{URL}/{conta_id}/senha", None),
        ("POST", f"{URL}/{conta_id}/desativacao", None),
        ("POST", f"{URL}/{conta_id}/reativacao", None),
        ("DELETE", f"{URL}/{conta_id}", None),
    ]


# --- Quem entra -----------------------------------------------------------------

def test_professor_comum_e_visitante_sao_recusados_em_todas_as_rotas(cliente):
    ana = cadastrar(cliente)
    cadastrar(cliente, "bruno@escola.am.gov.br")
    alvo = _id(cliente, "bruno@escola.am.gov.br")
    for metodo, url, corpo in _rotas(alvo):
        assert cliente.request(metodo, url, json=corpo, headers=ana).status_code == 403, (metodo, url)
        assert cliente.request(metodo, url, json=corpo).status_code == 401, (metodo, url)
    assert _contar(cliente, Professor) == 2
    assert _entrar(cliente, email="bruno@escola.am.gov.br").status_code == 200


def test_perder_o_papel_de_administrador_vale_na_hora(cliente, admin):
    assert cliente.get(URL, headers=admin).status_code == 200
    principal(["remover-admin", ADMIN], cliente.app.state.configuracao)
    assert cliente.get(URL, headers=admin).status_code == 403


def test_tornar_admin_so_pelo_comando(cliente, admin):
    cadastrar(cliente)
    corpo = {**NOVA, "administrador": True}
    criada = cliente.post(URL, headers=admin, json=corpo).json()["conta"]
    editada = cliente.put(f"{URL}/{_id(cliente)}", headers=admin, json={**corpo, "email": EMAIL}).json()
    assert criada["administrador"] is False and editada["administrador"] is False

    assert principal(["tornar-admin", EMAIL], cliente.app.state.configuracao) == 0
    assert _entrar(cliente).json()["professor"]["administrador"] is True


# --- Criar, ler, editar, excluir ----------------------------------------------------

def test_criar_devolve_senha_uma_vez_e_a_conta_entra(cliente, admin):
    resposta = cliente.post(URL, headers=admin, json=NOVA)
    assert resposta.status_code == 201
    assert resposta.headers["cache-control"] == "no-store"
    corpo = resposta.json()
    assert len(corpo["senha"]) >= 12
    assert corpo["conta"]["email"] == "bia@escola.am.gov.br"
    assert _entrar(cliente, corpo["senha"], "bia@escola.am.gov.br").status_code == 200

    lista = cliente.get(URL, headers=admin)
    assert corpo["senha"] not in lista.text and "argon2" not in lista.text


def test_criar_recusa_email_repetido_e_dados_invalidos(cliente, admin):
    cliente.post(URL, headers=admin, json=NOVA)
    assert cliente.post(URL, headers=admin, json=NOVA).status_code == 409
    for ruim in ({"cota": 0}, {"cota": "abc"}, {"email": "sem-arroba"}, {"nome": ""}):
        resposta = cliente.post(URL, headers=admin, json={**NOVA, "email": "c@x.com", **ruim})
        assert resposta.status_code == 422, ruim
        assert resposta.json()["erro"]["motivo"]
    assert _contar(cliente, Professor) == 2


def test_lista_mostra_consumo_e_quantidade_mas_nao_o_conteudo(cliente, admin):
    ana = cadastrar(cliente)
    _adaptar(cliente, ana, _enviar(cliente, ana))
    resposta = cliente.get(URL, headers=admin)
    conta = next(c for c in resposta.json() if c["email"] == EMAIL)
    assert conta["quantidade_materiais"] == 1
    assert conta["tokens_consumidos"] > 0
    assert "fotoss" not in resposta.text.lower() and "ciencias.pdf" not in resposta.text


def test_administrador_nao_abre_material_de_professor(cliente, admin):
    ana = cadastrar(cliente)
    material_id = _enviar(cliente, ana)
    assert cliente.get(f"/api/materiais/{material_id}", headers=admin).status_code == 404


def test_editar_muda_nome_email_e_cota(cliente, admin):
    cadastrar(cliente)
    cadastrar(cliente, "bruno@escola.am.gov.br")
    url = f"{URL}/{_id(cliente)}"
    editada = cliente.put(url, headers=admin, json={"nome": "Ana Dias", "email": "dias@x.com", "cota": 60_000}).json()
    assert (editada["nome"], editada["email"], editada["cota_tokens"]) == ("Ana Dias", "dias@x.com", 60_000)
    assert _entrar(cliente, email="dias@x.com").status_code == 200
    repetido = cliente.put(url, headers=admin, json={"nome": "Ana", "email": "bruno@escola.am.gov.br", "cota": 1})
    assert repetido.status_code == 409


def test_redefinir_senha_derruba_a_sessao_aberta(cliente, admin):
    ana = cadastrar(cliente)
    nova = cliente.post(f"{URL}/{_id(cliente)}/senha", headers=admin)
    assert nova.headers["cache-control"] == "no-store"
    assert cliente.get("/api/materiais", headers=ana).status_code == 401
    assert _entrar(cliente).status_code == 401
    assert _entrar(cliente, nova.json()["senha"]).status_code == 200


def test_administrador_escolhe_a_senha(cliente, admin, caplog):
    caplog.set_level("DEBUG")
    email = "bia@escola.am.gov.br"
    criada = cliente.post(URL, headers=admin, json={**NOVA, "nova_senha": "  biologia2026 "}).json()
    assert criada["senha"] == "biologia2026"
    entrada = _entrar(cliente, "biologia2026", email)
    assert entrada.status_code == 200

    bia = {"Authorization": f"Bearer {entrada.json()['token']}"}
    url = f"{URL}/{criada['conta']['id']}/senha"
    assert cliente.post(url, headers=admin, json={"nova_senha": "historia2026"}).json()["senha"] == "historia2026"
    assert cliente.get("/api/materiais", headers=bia).status_code == 401
    assert _entrar(cliente, "biologia2026", email).status_code == 401
    assert _entrar(cliente, "historia2026", email).status_code == 200
    with cliente.app.state.fabrica_sessao() as sessao:
        assert contas.por_email(sessao, email).senha_hash.startswith("$argon2")
    registros = "".join(r.getMessage() for r in caplog.records if r.name == "entende")
    assert "biologia2026" not in registros and "historia2026" not in registros


def test_senha_escolhida_curta_e_recusada_sem_aparecer_na_resposta(cliente, admin):
    for ruim in ("abc1234", "        ", ""):
        resposta = cliente.post(URL, headers=admin, json={**NOVA, "nova_senha": ruim})
        assert resposta.status_code == 422
        assert "entre 8 e 128" in resposta.json()["erro"]["motivo"]
        assert "abc1234" not in resposta.text
    cadastrar(cliente)
    url = f"{URL}/{_id(cliente)}/senha"
    assert cliente.post(url, headers=admin, json={"nova_senha": "curta"}).status_code == 422
    assert _entrar(cliente).status_code == 200


def test_senha_de_administrador_nao_e_escolhida_pela_web(cliente, admin):
    url = f"{URL}/{_id(cliente, ADMIN)}/senha"
    assert cliente.post(url, headers=admin, json={"nova_senha": "qualquer2026"}).status_code == 409
    assert _entrar(cliente, SENHA, ADMIN).status_code == 200


def test_desativar_e_reativar(cliente, admin):
    ana = cadastrar(cliente)
    _enviar(cliente, ana)
    url = f"{URL}/{_id(cliente)}"
    assert cliente.post(f"{url}/desativacao", headers=admin).json()["ativo"] is False
    assert _entrar(cliente).status_code == 403
    assert cliente.post(f"{url}/reativacao", headers=admin).json()["ativo"] is True
    # A senha continua a mesma; a sessão de antes não volta.
    assert cliente.get("/api/materiais", headers=ana).status_code == 401
    assert _entrar(cliente).status_code == 200
    assert _contar(cliente, Material) == 1


def test_excluir_apaga_tudo_do_professor_e_nada_dos_outros(cliente, admin):
    ana, bruno = cadastrar(cliente), cadastrar(cliente, "bruno@escola.am.gov.br")
    codigos = []
    for dono in (ana, bruno):
        material_id = _enviar(cliente, dono)
        _adaptar(cliente, dono, material_id)
        cliente.post(f"/api/materiais/{material_id}/adaptacao/aprovacao", headers=dono)
        codigos.append(cliente.post(f"/api/materiais/{material_id}/atividade", headers=dono).json()["codigo"])
    tabelas = (Material, Adaptacao, AplicacaoRegra, MetricaLegibilidade, Questao, Alternativa, AtividadePublicada)
    antes = {t: _contar(cliente, t) for t in tabelas}

    assert cliente.delete(f"{URL}/{_id(cliente)}", headers=admin).status_code == 204
    assert {t: _contar(cliente, t) * 2 for t in tabelas} == antes
    assert cliente.get("/api/materiais", headers=ana).status_code == 401
    assert _entrar(cliente).status_code == 401
    assert cliente.get(f"/api/atividades/{codigos[0]}").status_code == 404
    assert cliente.get(f"/api/atividades/{codigos[1]}").status_code == 200


def test_conta_que_nao_existe(cliente, admin):
    for metodo, url, corpo in _rotas(uuid.uuid4())[2:]:
        assert cliente.request(metodo, url, json=corpo, headers=admin).status_code == 404, (metodo, url)


# --- Ninguém tranca a dupla para fora ---------------------------------------------------

def test_conta_de_administrador_nao_e_derrubada_pela_web(cliente, admin):
    outro = cadastrar(cliente, "hugo@entende.com.br")
    principal(["tornar-admin", "hugo@entende.com.br"], cliente.app.state.configuracao)
    for email in (ADMIN, "hugo@entende.com.br"):
        url = f"{URL}/{_id(cliente, email)}"
        for metodo, caminho in (
            ("POST", f"{url}/senha"), ("POST", f"{url}/desativacao"), ("POST", f"{url}/reativacao"), ("DELETE", url)
        ):
            assert cliente.request(metodo, caminho, headers=admin).status_code == 409, (email, metodo)
        troca = cliente.put(url, headers=admin, json={"nome": "X Y", "email": "outro@x.com", "cota": 10})
        assert troca.status_code == 409
        assert _entrar(cliente, SENHA, email).status_code == 200
        # Nome e cota podem mudar.
        ok = cliente.put(url, headers=admin, json={"nome": "Nome Novo", "email": email, "cota": 70_000})
        assert ok.json()["cota_tokens"] == 70_000
    assert cliente.get(URL, headers=outro).status_code == 200


def test_comando_reativar(cliente):
    cadastrar(cliente)
    config = cliente.app.state.configuracao
    principal(["desativar", EMAIL], config)
    assert principal(["reativar", EMAIL], config) == 0
    assert _entrar(cliente).status_code == 200


def test_log_da_administracao_nao_traz_dado_pessoal(cliente, admin, caplog):
    with caplog.at_level("INFO", logger="entende"):
        senha = cliente.post(URL, headers=admin, json=NOVA).json()["senha"]
    registro = caplog.text.lower()
    assert "administração: criação" in registro
    for proibido in (senha.lower(), "bia", "@"):
        assert proibido not in registro


