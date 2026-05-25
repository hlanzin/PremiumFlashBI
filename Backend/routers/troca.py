from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user, CurrentUser
from database import execute_query, parse_data
from sql.troca_sql import build_troca_sql

router = APIRouter(prefix="/api/troca", tags=["Troca"])


@router.get("")
def get_troca(
    data: Optional[str] = None,
    u: CurrentUser = Depends(get_current_user),
):
    dr = parse_data(data)
    filtro_v   = u.cod_winthor if u.is_vendedor   else None
    filtro_sup = u.cod_winthor if u.is_supervisor  else None

    sql, params = build_troca_sql(
        date_ref=dr,
        filtro_vendedor=filtro_v,
        filtro_supervisor=filtro_sup,
    )
    rows = execute_query(sql, params)
    return {"dados": rows, "total": len(rows)}
