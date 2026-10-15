"""MotorAdaptacao, gatilhos e conjunto de regras — RF05, RF06, RN01, RN08,
RNF13, RNF14.

Sobre RNF14 ("testes automatizados cobrindo cada regra"): o teste
parametrizado abaixo passa por TODAS as regras do arquivo e confere que cada
uma chega aonde deve — a instrução ao modelo, o glossário, o código da
estrutura ou a folha impressa. Os testes de gatilho conferem, regra a regra,
quando o código decide pedir a reescrita. O que nenhum teste automatizado
mede é se o modelo de linguagem reescreveu bem: isso é a validação com
especialistas (OE3), não a suíte.
"""

import json

import pytest

from app.config import PASTA_SERVIDOR
from app.erros import ErroDeNegocio
from app.modelos import AplicacaoDaRegra
from app.servicos import gatilhos, motor, regras
from app.servicos import texto as md

from .cliente_falso import ClienteFalso

ARQUIVO = PASTA_SERVIDOR / "regras" / "tea.json"
CONJUNTO, _ = regras.carregar(ARQUIVO)
GLOSSARIO = next(r for r in CONJUNTO.regras if r.codigo == "TEA-05").glossario

FRASE_LONGA = (
    "As plantas produzem o próprio alimento por meio de um processo chamado fotossíntese, "
    "que usa a luz do sol, a água do solo e o gás carbônico do ar."
)

MATERIAL = f"""# Capítulo 3 - A fotossíntese

## O que é

{FRASE_LONGA}

## Onde acontece

A fotossíntese acontece nas folhas. A clorofila captura a luz.

## De noite

De noite não há luz. A fotossíntese para."""

# Dispara todas as regras do modelo, e tem duas seções para a TEA-09.
MATERIAL_COMPLETO = f"""# Os seres vivos

## Plantas

{FRASE_LONGA}

A água é absorvida pelas raízes.

A folha é a fábrica de alimento da planta.

## Animais

Os peixes vivem na água. As aves voam. Os cães latem. Os gatos miam.

Os animais precisam de alimento para viver e crescer. Alguns comem plantas e outros comem \
outros animais. Os que comem plantas são chamados de herbívoros e vivem em vários lugares.

Muitos animais vivem em grupo e cuidam dos filhotes até que eles cresçam. Outros vivem \
sozinhos durante quase toda a vida. Cada espécie tem um jeito próprio de viver.

Os animais respiram, se alimentam e se reproduzem. Eles também reagem ao ambiente em que \
vivem. Por isso, o frio e o calor mudam o comportamento de muitos deles.

Alguns animais dormem durante o inverno. Outros mudam de lugar quando o clima esfria. As \
aves que fazem isso viajam por muitos quilômetros.

O solo também guarda vida. Minhocas e fungos vivem nele."""


def _adaptar(material=MATERIAL, cliente=None):
    cliente = cliente or ClienteFalso()
    return motor.adaptar(material, CONJUNTO, cliente), cliente


def _marcas(texto: str) -> list[str]:
    """As regras marcadas no único parágrafo de `texto`."""
    return gatilhos.marcar(md.ler(texto), CONJUNTO).get(0, [])


# --- Cada regra do arquivo (RNF14) -------------------------------------------

@pytest.mark.parametrize("regra", CONJUNTO.regras, ids=lambda r: r.codigo)
def test_cada_regra_chega_aonde_deve(regra):
    resultado, cliente = _adaptar(MATERIAL_COMPLETO)
    sistemas = " ".join(c["sistema"] for c in cliente.chamadas)
    codigos_dos_esquemas = {
        codigo
        for c in cliente.chamadas
        for codigo in c["esquema"]["properties"]["adaptados"]["items"]["properties"]["resultado"][
            "items"
        ]["properties"]["regras_aplicadas"]["items"]["enum"]
    }

    if regra.aplicacao is AplicacaoDaRegra.MODELO:
        assert f"{regra.codigo} ({regra.nome}): {regra.instrucao}" in sistemas
        assert regra.codigo in codigos_dos_esquemas
    else:
        # Glossário, estrutura e apresentação não são pedidos ao modelo.
        assert regra.codigo not in sistemas
        assert regra.codigo not in codigos_dos_esquemas
    if regra.aplicacao in (AplicacaoDaRegra.GLOSSARIO, AplicacaoDaRegra.ESTRUTURA):
        assert any(regra.codigo in b.regras for b in resultado.blocos)


def test_arquivo_do_projeto_e_valido_e_tem_as_dez_regras():
    assert CONJUNTO.identificador.value == "TEA"
    assert [r.codigo for r in CONJUNTO.regras] == [f"TEA-{n:02d}" for n in range(1, 11)]


