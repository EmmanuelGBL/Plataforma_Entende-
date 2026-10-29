"""Ponto de entrada da API do Entende+.

    uvicorn app.principal:app --reload --no-access-log

`--no-access-log`: o registro de acesso padrão do uvicorn grava o IP de quem
abre cada rota, inclusive a da atividade do estudante, e o sistema não
registra dado que identifique o estudante (RN05).

Documentação interativa em http://localhost:8000/docs.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .banco import Base, criar_fabrica, criar_motor
from .config import Configuracao
from .erros import ErroDeNegocio, tratar_erro_de_negocio, tratar_erro_de_validacao
from .rotas import adaptacoes, atividades, autenticacao, materiais
from .seguranca import LimiteDeTentativas
from .servicos.cliente_llm import ClienteLLM, criar_cliente


def _configurar_registro() -> None:
    # Liga as mensagens do sistema no terminal (o uvicorn só configura as dele).
    registro = logging.getLogger("entende")
    if not registro.handlers:
        saida = logging.StreamHandler()
        saida.setFormatter(logging.Formatter("%(levelname)s:     [entende] %(message)s"))
        registro.addHandler(saida)
        registro.setLevel(logging.INFO)


def criar_app(configuracao: Configuracao | None = None, cliente_llm: ClienteLLM | None = None) -> FastAPI:
    _configurar_registro()
    config = configuracao or Configuracao()
    config.garantir_segredo()
    motor = criar_motor(config.banco_url)

    @asynccontextmanager
    async def ciclo_de_vida(_: FastAPI):
        # Cria as tabelas que faltam. Não altera tabela existente.
        Base.metadata.create_all(motor)
        yield
        motor.dispose()

    app = FastAPI(
        title="Entende+ — API",
        description="Adaptação de material didático para estudantes com autismo do 5º ano.",
        version="0.1.0",
        lifespan=ciclo_de_vida,
    )
    app.state.configuracao = config
    app.state.fabrica_sessao = criar_fabrica(motor)
    app.state.cliente_llm = cliente_llm or criar_cliente(
        config.provedor, config.modelo, config.chave_openai, config.chave_api
    )
    app.state.limite_entrada = LimiteDeTentativas(config.tentativas_entrada, config.bloqueio_entrada_minutos * 60)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.lista_origens,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        # Apresentação pelo GitHub Pages com o servidor no próprio computador:
        # o navegador pergunta antes se a página pública pode falar com a rede
        # local (Private Network Access). Só as origens acima recebem o sim.
        allow_private_network=True,
    )

    app.add_exception_handler(ErroDeNegocio, tratar_erro_de_negocio)
    app.add_exception_handler(RequestValidationError, tratar_erro_de_validacao)

    app.include_router(autenticacao.rotas)
    app.include_router(materiais.rotas)
    app.include_router(adaptacoes.rotas)
    app.include_router(atividades.rotas)

    @app.get("/api/saude", tags=["Infraestrutura"])
    def saude():
        return {"situacao": "ok"}

    return app


app = criar_app()
