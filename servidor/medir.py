"""Roda o motor de adaptação de verdade num material e mede o que ele gasta.

    .venv\\Scripts\\python medir.py "C:\\caminho\\material.md" "C:\\pasta\\do\\relatorio" [vezes]

Usa o modelo configurado no .env (precisa de OPENAI_API_KEY) e faz, a cada
vez, a adaptação inteira e a geração das questões, como o servidor faz. Nada
é gravado no banco. O relatório (relatorio.md e medicao.json) traz o texto
original e o adaptado, as questões, os trechos que foram ao modelo e, por
chamada, os tokens, o tempo e o custo.

Arquivo .md ou .txt é lido como está; PDF e DOCX passam pelo extrator.
"""

import json
import sys
import time
from dataclasses import asdict
from datetime import date
from pathlib import Path

from app.config import Configuracao
from app.servicos import legibilidade, motor, questoes, regras
from app.servicos.cliente_llm import ClienteGPT, criar_cliente
from app.servicos.extrator import extrair

# Preço do modelo padrão, por milhão de tokens, em dólar (modo padrão da API).
# Fonte: developers.openai.com/api/docs/pricing, consultada em 29/10/2026.
PRECO = {"entrada": 2.00, "entrada_em_cache": 0.10, "saida": 10.00}
# PTAX de venda de 29/10/2026 (Banco Central do Brasil).
DOLAR = 5.3744

if len(sys.argv) not in (3, 4):
    sys.exit(__doc__)
sys.stdout.reconfigure(encoding="utf-8")

arquivo, pasta = Path(sys.argv[1]), Path(sys.argv[2])
vezes = int(sys.argv[3]) if len(sys.argv) == 4 else 1
config = Configuracao()
if arquivo.suffix.lower() in (".md", ".txt"):
    texto = arquivo.read_text(encoding="utf-8").strip()
else:
    texto = extrair(arquivo.read_bytes(), arquivo.name, config.limite_paginas).texto

cliente = criar_cliente(config.provedor, config.modelo, config.chave_openai, config.chave_api)
if not isinstance(cliente, ClienteGPT):
    sys.exit("A medição de consumo só existe para a OpenAI (ENTENDE_PROVEDOR=openai).")
conjunto, _ = regras.carregar(config.caminho_regras)


def custo(c) -> float:
    sem_cache = c.entrada - c.entrada_em_cache
    return (
        sem_cache * PRECO["entrada"] + c.entrada_em_cache * PRECO["entrada_em_cache"] + c.saida * PRECO["saida"]
    ) / 1_000_000


execucoes = []
for n in range(1, vezes + 1):
    cliente.consumo = []
    inicio = time.perf_counter()
    resultado = motor.adaptar(texto, conjunto, cliente)
    segundos_adaptacao = time.perf_counter() - inicio
    geradas = questoes.gerar(resultado.texto, cliente)
    segundos_total = time.perf_counter() - inicio
    chamadas = [{**asdict(c), "custo_usd": custo(c)} for c in cliente.consumo]
    original, adaptado = legibilidade.medir(texto), legibilidade.medir(resultado.texto)
    execucoes.append(
        {
            "execucao": n,
            "blocos_adaptaveis": resultado.blocos_adaptaveis,
            "blocos_ao_modelo": resultado.blocos_ao_modelo,
            "pedidos_de_adaptacao": resultado.pedidos,
            "segundos_adaptacao": segundos_adaptacao,
            "segundos_total": segundos_total,
            "chamadas": chamadas,
            "custo_usd": sum(c["custo_usd"] for c in chamadas),
            "metricas": {
                i.codigo: {"nome": i.nome, "original": original[i.codigo], "adaptado": adaptado[i.codigo]}
                for i in legibilidade.INDICADORES
            },
            "regras_aplicadas": sorted({r for b in resultado.blocos for r in b.regras}),
            "texto_adaptado": resultado.texto,
            "questoes": [asdict(q) for q in geradas],
        }
    )
    print(
        f"execução {n}: {len(chamadas)} chamadas, {segundos_total:.1f} s, "
        f"US$ {execucoes[-1]['custo_usd']:.4f}"
    )

medicao = {
    "data": date.today().isoformat(),
    "modelo": cliente.modelo,
    "regras": f"{conjunto.identificador.value} v{conjunto.versao}",
    "preco_por_milhao_usd": PRECO,
    "dolar_ptax": DOLAR,
    "arquivo": arquivo.name,
    "palavras_original": len(texto.split()),
    "texto_original": texto,
    "execucoes": execucoes,
}
pasta.mkdir(parents=True, exist_ok=True)
(pasta / "medicao.json").write_text(json.dumps(medicao, ensure_ascii=False, indent=2), encoding="utf-8")


def br(valor: float, casas: int = 2) -> str:
    return f"{valor:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


linhas = [
    f"# Medição do motor de adaptação — {medicao['data']}",
    "",
    f"- Modelo: {medicao['modelo']} · regras {medicao['regras']}",
    f"- Material: `{arquivo.name}`, {medicao['palavras_original']} palavras",
    f"- Preço por milhão de tokens: US$ {br(PRECO['entrada'])} de entrada, "
    f"US$ {br(PRECO['entrada_em_cache'])} em cache, US$ {br(PRECO['saida'])} de saída · "
    f"dólar a R$ {br(DOLAR, 4)} (PTAX de venda)",
    "",
    "| Execução | Blocos ao modelo | Chamadas | Entrada | Saída (raciocínio) | Tempo da adaptação | Tempo total | Custo |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
]
for e in execucoes:
    entrada = sum(c["entrada"] for c in e["chamadas"])
    saida = sum(c["saida"] for c in e["chamadas"])
    raciocinio = sum(c["raciocinio"] for c in e["chamadas"])
    linhas.append(
        f"| {e['execucao']} | {e['blocos_ao_modelo']} de {e['blocos_adaptaveis']} | {len(e['chamadas'])} | "
        f"{entrada} | {saida} ({raciocinio}) | {br(e['segundos_adaptacao'], 1)} s | "
        f"{br(e['segundos_total'], 1)} s | US$ {br(e['custo_usd'], 4)} (R$ {br(e['custo_usd'] * DOLAR, 4)}) |"
    )
for e in execucoes:
    linhas += ["", f"## Execução {e['execucao']}", "", "| Métrica | Original | Adaptado |", "| --- | --- | --- |"]
    linhas += [f"| {m['nome']} | {m['original']} | {m['adaptado']} |" for m in e["metricas"].values()]
    linhas += ["", f"Regras aplicadas: {', '.join(e['regras_aplicadas'])}", "", "### Texto adaptado", "",
               e["texto_adaptado"], "", "### Questões", ""]
    for q in e["questoes"]:
        linhas.append(f"- {q['enunciado']} — **{q['alternativas'][q['correta']]}** (trecho: “{q['trecho']}”)")
linhas += ["", "## Texto original", "", texto, ""]
(pasta / "relatorio.md").write_text("\n".join(linhas), encoding="utf-8")
print("gravado:", pasta / "relatorio.md")
