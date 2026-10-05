"""ClienteLLM — a única porta do sistema para o modelo de linguagem.

O motor e o gerador de questões dependem só da interface (`ClienteLLM`), não
do fornecedor. É o que permite testar os dois sem rede e sem custo, com um
cliente falso, e trocar de modelo sem tocar nas regras (risco R5 do
documento de metodologia: o critério é do projeto, não do modelo).

O modelo nunca recebe "adapte este texto" em prompt livre: recebe as
instruções das regras do arquivo e devolve JSON num esquema fixo, que diz
quais regras aplicou em cada trecho. Sem esse esquema não haveria RF06.
"""

import json
import logging
from typing import Protocol

import anthropic

from ..erros import ErroDeNegocio

log = logging.getLogger("entende")


class ClienteLLM(Protocol):
    modelo: str

    def gerar_json(self, tarefa: str, sistema: str, conteudo: str, esquema: dict) -> dict:
        """Devolve um objeto que obedece a `esquema`. `tarefa` só identifica a
        chamada (log e testes); não é enviada ao modelo."""
        ...


_INDISPONIVEL = ErroDeNegocio(
    "O serviço de adaptação está indisponível agora",
    "O modelo de linguagem não respondeu. Nada foi alterado no seu material.",
    "Tente de novo em alguns minutos.",
    "RF05",
    status=503,
)


class ClienteClaude:
    # Cada trecho do material é um pedido. 32 mil tokens de saída sobram para
    # um trecho de ~3.500 caracteres reescrito e explicado, com folga.
    MAXIMO_SAIDA = 32000

    def __init__(self, modelo: str, chave: str | None = None):
        self.modelo = modelo
        # Sem chave explícita, o SDK procura sozinho (ANTHROPIC_API_KEY etc.).
        self._cliente = anthropic.Anthropic(api_key=chave) if chave else anthropic.Anthropic()

    def gerar_json(self, tarefa: str, sistema: str, conteudo: str, esquema: dict) -> dict:
        try:
            # Streaming: a resposta de um trecho longo pode passar do tempo
            # limite de uma requisição comum.
            with self._cliente.beta.messages.stream(
                model=self.modelo,
                max_tokens=self.MAXIMO_SAIDA,
                system=sistema,
                messages=[{"role": "user", "content": conteudo}],
                output_config={"format": {"type": "json_schema", "schema": esquema}},
                # Se o modelo principal recusar o pedido, o próprio serviço
                # tenta o modelo reserva recomendado para aquele motivo.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            ) as fluxo:
                resposta = fluxo.get_final_message()
        except anthropic.AuthenticationError:
            raise ErroDeNegocio(
                "O motor de adaptação não está configurado",
                "O servidor não tem uma chave válida de acesso ao modelo de linguagem.",
                "Quem administra o servidor precisa preencher ANTHROPIC_API_KEY no arquivo .env.",
                "RF05",
                status=503,
            ) from None
        except anthropic.RateLimitError:
            raise _INDISPONIVEL from None
        except anthropic.APIStatusError as erro:
            log.error("Falha do modelo em %s: %s (%s)", tarefa, erro.status_code, erro.message)
            raise _INDISPONIVEL from None
        except anthropic.APIConnectionError:
            raise _INDISPONIVEL from None
        except anthropic.AnthropicError as erro:
            # Por exemplo: nenhuma credencial encontrada no ambiente.
            log.error("Modelo de linguagem não configurado em %s: %s", tarefa, erro)
            raise ErroDeNegocio(
                "O motor de adaptação não está configurado",
                "O servidor não encontrou credencial de acesso ao modelo de linguagem.",
                "Quem administra o servidor precisa preencher ANTHROPIC_API_KEY no arquivo .env.",
                "RF05",
                status=503,
            ) from None

        if resposta.stop_reason == "refusal":
            raise ErroDeNegocio(
                "O modelo de linguagem recusou este trecho do material",
                "O serviço do modelo não processou parte do texto. Nada foi alterado.",
                "Confira se o material tem algum trecho fora do contexto escolar e tente de novo.",
                "RF05",
                status=422,
            )
        if resposta.stop_reason == "max_tokens":
            log.error("Resposta cortada por tamanho em %s", tarefa)
            raise ErroDeNegocio(
                "Um trecho do material ficou grande demais para adaptar",
                "A resposta do modelo foi interrompida antes do fim.",
                "Divida o material em partes menores e envie de novo.",
                "RNF08",
                status=422,
            )

        texto = next((b.text for b in resposta.content if b.type == "text"), "")
        try:
            return json.loads(texto)
        except json.JSONDecodeError:
            log.error("JSON inválido do modelo em %s", tarefa)
            raise _INDISPONIVEL from None
