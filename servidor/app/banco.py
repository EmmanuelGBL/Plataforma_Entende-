"""Conexão com o banco. O mesmo código roda em SQLite e em PostgreSQL;
muda só ENTENDE_BANCO_URL.
"""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine, event
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


def criar_fabrica(motor: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


def obter_sessao(request: Request) -> Iterator[Session]:
    with request.app.state.fabrica_sessao() as sessao:
        yield sessao
