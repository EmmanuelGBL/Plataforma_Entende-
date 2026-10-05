"""Ponto de entrada da API do Entende+.

    uvicorn app.principal:app --reload --no-access-log

`--no-access-log` não é detalhe: o registro de acesso padrão do uvicorn grava o
IP de quem abre cada rota, inclusive a da atividade da criança. IP é dado
pessoal (LGPD), e RN05 diz que o sistema não registra nada que identifique o
estudante.

Documentação interativa em http://localhost:8000/docs enquanto o servidor roda.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .banco import Base, criar_fabrica, criar_motor
from .config import Configuracao
from .erros import ErroDeNegocio, tratar_erro_de_negocio, tratar_erro_de_validacao
from .rotas import adaptacoes, atividades, autenticacao, materiais
from .servicos.cliente_llm import ClienteClaude, ClienteLLM


def criar_app(configuracao: Configuracao | None = None, cliente_llm: ClienteLLM | None = None) -> FastAPI:
    config = configuracao or Configuracao()
    config.garantir_segredo()
    motor = criar_motor(config.banco_url)

    @asynccontextmanager
    async def ciclo_de_vida(_: FastAPI):
        # Cria as tabelas que faltam. Não altera tabela existente: quando o
        # modelo mudar (semana 7 em diante), entra uma ferramenta de migração.
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
    app.state.cliente_llm = cliente_llm or ClienteClaude(config.modelo, config.chave_api or None)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.lista_origens,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
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
