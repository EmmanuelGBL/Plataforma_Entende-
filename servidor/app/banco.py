"""Conexão com o banco. O mesmo código roda em SQLite e em PostgreSQL;
muda só ENTENDE_BANCO_URL.
"""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def criar_motor(url: str) -> Engine:
    argumentos = {"check_same_thread": False} if url.startswith("sqlite") else {}
    motor = create_engine(url, connect_args=argumentos)
    if url.startswith("sqlite"):
        # Liga as chaves estrangeiras no SQLite, para a exclusão apagar também
        # os dependentes (RF20).
        @event.listens_for(motor, "connect")
        def _ligar_chaves_estrangeiras(conexao, _):
            cursor = conexao.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return motor


# Colunas acrescentadas depois que já havia banco em uso: create_all cria
# tabela que falta, mas não altera tabela existente.
COLUNAS_NOVAS = {
    "professor": {
        "ativo": "BOOLEAN NOT NULL DEFAULT TRUE",
        "cota_tokens": "INTEGER NOT NULL DEFAULT 0",
        "tokens_consumidos": "INTEGER NOT NULL DEFAULT 0",
        "administrador": "BOOLEAN NOT NULL DEFAULT FALSE",
        "versao_sessao": "INTEGER NOT NULL DEFAULT 0",
    },
}


def preparar_banco(motor: Engine) -> None:
    """Cria as tabelas que faltam e acrescenta as COLUNAS_NOVAS."""
    Base.metadata.create_all(motor)
    inspetor = inspect(motor)
    with motor.begin() as conexao:
        for tabela, colunas in COLUNAS_NOVAS.items():
            existentes = {c["name"] for c in inspetor.get_columns(tabela)}
            for coluna, tipo in colunas.items():
                if coluna not in existentes:
                    conexao.execute(text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipo}"))


def criar_fabrica(motor: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


def obter_sessao(request: Request) -> Iterator[Session]:
    with request.app.state.fabrica_sessao() as sessao:
        yield sessao
