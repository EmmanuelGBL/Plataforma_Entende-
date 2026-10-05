"""MotorAdaptacao — RF05 e RF06, sob RN01, RN03 e RN08.

Como funciona:

1. O texto extraído é dividido em trechos — um por seção do material, e
   nenhum maior que ~3.500 caracteres. Os trechos são adaptados em paralelo,
   para caber no tempo de RNF07 (20 páginas em até 120 s).
2. Cada trecho vai ao modelo com as instruções das regras do arquivo cuja
   aplicação é "modelo". A resposta vem num esquema fixo: cada bloco
   adaptado diz quais regras recebeu e de que trecho do original saiu.
3. A regra de aplicação "estrutura" (TEA-09, antecipar a estrutura) é feita
   aqui, pelo código, a partir dos títulos do texto já adaptado. Não há
   motivo para pedir ao modelo o que uma lista de títulos resolve.
4. As regras de "apresentação" (TEA-08, TEA-10) não mexem no texto: valem na
   folha impressa (src/estilos/impressao.css) e na extração.

Não existe adaptação parcial: se um trecho falha, a adaptação inteira falha,
pelo mesmo motivo da RN09.
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from . import texto as md
from .cliente_llm import ClienteLLM
from .regras import ConjuntoDeclarado

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

Regras a aplicar, com o código de cada uma:
{regras}

Formato da resposta:
- Devolva o trecho adaptado como uma lista de blocos, na ordem de leitura.
- "tipo": "titulo", "paragrafo", "item" (item de lista) ou "tabela".
- "nivel": de 1 a 3 para título (1 é o mais importante); 0 para os outros tipos.
- "texto": o texto do bloco, sem marcação Markdown. Tabela vai como tabela Markdown.
- "regras_aplicadas": os códigos das regras que de fato mudaram aquele bloco. \
Lista vazia se o bloco ficou igual ao original.
- "trecho_original": a frase ou o trecho do original de onde o bloco saiu, \
copiado exatamente como está no original. Para subtítulo novo, o primeiro \
trecho do bloco que ele anuncia.
"""


@dataclass
class ResultadoAdaptacao:
    blocos: list[md.Bloco]

    @property
    def texto(self) -> str:
        return md.escrever(self.blocos)


def esquema_resposta(codigos: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "blocos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tipo": {"type": "string", "enum": ["titulo", "paragrafo", "item", "tabela"]},
                        "nivel": {"type": "integer"},
                        "texto": {"type": "string"},
                        "regras_aplicadas": {
                            "type": "array",
                            "items": {"type": "string", "enum": codigos},
                        },
                        "trecho_original": {"type": "string"},
                    },
                    "required": ["tipo", "nivel", "texto", "regras_aplicadas", "trecho_original"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["blocos"],
        "additionalProperties": False,
    }


def dividir_em_trechos(texto: str) -> list[str]:
    trechos: list[list[md.Bloco]] = []
    atual: list[md.Bloco] = []
    tamanho = 0
    for bloco in md.ler(texto):
        # Título só abre trecho novo se o atual já tem conteúdo: o título do
        # capítulo vai junto com a primeira seção, e não sozinho num pedido.
        tem_conteudo = any(b.tipo != "titulo" for b in atual)
        nova_secao = bloco.tipo == "titulo" and bloco.nivel <= 2 and tem_conteudo
        if nova_secao or (atual and tamanho + len(bloco.texto) > TAMANHO_TRECHO):
            trechos.append(atual)
            atual, tamanho = [], 0
        atual.append(bloco)
        tamanho += len(bloco.texto)
    if atual:
        trechos.append(atual)
    return [md.escrever(t) for t in trechos]


def adaptar(texto: str, conjunto: ConjuntoDeclarado, cliente: ClienteLLM) -> ResultadoAdaptacao:
    regras = conjunto.regras_do_modelo()
    sistema = SISTEMA.format(
        regras="\n".join(f"- {r.codigo} ({r.nome}): {r.instrucao}" for r in regras)
    )
    esquema = esquema_resposta([r.codigo for r in regras])
    trechos = dividir_em_trechos(texto)

    def adaptar_trecho(numero_e_trecho: tuple[int, str]) -> list[md.Bloco]:
        numero, trecho = numero_e_trecho
        pedido = (
            f"Trecho {numero} de {len(trechos)} do material. Adapte só este trecho.\n\n"
            f"<original>\n{trecho}\n</original>"
        )
        resposta = cliente.gerar_json(f"adaptacao {numero}/{len(trechos)}", sistema, pedido, esquema)
        return _blocos_da_resposta(resposta, {r.codigo for r in regras})

    with ThreadPoolExecutor(max_workers=PARALELISMO) as execucao:
        partes = list(execucao.map(adaptar_trecho, enumerate(trechos, start=1)))

    blocos = [bloco for parte in partes for bloco in parte]
    if any(r.codigo == CODIGO_ESTRUTURA for r in conjunto.regras):
        blocos = antecipar_estrutura(blocos)
    return ResultadoAdaptacao(blocos)


def _blocos_da_resposta(resposta: dict, codigos_validos: set[str]) -> list[md.Bloco]:
    blocos = []
    for item in resposta.get("blocos", []):
        texto = str(item.get("texto", "")).strip()
        if not texto:
            continue
        tipo = item.get("tipo", "paragrafo")
        nivel = int(item.get("nivel") or 0)
        blocos.append(
            md.Bloco(
                tipo=tipo,
                texto=texto,
                nivel=max(1, min(nivel, 3)) if tipo == "titulo" else 0,
                # Mesmo com o esquema, só entra código que está no arquivo.
                regras=[c for c in dict.fromkeys(item.get("regras_aplicadas", [])) if c in codigos_validos],
                trecho_original=str(item.get("trecho_original", "")).strip(),
            )
        )
    return blocos


def antecipar_estrutura(blocos: list[md.Bloco]) -> list[md.Bloco]:
    """TEA-09: abre o material com a lista do que será lido, na ordem.

    Se o material começa com um título único de nível mais alto (o nome do
    capítulo), a lista entra logo depois dele e enumera as seções abaixo.
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
