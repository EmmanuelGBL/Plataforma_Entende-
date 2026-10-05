"""RF03 — extração com ordem de leitura e hierarquia; RN09 e RNF08 — recusas."""

import pytest

from app.erros import ErroDeNegocio
from app.modelos import FormatoArquivo
from app.servicos.extrator import _juntar, extrair

from . import amostras

LIMITE = 20


def _titulos(extracao):
    return [(b.nivel, b.texto) for b in extracao.blocos if b.tipo == "titulo"]


def _recusa(conteudo: bytes, nome: str) -> ErroDeNegocio:
    with pytest.raises(ErroDeNegocio) as erro:
        extrair(conteudo, nome, LIMITE)
    return erro.value


# --- PDF -------------------------------------------------------------------

def test_pdf_preserva_hierarquia_de_titulos():
    extracao = extrair(amostras.pdf_didatico(), "ciencias.pdf", LIMITE)

    assert extracao.formato is FormatoArquivo.PDF
    assert _titulos(extracao) == [
        (1, "Capítulo 3 - A fotossíntese"),
        (2, "Parte 1: o que as plantas precisam"),
        (2, "Parte 2: o que as plantas precisam"),
    ]


def test_pdf_preserva_ordem_de_leitura_e_junta_linhas_do_paragrafo():
    extracao = extrair(amostras.pdf_didatico(), "ciencias.pdf", LIMITE)
    tipos = [b.tipo for b in extracao.blocos]
    paragrafos = [b.texto for b in extracao.blocos if b.tipo == "paragrafo"]

    assert tipos[:7] == ["titulo", "titulo", "paragrafo", "paragrafo", "item", "item", "item"]
    # O parágrafo quebra em várias linhas no PDF e volta inteiro.
    assert paragrafos == [amostras.PARAGRAFO_1, amostras.PARAGRAFO_2] * 2


def test_pdf_reconhece_itens_de_lista():
    extracao = extrair(amostras.pdf_didatico(paginas=1), "ciencias.pdf", LIMITE)
    assert [b.texto for b in extracao.blocos if b.tipo == "item"] == amostras.ITENS


def test_pdf_de_uma_pagina_mantem_o_cabecalho():
    # Com uma página só não há repetição que denuncie o cabeçalho, e o
    # extrator prefere manter uma linha a mais do que apagar conteúdo.
    texto = extrair(amostras.pdf_didatico(paginas=1), "ciencias.pdf", LIMITE).texto
    assert texto.startswith(amostras.CABECALHO)


def test_pdf_remove_cabecalho_e_numero_de_pagina():
    texto = extrair(amostras.pdf_didatico(paginas=3), "ciencias.pdf", LIMITE).texto

    assert "Coleção Aprender Juntos" not in texto
    assert "\n\n1\n\n" not in texto and not texto.rstrip().endswith("3")


def test_texto_em_markdown_marca_o_nivel():
    texto = extrair(amostras.pdf_didatico(), "ciencias.pdf", LIMITE).texto
    assert texto.startswith("# Capítulo 3 - A fotossíntese\n\n## Parte 1")
    assert "- Luz do sol" in texto


def test_rn09_recusa_pdf_com_uma_pagina_so_de_imagem():
    erro = _recusa(amostras.pdf_paginas_de_imagem([True, False, True]), "misto.pdf")
    assert erro.regra == "RN09"
    assert "A página 2 é uma imagem" in erro.motivo


def test_rn09_lista_todas_as_paginas_sem_texto():
    erro = _recusa(amostras.pdf_paginas_de_imagem([True, False, False]), "misto.pdf")
    assert "As páginas 2 e 3 são imagens" in erro.motivo


def test_rn09_recusa_pdf_digitalizado_inteiro():
    erro = _recusa(amostras.pdf_paginas_de_imagem([False, False]), "digitalizado.pdf")
    assert erro.regra == "RN09"
    assert "OCR" in erro.saida


def test_rnf08_recusa_pdf_acima_de_20_paginas():
    erro = _recusa(amostras.pdf_com_paginas(21), "apostila.pdf")
    assert erro.regra == "RNF08"
    assert erro.status == 413
    assert "21 páginas" in erro.motivo


def test_rnf08_aceita_exatamente_20_paginas():
    assert extrair(amostras.pdf_com_paginas(20), "apostila.pdf", LIMITE).numero_paginas == 20


def test_pdf_protegido_por_senha_e_recusado_com_explicacao():
    erro = _recusa(amostras.pdf_com_senha(), "protegido.pdf")
    assert "senha" in erro.motivo


# --- Formato ---------------------------------------------------------------

def test_imagem_renomeada_para_pdf_e_recusada():
    erro = _recusa(amostras.png(), "foto.pdf")
    assert erro.regra == "RF02"
    assert "não é um PDF" in erro.motivo


def test_doc_antigo_recebe_instrucao_de_conversao():
    erro = _recusa(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\0" * 600, "prova.doc")
    assert ".doc" in erro.titulo
    assert "Salvar como" in erro.saida


# --- DOCX ------------------------------------------------------------------

def test_docx_preserva_hierarquia_pelo_estilo():
    extracao = extrair(amostras.docx_didatico(), "ciencias.docx", LIMITE)

    assert extracao.formato is FormatoArquivo.DOCX
    assert _titulos(extracao) == [
        (1, "Capítulo 3 - A fotossíntese"),
        (2, "O que as plantas precisam"),
    ]


def test_docx_mantem_a_ordem_entre_paragrafo_lista_e_tabela():
    extracao = extrair(amostras.docx_didatico(), "ciencias.docx", LIMITE)
    assert [b.tipo for b in extracao.blocos] == [
        "titulo", "titulo", "paragrafo", "item", "item", "item", "paragrafo", "tabela",
    ]


def test_docx_tabela_sai_como_tabela():
    texto = extrair(amostras.docx_didatico(), "ciencias.docx", LIMITE).texto
    assert "| Entra na planta | Sai da planta |\n| --- | --- |\n| Gás carbônico | Gás oxigênio |" in texto


def test_rn09_recusa_docx_sem_texto_suficiente():
    erro = _recusa(amostras.docx_quase_vazio(), "figura.docx")
    assert erro.regra == "RN09"


# --- Junção de linhas ------------------------------------------------------

@pytest.mark.parametrize(
    ("linha", "continuacao", "esperado"),
    [
        ("processo de fotossín-", "tese das plantas", "processo de fotossíntese das plantas"),
        ("a luz do", "sol", "a luz do sol"),
        ("a cidade de", "Manaus", "a cidade de Manaus"),
        ("ver Mato-", "Grosso", "ver Mato-Grosso"),
    ],
)
def test_juntar_desfaz_hifenizacao_so_antes_de_minuscula(linha, continuacao, esperado):
    assert _juntar(linha, continuacao) == esperado
