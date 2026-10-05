"""Mostra o que o extrator tira de um arquivo, sem subir o servidor.

    .venv\Scripts\python extrair.py "C:\caminho\material.pdf"

Serve para conferir o critério da semana 6 com material real do 5º ano: ver se
os títulos saíram com o nível certo, se os parágrafos voltaram inteiros e se
cabeçalho e número de página sumiram. O arquivo não é gravado em lugar nenhum.
"""

import sys
from pathlib import Path

from app.config import Configuracao
from app.erros import ErroDeNegocio
from app.servicos.extrator import extrair

if len(sys.argv) != 2:
    sys.exit(__doc__)

caminho = Path(sys.argv[1])
try:
    extracao = extrair(caminho.read_bytes(), caminho.name, Configuracao().limite_paginas)
except ErroDeNegocio as erro:
    sys.exit(f"RECUSADO ({erro.regra}): {erro.titulo}\n{erro.motivo}\nSaída: {erro.saida}")

estimadas = " (estimadas)" if extracao.paginas_estimadas else ""
print(f"{extracao.formato.value} · {extracao.numero_paginas} páginas{estimadas} · "
      f"{len(extracao.blocos)} blocos\n")
print(extracao.texto)
