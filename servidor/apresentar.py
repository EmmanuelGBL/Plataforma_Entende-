"""Deixa o sistema pronto para apresentar pelo GitHub Pages (chamado pelo
apresentar.cmd, depois que ele liga o servidor).

1. Espera o servidor deste computador responder.
2. Cria a conta de apresentação, se ela ainda não existir neste banco local.
3. Abre o GitHub Pages com ?servidor=local: a tela de entrada passa a
   oferecer "Usar o servidor ao vivo", além da demonstração.

A conta só existe no banco local (entende.db) deste computador.
"""

import json
import sys
import time
import urllib.error
import urllib.request
import webbrowser

SERVIDOR = "http://127.0.0.1:8000"
PAGES = "https://emmanuelgbl.github.io/Plataforma_Entende-/?servidor=local"
CONTA = {"nome": "Administrador", "email": "admin@admin.com", "senha": "admin123"}


def pedir(caminho: str, dados: dict | None = None) -> int:
    corpo = json.dumps(dados).encode() if dados is not None else None
    pedido = urllib.request.Request(
        SERVIDOR + caminho, data=corpo, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(pedido, timeout=5) as resposta:
            return resposta.status
    except urllib.error.HTTPError as erro:
        return erro.code


for _ in range(60):
    try:
        if pedir("/api/saude") == 200:
            break
    except OSError:
        time.sleep(1)
else:
    sys.exit("O servidor não respondeu em 60 segundos. Veja a outra janela, a do servidor.")

situacao = pedir("/api/autenticacao/cadastro", CONTA)
if situacao == 201:
    print("Conta de apresentação criada.")
elif situacao == 409:
    print("Conta de apresentação já existia.")
else:
    print(f"Aviso: a conta não foi criada (resposta {situacao}). Dá para criar pela tela.")

print(f"\nServidor ligado. Entrar com {CONTA['email']} / {CONTA['senha']}")
print("Abrindo o GitHub Pages...")
webbrowser.open(PAGES)
