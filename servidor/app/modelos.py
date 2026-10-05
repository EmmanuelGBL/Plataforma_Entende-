"""Modelo de dados — projeção das classes do diagrama 02 (Diagramas/fonte/02-classes.puml).

O que NÃO existe aqui, por decisão de projeto:

- Tabela de estudante (RN05, RNF11). O estudante acessa a atividade por link,
  sem cadastro, e o sistema não guarda nada que o identifique — nem as
  respostas que ele dá, que são conferidas e esquecidas.
- O arquivo enviado. Só o texto extraído é guardado. O reprocessamento de RF12
  precisa do texto, não do PDF, e guardar o arquivo seria reter mais do que a
  finalidade exige — e o material é responsabilidade autoral do professor (RN07).
"""

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
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
    adaptacoes: Mapped[list["Adaptacao"]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Adaptacao.data_geracao",
    )
    questoes: Mapped[list["Questao"]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Questao.ordem",
    )
    atividades: Mapped[list["AtividadePublicada"]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AtividadePublicada.data_publicacao",
    )

    @property
    def adaptacao_atual(self) -> "Adaptacao | None":
        # RF12: reprocessar cria uma adaptação nova; vale a mais recente, e as
        # anteriores ficam como registro do que cada versão das regras produziu.
        return self.adaptacoes[-1] if self.adaptacoes else None

    @property
    def atividade_atual(self) -> "AtividadePublicada | None":
        return self.atividades[-1] if self.atividades else None


# ---------------------------------------------------------------------------
# Regras de adaptação (RF06, RN08, RNF13)
# ---------------------------------------------------------------------------

class AplicacaoDaRegra(str, enum.Enum):
    MODELO = "modelo"  # o modelo de linguagem reescreve seguindo a instrução da regra
    ESTRUTURA = "estrutura"  # aplicada pelo próprio código (TEA-09)
    APRESENTACAO = "apresentacao"  # aplicada na formatação da folha (TEA-08, TEA-10)


