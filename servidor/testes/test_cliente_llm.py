"""Cliente do modelo de linguagem: escolha do provedor e leitura da resposta da
OpenAI. Sem rede: a chamada à API é trocada por um cliente falso."""

from types import SimpleNamespace

import pytest

from app.erros import ErroDeNegocio
from app.servicos.cliente_llm import ClienteClaude, ClienteGPT, criar_cliente
from app.servicos.questoes import ESQUEMA


class _RespostasFalsas:
    """Imita `cliente.responses` do SDK da OpenAI e guarda o último pedido."""

    def __init__(self, resposta):
        self.resposta = resposta
        self.pedido = None

    def create(self, **pedido):
        self.pedido = pedido
        return self.resposta


def _gpt(resposta):
    respostas = _RespostasFalsas(resposta)
    return ClienteGPT("gpt-teste", cliente=SimpleNamespace(responses=respostas)), respostas


def _mensagem(*partes, status="completed", motivo=None):
    return SimpleNamespace(
        status=status,
        incomplete_details=SimpleNamespace(reason=motivo) if motivo else None,
        output=[SimpleNamespace(type="message", content=list(partes))],
    )


def _texto(texto):
    return SimpleNamespace(type="output_text", text=texto)


# --- Escolha do provedor --------------------------------------------------------
def test_padrao_e_a_openai_com_o_modelo_padrao():
    cliente = criar_cliente("", "", "chave-de-teste", "")
    assert isinstance(cliente, ClienteGPT)
    assert cliente.modelo == "gpt-6.1-sol"


def test_anthropic_continua_disponivel():
    cliente = criar_cliente("anthropic", "", "", "chave-de-teste")
    assert isinstance(cliente, ClienteClaude)
    assert cliente.modelo == "claude-opus-5"


def test_modelo_informado_vale_mais_que_o_padrao():
    assert criar_cliente("openai", "gpt-6-astra", "chave-de-teste", "").modelo == "gpt-6-astra"


def test_provedor_desconhecido_e_recusado():
    with pytest.raises(ValueError):
        criar_cliente("outro", "", "", "")


def test_sem_chave_o_servidor_sobe_e_adaptar_responde_503(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    cliente = criar_cliente("openai", "", "", "")
    with pytest.raises(ErroDeNegocio) as erro:
        cliente.gerar_json("teste", "sistema", "conteudo", ESQUEMA)
    assert erro.value.status == 503
    assert "OPENAI_API_KEY" in erro.value.saida


# --- Leitura da resposta ----------------------------------------------------------
def test_pede_saida_estrita_no_esquema_e_le_o_json():
    cliente, respostas = _gpt(_mensagem(_texto('{"questoes": []}')))
    assert cliente.gerar_json("questoes", "regras", "texto", ESQUEMA) == {"questoes": []}

    formato = respostas.pedido["text"]["format"]
    assert formato["type"] == "json_schema"
    assert formato["strict"] is True
    assert formato["schema"] is ESQUEMA
    assert respostas.pedido["instructions"] == "regras"
    assert respostas.pedido["input"] == "texto"
    assert respostas.pedido["model"] == "gpt-teste"


def test_recusa_do_modelo_vira_erro_explicado():
    cliente, _ = _gpt(_mensagem(SimpleNamespace(type="refusal", refusal="não")))
    with pytest.raises(ErroDeNegocio) as erro:
        cliente.gerar_json("adaptacao 1/1", "regras", "texto", ESQUEMA)
    assert erro.value.status == 422
    assert "recusou" in erro.value.titulo


def test_resposta_cortada_pede_material_menor():
    cliente, _ = _gpt(_mensagem(_texto('{"quest'), status="incomplete", motivo="max_output_tokens"))
    with pytest.raises(ErroDeNegocio) as erro:
        cliente.gerar_json("adaptacao 1/1", "regras", "texto", ESQUEMA)
    assert erro.value.regra == "RNF08"


def test_json_invalido_responde_indisponivel():
    cliente, _ = _gpt(_mensagem(_texto("isto não é json")))
    with pytest.raises(ErroDeNegocio) as erro:
        cliente.gerar_json("questoes", "regras", "texto", ESQUEMA)
    assert erro.value.status == 503
