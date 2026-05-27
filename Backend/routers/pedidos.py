from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user, CurrentUser
from database import execute_query
from sql.pedidos_sql import build_pedidos_sql, build_itens_sql
from datetime import date

router = APIRouter(prefix="/api/pedidos", tags=["Pedidos"])

FORBIDDEN = HTTPException(403, "Acesso não autorizado")


@router.get("")
def get_pedidos(
    dt_ini:  Optional[str] = None,
    dt_fim:  Optional[str] = None,
    codusur: Optional[int] = None,
    codcli:  Optional[int] = None,
    numped:  Optional[int] = None,
    u: CurrentUser = Depends(get_current_user),
):
    hoje = date.today().isoformat()
    ini  = dt_ini or hoje
    fim  = dt_fim or hoje

    # Controle de acesso
    filtro_v   = u.cod_winthor if u.is_vendedor   else codusur
    filtro_sup = u.cod_winthor if u.is_supervisor  else None

    sql, params = build_pedidos_sql(
        dt_ini=ini, dt_fim=fim,
        cod_vendedor=filtro_v,
        cod_supervisor=filtro_sup,
        codcli=codcli,
        numped=numped,
    )
    rows = execute_query(sql, params)
    return {"dados": rows, "total": len(rows)}


@router.get("/{numped}/itens")
def get_itens(
    numped: int,
    u: CurrentUser = Depends(get_current_user),
):
    sql, params = build_itens_sql(numped)
    rows = execute_query(sql, params)
    return {"numped": numped, "itens": rows}
