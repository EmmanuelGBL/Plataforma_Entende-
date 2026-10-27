"""MotorAdaptacao — RF05 e RF06, sob RN01, RN03 e RN08.

O motor é híbrido: o código aplica o que uma regra do arquivo consegue fazer
sozinha, e o modelo de linguagem só reescreve o que exige entender a frase.

1. O código marca os parágrafos e itens que precisam de reescrita, com as
   regras que dispararam em cada um (gatilhos.py).
2. O material é dividido em trechos (um por seção, até ~3.500 caracteres).
   Trecho sem bloco marcado não gera pedido; os outros vão ao modelo em
   paralelo (RNF07).
3. Cada pedido leva o trecho como contexto e pede de volta só os blocos
   marcados, cada um com as instruções das suas regras. A resposta segue um
   esquema fixo, que diz quais regras cada bloco recebeu.
4. O código aplica o glossário (TEA-05) e a antecipação da estrutura (TEA-09).
5. TEA-08 e TEA-10 valem na folha impressa e na extração.

Bloco marcado que não volta na resposta, ou volta vazio, fica como no
original (RN01). Se um pedido falha, a adaptação inteira falha.
"""

import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from ..modelos import AplicacaoDaRegra
from . import gatilhos
from . import texto as md
from .cliente_llm import ClienteLLM
from .regras import ConjuntoDeclarado, RegraDeclarada

TAMANHO_TRECHO = 3500
PARALELISMO = 4
CODIGO_ESTRUTURA = "TEA-09"

SISTEMA = """\
Você adapta material didático do 5º ano do ensino fundamental para estudantes \
com Transtorno do Espectro Autista (TEA), seguindo um conjunto fixo de regras.

Limites que valem acima de qualquer regra (regra de negócio RN01 do sistema):
- Mude a FORMA do texto, nunca o conteúdo pedagógico.
- Não acrescente informação, exemplo, curiosidade ou conclusão que não esteja no original.
- Não retire nenhum conceito, dado, nome, número ou termo técnico que esteja no original.
- Mantenha a ordem em que as informações aparecem.
- Escreva em português do Brasil, para uma criança de 10 a 11 anos.

Regras deste pedido, com o código de cada uma:
{regras}

Como responder:
- Você recebe um trecho do material com os blocos numerados (B1, B2...) e a \
lista dos blocos a adaptar, cada um com as regras que valem para ele.
- Adapte somente os blocos da lista, aplicando a cada um só as regras \
indicadas para ele. Os outros blocos são contexto: não os devolva.
- Para cada bloco adaptado, devolva o resultado como uma lista de blocos, na \
ordem de leitura. Um parágrafo dividido vira vários blocos.
- "tipo": "titulo" (só para subtítulo novo), "paragrafo" ou "item" (item de lista).
- "nivel": de 1 a 3 para título (1 é o mais importante); 0 para os outros tipos.
- "texto": o texto do bloco, sem marcação Markdown.
- "regras_aplicadas": os códigos das regras que de fato mudaram aquele bloco. \
Lista vazia se o bloco ficou igual ao original.
"""


@dataclass
class ResultadoAdaptacao:
    blocos: list[md.Bloco]
    # Quantos blocos foram ao modelo e em quantos pedidos.
    blocos_adaptaveis: int = 0
    blocos_ao_modelo: int = 0
    pedidos: int = 0

    @property
    def texto(self) -> str:
        return md.escrever(self.blocos)


