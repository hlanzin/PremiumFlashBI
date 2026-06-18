from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query
from routers.auth import get_current_user, CurrentUser
from sql.vendas_produto_forn_sql import (
    build_vendas_produto_sql,
    build_vendas_produto_semanal_sql,
)
from datetime import date

router = APIRouter(prefix="/api/vendas-produto", tags=["Vendas Produto Fornecedor"])


def _resolve_codfornecs(codfornec: Optional[str], u: CurrentUser):
    if not codfornec:
        raise HTTPException(400, "Informe ?codfornec=X")
    try:
        codfornecs = [int(x.strip()) for x in codfornec.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "codfornec inválido")

    if u.is_fornecedor:
        meus = set(int(x) for x in (u.codfornecs or []))
        codfornecs = [c for c in codfornecs if c in meus]
        if not codfornecs:
            raise HTTPException(403, "Código de fornecedor não autorizado")

    if not codfornecs:
        raise HTTPException(400, "Nenhum fornecedor informado")
    return codfornecs


@router.get("")
def get_vendas_produto(
    codfornec: Optional[str] = None,
    mes_ref:   Optional[str] = None,
    dt_ini:    Optional[str] = None,   # semana: domingo (YYYY-MM-DD)
    dt_fim:    Optional[str] = None,   # semana: sábado  (YYYY-MM-DD)
    u: CurrentUser = Depends(get_current_user)
):
    if u.cargo not in ("fornecedor", "admin", "gerencial"):
        raise HTTPException(403, "Acesso negado")

    codfornecs = _resolve_codfornecs(codfornec, u)
    if not mes_ref:
        mes_ref = date.today().strftime("%Y-%m")

    try:
        sql, params = build_vendas_produto_sql(codfornecs, mes_ref, dt_ini, dt_fim)
        rows = execute_query(sql, params)
        return {
            "mes_ref":      mes_ref,
            "dt_ini":       dt_ini,
            "dt_fim":       dt_fim,
            "total_linhas": len(rows),
            "dados":        rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/semanal")
def get_vendas_produto_semanal(
    codfornec: Optional[str] = None,
    mes_ref:   Optional[str] = None,
    u: CurrentUser = Depends(get_current_user)
):
    """Mês inteiro quebrado por semana (domingo a sábado) — para export Excel."""
    if u.cargo not in ("fornecedor", "admin", "gerencial"):
        raise HTTPException(403, "Acesso negado")

    codfornecs = _resolve_codfornecs(codfornec, u)
    if not mes_ref:
        mes_ref = date.today().strftime("%Y-%m")

    try:
        sql, params = build_vendas_produto_semanal_sql(codfornecs, mes_ref)
        rows = execute_query(sql, params)
        return {"mes_ref": mes_ref, "total_linhas": len(rows), "dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))