# --- Gatilhos: quando o código pede a reescrita ----------------------------------

def test_frase_longa_dispara_tea01_e_leva_conectivo_e_linguagem_literal_junto():
    assert _marcas(FRASE_LONGA) == ["TEA-01", "TEA-03", "TEA-06"]


def test_paragrafo_sem_nada_a_corrigir_nao_e_marcado():
    assert _marcas("A fotossíntese acontece nas folhas. A clorofila captura a luz.") == []


def test_voz_passiva_dispara_tea04():
    assert "TEA-04" in _marcas("A água é absorvida pelas raízes.")
    assert "TEA-04" in _marcas("Os textos foram escritos pela turma.")
    assert "TEA-04" not in _marcas("A raiz absorve a água.")


def test_expressao_da_lista_dispara_tea03():
    assert _marcas("A folha é a fábrica de alimento da planta.") == ["TEA-03"]
    # A expressão vale como palavra inteira: "fabricação" não é "fábrica".
    assert _marcas("A fabricação do papel usa madeira.") == []


def test_paragrafo_com_muitas_frases_dispara_tea02():
    assert "TEA-02" in _marcas("Os peixes nadam. As aves voam. Os cães latem. Os gatos miam.")
    assert "TEA-02" not in _marcas("Os peixes nadam. As aves voam. Os cães latem.")


def test_texto_longo_sem_titulo_dispara_tea07_so_depois_do_limite():
    frase = "Os animais vivem em muitos lugares diferentes do mundo. "
    blocos = md.ler("## Animais\n\n" + "\n\n".join([frase * 3] * 6))
    marcas = gatilhos.marcar(blocos, CONJUNTO)
    com_tea07 = [i for i, codigos in marcas.items() if "TEA-07" in codigos]
    # 27 palavras por parágrafo: passa de 120 a partir do sexto bloco (o
    # quinto parágrafo depois do título).
    assert com_tea07 == [6]


def test_titulo_e_tabela_nunca_sao_marcados():
    blocos = md.ler(f"# {FRASE_LONGA}\n\n| a | b |\n| --- | --- |\n| {FRASE_LONGA} | x |")
    assert gatilhos.marcar(blocos, CONJUNTO) == {}


# --- Motor -------------------------------------------------------------------------

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


def test_so_vai_ao_modelo_o_bloco_marcado_com_as_regras_dele():
    resultado, cliente = _adaptar()
    adaptacoes = [c for c in cliente.chamadas if c["tarefa"].startswith("adaptacao")]
    # Das três seções, só a primeira tem o que corrigir.
    assert len(adaptacoes) == 1
    pedido = adaptacoes[0]["conteudo"]
    assert "[B1] # Capítulo 3 - A fotossíntese" in pedido  # contexto
    assert pedido.endswith("Blocos a adaptar e as regras de cada um:\n- B3: TEA-01, TEA-03, TEA-06")
    assert "TEA-04" not in adaptacoes[0]["sistema"]
    assert (resultado.blocos_adaptaveis, resultado.blocos_ao_modelo, resultado.pedidos) == (3, 1, 1)


def test_material_sem_nada_a_reescrever_nao_chama_o_modelo():
    resultado, cliente = _adaptar("## Folhas\n\nA clorofila captura a luz.\n\n## Raízes\n\nA raiz absorve a água.")
    assert cliente.chamadas == []
    assert resultado.pedidos == 0
    # O código continua fazendo a parte dele: glossário e estrutura.
    assert any("TEA-05" in b.regras for b in resultado.blocos)
    assert any("TEA-09" in b.regras for b in resultado.blocos)


def test_motor_registra_regra_por_bloco_e_o_trecho_de_origem():
    resultado, _ = _adaptar()
    dividido = [b for b in resultado.blocos if b.trecho_original == FRASE_LONGA]
    assert dividido and all("TEA-01" in b.regras for b in dividido)
    # Bloco que não foi ao modelo não recebe regra de reescrita.
    intacto = next(b for b in resultado.blocos if b.texto == "De noite não há luz. A fotossíntese para.")
    assert intacto.regras == []


def test_regra_nao_pedida_para_o_bloco_e_descartada():
    for extra in ("TEA-99", "TEA-04"):
        resultado, _ = _adaptar(cliente=ClienteFalso(regra_extra=extra))
        assert all(extra not in b.regras for b in resultado.blocos)


class _ClienteQueResponde:
    modelo = "fixo"

    def __init__(self, resposta):
        self.resposta = resposta

    def gerar_json(self, tarefa, sistema, conteudo, esquema):
        return self.resposta