def esquema_resposta(rotulos: list[str], codigos: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "adaptados": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "bloco": {"type": "string", "enum": rotulos},
                        "resultado": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "tipo": {"type": "string", "enum": ["titulo", "paragrafo", "item"]},
                                    "nivel": {"type": "integer"},
                                    "texto": {"type": "string"},
                                    "regras_aplicadas": {
                                        "type": "array",
                                        "items": {"type": "string", "enum": codigos},
                                    },
                                },
                                "required": ["tipo", "nivel", "texto", "regras_aplicadas"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["bloco", "resultado"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["adaptados"],
        "additionalProperties": False,
    }


def _agrupar(blocos: list[md.Bloco]) -> list[list[int]]:
    """Os índices dos blocos de cada trecho."""
    trechos: list[list[int]] = []
    atual: list[int] = []
    tamanho = 0
    for indice, bloco in enumerate(blocos):
        # Título só abre trecho novo se o atual já tem conteúdo: o título do
        # capítulo vai junto com a primeira seção.
        tem_conteudo = any(blocos[i].tipo != "titulo" for i in atual)
        nova_secao = bloco.tipo == "titulo" and bloco.nivel <= 2 and tem_conteudo
        if nova_secao or (atual and tamanho + len(bloco.texto) > TAMANHO_TRECHO):
            trechos.append(atual)
            atual, tamanho = [], 0
        atual.append(indice)
        tamanho += len(bloco.texto)
    if atual:
        trechos.append(atual)
    return trechos


def dividir_em_trechos(texto: str) -> list[str]:
    blocos = md.ler(texto)
    return [md.escrever([blocos[i] for i in trecho]) for trecho in _agrupar(blocos)]


def adaptar(texto: str, conjunto: ConjuntoDeclarado, cliente: ClienteLLM) -> ResultadoAdaptacao:
    originais = md.ler(texto)
    marcas = gatilhos.marcar(originais, conjunto)
    por_codigo = {r.codigo: r for r in conjunto.regras_do_modelo()}
    trechos = [t for t in _agrupar(originais) if any(i in marcas for i in t)]

    def adaptar_trecho(numero_e_trecho: tuple[int, list[int]]) -> dict[int, list[md.Bloco]]:
        numero, trecho = numero_e_trecho
        rotulo = {indice: f"B{n}" for n, indice in enumerate(trecho, start=1)}
        marcados = [i for i in trecho if i in marcas]
        codigos = [c for c in por_codigo if any(c in marcas[i] for i in marcados)]
        sistema = SISTEMA.format(
            regras="\n".join(f"- {c} ({por_codigo[c].nome}): {por_codigo[c].instrucao}" for c in codigos)
        )
        contexto = "\n\n".join(f"[{rotulo[i]}] {originais[i].em_markdown()}" for i in trecho)
        lista = "\n".join(f"- {rotulo[i]}: {', '.join(marcas[i])}" for i in marcados)
        pedido = (
            f"Trecho {numero} de {len(trechos)} do material.\n\n"
            f"<trecho>\n{contexto}\n</trecho>\n\n"
            f"Blocos a adaptar e as regras de cada um:\n{lista}"
        )
        esquema = esquema_resposta([rotulo[i] for i in marcados], codigos)
        resposta = cliente.gerar_json(f"adaptacao {numero}/{len(trechos)}", sistema, pedido, esquema)
        return _blocos_da_resposta(resposta, {rotulo[i]: i for i in marcados}, originais, marcas)

    with ThreadPoolExecutor(max_workers=PARALELISMO) as execucao:
        partes = list(execucao.map(adaptar_trecho, enumerate(trechos, start=1)))
    adaptados = {indice: blocos for parte in partes for indice, blocos in parte.items()}

    blocos: list[md.Bloco] = []
    for indice, original in enumerate(originais):
        blocos += adaptados.get(indice) or [md.Bloco(original.tipo, original.texto, original.nivel)]

    for regra in conjunto.regras_de(AplicacaoDaRegra.GLOSSARIO):
        blocos = aplicar_glossario(blocos, regra)
    if any(r.codigo == CODIGO_ESTRUTURA for r in conjunto.regras):
        blocos = antecipar_estrutura(blocos)
    return ResultadoAdaptacao(
        blocos,
        blocos_adaptaveis=sum(b.tipo in gatilhos.TIPOS_ADAPTAVEIS for b in originais),
        blocos_ao_modelo=len(marcas),
        pedidos=len(trechos),
    )


def _blocos_da_resposta(
    resposta: dict,
    indice_do_rotulo: dict[str, int],
    originais: list[md.Bloco],
    marcas: dict[int, list[str]],
) -> dict[int, list[md.Bloco]]:
    adaptados: dict[int, list[md.Bloco]] = {}
    for item in resposta.get("adaptados", []):
        indice = indice_do_rotulo.get(str(item.get("bloco", "")))
        if indice is None or indice in adaptados:
            continue
        blocos = []
        for parte in item.get("resultado", []):
            texto = str(parte.get("texto", "")).strip()
            if not texto:
                continue
            tipo = parte.get("tipo")
            tipo = tipo if tipo in ("titulo", "paragrafo", "item") else "paragrafo"
            nivel = int(parte.get("nivel") or 0)
            blocos.append(
                md.Bloco(
                    tipo=tipo,
                    texto=texto,
                    nivel=max(1, min(nivel, 3)) if tipo == "titulo" else 0,
                    # Mesmo com o esquema, só entra regra pedida para este bloco.
                    regras=[
                        c for c in dict.fromkeys(parte.get("regras_aplicadas", [])) if c in marcas[indice]
                    ],
                    trecho_original=originais[indice].texto,
                )
            )
        # Resultado vazio, ou só com subtítulo, apagaria o conteúdo do bloco
        # (RN01): nesse caso fica o original.
        if any(b.tipo != "titulo" for b in blocos):
            adaptados[indice] = blocos
    return adaptados


def aplicar_glossario(blocos: list[md.Bloco], regra: RegraDeclarada) -> list[md.Bloco]:
    """TEA-05: na primeira vez que um termo do glossário aparece num parágrafo
        ou item, a explicação entra entre parênteses logo depois dele.

        Vale também o plural simples. Se o texto já explica o termo entre
        parênteses, nada é acrescentado. Título e tabela ficam de fora.
    """
    pendentes = dict(regra.glossario or {})
    resultado = []
    for bloco in blocos:
        if bloco.tipo not in gatilhos.TIPOS_ADAPTAVEIS or not pendentes:
            resultado.append(bloco)
            continue
        # Procura no texto do bloco, e não nas explicações já acrescentadas.
        insercoes = []
        for termo, explicacao in list(pendentes.items()):
            achado = re.search(rf"(?<!\w){re.escape(termo)}(?:s|es)?(?!\w)", bloco.texto, re.IGNORECASE)
            if achado is None:
                continue
            del pendentes[termo]
            if not re.match(r"\s*\(", bloco.texto[achado.end():]):
                insercoes.append((achado.end(), explicacao))
        if not insercoes:
            resultado.append(bloco)
            continue
        texto = bloco.texto
        for posicao, explicacao in sorted(insercoes, reverse=True):
            texto = f"{texto[:posicao]} ({explicacao}){texto[posicao:]}"
        resultado.append(
            md.Bloco(
                bloco.tipo,
                texto,
                bloco.nivel,
                regras=[*bloco.regras, regra.codigo],
                trecho_original=bloco.trecho_original or bloco.texto,
            )
        )
    return resultado


def antecipar_estrutura(blocos: list[md.Bloco]) -> list[md.Bloco]:
    """TEA-09: abre o material com a lista do que será lido, na ordem.

        Se o material começa com o título do capítulo, a lista entra logo
        depois dele e enumera as seções.
    """
    titulos = [b for b in blocos if b.tipo == "titulo"]
    if not titulos:
        return blocos

    menor = min(t.nivel for t in titulos)
    do_menor = [t for t in titulos if t.nivel == menor]
    tem_titulo_do_capitulo = blocos[0].tipo == "titulo" and len(do_menor) == 1 and len(titulos) > 1
    if tem_titulo_do_capitulo:
        nivel_secao = min(t.nivel for t in titulos[1:])
        secoes = [t for t in titulos[1:] if t.nivel == nivel_secao]
    else:
        secoes = do_menor
    if len(secoes) < 2:
        return blocos

    abertura = [
        md.Bloco("titulo", "O que você vai ler", nivel=2, regras=[CODIGO_ESTRUTURA]),
        md.Bloco(
            "paragrafo",
            f"Neste texto você vai ler sobre {len(secoes)} assuntos, nesta ordem:",
            regras=[CODIGO_ESTRUTURA],
        ),
        *[
            md.Bloco("item", f"{n}. {s.texto}", regras=[CODIGO_ESTRUTURA])
            for n, s in enumerate(secoes, start=1)
        ],
    ]
    posicao = 1 if tem_titulo_do_capitulo else 0
    return blocos[:posicao] + abertura + blocos[posicao:]
