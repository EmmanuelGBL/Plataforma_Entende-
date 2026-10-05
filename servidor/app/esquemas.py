"""Formato das requisições e respostas da API."""

import uuid
from datetime import datetime

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
