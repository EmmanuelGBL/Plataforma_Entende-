import pytest
from fastapi.testclient import TestClient

from app.config import Configuracao
from app.principal import criar_app


def _cliente(tmp_path, **ajustes) -> TestClient:
    config = Configuracao(
        banco_url=f"sqlite:///{(tmp_path / 'teste.db').as_posix()}",
        segredo_token="segredo-apenas-para-teste-com-32-bytes-ou-mais",
        **ajustes,
    )
    return TestClient(criar_app(config))


@pytest.fixture
def cliente(tmp_path):
    with _cliente(tmp_path) as c:
        yield c


@pytest.fixture
def cliente_limite_1mb(tmp_path):
    with _cliente(tmp_path, limite_megabytes=1) as c:
        yield c


def cadastrar(cliente: TestClient, email: str = "ana@escola.am.gov.br") -> dict:
    """Cria conta e devolve o cabeçalho de autorização."""
    resposta = cliente.post(
        "/api/autenticacao/cadastro",
        json={"nome": "Ana Professora", "email": email, "senha": "senha-forte-123"},
    )
    assert resposta.status_code == 201, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['token']}"}
