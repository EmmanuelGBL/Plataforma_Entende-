"""ExtratorConteudo — RF03, com RN09 e RNF08.

Recebe os bytes do arquivo e devolve o texto em blocos (título, parágrafo, item
de lista, tabela), na ordem de leitura e com o nível de cada título. Não toca
no banco: é função pura, testável sem servidor.

Duas recusas são de propósito e não podem virar "melhor esforço":

- RN09: se alguma página do PDF é só imagem, o material é recusado inteiro, e
  não adaptado sem aquela página. Adaptação de texto incompleto produz material
  silenciosamente errado — pior que a recusa.
- RNF08: acima de 20 páginas ou 15 MB, recusa com a saída sugerida (dividir).

O formato é decidido pelo conteúdo do arquivo, e não pela extensão do nome:
um .doc antigo renomeado para .docx, ou uma imagem renomeada para .pdf, é
recusado com a explicação certa em vez de estourar um erro interno.

Limites conhecidos, declarados:

- PDF em duas colunas sai na ordem das linhas da página, misturando as colunas.
- Tabela de PDF sai como texto corrido; tabela de DOCX sai como tabela.
- Caixa de texto do Word não é lida.
- A hierarquia de títulos do PDF é inferida pelo corpo da fonte e pelo negrito,
  porque o PDF não guarda o que é título. O DOCX guarda, pelo estilo.
"""

import io
import math
import re
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from statistics import median

import pdfplumber
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

from ..erros import ErroDeNegocio
from ..modelos import FormatoArquivo

# RN09 — abaixo disso não há material didático para adaptar. Corresponde a
# pouco mais de três linhas de texto corrido.
MINIMO_LETRAS = 200

# DOCX sem contagem de páginas gravada: estimativa por volume de texto,
# próxima de uma página de livro didático do 5º ano.
CARACTERES_POR_PAGINA = 2000

NIVEL_MAXIMO = 3


@dataclass
class Bloco:
    tipo: str  # "titulo" | "paragrafo" | "item" | "tabela"
    texto: str = ""
    nivel: int = 0
    linhas: list[list[str]] = field(default_factory=list)


@dataclass
class Extracao:
    formato: FormatoArquivo
    blocos: list[Bloco]
    numero_paginas: int
    paginas_estimadas: bool = False

    @property
    def texto(self) -> str:
        """Markdown simples — '#' marca o nível do título."""
        return "\n\n".join(_bloco_em_markdown(b) for b in self.blocos)


def extrair(conteudo: bytes, nome_arquivo: str, limite_paginas: int) -> Extracao:
    formato = identificar_formato(conteudo, nome_arquivo)
    if formato is FormatoArquivo.PDF:
        extracao = _extrair_pdf(conteudo, limite_paginas)
    else:
        extracao = _extrair_docx(conteudo, limite_paginas)
    _exigir_conteudo_suficiente(extracao)
    return extracao


# ---------------------------------------------------------------------------
# Formato
# ---------------------------------------------------------------------------

def identificar_formato(conteudo: bytes, nome_arquivo: str) -> FormatoArquivo:
    if b"%PDF-" in conteudo[:1024]:
        return FormatoArquivo.PDF
    if conteudo.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(conteudo)) as pacote:
                if "word/document.xml" in pacote.namelist():
                    return FormatoArquivo.DOCX
        except zipfile.BadZipFile:
            pass
    if conteudo.startswith(b"\xd0\xcf\x11\xe0"):
        raise ErroDeNegocio(
            "Este arquivo está no formato antigo do Word (.doc)",
            f"“{nome_arquivo}” foi salvo num formato anterior a 2007, que o sistema não lê.",
            "Abra o arquivo no Word ou no LibreOffice e use “Salvar como” em .docx ou PDF.",
            "RF02",
        )
    raise ErroDeNegocio(
        "Este tipo de arquivo não é aceito",
        f"“{nome_arquivo}” não é um PDF nem um documento do Word (.docx).",
        "Envie o material em PDF ou em .docx.",
        "RF02",
    )


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

