"""O texto do sistema é Markdown simples, e este módulo é o único que o lê.

Formato, o mesmo que o extrator produz (ver extrator._bloco_em_markdown):
blocos separados por linha em branco; "#", "##", "###" para títulos; "- "
para item de lista; "|" no começo para tabela; o resto é parágrafo.
"""

import re
from dataclasses import dataclass, field


@dataclass
class Bloco:
    tipo: str  # "titulo" | "paragrafo" | "item" | "tabela"
    texto: str
    nivel: int = 0
    regras: list[str] = field(default_factory=list)
    trecho_original: str = ""

    def em_markdown(self) -> str:
        if self.tipo == "titulo":
            return f"{'#' * max(1, min(self.nivel, 3))} {self.texto}"
        if self.tipo == "item":
            return f"- {self.texto}"
        return self.texto


_TITULO = re.compile(r"^(#{1,6})\s+(.*)$")


def ler(texto: str) -> list[Bloco]:
    blocos = []
    for parte in re.split(r"\n\s*\n", texto.replace("\r\n", "\n")):
        parte = parte.strip()
        if not parte:
            continue
        titulo = _TITULO.match(parte)
        if titulo and "\n" not in parte:
            blocos.append(Bloco("titulo", titulo.group(2).strip(), nivel=min(len(titulo.group(1)), 3)))
        elif parte.startswith("|"):
            blocos.append(Bloco("tabela", parte))
        elif parte.startswith("- "):
            # Itens colados sem linha em branco entre eles (edição manual).
            for linha in parte.split("\n"):
                linha = linha.strip()
                if linha:
                    blocos.append(Bloco("item", linha[2:].strip() if linha.startswith("- ") else linha))
        else:
            blocos.append(Bloco("paragrafo", re.sub(r"\s*\n\s*", " ", parte)))
    return blocos


def escrever(blocos: list[Bloco]) -> str:
    return "\n\n".join(b.em_markdown() for b in blocos)


def normalizar(texto: str) -> str:
    """Para comparar trechos ignorando marcação, caixa, pontuação e espaços."""
    texto = re.sub(r"[#*|_>\-–—]+", " ", texto.lower())
    texto = re.sub(r"[^\w\s]", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()
