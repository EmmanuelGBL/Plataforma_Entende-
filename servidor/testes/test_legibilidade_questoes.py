"""CalculadoraLegibilidade (RF07, RN10) e GeradorQuestoes (RF13, RN04)."""

import pytest

from app.servicos import legibilidade, questoes

from .cliente_falso import QUESTAO_FORA_DO_TEXTO, ClienteFalso

ORIGINAL = (
    "Desde os tempos mais remotos, as plantas, que são organismos autotróficos, vêm sendo "
    "consideradas verdadeiras fábricas verdes, pois é por meio delas que a energia luminosa "
    "proveniente do Sol acaba sendo transformada em energia química."
)
ADAPTADO = (
    "## O que é a fotossíntese\n\n"
    "A planta produz o próprio alimento. Esse processo se chama fotossíntese.\n\n"
    "A planta usa a luz do Sol. A energia da luz fica guardada no alimento."
)


@pytest.mark.parametrize(
    ("palavra", "silabas"),
    [
        ("planta", 2),
        ("fotossíntese", 5),
        ("alimento", 4),
        ("saúde", 3),
        ("dia", 2),
        ("noite", 2),
        ("água", 2),
        ("quando", 2),
        ("pão", 1),
    ],
)
def test_contagem_de_silabas(palavra, silabas):
    assert legibilidade.contar_silabas(palavra) == silabas


def test_texto_adaptado_fica_mais_facil_que_o_original():
    original = legibilidade.medir(ORIGINAL)
    adaptado = legibilidade.medir(ADAPTADO)

    assert original["palavras_por_frase"] == 35.0
    assert adaptado["palavras_por_frase"] < 8
    assert adaptado["indice_flesch"] > original["indice_flesch"]
    assert legibilidade.faixa_escolar(original["indice_flesch"]) == "Ensino superior"
    assert legibilidade.faixa_escolar(adaptado["indice_flesch"]) == "Anos finais do fundamental"


def test_titulo_nao_conta_como_frase():
    sem_titulo = legibilidade.medir(ADAPTADO.split("\n\n", 1)[1])
    assert legibilidade.medir(ADAPTADO) == sem_titulo


def test_rn10_aumento_do_total_de_palavras_e_sinalizado():
    total = next(i for i in legibilidade.INDICADORES if i.codigo == "total_palavras")
    assert legibilidade.situacao(total, 100, 130) == "atencao"
    assert legibilidade.situacao(total, 100, 101) == "igual"


def test_piora_e_dita_como_piora():
    flesch = next(i for i in legibilidade.INDICADORES if i.codigo == "indice_flesch")
    assert legibilidade.situacao(flesch, 60, 40) == "piora"
    assert legibilidade.situacao(flesch, 40, 60) == "melhora"


def test_texto_vazio_nao_quebra():
    assert legibilidade.medir("# Só título") == {
        "palavras_por_frase": 0.0, "palavras_longas": 0.0, "indice_flesch": 0.0, "total_palavras": 0.0,
    }


# --- Questões --------------------------------------------------------------------

def test_rn04_questao_sobre_conteudo_de_fora_e_descartada():
    geradas = questoes.gerar(ADAPTADO, ClienteFalso())
    assert geradas
    assert all(q.enunciado != QUESTAO_FORA_DO_TEXTO for q in geradas)


def test_embaralhar_alternativas_mantem_a_resposta_certa():
    for _ in range(20):
        for q in questoes.gerar(ADAPTADO, ClienteFalso()):
            assert q.alternativas[q.correta] == q.trecho


@pytest.mark.parametrize(
    "defeito",
    [
        {"correta": 7},
        {"alternativas": ["Sim"]},
        {"alternativas": ["Sim", "sim", "Não"]},
        {"enunciado": ""},
    ],
)
def test_questao_malformada_e_descartada(defeito):
    item = {
        "enunciado": "Pergunta?",
        "alternativas": ["A planta produz o próprio alimento.", "Não", "Talvez"],
        "correta": 0,
        "trecho": "A planta produz o próprio alimento.",
        "dica": "",
    } | defeito
    assert questoes._validar(item, "a planta produz o próprio alimento") is None
