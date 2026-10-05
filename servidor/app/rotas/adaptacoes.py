"""Adaptação do material: gerar (RF05, RF06, RF12), consultar com métricas e
justificativas (RF07, RF08, RF10), editar (RF09) e aprovar (RN02)."""

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ..apresentacao import adaptacao_detalhe, conjunto_do_arquivo
from ..banco import obter_sessao
from ..erros import ErroDeNegocio
from ..esquemas import AdaptacaoDetalhe, ConjuntoPublico, EdicaoTexto
from ..modelos import Adaptacao, Professor, StatusAdaptacao, agora
from ..seguranca import professor_atual
from ..servicos import processamento, regras
from .materiais import material_do_professor

rotas = APIRouter(prefix="/api", tags=["Adaptação"])


def _adaptacao_atual(sessao: Session, material_id: uuid.UUID, professor: Professor) -> Adaptacao:
    adaptacao = material_do_professor(sessao, material_id, professor).adaptacao_atual
    if adaptacao is None:
        raise ErroDeNegocio(
            "Este material ainda não foi adaptado",
            "Não existe adaptação para este material.",
            "Volte para Meus materiais e mande processar o material.",
            "RF05",
            status=404,
        )
    return adaptacao


@rotas.get("/regras", response_model=ConjuntoPublico, tags=["Regras"])
def regras_vigentes(request: Request):
    """Catálogo das regras do arquivo em vigor (tela de Ajuda). Público: são
    critérios do projeto, não dado de ninguém."""
    conjunto, _ = regras.carregar(request.app.state.configuracao.caminho_regras)
    return conjunto_do_arquivo(conjunto)


@rotas.post(
    "/materiais/{material_id}/adaptacoes",
    response_model=AdaptacaoDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def adaptar(
    material_id: uuid.UUID,
    request: Request,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    """Gera uma adaptação nova com o arquivo de regras de agora. Chamar de novo
    num material já adaptado é o reprocessamento de RF12."""
    material = material_do_professor(sessao, material_id, professor)
    adaptacao = processamento.adaptar_material(
        sessao, material, request.app.state.configuracao, request.app.state.cliente_llm
    )
    return adaptacao_detalhe(adaptacao)


@rotas.get("/materiais/{material_id}/adaptacao", response_model=AdaptacaoDetalhe)
def consultar(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    return adaptacao_detalhe(_adaptacao_atual(sessao, material_id, professor))


@rotas.put("/materiais/{material_id}/adaptacao/texto", response_model=AdaptacaoDetalhe)
def editar(
    material_id: uuid.UUID,
    edicao: EdicaoTexto,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    adaptacao = _adaptacao_atual(sessao, material_id, professor)
    processamento.editar_texto(adaptacao, edicao.texto)
    sessao.commit()
    return adaptacao_detalhe(adaptacao)


@rotas.post("/materiais/{material_id}/adaptacao/aprovacao", response_model=AdaptacaoDetalhe)
def aprovar(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    adaptacao = _adaptacao_atual(sessao, material_id, professor)
    if adaptacao.status is not StatusAdaptacao.APROVADA:
        adaptacao.status = StatusAdaptacao.APROVADA
        adaptacao.data_aprovacao = agora()
        sessao.commit()
    return adaptacao_detalhe(adaptacao)
