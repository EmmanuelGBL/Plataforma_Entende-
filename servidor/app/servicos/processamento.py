"""Liga os serviços na ordem do diagrama de sequência 03: regras → motor →
registro das regras aplicadas → métricas → questões.

Fica separado das rotas para que a ordem — e o que acontece quando uma etapa
falha — esteja num lugar só.
"""

import logging
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Configuracao
from ..erros import ErroDeNegocio
from ..modelos import (
    Adaptacao,
    AplicacaoRegra,
    Alternativa,
    AtividadePublicada,
    Material,
    MetricaLegibilidade,
    Questao,
    StatusAdaptacao,
)
from . import legibilidade, motor, questoes, regras
from .cliente_llm import ClienteLLM

log = logging.getLogger("entende")

# Sem I, O, 0 e 1: o código é ditado em voz alta na sala (o mesmo alfabeto
# de src/servicos/api.js).
ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def adaptar_material(
    sessao: Session, material: Material, config: Configuracao, cliente: ClienteLLM
) -> Adaptacao:
    conjunto, impressao = regras.carregar(config.caminho_regras)
    if conjunto.identificador != material.perfil:
        # RN03: uma adaptação, um perfil.
        raise ErroDeNegocio(
            "O conjunto de regras não corresponde ao perfil do material",
            f"O material é do perfil {material.perfil.value} e as regras são do perfil "
            f"{conjunto.identificador.value}.",
            "Confira o arquivo de regras configurado no servidor.",
            "RN03",
            status=500,
        )
    registro = regras.registrar(sessao, conjunto, impressao)

    resultado = motor.adaptar(material.texto_extraido, conjunto, cliente)

    por_codigo = {r.codigo: r for r in registro.regras}
    aplicacoes = []
    for bloco in resultado.blocos:
        for codigo in bloco.regras:
            aplicacoes.append(
                AplicacaoRegra(
                    regra=por_codigo[codigo],
                    trecho_original=bloco.trecho_original,
                    trecho_resultante=bloco.texto,
                    ordem=len(aplicacoes) + 1,
                )
            )

    adaptacao = Adaptacao(
        material=material,
        conjunto=registro,
        modelo=cliente.modelo,
        texto_gerado=resultado.texto,
        texto_adaptado=resultado.texto,
        aplicacoes=aplicacoes,
    )
    recalcular_metricas(adaptacao)
    sessao.add(adaptacao)

    # Questões só na primeira adaptação: se o professor já revisou as dele
    # (RF14), reprocessar o texto (RF12) não as apaga.
    if not material.questoes:
        try:
            gerar_questoes(sessao, material, adaptacao.texto_adaptado, cliente)
        except ErroDeNegocio as erro:
            # A adaptação não se perde por causa das questões: elas podem ser
            # geradas de novo pela tela da atividade.
            log.warning("Questões não geradas para %s: %s", material.id, erro.titulo)

    sessao.commit()
    return adaptacao


def recalcular_metricas(adaptacao: Adaptacao) -> None:
    original = legibilidade.medir(adaptacao.material.texto_extraido)
    adaptado = legibilidade.medir(adaptacao.texto_adaptado)
    adaptacao.metricas = [
        MetricaLegibilidade(
            codigo=i.codigo,
            nome=i.nome,
            valor_original=original[i.codigo],
            valor_adaptado=adaptado[i.codigo],
            ordem=n,
        )
        for n, i in enumerate(legibilidade.INDICADORES, start=1)
    ]


def editar_texto(adaptacao: Adaptacao, texto: str) -> None:
    """RF09. Editar depois de aprovar volta a pedir aprovação (RN02): o que
    foi aprovado não é mais o que está ali."""
    adaptacao.texto_adaptado = texto.strip()
    adaptacao.status = StatusAdaptacao.EM_REVISAO
    adaptacao.data_aprovacao = None
    recalcular_metricas(adaptacao)


def gerar_questoes(sessao: Session, material: Material, texto: str, cliente: ClienteLLM) -> None:
    geradas = questoes.gerar(texto, cliente)
    if not geradas:
        raise ErroDeNegocio(
            "Não foi possível gerar questões a partir deste material",
            "Nenhuma das questões propostas pôde ser conferida no texto do material (RN04).",
            "Tente gerar de novo, ou escreva as questões na tela da atividade.",
            "RN04",
        )
    definir_questoes(
        material,
        [(q.enunciado, q.alternativas, q.correta, q.trecho, q.dica) for q in geradas],
    )


def definir_questoes(material: Material, dados: list[tuple[str, list[str], int, str, str]]) -> None:
    material.questoes.clear()
    for ordem, (enunciado, alternativas, correta, trecho, dica) in enumerate(dados, start=1):
        material.questoes.append(
            Questao(
                enunciado=enunciado,
                ordem=ordem,
                origem_no_material=trecho,
                dica=dica,
                alternativas=[
                    Alternativa(texto=texto, correta=(n == correta), ordem=n)
                    for n, texto in enumerate(alternativas)
                ],
            )
        )


def publicar(sessao: Session, material: Material) -> AtividadePublicada:
    adaptacao = material.adaptacao_atual
    if adaptacao is None or adaptacao.status is not StatusAdaptacao.APROVADA:
        raise ErroDeNegocio(
            "A adaptação ainda não foi aprovada",
            "A atividade só pode ser publicada depois que você aprova o material adaptado.",
            "Abra a revisão da adaptação, confira o texto e aprove.",
            "RN02",
            status=409,
        )
    if not material.questoes:
        raise ErroDeNegocio(
            "A atividade não tem questões",
            "Não há nenhuma questão para os estudantes responderem.",
            "Gere as questões ou escreva pelo menos uma antes de publicar.",
            "RF15",
            status=409,
        )
    atual = material.atividade_atual
    if atual is not None and atual.ativa:
        return atual

    while True:
        codigo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(6))
        if sessao.scalar(select(AtividadePublicada).where(AtividadePublicada.codigo == codigo)) is None:
            break
    atividade = AtividadePublicada(material=material, codigo=codigo)
    sessao.add(atividade)
    return atividade
