"""RF01 — conta do professor: criar, entrar, consultar quem está autenticado."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..banco import obter_sessao
from ..erros import ErroDeNegocio
from ..esquemas import Cadastro, Entrada, ProfessorPublico, Sessao
from ..modelos import Professor
from ..seguranca import conferir_senha, emitir_token, gerar_hash, professor_atual

rotas = APIRouter(prefix="/api/autenticacao", tags=["Autenticação"])


def _abrir_sessao(request: Request, professor: Professor) -> Sessao:
    config = request.app.state.configuracao
    token, expira_em = emitir_token(professor.id, config.segredo_token, config.validade_token_horas)
    return Sessao(
        token=token, expira_em=expira_em, professor=ProfessorPublico.model_validate(professor)
    )


@rotas.post("/cadastro", response_model=Sessao, status_code=status.HTTP_201_CREATED)
def cadastrar(dados: Cadastro, request: Request, sessao: Session = Depends(obter_sessao)):
    professor = Professor(
        nome=dados.nome.strip(),
        email=dados.email.strip().lower(),
        senha_hash=gerar_hash(dados.senha),
    )
    sessao.add(professor)
    try:
        sessao.commit()
    except IntegrityError:
        sessao.rollback()
        raise ErroDeNegocio(
            "Já existe uma conta com este e-mail",
            "O e-mail informado já está cadastrado no Entende+.",
            "Entre com esse e-mail e sua senha, ou use outro e-mail para criar a conta.",
            "RF01",
            status=409,
        ) from None
    return _abrir_sessao(request, professor)


@rotas.post("/entrar", response_model=Sessao)
def entrar(dados: Entrada, request: Request, sessao: Session = Depends(obter_sessao)):
    professor = sessao.scalar(select(Professor).where(Professor.email == dados.email.strip().lower()))
    # Mesma mensagem para e-mail inexistente e senha errada, e mesmo tempo de
    # resposta (ver conferir_senha): a tela de entrada não revela quem tem conta.
    if not conferir_senha(dados.senha, professor.senha_hash if professor else None):
        raise ErroDeNegocio(
            "E-mail ou senha não conferem",
            "Não encontramos uma conta com esse e-mail e essa senha.",
            "Confira se o e-mail está escrito como no cadastro e digite a senha de novo.",
            "RF01",
            status=401,
        )
    return _abrir_sessao(request, professor)


@rotas.get("/eu", response_model=ProfessorPublico)
def quem_sou(professor: Professor = Depends(professor_atual)):
    return professor
