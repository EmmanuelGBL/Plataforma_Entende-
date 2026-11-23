"""Contas de professor, administradas no servidor (RF24, RN12). Não há rota
para isto: quem usa é o comando administrar.py."""

import secrets

from sqlalchemy import select
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


def _exigir(sessao: Session, email: str) -> Professor:
    professor = buscar(sessao, email)
    if professor is None:
        raise ErroDeNegocio(f"Não existe conta com o e-mail {email}", regra="RF24", status=404)
    return professor


def criar(sessao: Session, dados: NovaConta, senha: str | None = None) -> tuple[Professor, str]:
    """Devolve a conta e a senha em texto claro, que só existe neste momento.

    `senha` só é informada pela conta de apresentação do banco local
    (apresentar.py); nas demais, é aleatória.
    """
    if buscar(sessao, dados.email) is not None:
        raise ErroDeNegocio(f"Já existe uma conta com o e-mail {dados.email}", regra="RF24", status=409)
    senha = senha or gerar_senha()
    professor = Professor(
        nome=dados.nome.strip(),
        email=dados.email.strip().lower(),
        senha_hash=gerar_hash(senha),
        cota_tokens=dados.cota,
    )
    sessao.add(professor)
    sessao.commit()
    return professor, senha


def desativar(sessao: Session, email: str) -> Professor:
    professor = _exigir(sessao, email)
    professor.ativo = False
    sessao.commit()
    return professor


def redefinir_senha(sessao: Session, email: str) -> tuple[Professor, str]:
    professor = _exigir(sessao, email)
    senha = gerar_senha()
    professor.senha_hash = gerar_hash(senha)
    sessao.commit()
    return professor, senha


def definir_cota(sessao: Session, email: str, cota: int) -> Professor:
    professor = _exigir(sessao, email)
    professor.cota_tokens = cota
    sessao.commit()
    return professor


def listar(sessao: Session) -> list[Professor]:
    return list(sessao.scalars(select(Professor).order_by(Professor.nome)))
