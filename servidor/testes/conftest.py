import shutil

import pytest
from fastapi.testclient import TestClient

from app.config import PASTA_SERVIDOR, Configuracao
from app.esquemas import NovaConta
from app.principal import criar_app
from app.servicos import contas

from .cliente_falso import ClienteFalso

ARQUIVO_REGRAS = PASTA_SERVIDOR / "regras" / "tea.json"
SENHA = "senha-forte-123"


def _cliente(tmp_path, cliente_llm=None, **ajustes) -> TestClient:
    # Cópia do arquivo de regras: os testes de RNF13 alteram a cópia, nunca o
    # arquivo do projeto.
    regras = tmp_path / "tea.json"
    if not regras.exists():
        shutil.copy(ARQUIVO_REGRAS, regras)
    config = Configuracao(
        banco_url=f"sqlite:///{(tmp_path / 'teste.db').as_posix()}",
        segredo_token="segredo-apenas-para-teste-com-32-bytes-ou-mais",
        caminho_regras=regras,
        **ajustes,
    )
    return TestClient(criar_app(config, cliente_llm or ClienteFalso()))


@pytest.fixture
def cliente(tmp_path):
    with _cliente(tmp_path) as c:
        yield c


@pytest.fixture
def cliente_limite_1mb(tmp_path):
    with _cliente(tmp_path, limite_megabytes=1) as c:
        yield c


@pytest.fixture
def fabrica_cliente(tmp_path):
    """Para o teste que precisa escolher o cliente de modelo de linguagem."""
    abertos = []

    def criar(cliente_llm):
        c = _cliente(tmp_path, cliente_llm).__enter__()
        abertos.append(c)
        return c

    yield criar
    for c in abertos:
        c.__exit__(None, None, None)


def cadastrar(cliente: TestClient, email: str = "ana@escola.am.gov.br", cota: int = 1_000_000) -> dict:
    """Cria a conta como a administração (RF24) e devolve o cabeçalho de autorização."""
    with cliente.app.state.fabrica_sessao() as sessao:
        contas.criar(sessao, NovaConta(nome="Ana Professora", email=email, cota=cota), SENHA)
    resposta = cliente.post("/api/autenticacao/entrar", json={"email": email, "senha": SENHA})
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['token']}"}
