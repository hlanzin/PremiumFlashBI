from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user, CurrentUser
from database import execute_query, parse_data
from sql.lista_negra_sql import (
    build_lista_negra_sql, build_lista_negra_vendedor_sql,
    build_fornecedores_sql, build_secoes_sql
)

router = APIRouter(prefix="/api/lista-negra", tags=["Lista Negra"])


@router.get("/fornecedores")
def get_fornecedores(u: CurrentUser = Depends(get_current_user)):
    sql, params = build_fornecedores_sql()
    rows = execute_query(sql, params)
    # Fornecedor só vê seus próprios codfornecs
    if u.is_fornecedor and u.codfornecs:
        rows = [r for r in rows if r["id"] in u.codfornecs]
    return {"dados": rows}


@router.get("/secoes")
def get_secoes(u: CurrentUser = Depends(get_current_user)):
    sql, params = build_secoes_sql()
    rows = execute_query(sql, params)
    # Fornecedor só vê suas próprias seções
    if u.is_fornecedor and u.secoes:
        rows = [r for r in rows if r["id"] in u.secoes]
    return {"dados": rows}


@router.get("/vendedor")
def get_lista_negra_vendedor(
    agrupamento: str = "fornecedor",
    dim_id:      Optional[int] = None,
    data:        Optional[str] = None,
    cod_vendedor: Optional[int] = None,   # gerencial/supervisor podem passar cod explícito
    u: CurrentUser = Depends(get_current_user),
):
    if dim_id is None:
        raise HTTPException(400, "dim_id obrigatório.")

    dr = parse_data(data)

    # Vendedor usa seu próprio código; gerencial/supervisor passam cod_vendedor explícito
    if u.is_vendedor:
        filtro_v = u.cod_winthor
    elif cod_vendedor:
        filtro_v = cod_vendedor
    else:
        raise HTTPException(400, "cod_vendedor obrigatório para este perfil.")

    sql, params = build_lista_negra_vendedor_sql(
        agrupamento=agrupamento,
        dim_id=dim_id,
        date_ref=dr,
        cod_vendedor=filtro_v,
    )

    rows = execute_query(sql, params)
    return {"dados": rows, "total": len(rows), "cod_vendedor": filtro_v}


@router.get("")
def get_lista_negra(
    agrupamento: str = "fornecedor",
    dim_id:      Optional[int] = None,
    data:        Optional[str] = None,
    u: CurrentUser = Depends(get_current_user),
):
    if dim_id is None:
        raise HTTPException(400, "dim_id obrigatório.")

    dr = parse_data(data)

    # Fornecedor só pode consultar dims autorizadas a ele
    if u.is_fornecedor:
        allowed = u.codfornecs if agrupamento == "fornecedor" else u.secoes
        if allowed and dim_id not in allowed:
            raise HTTPException(403, "Acesso negado a essa dimensão.")

    filtro_v   = u.cod_winthor if u.is_vendedor   else None
    filtro_sup = u.cod_winthor if u.is_supervisor  else None

    sql, params = build_lista_negra_sql(
        agrupamento=agrupamento,
        dim_id=dim_id,
        date_ref=dr,
        filtro_vendedor=filtro_v,
        filtro_supervisor=filtro_sup,
    )

    rows = execute_query(sql, params)
    return {"dados": rows, "total": len(rows)}