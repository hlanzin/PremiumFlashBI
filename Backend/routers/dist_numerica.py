from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data
from sql.dist_numerica_sql import build_dn_query, build_dn_total_query
from routers.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/dn", tags=["Dist. Numerica"])
FORBIDDEN = HTTPException(status_code=403, detail="Acesso negado para seu cargo.")


def _filtrar_fornecedor(rows: list, codfornecs: List[int]) -> list:
    if not codfornecs:
        return []
    s = set(int(x) for x in codfornecs)
    # Suporta tanto a coluna dim_id (novo SQL) quanto codfornec (legado)
    return [r for r in rows if int(r.get("dim_id") or r.get("codfornec") or 0) in s]


@router.get("")
def get_todos(data: Optional[str] = None, agrupamento: str = "fornecedor", u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_dn_query("todos", date_ref=dr, agrupamento=agrupamento)
        rows = execute_query(sql, params)
        if u.is_supervisor and u.cod_winthor:
            rows = [r for r in rows if r.get("cod_supervisor") == u.cod_winthor]
        if u.is_fornecedor:
            rows = _filtrar_fornecedor(rows, u.codfornecs)
        sql_t, p_t = build_dn_total_query("todos", date_ref=dr)
        tot = execute_query(sql_t, p_t)
        totais = tot[0] if tot else {}
        return {"data_ref": dr, "total_registros": len(rows), "dados": rows, "totais_distintos": totais}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/gerencial")
def get_gerencial(data: Optional[str] = None, agrupamento: str = "fornecedor", u: CurrentUser = Depends(get_current_user)):
    if u.is_supervisor or u.is_vendedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_dn_query("gerencial", date_ref=dr, agrupamento=agrupamento)
        rows = execute_query(sql, params)
        if u.is_fornecedor:
            rows = _filtrar_fornecedor(rows, u.codfornecs)
        sql_t, p_t = build_dn_total_query("gerencial", date_ref=dr)
        tot = execute_query(sql_t, p_t)
        totais = tot[0] if tot else {}
        return {"data_ref": dr, "total_registros": len(rows), "dados": rows, "totais_distintos": totais}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/vendedor/{cod}")
def get_por_vendedor(cod: int, data: Optional[str] = None, agrupamento: str = "fornecedor", u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor and u.cod_winthor != cod:
        raise FORBIDDEN
    if u.is_fornecedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_dn_query("vendedor", filtro_id=cod, date_ref=dr, agrupamento=agrupamento)
        rows = execute_query(sql, params)
        if not rows:
            raise HTTPException(404, f"Vendedor {cod} sem dados.")
        if u.is_supervisor and rows[0].get("cod_supervisor") != u.cod_winthor:
            raise FORBIDDEN
        sql_t, p_t = build_dn_total_query("vendedor", filtro_id=cod, date_ref=dr)
        tot = execute_query(sql_t, p_t)
        totais = tot[0] if tot else {}
        return {"data_ref": dr, "cod_vendedor": cod,
                "nome_vendedor": rows[0]["nome_vendedor"],
                "total_registros": len(rows), "dados": rows, "totais_distintos": totais}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/equipe/{cod}")
def get_por_equipe(cod: int, data: Optional[str] = None, agrupamento: str = "fornecedor", u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_dn_query("equipe", filtro_id=cod, date_ref=dr, agrupamento=agrupamento)
        rows = execute_query(sql, params)
        if u.is_fornecedor:
            rows = _filtrar_fornecedor(rows, u.codfornecs)
        if not rows:
            raise HTTPException(404, f"Nenhum dado para supervisor {cod}.")
        sql_t, p_t = build_dn_total_query("equipe", filtro_id=cod, date_ref=dr)
        tot = execute_query(sql_t, p_t)
        totais = tot[0] if tot else {}
        return {"data_ref": dr, "cod_supervisor": cod,
                "nome_supervisor": rows[0]["nome_supervisor"] if rows else None,
                "total_registros": len(rows), "dados": rows, "totais_distintos": totais}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/supervisor/{cod}")
def get_por_supervisor(cod: int, data: Optional[str] = None, agrupamento: str = "fornecedor", u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_dn_query("supervisor", filtro_id=cod, date_ref=dr, agrupamento=agrupamento)
        rows = execute_query(sql, params)
        if u.is_fornecedor:
            rows = _filtrar_fornecedor(rows, u.codfornecs)
        if not rows:
            raise HTTPException(404, f"Supervisor {cod} sem dados.")
        sql_t, p_t = build_dn_total_query("supervisor", filtro_id=cod, date_ref=dr)
        tot = execute_query(sql_t, p_t)
        totais = tot[0] if tot else {}
        return {"data_ref": dr, "cod_supervisor": cod,
                "nome_supervisor": rows[0]["nome_supervisor"] if rows else None,
                "total_registros": len(rows), "dados": rows, "totais_distintos": totais}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))