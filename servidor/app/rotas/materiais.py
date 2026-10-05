"""Materiais do professor: enviar (RF02–RF04), listar (RF19), consultar e
excluir definitivamente (RF20).

RNF12: toda consulta filtra pelo professor autenticado. Material de outro
professor responde 404, e não 403, para não confirmar que aquele
identificador existe.
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..banco import obter_sessao
from ..erros import ErroDeNegocio
from ..esquemas import MaterialDetalhe, MaterialResumo
from ..modelos import EtapaEscolar, Material, PerfilAdaptacao, Professor
from ..seguranca import professor_atual
from ..servicos.extrator import extrair

rotas = APIRouter(prefix="/api/materiais", tags=["Materiais"])

_BLOCO_LEITURA = 1024 * 1024


async def _ler_com_limite(arquivo: UploadFile, limite_bytes: int) -> bytes:
    """Lê em partes e para assim que passa do limite (RNF08), em vez de
    carregar na memória um arquivo de qualquer tamanho para só depois medir."""
    partes, lidos = [], 0
    while parte := await arquivo.read(_BLOCO_LEITURA):
        lidos += len(parte)
        if lidos > limite_bytes:
            megabytes = limite_bytes // (1024 * 1024)
            raise ErroDeNegocio(
                "Este material está acima do limite aceito",
                f"O arquivo passa de {megabytes} MB. O limite é de {megabytes} MB por envio.",
                "Separe o material em partes menores — por exemplo, um capítulo por envio — e "
                "envie de novo.",
                "RNF08",
                status=413,
            )
        partes.append(parte)
    return b"".join(partes)


def _material_do_professor(sessao: Session, material_id: uuid.UUID, professor: Professor) -> Material:
    material = sessao.scalar(
        select(Material).where(Material.id == material_id, Material.professor_id == professor.id)
    )
    if material is None:
        raise ErroDeNegocio(
            "Material não encontrado",
            "Este material não existe ou não pertence à sua conta.",
            "Volte para Meus materiais e abra o material pela lista.",
            "RNF12",
            status=404,
        )
    return material


@rotas.post("", response_model=MaterialDetalhe, status_code=status.HTTP_201_CREATED)
async def enviar(
    request: Request,
    arquivo: UploadFile = File(...),
    # RF04 — a etapa é informada pelo professor e registrada. Nesta versão só
    # existe uma; o campo existe para que o registro seja explícito.
    etapa_escolar: EtapaEscolar = Form(EtapaEscolar.ANOS_INICIAIS_5_ANO),
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    config = request.app.state.configuracao
    nome = (arquivo.filename or "material").strip()[:255]
    conteudo = await _ler_com_limite(arquivo, config.limite_bytes)

    extracao = extrair(conteudo, nome, config.limite_paginas)

    material = Material(
        professor_id=professor.id,
        nome_arquivo=nome,
        formato=extracao.formato,
        numero_paginas=extracao.numero_paginas,
        paginas_estimadas=extracao.paginas_estimadas,
        tamanho_bytes=len(conteudo),
        texto_extraido=extracao.texto,
        perfil=PerfilAdaptacao.TEA,
        etapa_escolar=etapa_escolar,
    )
    sessao.add(material)
    sessao.commit()
    return material


@rotas.get("", response_model=list[MaterialResumo])
def listar(professor: Professor = Depends(professor_atual), sessao: Session = Depends(obter_sessao)):
    return sessao.scalars(
        select(Material)
        .where(Material.professor_id == professor.id)
        .order_by(Material.data_envio.desc())
    ).all()


@rotas.get("/{material_id}", response_model=MaterialDetalhe)
def consultar(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    return _material_do_professor(sessao, material_id, professor)


@rotas.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(
    material_id: uuid.UUID,
    professor: Professor = Depends(professor_atual),
    sessao: Session = Depends(obter_sessao),
):
    # RF20 — exclusão definitiva, não lógica: a linha sai do banco. As
    # adaptações, quando existirem, saem junto pela chave estrangeira.
    sessao.delete(_material_do_professor(sessao, material_id, professor))
    sessao.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
