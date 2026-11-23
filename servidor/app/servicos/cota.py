"""Cota de tokens por professor (RF25, RN13).

`cliente_do_professor` é o único caminho das rotas até o modelo de linguagem:
confere a cota e devolve um cliente que soma cada chamada ao consumo do
professor. A conferência é feita no começo da operação, e não a cada chamada,
então a última operação pode ultrapassar a cota (RN13).
"""

import uuid

from sqlalchemy import update
from sqlalchemy.orm import Session, sessionmaker

from ..erros import ErroDeNegocio
from ..modelos import Professor
from .cliente_llm import AoConsumir, ClienteLLM, Consumo


class ClienteComCota:
    """Repassa as chamadas ao cliente do servidor e grava o consumo de cada uma."""

    def __init__(self, cliente: ClienteLLM, fabrica: sessionmaker[Session], professor_id: uuid.UUID):
        self._cliente = cliente
        self._fabrica = fabrica
        self._professor_id = professor_id
        self.modelo = cliente.modelo

    def gerar_json(
        self, tarefa: str, sistema: str, conteudo: str, esquema: dict, ao_consumir: AoConsumir | None = None
    ) -> dict:
        def registrar(consumo: Consumo) -> None:
            self._somar(consumo.total)
            if ao_consumir is not None:
                ao_consumir(consumo)

        return self._cliente.gerar_json(tarefa, sistema, conteudo, esquema, ao_consumir=registrar)

    def _somar(self, tokens: int) -> None:
        # Sessão própria: se a adaptação falhar no meio, o que já foi gasto
        # continua contado. A soma é feita no banco, para chamadas simultâneas
        # não se sobrescreverem.
        with self._fabrica() as sessao:
            sessao.execute(
                update(Professor)
                .where(Professor.id == self._professor_id)
                .values(tokens_consumidos=Professor.tokens_consumidos + tokens)
            )
            sessao.commit()


def cliente_do_professor(estado, professor: Professor) -> ClienteLLM:
    """`estado` é o app.state: o cliente do servidor e a fábrica de sessões."""
    if professor.tokens_consumidos >= professor.cota_tokens:
        raise ErroDeNegocio(
            "Sua cota de adaptação acabou",
            "Cada conta tem um limite de uso do modelo de linguagem, e o da sua já foi atingido. "
            "O pedido não foi executado.",
            "Você ainda pode consultar, editar, aprovar, exportar e publicar o que já foi "
            "adaptado. Para adaptar mais, fale com quem enviou o seu acesso.",
            "RN13",
            status=403,
        )
    return ClienteComCota(estado.cliente_llm, estado.fabrica_sessao, professor.id)
