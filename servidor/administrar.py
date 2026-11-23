"""Contas de professor do Entende+ (RF24, RN12, RN13). Rodar no servidor:

    python administrar.py criar "Ana Souza" ana@escola.br 40000
    python administrar.py desativar ana@escola.br
    python administrar.py redefinir-senha ana@escola.br
    python administrar.py cota ana@escola.br 60000
    python administrar.py listar

O número é a cota de tokens da conta. A senha é aleatória e aparece uma única
vez; no banco fica só o hash (RNF09).
"""

import argparse
import sys

from pydantic import ValidationError

from app.banco import criar_fabrica, criar_motor, preparar_banco
from app.config import Configuracao
from app.erros import ErroDeNegocio
from app.esquemas import NovaConta
from app.servicos import contas


def _numero(valor: int) -> str:
    return f"{valor:,}".replace(",", ".")


def _cota(valor: str) -> int:
    cota = int(valor)
    if cota < 1:
        raise argparse.ArgumentTypeError("a cota precisa ser maior que zero")
    return cota


def _argumentos(argumentos: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Contas de professor do Entende+.",
        epilog='Exemplo: python administrar.py criar "Ana Souza" ana@escola.br 40000',
    )
    comandos = parser.add_subparsers(dest="comando", required=True)

    criar = comandos.add_parser("criar", help="cria a conta e mostra a senha uma única vez")
    criar.add_argument("nome")
    criar.add_argument("email")
    criar.add_argument("cota", type=_cota, help="tokens do modelo de linguagem")

    desativar = comandos.add_parser("desativar", help="impede a entrada; os materiais ficam no banco")
    desativar.add_argument("email")

    senha = comandos.add_parser("redefinir-senha", help="troca a senha e mostra a nova uma única vez")
    senha.add_argument("email")

    cota = comandos.add_parser("cota", help="define a cota de tokens da conta")
    cota.add_argument("email")
    cota.add_argument("cota", type=_cota)

    comandos.add_parser("listar", help="mostra as contas e o consumo de cada uma")
    return parser.parse_args(argumentos)


def _mostrar_senha(email: str, senha: str) -> None:
    print(f"E-mail: {email}")
    print(f"Senha:  {senha}")
    print("Copie agora: ela não aparece de novo.")


def principal(argumentos: list[str] | None = None, configuracao: Configuracao | None = None) -> int:
    pedido = _argumentos(argumentos)
    motor = criar_motor((configuracao or Configuracao()).banco_url)
    try:
        preparar_banco(motor)
        with criar_fabrica(motor)() as sessao:
            if pedido.comando == "criar":
                dados = NovaConta(nome=pedido.nome.strip(), email=pedido.email, cota=pedido.cota)
                professor, senha = contas.criar(sessao, dados)
                print(f"Conta criada para {professor.nome}, com cota de {_numero(professor.cota_tokens)} tokens.")
                _mostrar_senha(professor.email, senha)
            elif pedido.comando == "desativar":
                professor = contas.desativar(sessao, pedido.email)
                print(f"Conta de {professor.nome} desativada. Os materiais continuam no banco.")
            elif pedido.comando == "redefinir-senha":
                professor, senha = contas.redefinir_senha(sessao, pedido.email)
                print(f"Senha de {professor.nome} redefinida.")
                _mostrar_senha(professor.email, senha)
            elif pedido.comando == "cota":
                professor = contas.definir_cota(sessao, pedido.email, pedido.cota)
                print(
                    f"Cota de {professor.nome}: {_numero(professor.cota_tokens)} tokens "
                    f"({_numero(professor.tokens_consumidos)} já consumidos)."
                )
            else:
                todas = contas.listar(sessao)
                for p in todas:
                    print(
                        f"{'ativa     ' if p.ativo else 'desativada'}  "
                        f"{_numero(p.tokens_consumidos)} de {_numero(p.cota_tokens)} tokens  "
                        f"{p.nome} <{p.email}>"
                    )
                print(f"{len(todas)} conta(s).")
    except ErroDeNegocio as erro:
        print(f"Erro: {erro.titulo}.", file=sys.stderr)
        return 1
    except ValidationError as erro:
        campos = ", ".join(str(e["loc"][0]) for e in erro.errors())
        print(f"Erro: confira {campos}.", file=sys.stderr)
        return 1
    finally:
        motor.dispose()
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    sys.exit(principal())
