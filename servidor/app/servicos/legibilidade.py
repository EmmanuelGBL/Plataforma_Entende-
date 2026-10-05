"""CalculadoraLegibilidade — RF07, sob RN10.

Mede o texto original e o adaptado com as mesmas funções, e devolve as duas
medidas sempre — inclusive quando a adaptação piora o número (RN10). O total
de palavras, por exemplo, quase sempre sobe: explicar termo (TEA-05) e dividir
período (TEA-01) alongam o texto.

O índice de facilidade de leitura é o de Flesch adaptado para o português
por Martins et al. (1996):

    ILF = 248,835 − 1,015 × (palavras / frases) − 84,6 × (sílabas / palavras)

com as faixas de escolaridade propostas pelos autores. A contagem de sílabas
é heurística (grupos de vogais, com tratamento de hiato acentuado, de "qu" e
"gu" e de hiato final como em "dia"): erra em palavras isoladas, e acerta o
suficiente na média de um texto inteiro, que é o que o índice usa.

Isto NÃO é o NILC-Metrix. O NILC-Metrix segue sendo o instrumento da
verificação de RNF03 na validação do trabalho; a calculadora existe para dar
ao professor a comparação na hora, dentro do sistema.
"""

import re
from dataclasses import dataclass

from . import texto as md

_VOGAIS = "aeiouáéíóúâêôãõàü"
_PALAVRA = re.compile(r"[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*")
_FIM_DE_FRASE = re.compile(r"(?<=[.!?…])\s+")


@dataclass(frozen=True)
class Indicador:
    codigo: str
    nome: str
    sentido: str  # "menor" é melhor, "maior" é melhor, ou "neutro"
    leitura: str


INDICADORES = [
    Indicador(
        "palavras_por_frase",
        "Palavras por frase",
        "menor",
        "Quanto menor, menos informação o leitor precisa segurar por vez.",
    ),
    Indicador(
        "palavras_longas",
        "Palavras longas (4 sílabas ou mais), em %",
        "menor",
        "Palavra longa costuma ser palavra menos frequente. As que restam no texto adaptado "
        "tendem a ser termos do conteúdo, explicados na primeira vez (TEA-05).",
    ),
    Indicador(
        "indice_flesch",
        "Índice de facilidade de leitura (Flesch, adaptado ao português)",
        "maior",
        "De 0 a 100: quanto maior, mais fácil. A partir de 75, o texto corresponde aos anos "
        "iniciais do fundamental, que é a meta de RNF03.",
    ),
    Indicador(
        "total_palavras",
        "Total de palavras",
        "neutro",
        "Explicar termos e dividir períodos alonga o material. É o custo conhecido da "
        "adaptação, e ele é mostrado sempre (RN10).",
    ),
]


def contar_silabas(palavra: str) -> int:
    palavra = palavra.lower()
    # "qu" e "gu" antes de vogal: o "u" não forma sílaba (quando, água, guerra).
    palavra = re.sub(r"([qg])u(?=[aeioáéíóâêôãõ])", r"\1", palavra)
    grupos = re.findall(f"[{_VOGAIS}]+", palavra)
    silabas = len(grupos)
    for grupo in grupos:
        # Hiato marcado por acento: sa-í-da, sa-ú-de, pa-ís.
        if len(grupo) > 1 and any(v in grupo for v in "íú"):
            silabas += 1
    # Hiato final átono: di-a, ri-o, ru-a, his-tó-ri-a.
    if re.search(f"[^{_VOGAIS}](ia|io|ua|uo|ea|eo|oa)s?$", palavra):
        silabas += 1
    return max(silabas, 1)


def _frases_do_texto(texto: str) -> list[str]:
    # Títulos e tabelas ficam de fora nos dois textos: título não é frase, e
    # contá-lo como frase curta melhoraria o índice artificialmente.
    frases = []
    for bloco in md.ler(texto):
        if bloco.tipo in ("paragrafo", "item"):
            frases += [f for f in _FIM_DE_FRASE.split(bloco.texto) if _PALAVRA.search(f)]
    return frases


def medir(texto: str) -> dict[str, float]:
    frases = _frases_do_texto(texto)
    palavras = [p for f in frases for p in _PALAVRA.findall(f)]
    if not palavras:
        return {i.codigo: 0.0 for i in INDICADORES}
    silabas = [contar_silabas(p) for p in palavras]
    por_frase = len(palavras) / len(frases)
    flesch = 248.835 - 1.015 * por_frase - 84.6 * (sum(silabas) / len(palavras))
    return {
        "palavras_por_frase": round(por_frase, 1),
        "palavras_longas": round(100 * sum(s >= 4 for s in silabas) / len(palavras), 1),
        "indice_flesch": round(max(0.0, min(100.0, flesch)), 1),
        "total_palavras": float(len(palavras)),
    }


def faixa_escolar(indice_flesch: float) -> str:
    """Faixas de Martins et al. (1996), com a nomenclatura escolar atual."""
    if indice_flesch >= 75:
        return "Anos iniciais do fundamental"
    if indice_flesch >= 50:
        return "Anos finais do fundamental"
    if indice_flesch >= 25:
        return "Ensino médio"
    return "Ensino superior"


def situacao(indicador: Indicador, original: float, adaptado: float) -> str:
    if indicador.sentido == "neutro":
        return "atencao" if adaptado > original * 1.05 else "igual"
    if abs(adaptado - original) < 0.05:
        return "igual"
    melhorou = adaptado < original if indicador.sentido == "menor" else adaptado > original
    return "melhora" if melhorou else "piora"
