from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user, CurrentUser
from database import execute_query, parse_data
from sql.lista_negra_sql import (
    build_lista_negra_sql, build_fornecedores_sql, build_secoes_sql
)

router = APIRouter(prefix="/api/lista-negra", tags=["Lista Negra"])


@router.get("/fornecedores")
def get_fornecedores(u: CurrentUser = Depends(get_current_user)):
    sql, params = build_fornecedores_sql()
    return {"dados": execute_query(sql, params)}


@router.get("/secoes")
def get_secoes(u: CurrentUser = Depends(get_current_user)):
    sql, params = build_secoes_sql()
    return {"dados": execute_query(sql, params)}


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