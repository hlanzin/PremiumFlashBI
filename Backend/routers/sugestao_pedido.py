from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query
from routers.auth import get_current_user, CurrentUser
from sql.sugestao_pedido_sql import build_sugestao_pedido_sql

router = APIRouter(prefix="/api/sugestao-pedido", tags=["Sugestão de Pedido"])


@router.get("")
def get_sugestao_pedido(
    codfornec:  int,
    dini:       str,           # período venda — início (YYYY-MM-DD)
    dfim:       str,           # período venda — fim
    dcorte_ini: str,           # período corte — início
    dcorte_fim: str,           # período corte — fim
    dias_estoque: int,         # dias úteis de estoque desejados
    u: CurrentUser = Depends(get_current_user),
):
    if u.cargo not in ("admin", "gerencial"):
        raise HTTPException(403, "Acesso restrito a admin/gerencial")
    if dias_estoque <= 0:
        raise HTTPException(400, "dias_estoque deve ser maior que zero")

    try:
        sql, params = build_sugestao_pedido_sql(
            codfornec, dini, dfim, dcorte_ini, dcorte_fim, dias_estoque
        )
        rows = execute_query(sql, params)
        return {
            "codfornec":    codfornec,
            "periodo_venda": {"ini": dini, "fim": dfim},
            "periodo_corte": {"ini": dcorte_ini, "fim": dcorte_fim},
            "dias_estoque": dias_estoque,
            "total_itens":  len(rows),
            "dados":        rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
