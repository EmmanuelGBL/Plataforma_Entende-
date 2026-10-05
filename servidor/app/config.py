"""Configuração lida do ambiente (prefixo ENTENDE_) ou do arquivo .env."""

import logging
import secrets
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PASTA_SERVIDOR = Path(__file__).resolve().parent.parent

log = logging.getLogger("entende")


class Configuracao(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ENTENDE_",
        env_file=PASTA_SERVIDOR / ".env",
        extra="ignore",
    )

    banco_url: str = f"sqlite:///{(PASTA_SERVIDOR / 'entende.db').as_posix()}"
    segredo_token: str = ""
    validade_token_horas: int = 8  # um turno de trabalho do professor
    origens: str = "http://localhost:5173,http://127.0.0.1:5173,https://emmanuelgbl.github.io"

    # RNF08 — limites de envio. Os mesmos valores estão em src/servicos/api.js,
    # que valida antes de enviar; aqui é a validação que vale.
    limite_paginas: int = 20
    limite_megabytes: int = 15

    # Motor de adaptação. O arquivo de regras é lido a cada adaptação (RNF13).
    caminho_regras: Path = PASTA_SERVIDOR / "regras" / "tea.json"
    modelo: str = "claude-opus-5"
    # Lida com o nome padrão do SDK, sem o prefixo ENTENDE_, para funcionar
    # tanto no .env quanto exportada no terminal.
    chave_api: str = Field(default="", validation_alias="ANTHROPIC_API_KEY")

    @property
    def lista_origens(self) -> list[str]:
        return [o.strip() for o in self.origens.split(",") if o.strip()]

    @property
    def limite_bytes(self) -> int:
        return self.limite_megabytes * 1024 * 1024

    def garantir_segredo(self) -> None:
        if not self.segredo_token:
            log.warning(
                "ENTENDE_SEGREDO_TOKEN não definido: usando segredo aleatório. "
                "Os tokens deixam de valer quando o servidor reinicia."
            )
            self.segredo_token = secrets.token_urlsafe(48)
