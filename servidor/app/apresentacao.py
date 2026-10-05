"""Monta as respostas da API a partir do modelo de dados."""

from collections import Counter

from .esquemas import (
    AdaptacaoDetalhe,
    AplicacaoPublica,
    AtividadeEstado,
    BlocoTexto,
    ConjuntoPublico,
    MaterialPainel,
    MaterialResumo,
    MetricaPublica,
    QuestaoProfessor,
    RegraPublica,
)
from .modelos import Adaptacao, ConjuntoRegras, Material, Questao, StatusAdaptacao
from .servicos import legibilidade
from .servicos import texto as md
from .servicos.regras import ConjuntoDeclarado


def conjunto_do_arquivo(conjunto: ConjuntoDeclarado) -> ConjuntoPublico:
    return ConjuntoPublico(
        perfil=conjunto.identificador.value,
        versao=conjunto.versao,
        data_publicacao=conjunto.publicado_em,
        descricao=conjunto.descricao,
        regras=[
            RegraPublica(
                codigo=r.codigo,
                nome=r.nome,
                descricao=r.descricao,
                base=r.base,
                justificativa=r.justificativa,
                aplicacao=r.aplicacao.value,
            )
            for r in conjunto.regras
        ],
    )


def conjunto_do_registro(conjunto: ConjuntoRegras) -> ConjuntoPublico:
    """As regras como estavam na versão que a adaptação usou — não as do arquivo
    de hoje. É o que a justificativa de RF10 precisa mostrar."""
    return ConjuntoPublico(
        perfil=conjunto.perfil.value,
        versao=conjunto.versao,
        data_publicacao=conjunto.data_publicacao,
        descricao=conjunto.descricao,
        regras=[
            RegraPublica(
                codigo=r.codigo,
                nome=r.nome,
                descricao=r.descricao,
                base=r.referencia_normativa,
                justificativa=r.justificativa,
                aplicacao=r.aplicacao.value,
            )
            for r in conjunto.regras
        ],
    )


def material_painel(material: Material) -> MaterialPainel:
    adaptacao = material.adaptacao_atual
    atividade = material.atividade_atual
    if atividade is None:
        estado_atividade = AtividadeEstado(estado="rascunho")
    else:
        estado_atividade = AtividadeEstado(
            estado="publicada" if atividade.ativa else "revogada",
            codigo=atividade.codigo,
            data_publicacao=atividade.data_publicacao,
            data_revogacao=atividade.data_revogacao,
        )
    return MaterialPainel(
        **MaterialResumo.model_validate(material).model_dump(),
        estado=adaptacao.status.value.lower() if adaptacao else "enviado",
        versao_regras=(
            f"{adaptacao.conjunto.perfil.value} v{adaptacao.conjunto.versao}" if adaptacao else None
        ),
        atividade=estado_atividade,
    )


def adaptacao_detalhe(adaptacao: Adaptacao) -> AdaptacaoDetalhe:
    # Marca de regra por bloco: vem do registro das aplicações. Bloco que o
    # professor editou deixa de coincidir com o que o motor produziu e perde a
    # marca — o que é verdade: aquele texto já não é obra da regra.
    regras_por_texto: dict[str, list[str]] = {}
    for aplicacao in adaptacao.aplicacoes:
        regras_por_texto.setdefault(aplicacao.trecho_resultante, []).append(aplicacao.regra.codigo)

    blocos = [
        BlocoTexto(tipo=b.tipo, nivel=b.nivel, texto=b.texto, regras=regras_por_texto.get(b.texto, []))
        for b in md.ler(adaptacao.texto_adaptado)
    ]
    original = [
        BlocoTexto(tipo=b.tipo, nivel=b.nivel, texto=b.texto, regras=[])
        for b in md.ler(adaptacao.material.texto_extraido)
    ]

    indicadores = {i.codigo: i for i in legibilidade.INDICADORES}
    metricas = [
        MetricaPublica(
            codigo=m.codigo,
            nome=m.nome,
            original=m.valor_original,
            adaptado=m.valor_adaptado,
            situacao=legibilidade.situacao(indicadores[m.codigo], m.valor_original, m.valor_adaptado)
            if m.codigo in indicadores
            else "igual",
            leitura=indicadores[m.codigo].leitura if m.codigo in indicadores else "",
        )
        for m in adaptacao.metricas
    ]
    flesch = {m.codigo: m for m in adaptacao.metricas}.get("indice_flesch")

    return AdaptacaoDetalhe(
        id=adaptacao.id,
        material_id=adaptacao.material_id,
        status=adaptacao.status.value,
        modelo=adaptacao.modelo,
        editada=adaptacao.texto_adaptado != adaptacao.texto_gerado,
        data_geracao=adaptacao.data_geracao,
        data_aprovacao=adaptacao.data_aprovacao,
        conjunto=conjunto_do_registro(adaptacao.conjunto),
        blocos_original=original,
        texto_adaptado=adaptacao.texto_adaptado,
        blocos=blocos,
        aplicacoes=[
            AplicacaoPublica(
                regra=a.regra.codigo,
                trecho_original=a.trecho_original,
                trecho_resultante=a.trecho_resultante,
            )
            for a in adaptacao.aplicacoes
        ],
        ocorrencias=dict(Counter(a.regra.codigo for a in adaptacao.aplicacoes)),
        metricas=metricas,
        nivel_original=legibilidade.faixa_escolar(flesch.valor_original) if flesch else "",
        nivel_adaptado=legibilidade.faixa_escolar(flesch.valor_adaptado) if flesch else "",
    )


def questao_professor(questao: Questao) -> QuestaoProfessor:
    return QuestaoProfessor(
        id=questao.id,
        enunciado=questao.enunciado,
        alternativas=[a.texto for a in questao.alternativas],
        correta=next((n for n, a in enumerate(questao.alternativas) if a.correta), 0),
        trecho=questao.origem_no_material,
        dica=questao.dica,
    )


def titulo_do_material(material: Material) -> str:
    """Para a tela da criança: o primeiro título do texto adaptado, e não o
    nome do arquivo, que costuma ter sigla de turma ou nome do professor."""
    adaptacao = material.adaptacao_atual
    if adaptacao and adaptacao.status is StatusAdaptacao.APROVADA:
        for bloco in md.ler(adaptacao.texto_adaptado):
            if bloco.tipo == "titulo":
                return bloco.texto
    return "Atividade"
