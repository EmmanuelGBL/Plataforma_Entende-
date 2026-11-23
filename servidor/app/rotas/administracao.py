"""Contas de professor pela tela Contas, só para administrador.

Ninguém vira administrador por aqui, e conta de administrador não é desativada,
excluída nem tem senha ou e-mail trocados por aqui: isso é só do comando
administrar.py, no servidor. Quem tomasse uma sessão de administrador não
conseguiria trancar a dupla para fora.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..banco import obter_sessao
from ..erros import ErroDeNegocio
from ..esquemas import ContaComSenha, ContaPublica, NovaConta
from ..modelos import Material, Professor
from ..seguranca import administrador_atual
from ..servicos import contas

log = logging.getLogger("entende")

rotas = APIRouter(prefix="/api/administracao/contas", tags=["Administração"])


def _publica(professor: Professor, materiais: int) -> ContaPublica:
    return ContaPublica(
        id=professor.id,
        nome=professor.nome,
        email=professor.email,
        cota_tokens=professor.cota_tokens,
        tokens_consumidos=professor.tokens_consumidos,
        administrador=professor.administrador,
        ativo=professor.ativo,
        criado_em=professor.criado_em,
        quantidade_materiais=materiais,
    )


def _contar_materiais(sessao: Session, professor: Professor) -> int:
    return sessao.scalar(select(func.count()).select_from(Material).where(Material.professor_id == professor.id))


def _conta(sessao: Session, professor: Professor) -> ContaPublica:
    return _publica(professor, _contar_materiais(sessao, professor))


def _de_professor(sessao: Session, conta_id: uuid.UUID) -> Professor:
    professor = contas.por_id(sessao, conta_id)
    if professor.administrador:
        raise ErroDeNegocio(
            "Conta de administrador não muda por aqui",
            "Por segurança, senha, e-mail, situação e exclusão de um administrador só mudam no servidor.",
            "Use o comando administrar.py no servidor.",
            "RF24",
            status=409,
        )
    return professor


def _registrar(acao: str, administrador: Professor, conta_id: uuid.UUID) -> None:
    # Só os identificadores: nada de nome, e-mail, senha ou IP no log.
    log.info("Administração: %s na conta %s, por %s", acao, conta_id, administrador.id)


@rotas.get("", response_model=list[ContaPublica])
def listar(_: Professor = Depends(administrador_atual), sessao: Session = Depends(obter_sessao)):
    quantidades = dict(
        sessao.execute(select(Material.professor_id, func.count()).group_by(Material.professor_id)).all()
    )
    return [_publica(p, quantidades.get(p.id, 0)) for p in contas.listar(sessao)]


@rotas.post("", response_model=ContaComSenha, status_code=status.HTTP_201_CREATED)
def criar(
    dados: NovaConta,
    resposta: Response,
    administrador: Professor = Depends(administrador_atual),
    sessao: Session = Depends(obter_sessao),
):
    professor, senha = contas.criar(sessao, dados)
    _registrar("criação", administrador, professor.id)
    resposta.headers["Cache-Control"] = "no-store"
    return ContaComSenha(conta=_conta(sessao, professor), senha=senha)


@rotas.put("/{conta_id}", response_model=ContaPublica)
def editar(
    conta_id: uuid.UUID,
    dados: NovaConta,
    administrador: Professor = Depends(administrador_atual),
    sessao: Session = Depends(obter_sessao),
):
    professor = contas.por_id(sessao, conta_id)
    if dados.email.strip().lower() != professor.email:
        _de_professor(sessao, conta_id)
    contas.editar(sessao, professor, dados)
    _registrar("edição", administrador, conta_id)
    return _conta(sessao, professor)


@rotas.post("/{conta_id}/senha", response_model=ContaComSenha)
def redefinir_senha(
    conta_id: uuid.UUID,
    resposta: Response,
    administrador: Professor = Depends(administrador_atual),
    sessao: Session = Depends(obter_sessao),
):
    professor = _de_professor(sessao, conta_id)
    senha = contas.redefinir_senha(sessao, professor)
    _registrar("nova senha", administrador, conta_id)
    resposta.headers["Cache-Control"] = "no-store"
    return ContaComSenha(conta=_conta(sessao, professor), senha=senha)


@rotas.post("/{conta_id}/desativacao", response_model=ContaPublica)
def desativar(
    conta_id: uuid.UUID,
    administrador: Professor = Depends(administrador_atual),
    sessao: Session = Depends(obter_sessao),
):
    professor = _de_professor(sessao, conta_id)
    contas.desativar(sessao, professor)
    _registrar("desativação", administrador, conta_id)
    return _conta(sessao, professor)


@rotas.post("/{conta_id}/reativacao", response_model=ContaPublica)
def reativar(
    conta_id: uuid.UUID,
    administrador: Professor = Depends(administrador_atual),
    sessao: Session = Depends(obter_sessao),
):
    professor = _de_professor(sessao, conta_id)
    contas.reativar(sessao, professor)
    _registrar("reativação", administrador, conta_id)
    return _conta(sessao, professor)


@rotas.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    conta_id: uuid.UUID,
    administrador: Professor = Depends(administrador_atual),
    sessao: Session = Depends(obter_sessao),
):
    contas.excluir(sessao, _de_professor(sessao, conta_id))
    _registrar("exclusão", administrador, conta_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
