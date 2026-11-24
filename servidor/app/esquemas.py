"""Formato das requisições e respostas da API."""

import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field


def _em_utc(valor: datetime) -> datetime:
    # O SQLite devolve data e hora sem fuso; a resposta acrescenta UTC.
    return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)


DataHora = Annotated[datetime, AfterValidator(_em_utc)]

from .modelos import EtapaEscolar, FormatoArquivo, PerfilAdaptacao


class NovaConta(BaseModel):
    """Dados de uma conta de professor, na criação e na edição (RF24)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    cota: int = Field(ge=1, le=100_000_000)


class SenhaDaConta(BaseModel):
    """Senha escolhida pelo administrador na tela Contas. Sem ela, é aleatória."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nova_senha: str | None = Field(default=None, min_length=8, max_length=128)


class CriacaoDeConta(NovaConta, SenhaDaConta):
    """Conta nova pela tela Contas."""


class Entrada(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=128)


class ProfessorPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    email: str
    # RF25 — uso da cota, mostrado no painel.
    cota_tokens: int
    tokens_consumidos: int
    administrador: bool


class ContaPublica(ProfessorPublico):
    """Uma conta na tela Contas. Dos materiais, só a quantidade: o conteúdo é do
    professor (RNF12)."""

    ativo: bool
    criado_em: DataHora
    quantidade_materiais: int


class ContaComSenha(BaseModel):
    """A senha em texto claro só existe nesta resposta (RNF09)."""

    conta: ContaPublica
    senha: str


class Sessao(BaseModel):
    token: str
    tipo: str = "bearer"
    expira_em: DataHora
    professor: ProfessorPublico


class MaterialResumo(BaseModel):
    """O que aparece na lista do painel (RF19)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome_arquivo: str
    formato: FormatoArquivo
    numero_paginas: int
    paginas_estimadas: bool
    perfil: PerfilAdaptacao
    etapa_escolar: EtapaEscolar
    data_envio: DataHora


class MaterialDetalhe(MaterialResumo):
    tamanho_bytes: int
    texto_extraido: str


# --- Estado resumido do material, para o painel (RF19) -----------------------

class AtividadeEstado(BaseModel):
    estado: str  # "rascunho" | "publicada" | "revogada"
    codigo: str | None = None
    data_publicacao: DataHora | None = None
    data_revogacao: DataHora | None = None


class MaterialPainel(MaterialResumo):
    estado: str  # "enviado" | "gerada" | "em_revisao" | "aprovada"
    versao_regras: str | None = None
    atividade: AtividadeEstado


# --- Regras (RF06, RF10) ------------------------------------------------------

class RegraPublica(BaseModel):
    codigo: str
    nome: str
    descricao: str
    base: str
    justificativa: str
    aplicacao: str


class ConjuntoPublico(BaseModel):
    perfil: str
    versao: str
    data_publicacao: date
    descricao: str
    regras: list[RegraPublica]


# --- Adaptação (RF05–RF10) ----------------------------------------------------

class BlocoTexto(BaseModel):
    tipo: str
    nivel: int
    texto: str
    regras: list[str]


class AplicacaoPublica(BaseModel):
    regra: str
    trecho_original: str
    trecho_resultante: str


class MetricaPublica(BaseModel):
    codigo: str
    nome: str
    original: float
    adaptado: float
    situacao: str  # "melhora" | "piora" | "igual" | "atencao"
    leitura: str


class AdaptacaoDetalhe(BaseModel):
    id: uuid.UUID
    material_id: uuid.UUID
    status: str
    modelo: str
    editada: bool
    data_geracao: DataHora
    data_aprovacao: DataHora | None
    conjunto: ConjuntoPublico
    blocos_original: list[BlocoTexto]
    texto_adaptado: str
    blocos: list[BlocoTexto]
    aplicacoes: list[AplicacaoPublica]
    ocorrencias: dict[str, int]
    metricas: list[MetricaPublica]
    nivel_original: str
    nivel_adaptado: str


class EdicaoTexto(BaseModel):
    texto: str = Field(min_length=1, max_length=200_000)


# --- Questões e atividade (RF13–RF18, RF23) -----------------------------------

class QuestaoEntrada(BaseModel):
    enunciado: str = Field(min_length=1, max_length=1000)
    alternativas: list[str] = Field(min_length=2, max_length=5)
    correta: int = Field(ge=0)
    trecho: str = ""
    dica: str = ""


class QuestaoProfessor(QuestaoEntrada):
    id: uuid.UUID


class QuestaoEstudante(BaseModel):
    """Vai com a resposta certa: a atividade é formativa, sem nota nem registro
        de resposta (RN05), e as telas do estudante mostram a resposta depois que
        ele responde (RF17).
    """

    id: uuid.UUID
    enunciado: str
    alternativas: list[str]
    correta: int
    # Sem o trecho de origem, que é a frase da resposta. A dica vai no lugar.
    dica: str


class AtividadeEstudante(BaseModel):
    codigo: str
    titulo: str
    questoes: list[QuestaoEstudante]
