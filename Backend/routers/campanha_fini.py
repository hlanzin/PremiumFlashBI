from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data
from routers.auth import get_current_user, CurrentUser
from sql.campanha_fini_sql import build_campanha_fini_sql

router = APIRouter(prefix="/api/campanha-fini", tags=["Campanha Fini"])


@router.get("")
def get_campanha_fini(data: Optional[str] = None,
                      u: CurrentUser = Depends(get_current_user)):
    """
    Campanha Fini (fornecedor 1488) — visão por cliente.
    Cada vendedor vê seus clientes; supervisor a equipe; admin/gerencial tudo.
    Fornecedor não tem acesso (é campanha interna de vendas).
    """
    if u.is_fornecedor:
        raise HTTPException(403, "Acesso negado")

    try:
        dr = parse_data(data)
        if u.is_vendedor:
            modo, filtro = "vendedor", u.cod_winthor
        elif u.is_supervisor:
            modo, filtro = "supervisor", u.cod_winthor
        else:  # admin / gerencial
            modo, filtro = "todos", None

        sql, params = build_campanha_fini_sql(modo, filtro, dr)
        rows = execute_query(sql, params)

        # Totais gerais para o cabeçalho
        tot_meta = round(sum(r.get("meta_cliente") or 0 for r in rows), 2)
        tot_real = round(sum(r.get("realizado_mes_atual") or 0 for r in rows), 2)
        tot_dia  = round(sum(r.get("realizado_dia") or 0 for r in rows), 2)

        return {
            "data_ref":       dr,
            "total_clientes": len(rows),
            "totais": {
                "meta":          tot_meta,
                "realizado":     tot_real,
                "realizado_dia": tot_dia,
                "pct_meta":      round(tot_real / tot_meta * 100, 1) if tot_meta > 0 else None,
            },
            "dados": rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
