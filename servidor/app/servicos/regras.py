"""ConjuntoRegras — leitura do arquivo de regras (RNF13) e registro da versão (RN08).

O arquivo é lido a cada adaptação, e não uma vez na partida do servidor: é o
que permite alterar uma regra e reprocessar o mesmo material sem novo deploy,
que é exatamente a verificação que o RNF13 descreve.
"""

import hashlib
from datetime import date
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..erros import ErroDeNegocio
from ..modelos import AplicacaoDaRegra, ConjuntoRegras, PerfilAdaptacao, RegraAdaptacao


class RegraDeclarada(BaseModel):
    codigo: str = Field(pattern=r"^[A-Z]+-\d{2}$")
    nome: str
    descricao: str
    base: str
    justificativa: str
    aplicacao: AplicacaoDaRegra
    instrucao: str | None = None


class ConjuntoDeclarado(BaseModel):
    identificador: PerfilAdaptacao
    versao: str
    publicado_em: date
    descricao: str
    regras: list[RegraDeclarada] = Field(min_length=1)

    def regras_do_modelo(self) -> list[RegraDeclarada]:
        return [r for r in self.regras if r.aplicacao is AplicacaoDaRegra.MODELO]


def carregar(caminho: Path) -> tuple[ConjuntoDeclarado, str]:
    """Lê e valida o arquivo. Devolve o conjunto e a impressão digital."""
    try:
        bruto = caminho.read_bytes()
        conjunto = ConjuntoDeclarado.model_validate_json(bruto)
    except (OSError, ValidationError) as erro:
        raise ErroDeNegocio(
            "O arquivo de regras de adaptação não pôde ser lido",
            f"Problema em {caminho.name}: {erro}".strip()[:600],
            "Corrija o arquivo de regras e tente de novo. Nenhum material foi alterado.",
            "RNF13",
            status=500,
        ) from None

    codigos = [r.codigo for r in conjunto.regras]
    if len(codigos) != len(set(codigos)):
        raise ErroDeNegocio(
            "O arquivo de regras tem códigos repetidos",
            f"Cada regra precisa de um código único em {caminho.name}.",
            "Corrija o arquivo de regras e tente de novo.",
            "RNF13",
            status=500,
        )
    faltando = [r.codigo for r in conjunto.regras_do_modelo() if not r.instrucao]
    if faltando:
        raise ErroDeNegocio(
            "Há regra sem instrução para o modelo",
            f"As regras {', '.join(faltando)} são aplicadas pelo modelo e não têm instrução.",
            "Acrescente o campo “instrucao” a essas regras no arquivo.",
            "RNF13",
            status=500,
        )
    return conjunto, hashlib.sha256(bruto).hexdigest()


def registrar(sessao: Session, conjunto: ConjuntoDeclarado, impressao: str) -> ConjuntoRegras:
    """Devolve o registro desta versão no banco, criando-o na primeira vez.

    Se a mesma versão já foi registrada com outro conteúdo, recusa: alguém
    alterou o arquivo sem trocar o número da versão, e as adaptações antigas
    passariam a parecer produzidas por regras que não eram as delas.
    """
    existente = sessao.scalar(
        select(ConjuntoRegras).where(
            ConjuntoRegras.perfil == conjunto.identificador,
            ConjuntoRegras.versao == conjunto.versao,
        )
    )
    if existente is not None:
        if existente.impressao_digital != impressao:
            raise ErroDeNegocio(
                "As regras mudaram sem mudar de versão",
                f"O arquivo de regras {conjunto.identificador.value} v{conjunto.versao} não é "
                "mais igual ao que foi usado nas adaptações anteriores com essa mesma versão.",
                "Aumente o número da versão no arquivo de regras (por exemplo, de 1.3 para 1.4) "
                "e processe de novo.",
                "RN08",
                status=409,
            )
        return existente

    registro = ConjuntoRegras(
        perfil=conjunto.identificador,
        versao=conjunto.versao,
        data_publicacao=conjunto.publicado_em,
        descricao=conjunto.descricao,
        impressao_digital=impressao,
        regras=[
            RegraAdaptacao(
                codigo=r.codigo,
                nome=r.nome,
                descricao=r.descricao,
                referencia_normativa=r.base,
                justificativa=r.justificativa,
                aplicacao=r.aplicacao,
                instrucao=r.instrucao,
            )
            for r in conjunto.regras
        ],
    )
    sessao.add(registro)
    sessao.flush()
    return registro
