"""Modelo de dados — projeção das classes Professor e Material do diagrama 02.

As demais classes do diagrama (Adaptacao, ConjuntoRegras, AplicacaoRegra,
MetricaLegibilidade, Questao, Alternativa, AtividadePublicada) entram junto com
os requisitos que as exigem, a partir do motor de adaptação (semana 7).

O que NÃO existe aqui, por decisão de projeto:

- Tabela de estudante (RN05, RNF11). O estudante acessa a atividade por link,
  sem cadastro, e o sistema não guarda nada que o identifique.
- O arquivo enviado. Só o texto extraído é guardado. O reprocessamento de RF12
  precisa do texto, não do PDF, e guardar o arquivo seria reter mais do que a
  finalidade exige — e o material é responsabilidade autoral do professor (RN07).
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .banco import Base


def agora() -> datetime:
    return datetime.now(timezone.utc)


class FormatoArquivo(str, enum.Enum):
    PDF = "PDF"
    DOCX = "DOCX"


class PerfilAdaptacao(str, enum.Enum):
    # RN03 — perfil único nesta versão. TDAH e dislexia são trabalhos futuros.
    TEA = "TEA"


class EtapaEscolar(str, enum.Enum):
    ANOS_INICIAIS_5_ANO = "ANOS_INICIAIS_5_ANO"


class Professor(Base):
    __tablename__ = "professor"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    # RNF09 — Argon2id: o sal é gerado por senha e vai dentro do próprio hash.
    senha_hash: Mapped[str] = mapped_column(String(255))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    materiais: Mapped[list["Material"]] = relationship(
        back_populates="professor", cascade="all, delete-orphan", passive_deletes=True
    )


class Material(Base):
    __tablename__ = "material"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # RNF12 — toda consulta a material filtra por esta coluna.
    professor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("professor.id", ondelete="CASCADE"), index=True
    )
    nome_arquivo: Mapped[str] = mapped_column(String(255))
    formato: Mapped[FormatoArquivo] = mapped_column(Enum(FormatoArquivo, native_enum=False))
    numero_paginas: Mapped[int] = mapped_column(Integer)
    # DOCX não traz número de páginas confiável: quando o Word não gravou a
    # contagem no arquivo, ela é estimada pelo volume de texto, e isso fica dito.
    paginas_estimadas: Mapped[bool] = mapped_column(default=False)
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    # Texto em Markdown simples: "#" marca o nível do título (RF03 — hierarquia).
    texto_extraido: Mapped[str] = mapped_column(Text)
    perfil: Mapped[PerfilAdaptacao] = mapped_column(
        Enum(PerfilAdaptacao, native_enum=False), default=PerfilAdaptacao.TEA
    )
    etapa_escolar: Mapped[EtapaEscolar] = mapped_column(
        Enum(EtapaEscolar, native_enum=False), default=EtapaEscolar.ANOS_INICIAIS_5_ANO
    )
    data_envio: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    professor: Mapped[Professor] = relationship(back_populates="materiais")