class ConjuntoRegras(Base):
    """Cópia, no banco, da versão do arquivo de regras que uma adaptação usou.

    O arquivo (regras/tea.json) é a fonte; esta tabela é o registro. Mesmo que
    o arquivo mude depois, a adaptação continua apontando para as regras exatas
    que a produziram (RN08). A impressão digital (SHA-256 do arquivo) impede
    que o conteúdo mude sem que a versão mude junto.
    """

    __tablename__ = "conjunto_regras"
    __table_args__ = (UniqueConstraint("perfil", "versao"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    perfil: Mapped[PerfilAdaptacao] = mapped_column(Enum(PerfilAdaptacao, native_enum=False))
    versao: Mapped[str] = mapped_column(String(20))
    data_publicacao: Mapped[date] = mapped_column(Date)
    descricao: Mapped[str] = mapped_column(Text)
    impressao_digital: Mapped[str] = mapped_column(String(64), unique=True)
    registrado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    regras: Mapped[list["RegraAdaptacao"]] = relationship(
        back_populates="conjunto", cascade="all, delete-orphan", order_by="RegraAdaptacao.codigo"
    )


class RegraAdaptacao(Base):
    __tablename__ = "regra_adaptacao"
    __table_args__ = (UniqueConstraint("conjunto_id", "codigo"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    conjunto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conjunto_regras.id"), index=True)
    codigo: Mapped[str] = mapped_column(String(20))
    nome: Mapped[str] = mapped_column(String(120))
    descricao: Mapped[str] = mapped_column(Text)
    referencia_normativa: Mapped[str] = mapped_column(String(255))
    justificativa: Mapped[str] = mapped_column(Text)
    aplicacao: Mapped[AplicacaoDaRegra] = mapped_column(Enum(AplicacaoDaRegra, native_enum=False))
    instrucao: Mapped[str | None] = mapped_column(Text, nullable=True)

    conjunto: Mapped[ConjuntoRegras] = relationship(back_populates="regras")


# ---------------------------------------------------------------------------
# Adaptação (RF05–RF10)
# ---------------------------------------------------------------------------

class StatusAdaptacao(str, enum.Enum):
    GERADA = "GERADA"
    EM_REVISAO = "EM_REVISAO"  # o professor editou o texto (RF09)
    APROVADA = "APROVADA"  # só daqui em diante exporta e publica (RN02)


class Adaptacao(Base):
    __tablename__ = "adaptacao"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("material.id", ondelete="CASCADE"), index=True
    )
    conjunto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conjunto_regras.id"))
    # Modelo de linguagem que gerou o texto. Faz parte do registro auditável:
    # as mesmas regras em outro modelo podem dar outro texto.
    modelo: Mapped[str] = mapped_column(String(80))
    # O que o motor produziu, nunca editado (RN08), e o texto que vale depois
    # da revisão do professor (RF09). A diferença entre os dois é a edição.
    texto_gerado: Mapped[str] = mapped_column(Text)
    texto_adaptado: Mapped[str] = mapped_column(Text)
    status: Mapped[StatusAdaptacao] = mapped_column(
        Enum(StatusAdaptacao, native_enum=False), default=StatusAdaptacao.GERADA
    )
    data_geracao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    data_aprovacao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    material: Mapped[Material] = relationship(back_populates="adaptacoes")
    conjunto: Mapped[ConjuntoRegras] = relationship()
    aplicacoes: Mapped[list["AplicacaoRegra"]] = relationship(
        back_populates="adaptacao",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AplicacaoRegra.ordem",
    )
    metricas: Mapped[list["MetricaLegibilidade"]] = relationship(
        back_populates="adaptacao",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="MetricaLegibilidade.ordem",
    )


class AplicacaoRegra(Base):
    """Qual regra transformou qual trecho em qual resultado (RF06, RF10)."""

    __tablename__ = "aplicacao_regra"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    adaptacao_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("adaptacao.id", ondelete="CASCADE"), index=True
    )
    regra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regra_adaptacao.id"))
    trecho_original: Mapped[str] = mapped_column(Text)
    trecho_resultante: Mapped[str] = mapped_column(Text)
    ordem: Mapped[int] = mapped_column(Integer)

    adaptacao: Mapped[Adaptacao] = relationship(back_populates="aplicacoes")
    regra: Mapped[RegraAdaptacao] = relationship()


class MetricaLegibilidade(Base):
    __tablename__ = "metrica_legibilidade"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    adaptacao_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("adaptacao.id", ondelete="CASCADE"), index=True
    )
    codigo: Mapped[str] = mapped_column(String(40))
    nome: Mapped[str] = mapped_column(String(120))
    valor_original: Mapped[float] = mapped_column(Float)
    valor_adaptado: Mapped[float] = mapped_column(Float)
    ordem: Mapped[int] = mapped_column(Integer)

    adaptacao: Mapped[Adaptacao] = relationship(back_populates="metricas")


# ---------------------------------------------------------------------------
# Atividade (RF13–RF18, RF21–RF23)
# ---------------------------------------------------------------------------

class Questao(Base):
    __tablename__ = "questao"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("material.id", ondelete="CASCADE"), index=True
    )
    enunciado: Mapped[str] = mapped_column(Text)
    ordem: Mapped[int] = mapped_column(Integer)
    # RN04: o trecho do material em que a resposta está. Conferido na geração.
    origem_no_material: Mapped[str] = mapped_column(Text)
    # G11: a dica aparece antes da resposta, de graça.
    dica: Mapped[str] = mapped_column(Text, default="")

    material: Mapped[Material] = relationship(back_populates="questoes")
    alternativas: Mapped[list["Alternativa"]] = relationship(
        back_populates="questao",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Alternativa.ordem",
    )


class Alternativa(Base):
    __tablename__ = "alternativa"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    questao_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questao.id", ondelete="CASCADE"), index=True
    )
    texto: Mapped[str] = mapped_column(Text)
    correta: Mapped[bool] = mapped_column(Boolean, default=False)
    ordem: Mapped[int] = mapped_column(Integer)

    questao: Mapped[Questao] = relationship(back_populates="alternativas")


class AtividadePublicada(Base):
    """O link da atividade. Não existe aqui nada sobre quem a abriu (RN05):
    nem contagem de acesso, nem resposta, nem identificador do navegador."""

    __tablename__ = "atividade_publicada"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    material_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("material.id", ondelete="CASCADE"), index=True
    )
    codigo: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    data_publicacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)
    data_revogacao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    material: Mapped[Material] = relationship(back_populates="atividades")
