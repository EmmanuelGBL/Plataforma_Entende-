"""Deixa o sistema pronto para apresentar pelo GitHub Pages (chamado pelo
apresentar.cmd, depois que ele liga o servidor).

1. Espera o servidor deste computador responder.
2. Cria a conta de apresentação, se ela ainda não existir neste banco local.
   Vai direto ao banco: o servidor não tem rota de cadastro (RN12).
3. Abre o GitHub Pages com ?servidor=local: a tela de entrada passa a
   oferecer "Usar o servidor ao vivo", além da demonstração.

A conta só existe no banco local (entende.db) deste computador.
"""

import sys
import time
import urllib.error
import urllib.request
import webbrowser

from app.banco import criar_fabrica, criar_motor, preparar_banco
from app.config import Configuracao
from app.esquemas import NovaConta
from app.servicos import contas

SERVIDOR = "http://127.0.0.1:8000"
PAGES = "https://emmanuelgbl.github.io/Plataforma_Entende-/?servidor=local"
CONTA = NovaConta(nome="Administrador", email="admin@admin.com", cota=200_000)
SENHA = "admin123"


def pedir(caminho: str) -> int:
    try:
        with urllib.request.urlopen(SERVIDOR + caminho, timeout=5) as resposta:
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

motor = criar_motor(Configuracao().banco_url)
preparar_banco(motor)
with criar_fabrica(motor)() as sessao:
    conta = contas.buscar(sessao, CONTA.email)
    if conta is None:
        contas.criar(sessao, CONTA, SENHA)
        print("Conta de apresentação criada.")
    else:
        # Conta de antes da cota (RN13) não tem cota definida e não adaptaria.
        if conta.cota_tokens == 0:
            contas.definir_cota(sessao, CONTA.email, CONTA.cota)
        print("Conta de apresentação já existia.")
motor.dispose()

print(f"\nServidor ligado. Entrar com {CONTA.email} / {SENHA}")
print("Abrindo o GitHub Pages...")
webbrowser.open(PAGES)
