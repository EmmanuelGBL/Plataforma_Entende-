"""Cliente de modelo de linguagem para os testes: sem rede, sem custo e
previsível. Faz uma "adaptação" mecânica — cada frase do original vira um
parágrafo, marcado com TEA-01 — e uma questão por frase do texto."""

import re

from app.erros import ErroDeNegocio
from app.servicos import texto as md

QUESTAO_FORA_DO_TEXTO = "Qual é a capital da França?"


class ClienteFalso:
    modelo = "modelo-falso-de-teste"

    def __init__(self, falhar_em: str | None = None, regra_extra: str | None = None):
        self.falhar_em = falhar_em
        self.regra_extra = regra_extra
        self.chamadas: list[dict] = []

    def gerar_json(self, tarefa: str, sistema: str, conteudo: str, esquema: dict) -> dict:
        self.chamadas.append({"tarefa": tarefa, "sistema": sistema, "conteudo": conteudo, "esquema": esquema})
        if self.falhar_em and tarefa.startswith(self.falhar_em):
            raise ErroDeNegocio("O serviço de adaptação está indisponível agora", status=503)
        if tarefa.startswith("adaptacao"):
            return self._adaptar(_entre(conteudo, "original"))
        return self._questoes(_entre(conteudo, "texto"))

    def _adaptar(self, original: str) -> dict:
        blocos = []
        for bloco in md.ler(original):
            if bloco.tipo == "paragrafo":
                for frase in re.split(r"(?<=[.!?])\s+", bloco.texto):
                    regras = ["TEA-01"] + ([self.regra_extra] if self.regra_extra else [])
                    blocos.append(
                        {"tipo": "paragrafo", "nivel": 0, "texto": frase,
                         "regras_aplicadas": regras, "trecho_original": bloco.texto}
                    )
            else:
                blocos.append(
                    {"tipo": bloco.tipo, "nivel": bloco.nivel, "texto": bloco.texto,
                     "regras_aplicadas": [], "trecho_original": bloco.texto}
                )
        return {"blocos": blocos}

    def _questoes(self, texto: str) -> dict:
        frases = [
            f for b in md.ler(texto) if b.tipo == "paragrafo"
            for f in re.split(r"(?<=[.!?])\s+", b.texto)
        ]
        questoes = [
            {
                "enunciado": f"O que o texto diz na frase {n}?",
                "alternativas": [frase, "Nada disso.", "Outra coisa.", "Nenhuma das anteriores."],
                "correta": 0,
                "trecho": frase,
                "dica": "Leia o texto do começo.",
            }
            for n, frase in enumerate(frases[:3], start=1)
        ]
        # RN04: esta tem de ser descartada, o trecho não está no texto.
        questoes.append(
            {
                "enunciado": QUESTAO_FORA_DO_TEXTO,
                "alternativas": ["Paris", "Roma", "Lima", "Quito"],
                "correta": 0,
                "trecho": "Paris é a capital da França.",
                "dica": "",
            }
        )
        return {"questoes": questoes}


def _entre(conteudo: str, marcador: str) -> str:
    achado = re.search(f"<{marcador}>\n(.*)\n</{marcador}>", conteudo, re.DOTALL)
    return achado.group(1) if achado else conteudo
