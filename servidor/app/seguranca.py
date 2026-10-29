"""Senha (RNF09) e token de acesso (RF01).

Senha: hash Argon2id com sal aleatório; a senha em texto claro não é
gravada nem registrada em log.

Token: JWT assinado (HS256), enviado no cabeçalho Authorization.

Força bruta: limite de senhas erradas seguidas por e-mail (LimiteDeTentativas).
"""

import threading
import time
import uuid
from collections.abc import Callable
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

# Hash fictício usado quando o e-mail não existe, para a resposta levar o
# mesmo tempo que a de senha errada.
_HASH_FICTICIO = _hasher.hash("senha-ficticia-para-igualar-o-tempo")


def gerar_hash(senha: str) -> str:
    return _hasher.hash(senha)


def conferir_senha(senha: str, senha_hash: str | None) -> bool:
    try:
        _hasher.verify(senha_hash or _HASH_FICTICIO, senha)
    except (VerificationError, InvalidHashError):
        return False
    return senha_hash is not None


class LimiteDeTentativas:
    """Bloqueia a entrada com um e-mail depois de `maximo` senhas erradas
    seguidas, por `bloqueio_segundos`. Acertar a senha zera a contagem.

    A chave é o e-mail digitado, exista a conta ou não: e-mail inexistente é
    bloqueado do mesmo jeito, então o bloqueio não revela quais contas existem.
    Não guarda IP. Fica em memória: reiniciar o servidor zera as contagens.
    """

    def __init__(self, maximo: int, bloqueio_segundos: float, relogio: Callable[[], float] = time.monotonic):
        self.maximo = maximo
        self.bloqueio_segundos = bloqueio_segundos
        self._relogio = relogio
        self._erros: dict[str, list[float]] = {}
        self._trava = threading.Lock()

    def _recentes(self, email: str, agora: float) -> list[float]:
        recentes = [t for t in self._erros.get(email, []) if agora - t < self.bloqueio_segundos]
        if recentes:
            self._erros[email] = recentes
        else:
            self._erros.pop(email, None)
        return recentes

    def bloqueado(self, email: str) -> bool:
        with self._trava:
            return len(self._recentes(email, self._relogio())) >= self.maximo

    def registrar_erro(self, email: str) -> None:
        with self._trava:
            agora = self._relogio()
            self._erros[email] = self._recentes(email, agora) + [agora]

    def registrar_acerto(self, email: str) -> None:
        with self._trava:
            self._erros.pop(email, None)


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
