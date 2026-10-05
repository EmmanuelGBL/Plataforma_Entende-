"""Formato das requisições e respostas da API."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .modelos import EtapaEscolar, FormatoArquivo, PerfilAdaptacao


class Cadastro(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=128)


class Entrada(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=128)


class ProfessorPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    email: str


class Sessao(BaseModel):
    token: str
    tipo: str = "bearer"
    expira_em: datetime
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
    data_envio: datetime


class MaterialDetalhe(MaterialResumo):
    tamanho_bytes: int
    texto_extraido: str


# --- Estado resumido do material, para o painel (RF19) -----------------------

class AtividadeEstado(BaseModel):
    estado: str  # "rascunho" | "publicada" | "revogada"
    codigo: str | None = None
    data_publicacao: datetime | None = None
    data_revogacao: datetime | None = None


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
    data_geracao: datetime
    data_aprovacao: datetime | None
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
    """Vai com a resposta certa. A atividade é formativa: não há nota, ranking
    nem registro de resposta (RN05, G06), e as duas telas da criança mostram a
    resposta certa depois de responder (RF17). Esconder o gabarito no servidor
    obrigaria cada clique a esperar a rede, sem proteger nada que importe."""

    id: uuid.UUID
    enunciado: str
    alternativas: list[str]
    correta: int
    # Sem o trecho de origem: ele é a frase que contém a resposta. A dica
    # diz onde procurar sem entregar (G11).
    dica: str


class AtividadeEstudante(BaseModel):
    codigo: str
    titulo: str
    questoes: list[QuestaoEstudante]