@dataclass
class _Linha:
    texto: str
    tamanho: float
    negrito: bool
    topo: float
    base: float
    x0: float
    x1: float
    pagina: int


_MARCADOR_LISTA = re.compile(r"^([•▪◦●○■□➢►✓\-–—*]|\d{1,2}[.)]|[a-zA-Z][)])\s+")
_MARCADOR_GRAFICO = re.compile(r"^[•▪◦●○■□➢►✓\-–—*]\s+")
_NUMERO_DE_PAGINA = re.compile(r"^(p[áa]g(ina)?\.?\s*)?\d{1,3}(\s*(de|/)\s*\d{1,3})?$", re.IGNORECASE)
_FIM_DE_FRASE = (".", "!", "?", ":", ";")


def _extrair_pdf(conteudo: bytes, limite_paginas: int) -> Extracao:
    try:
        documento = pdfplumber.open(io.BytesIO(conteudo))
    except Exception:
        raise _erro_arquivo_ilegivel() from None

    with documento:
        total = len(documento.pages)
        if total > limite_paginas:
            raise _erro_paginas(total, limite_paginas, estimado=False)

        linhas: list[_Linha] = []
        sem_texto: list[int] = []
        try:
            for numero, pagina in enumerate(documento.pages, start=1):
                da_pagina = _linhas_da_pagina(pagina, numero)
                if sum(len(l.texto) for l in da_pagina) < 10 and pagina.images:
                    sem_texto.append(numero)
                linhas.extend(da_pagina)
        except Exception:
            raise _erro_arquivo_ilegivel() from None

    if sem_texto and len(sem_texto) < total:
        raise _erro_paginas_sem_texto(sem_texto)

    linhas = _remover_cabecalho_e_rodape(linhas, total)
    return Extracao(FormatoArquivo.PDF, _montar_blocos_pdf(linhas), total)


def _linhas_da_pagina(pagina, numero: int) -> list[_Linha]:
    altura = float(pagina.height)
    resultado = []
    for bruta in pagina.extract_text_lines(return_chars=True, strip=True):
        texto = re.sub(r"\s+", " ", bruta["text"]).strip()
        letras = [c for c in bruta["chars"] if c["text"].strip()]
        if not texto or not letras:
            continue
        tamanho = round(median(float(c["size"]) for c in letras), 1)
        em_negrito = sum(1 for c in letras if _fonte_negrito(c.get("fontname", "")))
        resultado.append(
            _Linha(
                texto=texto,
                tamanho=tamanho,
                negrito=em_negrito >= 0.8 * len(letras),
                # topo e base relativos à página, para comparar páginas de
                # tamanhos diferentes no mesmo arquivo
                topo=float(bruta["top"]) / altura,
                base=float(bruta["bottom"]) / altura,
                x0=float(bruta["x0"]),
                x1=float(bruta["x1"]),
                pagina=numero,
            )
        )
    return resultado


def _fonte_negrito(nome_fonte: str) -> bool:
    nome = nome_fonte.lower()
    return any(marca in nome for marca in ("bold", "black", "heavy", "semibold", "negrito"))


def _remover_cabecalho_e_rodape(linhas: list[_Linha], total_paginas: int) -> list[_Linha]:
    """Tira número de página e o que se repete na margem de muitas páginas
    (nome da coleção, nome da escola). Repetido no texto adaptado, isso seria
    ruído que o estudante teria de ignorar a cada página."""

    def na_margem(l: _Linha) -> bool:
        return l.topo < 0.1 or l.base > 0.9

    def forma(texto: str) -> str:
        return re.sub(r"\d+", "#", texto.lower())

    repeticoes = Counter()
    if total_paginas >= 2:
        for pagina in {l.pagina for l in linhas}:
            formas = {forma(l.texto) for l in linhas if l.pagina == pagina and na_margem(l)}
            repeticoes.update(formas)
    minimo = max(2, math.ceil(total_paginas / 2))

    def repetida(l: _Linha) -> bool:
        # Só linha curta conta como cabeçalho: texto do corpo que começa no
        # alto da página e se repete (exercício com o mesmo enunciado em cada
        # página, por exemplo) não pode sumir da extração.
        return len(l.texto) <= 80 and repeticoes[forma(l.texto)] >= minimo

    return [
        l
        for l in linhas
        if not (na_margem(l) and (_NUMERO_DE_PAGINA.match(l.texto) or repetida(l)))
    ]


