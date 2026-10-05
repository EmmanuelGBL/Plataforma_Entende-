"""GeradorQuestoes — RF13, sob RN04.

As questões saem do texto adaptado (que, por RN01, tem o mesmo conteúdo do
original, na linguagem que o estudante vai ler). RN04 é conferida, e não só
pedida: cada questão traz o trecho do texto em que a resposta está, e a
questão cujo trecho não é encontrado no texto é descartada. Questão sobre
conteúdo de fora do material não passa.
"""

import logging
import random
from dataclasses import dataclass

from . import texto as md
from .cliente_llm import ClienteLLM

log = logging.getLogger("entende")

QUANTIDADE = 5

SISTEMA = """\
Você escreve questões de múltipla escolha para estudantes do 5º ano do ensino \
fundamental com Transtorno do Espectro Autista (TEA), a partir de um texto didático.

Regras:
- Use só informação que está no texto. Nada de conhecimento de fora (regra RN04).
- Uma pergunta por questão, direta e literal, sem ironia, sem pegadinha, sem dupla negação.
- Enunciado curto, em ordem direta, com palavras que estão no texto.
- 4 alternativas curtas; só uma correta. As erradas devem ser claramente erradas \
para quem leu o texto, sem jogar com detalhe.
- "correta": a posição da alternativa correta na lista, contando a partir de 0.
- "trecho": a frase do texto que contém a resposta, copiada exatamente como está no texto.
- "dica": uma frase que lembra onde ou o que procurar no texto, sem entregar a resposta.
- Siga a ordem em que os assuntos aparecem no texto.
"""

ESQUEMA = {
    "type": "object",
    "properties": {
        "questoes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "enunciado": {"type": "string"},
                    "alternativas": {"type": "array", "items": {"type": "string"}},
                    "correta": {"type": "integer"},
                    "trecho": {"type": "string"},
                    "dica": {"type": "string"},
                },
                "required": ["enunciado", "alternativas", "correta", "trecho", "dica"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["questoes"],
    "additionalProperties": False,
}


@dataclass
class QuestaoGerada:
    enunciado: str
    alternativas: list[str]
    correta: int
    trecho: str
    dica: str


def gerar(texto: str, cliente: ClienteLLM, quantidade: int = QUANTIDADE) -> list[QuestaoGerada]:
    pedido = f"Escreva {quantidade} questões sobre este texto.\n\n<texto>\n{texto}\n</texto>"
    resposta = cliente.gerar_json("questoes", SISTEMA, pedido, ESQUEMA)
    texto_normalizado = md.normalizar(texto)

    questoes = []
    for item in resposta.get("questoes", []):
        questao = _validar(item, texto_normalizado)
        if questao:
            questoes.append(questao)
    return questoes[:quantidade]


def _validar(item: dict, texto_normalizado: str) -> QuestaoGerada | None:
    enunciado = str(item.get("enunciado", "")).strip()
    alternativas = [str(a).strip() for a in item.get("alternativas", []) if str(a).strip()]
    correta = item.get("correta")
    trecho = str(item.get("trecho", "")).strip()

    if not enunciado or not 2 <= len(alternativas) <= 5:
        return None
    if len({a.lower() for a in alternativas}) != len(alternativas):
        return None
    if not isinstance(correta, int) or not 0 <= correta < len(alternativas):
        return None
    if not trecho or md.normalizar(trecho) not in texto_normalizado:
        log.info("Questão descartada por RN04 (trecho não está no texto): %s", enunciado)
        return None

    # O modelo tende a pôr a correta sempre na mesma posição. Embaralhar na
    # geração resolve; depois de gravada, a ordem não muda mais (G02).
    resposta_certa = alternativas[correta]
    random.shuffle(alternativas)
    return QuestaoGerada(
        enunciado=enunciado,
        alternativas=alternativas,
        correta=alternativas.index(resposta_certa),
        trecho=trecho,
        dica=str(item.get("dica", "")).strip(),
    )