@pytest.mark.parametrize(
    "resposta",
    [
        {"adaptados": []},
        {"adaptados": [{"bloco": "B3", "resultado": []}]},
        {"adaptados": [{"bloco": "B3", "resultado": [
            {"tipo": "titulo", "nivel": 3, "texto": "Alimento", "regras_aplicadas": ["TEA-07"]}
        ]}]},
    ],
    ids=["bloco-nao-devolvido", "resultado-vazio", "so-subtitulo"],
)
def test_rn01_bloco_que_o_modelo_nao_devolve_fica_como_no_original(resposta):
    resultado, _ = _adaptar(cliente=_ClienteQueResponde(resposta))
    textos = [b.texto for b in resultado.blocos]
    assert any(t.startswith("As plantas produzem o próprio alimento") for t in textos)


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
        motor.adaptar(MATERIAL_COMPLETO, CONJUNTO, ClienteFalso(falhar_em="adaptacao 2/"))


# --- Glossário (TEA-05) ----------------------------------------------------------

def _glossario(*textos: str) -> list[md.Bloco]:
    regra = next(r for r in CONJUNTO.regras if r.codigo == "TEA-05")
    return motor.aplicar_glossario(list(md.ler("\n\n".join(textos))), regra)


def test_glossario_explica_so_a_primeira_ocorrencia():
    blocos = _glossario("A clorofila é verde.", "Sem clorofila não há fotossíntese.")
    assert blocos[0].texto == f"A clorofila ({GLOSSARIO['clorofila']}) é verde."
    assert blocos[0].regras == ["TEA-05"]
    assert blocos[0].trecho_original == "A clorofila é verde."
    assert "clorofila (" not in blocos[1].texto
    assert f"fotossíntese ({GLOSSARIO['fotossíntese']})" in blocos[1].texto


def test_glossario_nao_explica_termo_que_esta_dentro_de_outra_explicacao():
    # A explicação de "fotossíntese" fala em "gás carbônico".
    blocos = _glossario("A fotossíntese acontece na folha.", "O gás carbônico vem do ar.")
    assert blocos[0].texto.count("(") == 1
    assert f"gás carbônico ({GLOSSARIO['gás carbônico']})" in blocos[1].texto


def test_glossario_ignora_titulo_e_termo_ja_explicado():
    blocos = _glossario("# A clorofila", "A clorofila (o verde da folha) captura luz.")
    assert blocos[0].texto == "A clorofila"
    assert blocos[1].texto == "A clorofila (o verde da folha) captura luz."
    assert blocos[1].regras == []


def test_glossario_acha_o_plural_e_ignora_maiusculas():
    blocos = _glossario("Decompositores vivem no solo.")
    assert blocos[0].texto.startswith(f"Decompositores ({GLOSSARIO['decompositor']})")


# --- Arquivo de regras (RNF13, RN08) ---------------------------------------------

def _arquivo_alterado(tmp_path, alterar):
    dados = json.loads(ARQUIVO.read_text(encoding="utf-8"))
    alterar({r["codigo"]: r for r in dados["regras"]})
    arquivo = tmp_path / "regras.json"
    arquivo.write_text(json.dumps(dados), encoding="utf-8")
    return arquivo


def test_regra_do_modelo_sem_instrucao_e_recusada(tmp_path):
    arquivo = _arquivo_alterado(tmp_path, lambda r: r["TEA-01"].pop("instrucao"))
    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert "TEA-01" in erro.value.motivo


def test_regra_de_glossario_sem_termos_e_recusada(tmp_path):
    arquivo = _arquivo_alterado(tmp_path, lambda r: r["TEA-05"].pop("glossario"))
    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert "TEA-05" in erro.value.motivo


def test_acompanha_regra_inexistente_e_recusado(tmp_path):
    arquivo = _arquivo_alterado(tmp_path, lambda r: r["TEA-06"]["gatilho"].update(acompanha=["TEA-42"]))
    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert "TEA-06" in erro.value.motivo


def test_gatilho_com_campo_desconhecido_e_recusado(tmp_path):
    arquivo = _arquivo_alterado(tmp_path, lambda r: r["TEA-01"]["gatilho"].update(palavras=10))
    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert erro.value.regra == "RNF13"


def test_arquivo_invalido_e_recusado_com_explicacao(tmp_path):
    arquivo = tmp_path / "regras.json"
    arquivo.write_text("{ isto não é json", encoding="utf-8")
    with pytest.raises(ErroDeNegocio) as erro:
        regras.carregar(arquivo)
    assert erro.value.regra == "RNF13"
