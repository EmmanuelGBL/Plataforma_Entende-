"""MotorAdaptacao e conjunto de regras — RF05, RF06, RN08, RNF13, RNF14.

Sobre RNF14 ("testes automatizados cobrindo cada regra"): o teste
parametrizado abaixo passa por TODAS as regras do arquivo e confere que cada
uma chega aonde deve — a instrução ao modelo, o código da estrutura ou a
folha impressa. O que ele não mede, e nenhum teste automatizado mediria, é se
o modelo de linguagem reescreveu bem: isso é a validação com especialistas
(OE3), não a suíte.
"""

import json

import pytest

from app.config import PASTA_SERVIDOR
from app.erros import ErroDeNegocio
from app.modelos import AplicacaoDaRegra
from app.servicos import motor, regras
from app.servicos import texto as md

from .cliente_falso import ClienteFalso

ARQUIVO = PASTA_SERVIDOR / "regras" / "tea.json"
CONJUNTO, _ = regras.carregar(ARQUIVO)

MATERIAL = """# Capítulo 3 - A fotossíntese

## O que é

As plantas produzem o próprio alimento. Esse processo se chama fotossíntese.

## Onde acontece

A fotossíntese acontece nas folhas. A clorofila captura a luz.

## De noite

De noite não há luz. A fotossíntese para."""


def _adaptar(cliente=None):
    cliente = cliente or ClienteFalso()
    return motor.adaptar(MATERIAL, CONJUNTO, cliente), cliente


# --- Cada regra do arquivo (RNF14) -------------------------------------------

@pytest.mark.parametrize("regra", CONJUNTO.regras, ids=lambda r: r.codigo)
def test_cada_regra_chega_aonde_deve(regra):
    resultado, cliente = _adaptar()
    chamada = cliente.chamadas[0]
    codigos_do_esquema = chamada["esquema"]["properties"]["blocos"]["items"]["properties"][
        "regras_aplicadas"
    ]["items"]["enum"]

    if regra.aplicacao is AplicacaoDaRegra.MODELO:
        assert f"{regra.codigo} ({regra.nome}): {regra.instrucao}" in chamada["sistema"]
        assert regra.codigo in codigos_do_esquema
    else:
        # Estrutura e apresentação não são pedidas ao modelo.
        assert regra.codigo not in chamada["sistema"]
        assert regra.codigo not in codigos_do_esquema
    if regra.aplicacao is AplicacaoDaRegra.ESTRUTURA:
        assert any(regra.codigo in b.regras for b in resultado.blocos)


def test_arquivo_do_projeto_e_valido_e_tem_as_dez_regras():
    assert CONJUNTO.identificador.value == "TEA"
    assert [r.codigo for r in CONJUNTO.regras] == [f"TEA-{n:02d}" for n in range(1, 11)]


# --- Motor ---------------------------------------------------------------------

def test_material_e_dividido_por_secao():
    trechos = motor.dividir_em_trechos(MATERIAL)
    assert len(trechos) == 3
    assert trechos[0].startswith("# Capítulo 3") and "## O que é" in trechos[0]
    assert trechos[2].startswith("## De noite")


def test_trecho_grande_e_dividido_mesmo_sem_titulo():
    longo = "\n\n".join(["Uma frase de teste que ocupa espaço no material didático."] * 100)
    trechos = motor.dividir_em_trechos(longo)
    assert len(trechos) > 1
    assert all(len(t) <= motor.TAMANHO_TRECHO + 100 for t in trechos)


def test_motor_registra_regra_por_bloco_e_o_trecho_de_origem():
    resultado, _ = _adaptar()
    frase = next(b for b in resultado.blocos if b.texto == "A clorofila captura a luz.")
    assert frase.regras == ["TEA-01"]
    assert frase.trecho_original == "A fotossíntese acontece nas folhas. A clorofila captura a luz."


def test_codigo_que_nao_esta_no_arquivo_e_descartado():
    resultado, _ = _adaptar(ClienteFalso(regra_extra="TEA-99"))
    assert all("TEA-99" not in b.regras for b in resultado.blocos)


def test_tea09_abre_o_material_com_a_lista_das_secoes_depois_do_titulo():
    resultado, _ = _adaptar()
    textos = [b.em_markdown() for b in resultado.blocos[:6]]
    assert textos == [
        "# Capítulo 3 - A fotossíntese",
        "## O que você vai ler",
        "Neste texto você vai ler sobre 3 assuntos, nesta ordem:",
        "- 1. O que é",
        "- 2. Onde acontece",
        "- 3. De noite",
    ]


def test_tea09_nao_inventa_lista_para_texto_sem_secoes():
    blocos = [md.Bloco("paragrafo", "Só um parágrafo.")]
    assert motor.antecipar_estrutura(blocos) == blocos


def test_falha_em_um_trecho_derruba_a_adaptacao_inteira():
    with pytest.raises(ErroDeNegocio):
        motor.adaptar(MATERIAL, CONJUNTO, ClienteFalso(falhar_em="adaptacao 2/"))


# --- Arquivo de regras (RNF13, RN08) ---------------------------------------------

def test_regra_do_modelo_sem_instrucao_e_recusada(tmp_path):
    dados = json.loads(ARQUIVO.read_text(encoding="utf-8"))
    del dados["regras"][0]["instrucao"]
    arquivo = tmp_path / "regras.json"
    arquivo.write_text(json.dumps(dados), encoding="utf-8")

    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert "TEA-01" in erro.value.motivo


def test_arquivo_invalido_e_recusado_com_explicacao(tmp_path):
    arquivo = tmp_path / "regras.json"
    arquivo.write_text("{ isto não é json", encoding="utf-8")
    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert erro.value.regra == "RNF13"
