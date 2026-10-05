"""Questões e atividade: revisar as questões (RF13, RF14, RF23), publicar e
revogar o link (RF15, RF18, RN06) e a rota pública da criança (RF16, RF21,
RF22), que não pede cadastro e não guarda nada (RN05)."""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..apresentacao import material_painel, questao_professor, titulo_do_material
from ..banco import obter_sessao
from ..erros import ErroDeNegocio
from ..esquemas import (
    AtividadeEstado,
    AtividadeEstudante,
    QuestaoEntrada,
    QuestaoEstudante,
    QuestaoProfessor,
)
from ..modelos import AtividadePublicada, Professor, agora
from ..seguranca import professor_atual
from ..servicos import processamento
from .materiais import material_do_professor

rotas = APIRouter(prefix="/api", tags=["Atividade"])


@rotas.get("/materiais/{material_id}/questoes", response_model=list[QuestaoProfessor])
def listar_questoes(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    return [questao_professor(q) for q in material_do_professor(sessao, material_id, professor).questoes]


@rotas.put("/materiais/{material_id}/questoes", response_model=list[QuestaoProfessor])
def substituir_questoes(
    material_id: uuid.UUID,
    questoes: list[QuestaoEntrada],
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    """RF14 — a lista inteira, como o professor a deixou: editar, excluir e
    reordenar são todos a mesma operação."""
    for numero, q in enumerate(questoes, start=1):
        if q.correta >= len(q.alternativas):
            raise ErroDeNegocio(
                f"A questão {numero} não tem resposta certa marcada",
                "A resposta marcada como certa não está entre as alternativas.",
                "Marque qual alternativa é a certa e salve de novo.",
                "RF14",
            )
        if any(not a.strip() for a in q.alternativas):
            raise ErroDeNegocio(
                f"A questão {numero} tem alternativa vazia",
                "Toda alternativa precisa ter texto.",
                "Escreva a alternativa ou retire-a e salve de novo.",
                "RF14",
            )
    material = material_do_professor(sessao, material_id, professor)
    processamento.definir_questoes(
        material,
        [
            (q.enunciado.strip(), [a.strip() for a in q.alternativas], q.correta, q.trecho, q.dica)
            for q in questoes
        ],
    )
    sessao.commit()
    return [questao_professor(q) for q in material.questoes]


@rotas.post("/materiais/{material_id}/questoes/geracao", response_model=list[QuestaoProfessor])
def gerar_questoes(
    material_id: uuid.UUID,
    request: Request,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    """Gera de novo, a partir do texto adaptado atual. Substitui as questões."""
    material = material_do_professor(sessao, material_id, professor)
    adaptacao = material.adaptacao_atual
    if adaptacao is None:
        raise ErroDeNegocio(
            "Este material ainda não foi adaptado",
            "As questões são geradas a partir do texto adaptado.",
            "Processe o material primeiro.",
            "RF13",
            status=409,
        )
    processamento.gerar_questoes(
        sessao, material, adaptacao.texto_adaptado, request.app.state.cliente_llm
    )
    sessao.commit()
    return [questao_professor(q) for q in material.questoes]


@rotas.post("/materiais/{material_id}/atividade", response_model=AtividadeEstado)
def publicar(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    material = material_do_professor(sessao, material_id, professor)
    processamento.publicar(sessao, material)
    sessao.commit()
    return material_painel(material).atividade


@rotas.delete("/materiais/{material_id}/atividade", response_model=AtividadeEstado)
def revogar(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    material = material_do_professor(sessao, material_id, professor)
    atividade = material.atividade_atual
    if atividade is not None and atividade.ativa:
        atividade.ativa = False
        atividade.data_revogacao = agora()
        sessao.commit()
    return material_painel(material).atividade


# --- Rota pública da criança --------------------------------------------------

LINK_INDISPONIVEL = ErroDeNegocio(
    "Esta atividade não está disponível",
    "O código não existe, ou o professor encerrou esta atividade.",
    "Confira o código com o seu professor.",
    "RN06",
    status=404,
)


@rotas.get("/atividades/{codigo}", response_model=AtividadeEstudante, tags=["Estudante"])
def abrir_atividade(codigo: str, sessao: Session = Depends(obter_sessao)):
    atividade = sessao.scalar(
        select(AtividadePublicada).where(AtividadePublicada.codigo == codigo.strip().upper())
    )
    if atividade is None or not atividade.ativa:
        raise LINK_INDISPONIVEL
    material = atividade.material
    return AtividadeEstudante(
        codigo=atividade.codigo,
        titulo=titulo_do_material(material),
        questoes=[
            QuestaoEstudante(
                id=q.id,
                enunciado=q.enunciado,
                alternativas=[a.texto for a in q.alternativas],
                correta=next((n for n, a in enumerate(q.alternativas) if a.correta), 0),
                dica=q.dica,
            )
            for q in material.questoes
        ],
    )
