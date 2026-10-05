"""Erro de negócio com motivo legível e saída sugerida.

É o mesmo formato do `ErroDeNegocio` de src/servicos/api.js — título, motivo,
saída e regra —, para que o front-end mostre a resposta do servidor sem
traduzir nada. Heurística H9: o professor precisa saber o que aconteceu e o
que fazer a seguir, e não receber um código de status.
"""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ErroDeNegocio(Exception):
    def __init__(
        self,
        titulo: str,
        motivo: str = "",
        saida: str = "",
        regra: str | None = None,
        status: int = 422,
    ):
        super().__init__(titulo)
        self.titulo = titulo
        self.motivo = motivo
        self.saida = saida
        self.regra = regra
        self.status = status

    def corpo(self) -> dict:
        return {
            "erro": {
                "titulo": self.titulo,
                "motivo": self.motivo,
                "saida": self.saida,
                "regra": self.regra,
            }
        }


async def tratar_erro_de_negocio(_: Request, erro: ErroDeNegocio) -> JSONResponse:
    cabecalhos = {"WWW-Authenticate": "Bearer"} if erro.status == 401 else None
    return JSONResponse(erro.corpo(), status_code=erro.status, headers=cabecalhos)


EXPLICACAO_CAMPOS = {
    "email": "o e-mail precisa estar num formato válido, como nome@escola.com",
    "senha": "a senha precisa ter entre 8 e 128 caracteres",
    "nome": "o nome precisa ter entre 2 e 120 caracteres",
    "arquivo": "é preciso anexar um arquivo",
}


async def tratar_erro_de_validacao(_: Request, erro: RequestValidationError) -> JSONResponse:
    explicacoes = []
    for detalhe in erro.errors():
        campo = str(detalhe.get("loc", ["", "?"])[-1])
        texto = EXPLICACAO_CAMPOS.get(campo, f"o campo “{campo}” não foi aceito")
        if texto not in explicacoes:
            explicacoes.append(texto)
    motivo = "; ".join(explicacoes)
    resposta = ErroDeNegocio(
        "Alguns dados não foram aceitos",
        motivo[0].upper() + motivo[1:] + ".",
        "Corrija o que foi indicado e envie de novo.",
    )
    return JSONResponse(resposta.corpo(), status_code=422)