def _montar_blocos_pdf(linhas: list[_Linha]) -> list[Bloco]:
    if not linhas:
        return []

    # Corpo do texto: o tamanho de fonte que cobre mais caracteres.
    pesos = Counter()
    for l in linhas:
        pesos[l.tamanho] += len(l.texto)
    corpo = pesos.most_common(1)[0][0]

    def titulo_por_tamanho(l: _Linha) -> bool:
        return l.tamanho >= corpo * 1.15 and len(l.texto) <= 120

    def titulo_por_negrito(l: _Linha) -> bool:
        return (
            l.negrito
            and l.tamanho >= corpo * 0.95
            and len(l.texto) <= 90
            and not l.texto.endswith((".", ",", ";"))
            and not _MARCADOR_LISTA.match(l.texto)
        )

    # Nível do título: o maior corpo é o nível 1, o seguinte o 2, e assim por
    # diante. Título só em negrito, no corpo do texto, fica abaixo de todos.
    tamanhos = sorted({round(l.tamanho) for l in linhas if titulo_por_tamanho(l)}, reverse=True)
    nivel_do_tamanho = {t: min(i + 1, NIVEL_MAXIMO) for i, t in enumerate(tamanhos)}
    nivel_negrito = min(len(tamanhos) + 1, NIVEL_MAXIMO)

    def nivel(l: _Linha) -> int:
        if titulo_por_tamanho(l):
            return nivel_do_tamanho[round(l.tamanho)]
        if titulo_por_negrito(l):
            return nivel_negrito
        return 0

    corpo_linhas = [l for l in linhas if nivel(l) == 0]
    passos = [
        b.topo - a.topo
        for a, b in zip(corpo_linhas, corpo_linhas[1:])
        if a.pagina == b.pagina and b.topo > a.topo
    ]
    passo_tipico = median(passos) if passos else 0.03
    margem_direita = max((l.x1 for l in corpo_linhas), default=0)
    margem_esquerda = min((l.x0 for l in corpo_linhas), default=0)
    largura = max(margem_direita - margem_esquerda, 1)

    blocos: list[Bloco] = []
    anterior: _Linha | None = None

    for l in linhas:
        n = nivel(l)
        atual = blocos[-1] if blocos else None

        if n:
            continua_titulo = (
                atual is not None
                and atual.tipo == "titulo"
                and atual.nivel == n
                and anterior is not None
                and anterior.pagina == l.pagina
                and l.topo - anterior.topo <= passo_tipico * 1.8
            )
            if continua_titulo:
                atual.texto = _juntar(atual.texto, l.texto)
            else:
                blocos.append(Bloco("titulo", l.texto, nivel=n))
            anterior = l
            continue

        if _MARCADOR_LISTA.match(l.texto):
            blocos.append(Bloco("item", _MARCADOR_GRAFICO.sub("", l.texto)))
            anterior = l
            continue

        novo_paragrafo = (
            atual is None
            or atual.tipo == "titulo"
            or anterior is None
            or _quebra_de_paragrafo(anterior, l, passo_tipico, margem_direita, largura)
        )
        if atual is not None and atual.tipo == "item" and not novo_paragrafo:
            atual.texto = _juntar(atual.texto, l.texto)
        elif novo_paragrafo or atual.tipo != "paragrafo":
            blocos.append(Bloco("paragrafo", l.texto))
        else:
            atual.texto = _juntar(atual.texto, l.texto)
        anterior = l

    return blocos


def _quebra_de_paragrafo(
    anterior: _Linha, l: _Linha, passo: float, margem_direita: float, largura: float
) -> bool:
    terminou_frase = anterior.texto.endswith(_FIM_DE_FRASE)
    if anterior.pagina != l.pagina:
        # Parágrafo que atravessa a página continua se a frase não terminou.
        return terminou_frase
    if l.topo - anterior.topo > passo * 1.4:
        return True
    linha_curta = anterior.x1 < margem_direita - 0.15 * largura
    recuo = l.x0 > anterior.x0 + 8
    return terminou_frase and (linha_curta or recuo)


