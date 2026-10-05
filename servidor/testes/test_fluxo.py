"""O fluxo inteiro pela API, como o professor e a criança o percorrem:
enviar → adaptar → revisar → editar → aprovar → publicar → abrir o link →
revogar. Com o cliente falso no lugar do modelo de linguagem."""

import json

from sqlalchemy import func, select

from app.modelos import (
    Adaptacao,
    AplicacaoRegra,
    AtividadePublicada,
    ConjuntoRegras,
    MetricaLegibilidade,
    Questao,
)

from . import amostras
from .cliente_falso import ClienteFalso
from .conftest import cadastrar

PDF = "application/pdf"


def _material(cliente, cabecalho) -> str:
    resposta = cliente.post(
        "/api/materiais",
        headers=cabecalho,
        files={"arquivo": ("ciencias.pdf", amostras.pdf_didatico(), PDF)},
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()["id"]


def _adaptado(cliente, cabecalho) -> tuple[str, dict]:
    material_id = _material(cliente, cabecalho)
    resposta = cliente.post(f"/api/materiais/{material_id}/adaptacoes", headers=cabecalho)
    assert resposta.status_code == 201, resposta.text
    return material_id, resposta.json()


def _contar(cliente, modelo) -> int:
    with cliente.app.state.fabrica_sessao() as sessao:
        return sessao.scalar(select(func.count()).select_from(modelo))


# --- Adaptação ---------------------------------------------------------------

def test_adaptacao_registra_regras_versao_modelo_e_metricas(cliente):
    _, adaptacao = _adaptado(cliente, cadastrar(cliente))

    assert adaptacao["status"] == "GERADA"
    assert adaptacao["modelo"] == ClienteFalso.modelo
    assert adaptacao["conjunto"]["versao"] == "1.3"
    assert len(adaptacao["conjunto"]["regras"]) == 10
    # RF06: a regra de cada trecho, e o trecho de origem
    assert adaptacao["ocorrencias"]["TEA-01"] > 0
    assert adaptacao["ocorrencias"]["TEA-09"] > 0
    aplicacao = next(a for a in adaptacao["aplicacoes"] if a["regra"] == "TEA-01")
    assert aplicacao["trecho_resultante"] in aplicacao["trecho_original"]
    # RF08: o original vem junto para a comparação
    assert adaptacao["blocos_original"][0]["texto"] == "Capítulo 3 - A fotossíntese"
    # RF07 e RN10: as quatro métricas, sempre
    assert [m["codigo"] for m in adaptacao["metricas"]] == [
        "palavras_por_frase", "palavras_longas", "indice_flesch", "total_palavras",
    ]
    assert adaptacao["nivel_adaptado"]


def test_blocos_trazem_a_marca_da_regra(cliente):
    _, adaptacao = _adaptado(cliente, cadastrar(cliente))
    marcados = [b for b in adaptacao["blocos"] if "TEA-01" in b["regras"]]
    assert marcados and all(b["tipo"] == "paragrafo" for b in marcados)


def test_questoes_sao_geradas_junto_e_rn04_e_conferida(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    questoes = cliente.get(f"/api/materiais/{material_id}/questoes", headers=cabecalho).json()

    assert len(questoes) == 3  # a quarta, de fora do texto, foi descartada
    assert all(q["trecho"] for q in questoes)


def test_falha_do_modelo_nao_grava_adaptacao_pela_metade(fabrica_cliente):
    cliente = fabrica_cliente(ClienteFalso(falhar_em="adaptacao"))
    cabecalho = cadastrar(cliente)
    material_id = _material(cliente, cabecalho)

    resposta = cliente.post(f"/api/materiais/{material_id}/adaptacoes", headers=cabecalho)
    assert resposta.status_code == 503
    assert _contar(cliente, Adaptacao) == 0
    assert cliente.get(f"/api/materiais/{material_id}/adaptacao", headers=cabecalho).status_code == 404


def test_falha_nas_questoes_nao_perde_a_adaptacao(fabrica_cliente):
    cliente = fabrica_cliente(ClienteFalso(falhar_em="questoes"))
    cabecalho = cadastrar(cliente)
    material_id = _material(cliente, cabecalho)

    assert cliente.post(f"/api/materiais/{material_id}/adaptacoes", headers=cabecalho).status_code == 201
    assert cliente.get(f"/api/materiais/{material_id}/questoes", headers=cabecalho).json() == []


# --- RF09 e RN02 ---------------------------------------------------------------

def test_edicao_volta_para_revisao_e_recalcula_metricas(cliente):
    cabecalho = cadastrar(cliente)
    material_id, antes = _adaptado(cliente, cabecalho)

    resposta = cliente.put(
        f"/api/materiais/{material_id}/adaptacao/texto",
        headers=cabecalho,
        json={"texto": "# Fotossíntese\n\nA planta faz alimento. Ela usa luz."},
    )
    depois = resposta.json()
    assert depois["status"] == "EM_REVISAO"
    assert depois["editada"] is True
    total = lambda a: next(m for m in a["metricas"] if m["codigo"] == "total_palavras")["adaptado"]  # noqa: E731
    assert total(depois) == 7 and total(antes) != 7


def test_rn02_nao_publica_sem_aprovacao(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)

    resposta = cliente.post(f"/api/materiais/{material_id}/atividade", headers=cabecalho)
    assert resposta.status_code == 409
    assert resposta.json()["erro"]["regra"] == "RN02"


def test_editar_depois_de_aprovar_pede_aprovacao_de_novo(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    cliente.post(f"/api/materiais/{material_id}/adaptacao/aprovacao", headers=cabecalho)

    editada = cliente.put(
        f"/api/materiais/{material_id}/adaptacao/texto", headers=cabecalho, json={"texto": "Outro texto."}
    ).json()
    assert editada["status"] == "EM_REVISAO"
    assert editada["data_aprovacao"] is None


# --- Atividade: publicar, abrir, revogar ---------------------------------------

def test_ciclo_da_atividade(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    cliente.post(f"/api/materiais/{material_id}/adaptacao/aprovacao", headers=cabecalho)

    publicada = cliente.post(f"/api/materiais/{material_id}/atividade", headers=cabecalho).json()
    codigo = publicada["codigo"]
    assert publicada["estado"] == "publicada" and len(codigo) == 6

    # A criança abre sem conta (RF16), e não recebe o trecho que entrega a resposta.
    aberta = cliente.get(f"/api/atividades/{codigo.lower()}")
    assert aberta.status_code == 200
    corpo = aberta.json()
    assert corpo["titulo"] == "Capítulo 3 - A fotossíntese"
    assert len(corpo["questoes"]) == 3
    assert "trecho" not in corpo["questoes"][0]
    assert corpo["questoes"][0]["dica"]

    painel = cliente.get("/api/materiais", headers=cabecalho).json()[0]
    assert painel["estado"] == "aprovada"
    assert painel["versao_regras"] == "TEA v1.3"
    assert painel["atividade"]["codigo"] == codigo

    # RF18 / RN06
    revogada = cliente.delete(f"/api/materiais/{material_id}/atividade", headers=cabecalho).json()
    assert revogada["estado"] == "revogada"
    fechada = cliente.get(f"/api/atividades/{codigo}")
    assert fechada.status_code == 404
    assert fechada.json()["erro"]["saida"] == "Confira o código com o seu professor."

    # Publicar de novo gera outro código: o link revogado não volta a valer.
    nova = cliente.post(f"/api/materiais/{material_id}/atividade", headers=cabecalho).json()
    assert nova["codigo"] != codigo


def test_professor_edita_questoes(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    nova = [{"enunciado": "Onde acontece a fotossíntese?", "alternativas": ["Nas folhas", "Nas raízes"], "correta": 0}]

    salvas = cliente.put(f"/api/materiais/{material_id}/questoes", headers=cabecalho, json=nova).json()
    assert [(q["enunciado"], q["correta"]) for q in salvas] == [("Onde acontece a fotossíntese?", 0)]

    sem_certa = [{"enunciado": "?", "alternativas": ["A", "B"], "correta": 5}]
    erro = cliente.put(f"/api/materiais/{material_id}/questoes", headers=cabecalho, json=sem_certa)
    assert erro.status_code == 422
    assert "resposta certa" in erro.json()["erro"]["titulo"]


def test_publicar_sem_questoes_e_recusado(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    cliente.put(f"/api/materiais/{material_id}/questoes", headers=cabecalho, json=[])
    cliente.post(f"/api/materiais/{material_id}/adaptacao/aprovacao", headers=cabecalho)

    resposta = cliente.post(f"/api/materiais/{material_id}/atividade", headers=cabecalho)
    assert resposta.status_code == 409
    assert resposta.json()["erro"]["regra"] == "RF15"


# --- RF12, RNF13 e RN08 ----------------------------------------------------------

def test_rnf13_alterar_regra_e_reprocessar_sem_reiniciar(cliente):
    cabecalho = cadastrar(cliente)
    material_id, primeira = _adaptado(cliente, cabecalho)
    questoes_antes = cliente.get(f"/api/materiais/{material_id}/questoes", headers=cabecalho).json()

    arquivo = cliente.app.state.configuracao.caminho_regras
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    dados["versao"] = "1.4"
    dados["regras"][0]["instrucao"] = "Frases de no máximo 10 palavras."
    arquivo.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")

    segunda = cliente.post(f"/api/materiais/{material_id}/adaptacoes", headers=cabecalho).json()
    assert primeira["conjunto"]["versao"] == "1.3"
    assert segunda["conjunto"]["versao"] == "1.4"
    assert "Frases de no máximo 10 palavras." in cliente.app.state.cliente_llm.chamadas[-1]["sistema"]
    # RF12: as questões que o professor já tinha não são apagadas
    assert cliente.get(f"/api/materiais/{material_id}/questoes", headers=cabecalho).json() == questoes_antes
    assert _contar(cliente, ConjuntoRegras) == 2


def test_rn08_regra_alterada_sem_trocar_versao_e_recusada(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)

    arquivo = cliente.app.state.configuracao.caminho_regras
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    dados["regras"][0]["instrucao"] = "Instrução trocada às escondidas."
    arquivo.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")

    resposta = cliente.post(f"/api/materiais/{material_id}/adaptacoes", headers=cabecalho)
    assert resposta.status_code == 409
    assert resposta.json()["erro"]["regra"] == "RN08"


def test_regras_vigentes_sao_publicas(cliente):
    regras = cliente.get("/api/regras").json()
    assert regras["versao"] == "1.3"
    assert regras["regras"][7]["aplicacao"] == "apresentacao"


# --- RNF12 e RF20 ----------------------------------------------------------------

def test_rnf12_adaptacao_e_questoes_de_outro_professor_respondem_404(cliente):
    ana = cadastrar(cliente, "ana@escola.am.gov.br")
    bruno = cadastrar(cliente, "bruno@escola.am.gov.br")
    material_id, _ = _adaptado(cliente, ana)

    for metodo, rota in [
        ("get", f"/api/materiais/{material_id}/adaptacao"),
        ("post", f"/api/materiais/{material_id}/adaptacoes"),
        ("post", f"/api/materiais/{material_id}/adaptacao/aprovacao"),
        ("get", f"/api/materiais/{material_id}/questoes"),
        ("post", f"/api/materiais/{material_id}/atividade"),
    ]:
        assert getattr(cliente, metodo)(rota, headers=bruno).status_code == 404, rota


def test_rf20_excluir_material_apaga_tudo_que_dependia_dele(cliente):
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    cliente.post(f"/api/materiais/{material_id}/adaptacao/aprovacao", headers=cabecalho)
    cliente.post(f"/api/materiais/{material_id}/atividade", headers=cabecalho)

    assert cliente.delete(f"/api/materiais/{material_id}", headers=cabecalho).status_code == 204
    for modelo in (Adaptacao, AplicacaoRegra, MetricaLegibilidade, Questao, AtividadePublicada):
        assert _contar(cliente, modelo) == 0, modelo.__name__


def test_datas_saem_com_fuso_horario(cliente):
    # O SQLite devolve data sem fuso; sem ele na resposta, o navegador leria
    # a hora UTC como hora local (4 horas adiantada em Manaus).
    cabecalho = cadastrar(cliente)
    material_id, _ = _adaptado(cliente, cabecalho)
    cliente.post(f"/api/materiais/{material_id}/adaptacao/aprovacao", headers=cabecalho)
    cliente.post(f"/api/materiais/{material_id}/atividade", headers=cabecalho)

    painel = cliente.get("/api/materiais", headers=cabecalho).json()[0]
    for valor in (painel["data_envio"], painel["atividade"]["data_publicacao"]):
        assert valor.endswith("Z") or valor.endswith("+00:00"), valor
