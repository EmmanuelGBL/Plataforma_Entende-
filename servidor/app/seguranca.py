"""Senha (RNF09) e token de acesso (RF01).

Senha: Argon2id, o algoritmo recomendado pela OWASP para armazenar senha. O
sal é aleatório por senha e fica embutido no próprio hash; a senha em texto
claro não é gravada nem registrada em log em lugar nenhum.

Token: JWT assinado (HS256), enviado no cabeçalho Authorization. Foi escolhido
no lugar de cookie porque o front-end é servido pelo GitHub Pages, em outra
origem que não a da API, e cookie entre origens exige SameSite=None e mais
configuração de CORS para o mesmo resultado.
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .banco import obter_sessao
from .erros import ErroDeNegocio
from .modelos import Professor

_hasher = PasswordHasher()

# Usado quando o e-mail não existe, para que a resposta leve o mesmo tempo que
# a de senha errada. Sem isso, medir o tempo de resposta revelaria quais
# e-mails têm conta.
_HASH_FICTICIO = _hasher.hash("senha-ficticia-para-igualar-o-tempo")


def gerar_hash(senha: str) -> str:
    return _hasher.hash(senha)


def conferir_senha(senha: str, senha_hash: str | None) -> bool:
    try:
        _hasher.verify(senha_hash or _HASH_FICTICIO, senha)
    except (VerificationError, InvalidHashError):
        return False
    return senha_hash is not None


def emitir_token(professor_id: uuid.UUID, segredo: str, horas: int) -> tuple[str, datetime]:
    expira_em = datetime.now(timezone.utc) + timedelta(hours=horas)
    token = jwt.encode({"sub": str(professor_id), "exp": expira_em}, segredo, algorithm="HS256")
    return token, expira_em


_portador = HTTPBearer(auto_error=False)

SESSAO_INVALIDA = ErroDeNegocio(
    "Sua sessão terminou",
    "O acesso expirou ou não foi reconhecido.",
    "Entre de novo com seu e-mail e sua senha.",
    "RF01",
    status=401,
)


def professor_atual(
    request: Request,
    credencial: HTTPAuthorizationCredentials | None = Depends(_portador),
    sessao: Session = Depends(obter_sessao),
) -> Professor:
    if credencial is None:
        raise SESSAO_INVALIDA
    segredo = request.app.state.configuracao.segredo_token
    try:
        dados = jwt.decode(credencial.credentials, segredo, algorithms=["HS256"])
        professor_id = uuid.UUID(dados["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise SESSAO_INVALIDA from None
    professor = sessao.get(Professor, professor_id)
    if professor is None:
        raise SESSAO_INVALIDA
    return professor