def _juntar(texto: str, continuacao: str) -> str:
    # Hifenização de fim de linha ("fotossín-" + "tese"): junta sem o hífen
    # quando a continuação começa em minúscula. Palavra composta partida
    # exatamente no hífen ("guarda-" + "chuva") também cai aqui e perde o
    # hífen — custo aceito, porque é bem mais rara que a hifenização silábica.
    if re.search(r"[A-Za-zÀ-ÿ]-$", texto):
        if continuacao[:1].islower():
            return texto[:-1] + continuacao
        return texto + continuacao  # "Mato-" + "Grosso": o hífen é da palavra
    return f"{texto} {continuacao}"


# ---------------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------------

_ESTILO_TITULO = re.compile(r"^(heading|t[íi]tulo)\s*(\d)$")


def _extrair_docx(conteudo: bytes, limite_paginas: int) -> Extracao:
    try:
        documento = Document(io.BytesIO(conteudo))
    except Exception:
        raise _erro_arquivo_ilegivel() from None

    blocos: list[Bloco] = []
    for elemento in documento.element.body.iterchildren():
        if elemento.tag == qn("w:p"):
            bloco = _bloco_de_paragrafo(Paragraph(elemento, documento))
            if bloco:
                blocos.append(bloco)
        elif elemento.tag == qn("w:tbl"):
            bloco = _bloco_de_tabela(Table(elemento, documento))
            if bloco:
                blocos.append(bloco)

    paginas = _paginas_declaradas(conteudo)
    estimadas = paginas is None
    if estimadas:
        caracteres = sum(len(b.texto) + sum(len(c) for r in b.linhas for c in r) for b in blocos)
        paginas = max(1, math.ceil(caracteres / CARACTERES_POR_PAGINA))
    if paginas > limite_paginas:
        raise _erro_paginas(paginas, limite_paginas, estimado=estimadas)

    return Extracao(FormatoArquivo.DOCX, blocos, paginas, paginas_estimadas=estimadas)


def _bloco_de_paragrafo(paragrafo: Paragraph) -> Bloco | None:
    texto = re.sub(r"\s+", " ", paragrafo.text).strip()
    if not texto:
        return None
    nivel = _nivel_titulo_docx(paragrafo)
    if nivel:
        return Bloco("titulo", texto, nivel=nivel)
    nome_estilo = (paragrafo.style.name if paragrafo.style is not None else "").lower()
    numerado = paragrafo._p.pPr is not None and paragrafo._p.pPr.numPr is not None
    if numerado or nome_estilo.startswith(("list", "lista")):
        return Bloco("item", _MARCADOR_GRAFICO.sub("", texto))
    return Bloco("paragrafo", texto)


def _nivel_titulo_docx(paragrafo: Paragraph) -> int:
    nome = (paragrafo.style.name if paragrafo.style is not None else "").strip().lower()
    if nome in ("title", "título", "titulo"):
        return 1
    encontrado = _ESTILO_TITULO.match(nome)
    if encontrado:
        return min(int(encontrado.group(2)), NIVEL_MAXIMO)
    # Estilo personalizado marcado como nível de tópico no Word.
    contorno = paragrafo._p.xpath("./w:pPr/w:outlineLvl/@w:val")
    if contorno and int(contorno[0]) < 9:
        return min(int(contorno[0]) + 1, NIVEL_MAXIMO)
    return 0


def _bloco_de_tabela(tabela: Table) -> Bloco | None:
    linhas = []
    for linha in tabela.rows:
        celulas, vistas = [], set()
        for celula in linha.cells:
            # Célula mesclada aparece repetida em python-docx; conta uma vez.
            if id(celula._tc) in vistas:
                continue
            vistas.add(id(celula._tc))
            celulas.append(re.sub(r"\s+", " ", celula.text).strip())
        if any(celulas):
            linhas.append(celulas)
    return Bloco("tabela", linhas=linhas) if linhas else None


