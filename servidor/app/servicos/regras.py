"""ConjuntoRegras — leitura do arquivo de regras (RNF13) e registro da versão (RN08).

O arquivo é lido a cada adaptação, então alterar uma regra vale no próximo
processamento sem reiniciar o servidor. Gatilhos e glossário entram na
impressão digital: mudar qualquer um deles exige trocar a versão.
"""

import hashlib
from datetime import date
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..erros import ErroDeNegocio
from ..modelos import AplicacaoDaRegra, ConjuntoRegras, PerfilAdaptacao, RegraAdaptacao


class Gatilho(BaseModel):
    """Quando um bloco do material precisa desta regra (ver gatilhos.py).

        Regra do modelo sem gatilho vale para todo parágrafo e item.
    """

    model_config = ConfigDict(extra="forbid")

    palavras_por_frase_acima_de: int | None = Field(default=None, ge=1)
    frases_por_paragrafo_acima_de: int | None = Field(default=None, ge=1)
    palavras_sem_titulo_acima_de: int | None = Field(default=None, ge=1)
    voz_passiva: bool = False
    expressoes: list[str] = []
    # Regras que entram junto quando estas já foram disparadas no bloco
    # ("*" = qualquer uma).
    acompanha: list[str] = []


class RegraDeclarada(BaseModel):
    codigo: str = Field(pattern=r"^[A-Z]+-\d{2}$")
    nome: str
    descricao: str
    base: str
    justificativa: str
    aplicacao: AplicacaoDaRegra
    instrucao: str | None = None
    gatilho: Gatilho | None = None
    glossario: dict[str, str] | None = None


class ConjuntoDeclarado(BaseModel):
    identificador: PerfilAdaptacao
    versao: str
    publicado_em: date
    descricao: str
    regras: list[RegraDeclarada] = Field(min_length=1)

    def regras_do_modelo(self) -> list[RegraDeclarada]:
        return [r for r in self.regras if r.aplicacao is AplicacaoDaRegra.MODELO]

    def regras_de(self, aplicacao: AplicacaoDaRegra) -> list[RegraDeclarada]:
        return [r for r in self.regras if r.aplicacao is aplicacao]


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
    sem_glossario = [
        r.codigo for r in conjunto.regras_de(AplicacaoDaRegra.GLOSSARIO) if not r.glossario
    ]
    if sem_glossario:
        raise ErroDeNegocio(
            "Há regra de glossário sem termos",
            f"As regras {', '.join(sem_glossario)} são aplicadas pelo glossário e não têm termos.",
            "Acrescente o campo “glossario” a essas regras no arquivo.",
            "RNF13",
            status=500,
        )
    do_modelo = {r.codigo for r in conjunto.regras_do_modelo()}
    acompanha_desconhecida = [
        r.codigo
        for r in conjunto.regras_do_modelo()
        if r.gatilho and any(c != "*" and c not in do_modelo for c in r.gatilho.acompanha)
    ]
    if acompanha_desconhecida:
        raise ErroDeNegocio(
            "Há regra que acompanha uma regra inexistente",
            f"O campo “acompanha” das regras {', '.join(acompanha_desconhecida)} cita "
            "código que não é regra do modelo neste arquivo.",
            "Corrija o campo “acompanha” no arquivo de regras.",
            "RNF13",
            status=500,
        )
    return conjunto, hashlib.sha256(bruto).hexdigest()


def registrar(sessao: Session, conjunto: ConjuntoDeclarado, impressao: str) -> ConjuntoRegras:
    """Devolve o registro desta versão no banco, criando-o na primeira vez.

        Se a mesma versão já existe com outro conteúdo, recusa (RN08).
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
