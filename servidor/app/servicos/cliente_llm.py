"""ClienteLLM — único ponto do sistema que chama o modelo de linguagem.

Dois provedores, escolhidos por ENTENDE_PROVEDOR: a OpenAI (ClienteGPT, o
padrão desde 29/10/2026) e a Anthropic (ClienteClaude). O motor não muda com a
troca: regras, gatilhos, glossário e métricas são do código.

O motor e o gerador de questões dependem só da interface `ClienteLLM`, o que
permite testá-los com um cliente falso, sem rede. O modelo recebe as
instruções das regras do arquivo e responde em JSON num esquema fixo, que diz
quais regras aplicou em cada trecho (RF06).
"""

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Protocol

import anthropic
import openai

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
    # Cada trecho do material é um pedido; 32 mil tokens de saída bastam para
    # um trecho de ~3.500 caracteres.
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
                # Se o modelo principal recusar o pedido, o serviço tenta o modelo reserva.
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


def _sem_configuracao(variavel: str) -> ErroDeNegocio:
    return ErroDeNegocio(
        "O motor de adaptação não está configurado",
        "O servidor não tem uma chave válida de acesso ao modelo de linguagem.",
        f"Quem administra o servidor precisa preencher {variavel} no arquivo .env.",
        "RF05",
        status=503,
    )


_RECUSA = ErroDeNegocio(
    "O modelo de linguagem recusou este trecho do material",
    "O serviço do modelo não processou parte do texto. Nada foi alterado.",
    "Confira se o material tem algum trecho fora do contexto escolar e tente de novo.",
    "RF05",
    status=422,
)

_CORTADA = ErroDeNegocio(
    "Um trecho do material ficou grande demais para adaptar",
    "A resposta do modelo foi interrompida antes do fim.",
    "Divida o material em partes menores e envie de novo.",
    "RNF08",
    status=422,
)


@dataclass
class Consumo:
    """Tokens e tempo de uma chamada ao modelo. Não guarda nada do material."""

    tarefa: str
    entrada: int
    entrada_em_cache: int
    saida: int
    # Parte da saída gasta em raciocínio, que é cobrada como saída.
    raciocinio: int
    segundos: float


def _consumo(tarefa: str, uso, segundos: float) -> Consumo:
    detalhes_entrada = getattr(uso, "input_tokens_details", None)
    detalhes_saida = getattr(uso, "output_tokens_details", None)
    return Consumo(
        tarefa=tarefa,
        entrada=getattr(uso, "input_tokens", 0) or 0,
        entrada_em_cache=getattr(detalhes_entrada, "cached_tokens", 0) or 0,
        saida=getattr(uso, "output_tokens", 0) or 0,
        raciocinio=getattr(detalhes_saida, "reasoning_tokens", 0) or 0,
        segundos=segundos,
    )


class ClienteGPT:
    """Modelo da OpenAI pela Responses API, com saída estruturada estrita: a
    resposta obedece ao esquema JSON do motor e do gerador de questões (os dois
    já seguem o modo estrito: todo campo obrigatório, nenhum campo extra)."""

    # Mesmo limite do cliente do Claude: um trecho de ~3.500 caracteres.
    MAXIMO_SAIDA = 32000
    # Resposta de um trecho longo pode passar do tempo padrão do SDK.
    TEMPO_LIMITE = 600

    def __init__(self, modelo: str, chave: str | None = None, cliente=None):
        self.modelo = modelo
        # `cliente` só existe para os testes trocarem a chamada de rede. Sem
        # chave (nem aqui nem em OPENAI_API_KEY), o SDK recusa até ser criado;
        # aí o servidor sobe assim mesmo e só adaptar responde 503.
        if cliente is not None:
            self._cliente = cliente
        elif chave or os.environ.get("OPENAI_API_KEY"):
            self._cliente = openai.OpenAI(api_key=chave or None, timeout=self.TEMPO_LIMITE)
        else:
            self._cliente = None
        # Com uma lista aqui, cada chamada registra o seu Consumo (medir.py).
        # O servidor deixa None: o consumo só vai para o log.
        self.consumo: list[Consumo] | None = None

    def gerar_json(self, tarefa: str, sistema: str, conteudo: str, esquema: dict) -> dict:
        if self._cliente is None:
            raise _sem_configuracao("OPENAI_API_KEY")
        inicio = time.perf_counter()
        try:
            resposta = self._cliente.responses.create(
                model=self.modelo,
                instructions=sistema,
                input=conteudo,
                max_output_tokens=self.MAXIMO_SAIDA,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "resposta_entende",
                        "schema": esquema,
                        "strict": True,
                    }
                },
            )
        except openai.AuthenticationError:
            raise _sem_configuracao("OPENAI_API_KEY") from None
        except openai.RateLimitError:
            raise _INDISPONIVEL from None
        except openai.APIStatusError as erro:
            log.error("Falha do modelo em %s: %s (%s)", tarefa, erro.status_code, erro.message)
            raise _INDISPONIVEL from None
        except openai.APIConnectionError:
            raise _INDISPONIVEL from None
        except openai.OpenAIError as erro:
            log.error("Modelo de linguagem não configurado em %s: %s", tarefa, erro)
            raise _sem_configuracao("OPENAI_API_KEY") from None

        consumo = _consumo(tarefa, getattr(resposta, "usage", None), time.perf_counter() - inicio)
        log.info(
            "Consumo em %s: %d tokens de entrada (%d em cache), %d de saída, %.1f s",
            tarefa, consumo.entrada, consumo.entrada_em_cache, consumo.saida, consumo.segundos,
        )
        if self.consumo is not None:
            self.consumo.append(consumo)

        if getattr(resposta, "status", None) == "incomplete":
            motivo = getattr(getattr(resposta, "incomplete_details", None), "reason", None)
            if motivo == "max_output_tokens":
                log.error("Resposta cortada por tamanho em %s", tarefa)
                raise _CORTADA
            if motivo == "content_filter":
                raise _RECUSA
            log.error("Resposta incompleta em %s: %s", tarefa, motivo)
            raise _INDISPONIVEL

        texto = ""
        for item in getattr(resposta, "output", None) or []:
            if getattr(item, "type", None) != "message":
                continue
            for parte in getattr(item, "content", None) or []:
                if getattr(parte, "type", None) == "refusal":
                    raise _RECUSA
                if getattr(parte, "type", None) == "output_text":
                    texto += parte.text
        try:
            return json.loads(texto)
        except json.JSONDecodeError:
            log.error("JSON inválido do modelo em %s", tarefa)
            raise _INDISPONIVEL from None


# Provedores disponíveis. O padrão é a OpenAI (decisão da dupla em 29/10/2026);
# o Claude continua disponível com ENTENDE_PROVEDOR=anthropic.
MODELO_PADRAO = {"openai": "gpt-6.1-sol", "anthropic": "claude-opus-5"}


def criar_cliente(provedor: str, modelo: str, chave_openai: str, chave_anthropic: str) -> ClienteLLM:
    provedor = (provedor or "openai").strip().lower()
    if provedor not in MODELO_PADRAO:
        raise ValueError(f"Provedor de modelo desconhecido: {provedor!r} (use openai ou anthropic)")
    modelo = modelo or MODELO_PADRAO[provedor]
    if provedor == "anthropic":
        return ClienteClaude(modelo, chave_anthropic or None)
    return ClienteGPT(modelo, chave_openai or None)
