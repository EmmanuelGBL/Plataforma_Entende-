"""Contas de professor (RF24, RN12). Usadas pelo comando administrar.py e pela
tela Contas do administrador (rotas/administracao.py)."""

import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..erros import ErroDeNegocio
from ..esquemas import NovaConta
from ..modelos import Professor
from ..seguranca import gerar_hash

# Sem I, l, O, 0 e 1, para não confundir ao copiar a senha à mão.
ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
TAMANHO_SENHA = 14  # RF24 pede no mínimo 12


def gerar_senha() -> str:
    return "".join(secrets.choice(ALFABETO_SENHA) for _ in range(TAMANHO_SENHA))


def buscar(sessao: Session, email: str) -> Professor | None:
    return sessao.scalar(select(Professor).where(Professor.email == email.strip().lower()))


def por_email(sessao: Session, email: str) -> Professor:
    professor = buscar(sessao, email)
    if professor is None:
        raise ErroDeNegocio(f"Não existe conta com o e-mail {email}", regra="RF24", status=404)
    return professor


def por_id(sessao: Session, conta_id: uuid.UUID) -> Professor:
    professor = sessao.get(Professor, conta_id)
    if professor is None:
        raise ErroDeNegocio(
            "Esta conta não existe mais",
            "Ela pode ter sido excluída em outra janela.",
            "Atualize a página para ver a lista atual.",
            "RF24",
            status=404,
        )
    return professor


def _salvar(sessao: Session, email: str) -> None:
    try:
        sessao.commit()
    except IntegrityError:
        sessao.rollback()
        raise ErroDeNegocio(
            f"Já existe uma conta com o e-mail {email}",
            "Cada e-mail só pode ter uma conta.",
            "Use outro e-mail ou edite a conta que já existe.",
            "RF24",
            status=409,
        ) from None


def criar(sessao: Session, dados: NovaConta, senha: str | None = None) -> tuple[Professor, str]:
    """Devolve a conta e a senha em texto claro, que só existe neste momento.

    `senha` vem da tela Contas ou da conta de apresentação (apresentar.py); sem
    ela, é aleatória.
    """
    senha = senha or gerar_senha()
    professor = Professor(
        nome=dados.nome.strip(),
        email=dados.email.strip().lower(),
        senha_hash=gerar_hash(senha),
        cota_tokens=dados.cota,
    )
    sessao.add(professor)
    _salvar(sessao, professor.email)
    return professor, senha


def editar(sessao: Session, professor: Professor, dados: NovaConta) -> None:
    professor.nome = dados.nome.strip()
    professor.email = dados.email.strip().lower()
    professor.cota_tokens = dados.cota
    _salvar(sessao, professor.email)


def definir_cota(sessao: Session, professor: Professor, cota: int) -> None:
    professor.cota_tokens = cota
    sessao.commit()


def redefinir_senha(sessao: Session, professor: Professor, senha: str | None = None) -> str:
    senha = senha or gerar_senha()
    professor.senha_hash = gerar_hash(senha)
    professor.versao_sessao += 1
    sessao.commit()
    return senha


def desativar(sessao: Session, professor: Professor) -> None:
    professor.ativo = False
    # Reativar depois não ressuscita a sessão antiga.
    professor.versao_sessao += 1
    sessao.commit()


def reativar(sessao: Session, professor: Professor) -> None:
    professor.ativo = True
    sessao.commit()


def excluir(sessao: Session, professor: Professor) -> None:
    """Apaga a conta e tudo o que é dela: materiais, adaptações e atividades."""
    sessao.delete(professor)
    sessao.commit()


def definir_administrador(sessao: Session, professor: Professor, administrador: bool) -> None:
    professor.administrador = administrador
    sessao.commit()


def listar(sessao: Session) -> list[Professor]:
    return list(sessao.scalars(select(Professor).order_by(Professor.nome)))
