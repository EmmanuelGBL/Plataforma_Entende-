"""RF01 — entrar e consultar quem está autenticado.

Não há rota de cadastro (RN12): a conta é criada pela administração, com o
comando administrar.py (RF24).
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..banco import obter_sessao
from ..erros import ErroDeNegocio
from ..esquemas import Entrada, ProfessorPublico, Sessao
from ..modelos import Professor
from ..seguranca import conferir_senha, emitir_token, professor_atual

rotas = APIRouter(prefix="/api/autenticacao", tags=["Autenticação"])


def _abrir_sessao(request: Request, professor: Professor) -> Sessao:
    config = request.app.state.configuracao
    token, expira_em = emitir_token(professor.id, config.segredo_token, config.validade_token_horas)
    return Sessao(
        token=token, expira_em=expira_em, professor=ProfessorPublico.model_validate(professor)
    )


@rotas.post("/entrar", response_model=Sessao)
def entrar(dados: Entrada, request: Request, sessao: Session = Depends(obter_sessao)):
    email = dados.email.strip().lower()
    limite = request.app.state.limite_entrada
    # Conferido antes da senha: bloqueado, nem a senha certa entra.
    if limite.bloqueado(email):
        minutos = request.app.state.configuracao.bloqueio_entrada_minutos
        raise ErroDeNegocio(
            "Entrada bloqueada por alguns minutos",
            f"Houve {limite.maximo} tentativas seguidas com senha errada para este e-mail.",
            f"Espere até {minutos} minutos e tente de novo, com calma.",
            "RF01",
            status=429,
        )
    professor = sessao.scalar(select(Professor).where(Professor.email == email))
    # Mesma mensagem para e-mail inexistente e senha errada.
    if not conferir_senha(dados.senha, professor.senha_hash if professor else None):
        limite.registrar_erro(email)
        raise ErroDeNegocio(
            "E-mail ou senha não conferem",
            "Não encontramos uma conta com esse e-mail e essa senha.",
            "Confira o e-mail e digite de novo a senha que você recebeu.",
            "RF01",
            status=401,
        )
    # Só depois da senha certa: quem não a sabe não descobre a situação da conta.
    if not professor.ativo:
        raise ErroDeNegocio(
            "Esta conta foi desativada",
            "A administração do Entende+ encerrou o acesso desta conta.",
            "Se você ainda precisa dela, fale com quem enviou o seu acesso.",
            "RF24",
            status=403,
        )
    limite.registrar_acerto(email)
    return _abrir_sessao(request, professor)


@rotas.get("/eu", response_model=ProfessorPublico)
def quem_sou(professor: Professor = Depends(professor_atual)):
    return professor
