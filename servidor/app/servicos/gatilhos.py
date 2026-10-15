"""Gatilhos — a parte do motor híbrido que decide, sem modelo de linguagem,
quais blocos do material precisam de reescrita e por quais regras.

O motor antigo mandava o material inteiro ao modelo, e o modelo devolvia o
material inteiro — inclusive o que não mudava. Aqui o código lê cada parágrafo
e item e só marca o bloco em que encontrou o que uma regra corrige:

- período com mais palavras que o limite (TEA-01);
- parágrafo com mais frases que o limite (TEA-02);
- expressão da lista do arquivo (TEA-03);
- forma de "ser" seguida de particípio, a voz passiva (TEA-04);
- texto longo demais desde o último título (TEA-07).

Bloco sem marca nenhuma não vai ao modelo e fica como está no original.

O gatilho é deliberadamente generoso: marcar a mais custa um pedido; marcar a
menos deixa o texto sem adaptar. Por isso a voz passiva é detectada por um
padrão simples, que também pega "é rápido" — o modelo recebe o bloco, não
encontra passiva e não muda nada, e o registro (RF06) continua vazio para ele.

Os limites ficam no arquivo de regras (RNF13), não aqui.
"""

import re

from . import texto as md
from .regras import ConjuntoDeclarado, RegraDeclarada

# Só parágrafo e item têm texto corrido para reescrever. Título e tabela vão
# ao modelo apenas como contexto.
TIPOS_ADAPTAVEIS = ("paragrafo", "item")

_PALAVRA = re.compile(r"[A-Za-zÀ-ÿ0-9]+(?:-[A-Za-zÀ-ÿ]+)*")
_FIM_DE_FRASE = re.compile(r"(?<=[.!?…])\s+")
_PASSIVA = re.compile(
    r"\b(?:é|são|foi|foram|era|eram|será|serão|seria|seriam|seja|sejam|fosse|fossem|ser|sendo|sido)"
    r"\s+(?:\w+mente\s+)?"
    r"(?:\w+(?:ad|id)|feit|escrit|abert|cobert|dit|vist|post|pres|eleit|aceit)[oa]s?\b",
    re.IGNORECASE,
)


def frases(texto: str) -> list[str]:
    return [f for f in _FIM_DE_FRASE.split(texto) if _PALAVRA.search(f)]


def contar_palavras(texto: str) -> int:
    return len(_PALAVRA.findall(texto))


def tem_voz_passiva(texto: str) -> bool:
    return _PASSIVA.search(texto) is not None


def tem_expressao(texto: str, expressoes: list[str]) -> bool:
    return any(
        re.search(rf"(?<!\w){re.escape(e)}(?!\w)", texto, re.IGNORECASE) for e in expressoes
    )


def marcar(blocos: list[md.Bloco], conjunto: ConjuntoDeclarado) -> dict[int, list[str]]:
    """Para cada bloco que precisa do modelo, os códigos das regras que ele
    deve receber, na ordem do arquivo. Bloco que não aparece no resultado não
    vai ao modelo."""
    regras = conjunto.regras_do_modelo()
    marcas: dict[int, list[str]] = {}
    palavras_desde_titulo = 0
    anterior: md.Bloco | None = None

    for indice, bloco in enumerate(blocos):
        if bloco.tipo == "titulo":
            palavras_desde_titulo = 0
            anterior = bloco
            continue
        if bloco.tipo in TIPOS_ADAPTAVEIS:
            disparadas = {
                r.codigo for r in regras if _dispara(r, bloco, anterior, palavras_desde_titulo)
            }
            disparadas = _acompanhantes(regras, disparadas)
            if disparadas:
                marcas[indice] = [r.codigo for r in regras if r.codigo in disparadas]
        palavras_desde_titulo += contar_palavras(bloco.texto)
        anterior = bloco
    return marcas


def _dispara(
    regra: RegraDeclarada, bloco: md.Bloco, anterior: md.Bloco | None, palavras_desde_titulo: int
) -> bool:
    gatilho = regra.gatilho
    if gatilho is None:
        return True
    texto = bloco.texto
    if gatilho.palavras_por_frase_acima_de and any(
        contar_palavras(f) > gatilho.palavras_por_frase_acima_de for f in frases(texto)
    ):
        return True
    if gatilho.frases_por_paragrafo_acima_de and (
        bloco.tipo == "paragrafo" and len(frases(texto)) > gatilho.frases_por_paragrafo_acima_de
    ):
        return True
    if gatilho.voz_passiva and tem_voz_passiva(texto):
        return True
    if gatilho.expressoes and tem_expressao(texto, gatilho.expressoes):
        return True
    if gatilho.palavras_sem_titulo_acima_de and (
        bloco.tipo == "paragrafo"
        and anterior is not None
        and anterior.tipo != "titulo"
        and palavras_desde_titulo > gatilho.palavras_sem_titulo_acima_de
    ):
        return True
    return False


def _acompanhantes(regras: list[RegraDeclarada], disparadas: set[str]) -> set[str]:
    # Repete até estabilizar: uma regra que acompanha outra acompanhante
    # também entra. Com dez regras, termina em duas ou três voltas.
    while True:
        novas = {
            r.codigo
            for r in regras
            if r.codigo not in disparadas
            and r.gatilho
            and any(c in disparadas or (c == "*" and disparadas) for c in r.gatilho.acompanha)
        }
        if not novas:
            return disparadas
        disparadas = disparadas | novas