def _paginas_declaradas(conteudo: bytes) -> int | None:
    """Contagem que o próprio Word grava em docProps/app.xml ao salvar.
    Arquivo gerado por outro programa costuma não ter."""
    try:
        with zipfile.ZipFile(io.BytesIO(conteudo)) as pacote:
            xml = pacote.read("docProps/app.xml").decode("utf-8", "ignore")
    except (KeyError, zipfile.BadZipFile):
        return None
    encontrado = re.search(r"<(?:\w+:)?Pages>(\d+)</", xml)
    paginas = int(encontrado.group(1)) if encontrado else 0
    return paginas or None


# ---------------------------------------------------------------------------
# Suficiência (RN09) e mensagens
# ---------------------------------------------------------------------------

def _exigir_conteudo_suficiente(extracao: Extracao) -> None:
    letras = sum(1 for c in extracao.texto if c.isalpha())
    if letras < MINIMO_LETRAS:
        raise ErroDeNegocio(
            "Não foi possível ler o texto deste material",
            "O arquivo enviado não tem texto que o sistema consiga ler — em geral, isso acontece "
            "quando o material foi digitalizado como imagem. Adaptar um material lido pela metade "
            "produziria um resultado errado sem avisar você.",
            "Envie o arquivo original em PDF ou Word, ou passe o material por um programa de "
            "reconhecimento de texto (OCR) antes de enviar novamente.",
            "RN09",
        )


def _erro_paginas_sem_texto(paginas: list[int]) -> ErroDeNegocio:
    lista = _listar(paginas)
    plural = len(paginas) > 1
    return ErroDeNegocio(
        "Parte deste material não pôde ser lida",
        f"{'As páginas' if plural else 'A página'} {lista} "
        f"{'são imagens' if plural else 'é uma imagem'}, sem texto que o sistema consiga ler. "
        "O sistema não adapta material pela metade: o resultado ficaria sem esse trecho, "
        "e nada avisaria isso a quem o recebesse.",
        "Passe o arquivo por um programa de reconhecimento de texto (OCR), ou envie só as "
        "páginas que têm texto, e tente de novo.",
        "RN09",
    )


def _erro_paginas(paginas: int, limite: int, estimado: bool) -> ErroDeNegocio:
    medida = f"cerca de {paginas} páginas" if estimado else f"{paginas} páginas"
    return ErroDeNegocio(
        "Este material está acima do limite aceito",
        f"O arquivo tem {medida}. O limite é de {limite} páginas por envio.",
        "Separe o material em partes menores — por exemplo, um capítulo por envio — e envie de novo.",
        "RNF08",
        status=413,
    )


def _erro_arquivo_ilegivel() -> ErroDeNegocio:
    return ErroDeNegocio(
        "Não foi possível abrir este arquivo",
        "O arquivo parece estar danificado ou protegido por senha.",
        "Abra o arquivo no seu computador para conferir se ele abre normalmente. Se tiver senha, "
        "salve uma cópia sem senha e envie de novo.",
        "RF03",
    )


def _listar(numeros: list[int]) -> str:
    textos = [str(n) for n in numeros]
    return textos[0] if len(textos) == 1 else ", ".join(textos[:-1]) + " e " + textos[-1]


def _bloco_em_markdown(bloco: Bloco) -> str:
    if bloco.tipo == "titulo":
        return f"{'#' * bloco.nivel} {bloco.texto}"
    if bloco.tipo == "item":
        return f"- {bloco.texto}"
    if bloco.tipo == "tabela":
        largura = max(len(r) for r in bloco.linhas)
        linhas = [r + [""] * (largura - len(r)) for r in bloco.linhas]
        celula = lambda t: t.replace("|", "\\|")  # noqa: E731
        saida = ["| " + " | ".join(celula(c) for c in linhas[0]) + " |"]
        saida.append("|" + " --- |" * largura)
        saida += ["| " + " | ".join(celula(c) for c in r) + " |" for r in linhas[1:]]
        return "\n".join(saida)
    return bloco.texto
