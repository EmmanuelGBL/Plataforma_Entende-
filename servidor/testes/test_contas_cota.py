"""Contas administradas no servidor (RF24, RN12) e cota de tokens por professor
(RF25, RN13). Um teste, pelo menos, por critério de aceite dos dois."""

import sqlite3

import pytest
from sqlalchemy import func, select

from administrar import principal
from app.banco import criar_fabrica, criar_motor, preparar_banco
from app.modelos import Adaptacao, Material, Professor
from app.servicos import contas
from app.servicos.cliente_llm import ClienteClaude, ClienteGPT

from . import amostras
from .cliente_falso import ClienteFalso
from .conftest import SENHA, cadastrar
from .test_cliente_llm import ESQUEMA, SimpleNamespace, _gpt, _mensagem, _texto

PDF = "application/pdf"
EMAIL = "ana@escola.am.gov.br"


def _entrar(cliente, senha=SENHA, email=EMAIL):
    return cliente.post("/api/autenticacao/entrar", json={"email": email, "senha": senha})


def _enviar(cliente, cabecalho) -> str:
    resposta = cliente.post(
        "/api/materiais", headers=cabecalho, files={"arquivo": ("ciencias.pdf", amostras.pdf_didatico(), PDF)}
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()["id"]


def _adaptar(cliente, cabecalho, material_id):
    return cliente.post(f"/api/materiais/{material_id}/adaptacoes", headers=cabecalho)


def _consumo(cliente, email=EMAIL) -> int:
    with cliente.app.state.fabrica_sessao() as sessao:
        return contas.buscar(sessao, email).tokens_consumidos


def _contar(cliente, modelo) -> int:
    with cliente.app.state.fabrica_sessao() as sessao:
        return sessao.scalar(select(func.count()).select_from(modelo))


def _esgotar(cliente, email=EMAIL) -> None:
    with cliente.app.state.fabrica_sessao() as sessao:
        professor = contas.buscar(sessao, email)
        professor.tokens_consumidos = professor.cota_tokens
        sessao.commit()


@pytest.fixture
def comando(cliente, capsys):
    """Roda o administrar.py no banco do cliente de teste."""

    def rodar(*argumentos):
        codigo = principal(list(argumentos), cliente.app.state.configuracao)
        saida = capsys.readouterr()
        return codigo, saida.out, saida.err

    return rodar


def _senha_mostrada(saida: str) -> str:
    (linha,) = [l for l in saida.splitlines() if l.startswith("Senha:")]
    return linha.split()[-1]


# --- RF24 -----------------------------------------------------------------------

def test_rf24_ca01_rota_de_cadastro_recusa_e_nao_cria_conta(cliente):
    resposta = cliente.post(
        "/api/autenticacao/cadastro", json={"nome": "Intruso", "email": "x@x.com", "senha": "senha-forte-123"}
    )
    assert resposta.status_code in (404, 405)
    assert _contar(cliente, Professor) == 0


def test_rf24_ca02_criar_mostra_senha_aleatoria_uma_vez_e_grava_so_o_hash(cliente, comando):
    codigo, saida, _ = comando("criar", "Ana Souza", "Ana@Escola.am.gov.br", "40000")
    senha = _senha_mostrada(saida)
    assert codigo == 0
    assert len(senha) >= 12
    assert saida.count(senha) == 1

    with cliente.app.state.fabrica_sessao() as sessao:
        professor = contas.buscar(sessao, EMAIL)
    assert professor.senha_hash.startswith("$argon2id$")
    assert senha not in professor.senha_hash
    assert (professor.nome, professor.cota_tokens, professor.ativo) == ("Ana Souza", 40_000, True)
    assert _entrar(cliente, senha).status_code == 200

    _, outra, _ = comando("criar", "Bia Lima", "bia@escola.am.gov.br", "40000")
    assert _senha_mostrada(outra) != senha


def test_rf24_criar_recusa_email_repetido_invalido_e_cota_zero(cliente, comando):
    comando("criar", "Ana Souza", EMAIL, "40000")
    codigo, saida, erro = comando("criar", "Outra", EMAIL.upper(), "40000")
    assert codigo == 1 and "Já existe" in erro and "Senha" not in saida
    codigo, _, erro = comando("criar", "Ana Souza", "sem-arroba", "40000")
    assert codigo == 1 and "email" in erro
    with pytest.raises(SystemExit):
        comando("criar", "Ana Souza", "c@escola.am.gov.br", "0")
    assert _contar(cliente, Professor) == 1


def test_rf24_ca03_conta_desativada_nao_entra_e_mantem_os_materiais(cliente, comando):
    cabecalho = cadastrar(cliente)
    _enviar(cliente, cabecalho)
    assert comando("desativar", EMAIL)[0] == 0

    recusa = _entrar(cliente)
    assert recusa.status_code == 403
    assert recusa.json()["erro"]["titulo"] == "Esta conta foi desativada"
    # A sessão que estava aberta também cai.
    assert cliente.get("/api/materiais", headers=cabecalho).status_code == 401
    assert _contar(cliente, Material) == 1


def test_rf24_senha_errada_nao_revela_que_a_conta_foi_desativada(cliente, comando):
    cadastrar(cliente)
    comando("desativar", EMAIL)
    sem_conta = _entrar(cliente, "errada-000", email="ninguem@escola.am.gov.br")
    errada = _entrar(cliente, "errada-000")
    assert errada.status_code == 401
    assert errada.json() == sem_conta.json()


def test_rf24_redefinir_senha_troca_a_senha(cliente, comando):
    cadastrar(cliente)
    codigo, saida, _ = comando("redefinir-senha", EMAIL)
    nova = _senha_mostrada(saida)
    assert codigo == 0 and len(nova) >= 12
    assert _entrar(cliente).status_code == 401
    assert _entrar(cliente, nova).status_code == 200


def test_rf24_comando_com_email_desconhecido_avisa(comando):
    for argumentos in (("desativar", EMAIL), ("redefinir-senha", EMAIL), ("cota", EMAIL, "10")):
        codigo, _, erro = comando(*argumentos)
        assert codigo == 1 and "Não existe conta" in erro


def test_rf24_listar_mostra_consumo_e_nunca_a_senha(cliente, comando):
    cadastrar(cliente, cota=40_000)
    _, saida, _ = comando("listar")
    assert "0 de 40.000 tokens" in saida and EMAIL in saida
    assert SENHA not in saida and "argon2" not in saida


# --- RF25 e RN13 ------------------------------------------------------------------

def test_rf25_ca01_cada_chamada_soma_ao_professor_que_a_originou(cliente):
    ana, bruno = cadastrar(cliente), cadastrar(cliente, "bruno@escola.am.gov.br")
    material_id = _enviar(cliente, ana)
    assert _adaptar(cliente, ana, material_id).status_code == 201

    chamadas = cliente.app.state.cliente_llm.chamadas
    assert len(chamadas) >= 2  # adaptação e questões
    assert _consumo(cliente) == len(chamadas) * ClienteFalso.TOKENS
    assert _consumo(cliente, "bruno@escola.am.gov.br") == 0

    cliente.post(f"/api/materiais/{material_id}/questoes/geracao", headers=ana)
    assert _consumo(cliente) == len(chamadas) * ClienteFalso.TOKENS
    eu = cliente.get("/api/autenticacao/eu", headers=ana).json()
    assert eu["tokens_consumidos"] == _consumo(cliente)
    assert cliente.get("/api/autenticacao/eu", headers=bruno).json()["tokens_consumidos"] == 0


def test_rf25_ca01_operacao_que_falha_tambem_conta(fabrica_cliente):
    cliente = fabrica_cliente(ClienteFalso(falhar_em="adaptacao"))
    cabecalho = cadastrar(cliente)
    material_id = _enviar(cliente, cabecalho)
    assert _adaptar(cliente, cabecalho, material_id).status_code == 503
    chamadas = cliente.app.state.cliente_llm.chamadas
    assert chamadas and _consumo(cliente) == len(chamadas) * ClienteFalso.TOKENS
    assert _contar(cliente, Adaptacao) == 0


def test_rf25_ca02_cota_esgotada_recusa_sem_chamar_o_modelo(cliente):
    cabecalho = cadastrar(cliente)
    adaptado, novo = _enviar(cliente, cabecalho), _enviar(cliente, cabecalho)
    _adaptar(cliente, cabecalho, adaptado)
    _esgotar(cliente)
    antes = len(cliente.app.state.cliente_llm.chamadas)

    recusas = [
        _adaptar(cliente, cabecalho, novo),  # adaptação
        _adaptar(cliente, cabecalho, adaptado),  # reprocessamento (RF12)
        cliente.post(f"/api/materiais/{adaptado}/questoes/geracao", headers=cabecalho),  # RF13
    ]
    for recusa in recusas:
        assert recusa.status_code == 403
        erro = recusa.json()["erro"]
        assert erro["regra"] == "RN13"
        assert erro["motivo"] and erro["saida"]
    assert len(cliente.app.state.cliente_llm.chamadas) == antes
    assert _contar(cliente, Adaptacao) == 1


def test_rf25_ca03_com_cota_esgotada_o_resto_continua(cliente):
    cabecalho = cadastrar(cliente)
    material_id = _enviar(cliente, cabecalho)
    texto = _adaptar(cliente, cabecalho, material_id).json()["texto_adaptado"]
    _esgotar(cliente)
    base = f"/api/materiais/{material_id}"

    assert cliente.get("/api/materiais", headers=cabecalho).status_code == 200
    assert cliente.get(f"{base}/adaptacao", headers=cabecalho).status_code == 200
    assert cliente.put(f"{base}/adaptacao/texto", headers=cabecalho, json={"texto": texto}).status_code == 200
    assert cliente.post(f"{base}/adaptacao/aprovacao", headers=cabecalho).status_code == 200
    assert cliente.get(f"{base}/questoes", headers=cabecalho).status_code == 200
    publicada = cliente.post(f"{base}/atividade", headers=cabecalho)
    assert publicada.status_code == 200
    assert cliente.get(f"/api/atividades/{publicada.json()['codigo']}").status_code == 200
    assert cliente.delete(f"{base}/atividade", headers=cabecalho).status_code == 200


def test_rn13_a_ultima_operacao_pode_ultrapassar_a_cota(cliente):
    cabecalho = cadastrar(cliente, cota=1)
    material_id = _enviar(cliente, cabecalho)
    assert _adaptar(cliente, cabecalho, material_id).status_code == 201
    assert _consumo(cliente) > 1
    assert _adaptar(cliente, cabecalho, material_id).status_code == 403


def test_rn13_aumentar_a_cota_libera_de_novo(cliente, comando):
    cabecalho = cadastrar(cliente, cota=1)
    material_id = _enviar(cliente, cabecalho)
    _adaptar(cliente, cabecalho, material_id)
    assert comando("cota", EMAIL, "40000")[0] == 0
    assert _adaptar(cliente, cabecalho, material_id).status_code == 201


# --- Consumo informado pelos clientes do modelo -------------------------------------

def test_gpt_informa_o_consumo_mesmo_quando_a_resposta_vem_cortada():
    resposta = _mensagem(_texto("{"), status="incomplete", motivo="max_output_tokens")
    resposta.usage = SimpleNamespace(input_tokens=1200, output_tokens=800)
    cliente, _ = _gpt(resposta)
    assert isinstance(cliente, ClienteGPT)
    consumos = []
    with pytest.raises(Exception):
        cliente.gerar_json("questoes", "regras", "texto", ESQUEMA, ao_consumir=consumos.append)
    assert [c.total for c in consumos] == [2000]


def test_claude_informa_o_consumo_com_os_tokens_de_cache():
    resposta = SimpleNamespace(
        stop_reason="end_turn",
        content=[SimpleNamespace(type="text", text='{"questoes": []}')],
        usage=SimpleNamespace(
            input_tokens=100, cache_read_input_tokens=30, cache_creation_input_tokens=20, output_tokens=50
        ),
    )

    class _Fluxo:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def get_final_message(self):
            return resposta

    cliente = ClienteClaude("claude-teste", "chave-de-teste")
    cliente._cliente = SimpleNamespace(
        beta=SimpleNamespace(messages=SimpleNamespace(stream=lambda **_: _Fluxo()))
    )
    consumos = []
    assert cliente.gerar_json("q", "s", "c", ESQUEMA, ao_consumir=consumos.append) == {"questoes": []}
    assert [c.total for c in consumos] == [200]


# --- Banco que já existia -------------------------------------------------------------

def test_banco_antigo_ganha_as_colunas_sem_perder_a_conta(tmp_path):
    arquivo = tmp_path / "antigo.db"
    with sqlite3.connect(arquivo) as conexao:
        conexao.execute(
            "CREATE TABLE professor (id CHAR(32) PRIMARY KEY, nome VARCHAR(120) NOT NULL, "
            "email VARCHAR(254) NOT NULL, senha_hash VARCHAR(255) NOT NULL, criado_em DATETIME NOT NULL)"
        )
        conexao.execute(
            "INSERT INTO professor VALUES (?, 'Ana', ?, 'hash', '2026-10-29 12:00:00')", ("a" * 32, EMAIL)
        )
    conexao.close()

    motor = criar_motor(f"sqlite:///{arquivo.as_posix()}")
    preparar_banco(motor)
    preparar_banco(motor)  # repetir não quebra
    with criar_fabrica(motor)() as sessao:
        professor = contas.buscar(sessao, EMAIL)
        assert (professor.ativo, professor.cota_tokens, professor.tokens_consumidos) == (True, 0, 0)
    motor.dispose()
