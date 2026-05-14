from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data, get_connection
from sql.faturamento_sql import build_query, build_ranking_query
from routers.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/faturamento", tags=["Faturamento"])
FORBIDDEN = HTTPException(status_code=403, detail="Acesso negado para seu cargo.")


def _filtrar_secoes(rows: list, secoes: List[int]) -> list:
    if not secoes:
        return []
    s = set(int(x) for x in secoes)
    return [r for r in rows if int(r.get("cod_secao") or 0) in s]


# ── Listas para dropdowns ─────────────────────────────────────────────────────
@router.get("/secoes-disponiveis", tags=["Listas"])
def get_secoes_disponiveis(u: CurrentUser = Depends(get_current_user)):
    try:
        sql = "SELECT CODSEC, DESCRICAO FROM PCSECAO ORDER BY DESCRICAO"
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(sql)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/vendedores", tags=["Listas"])
def get_vendedores(u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    try:
        if u.is_supervisor and u.cod_winthor:
            sql = f"""SELECT DISTINCT PCUSUARI.CODUSUR AS COD_VENDEDOR, PCUSUARI.NOME AS NOME_VENDEDOR
                      FROM PCUSUARI
                      WHERE PCUSUARI.CODSUPERVISOR = {u.cod_winthor}
                        AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)
                        AND PCUSUARI.NOME LIKE 'PMU%'
                      ORDER BY PCUSUARI.NOME"""
        else:
            sql = """SELECT DISTINCT PCUSUARI.CODUSUR AS COD_VENDEDOR, PCUSUARI.NOME AS NOME_VENDEDOR
                     FROM PCUSUARI
                     WHERE PCUSUARI.CODUSUR NOT IN (2,10,160,180)
                       AND NVL(PCUSUARI.CODSUPERVISOR,0) NOT IN (9999)
                       AND PCUSUARI.CODUSUR > 0
                       AND PCUSUARI.NOME LIKE 'PMU%'
                     ORDER BY PCUSUARI.NOME"""
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(sql)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/supervisores", tags=["Listas"])
def get_supervisores(u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    try:
        sql = """SELECT DISTINCT PCSUPERV.CODSUPERVISOR AS COD_SUPERVISOR, PCSUPERV.NOME AS NOME_SUPERVISOR
                 FROM PCSUPERV
                 WHERE PCSUPERV.CODSUPERVISOR NOT IN (9999)
                   AND PCSUPERV.NOME LIKE 'PMU%'
                 ORDER BY PCSUPERV.NOME"""
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(sql)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Faturamento ───────────────────────────────────────────────────────────────
@router.get("")
def get_todos(data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_query("todos", date_ref=dr)
        rows = execute_query(sql, params)
        if u.is_supervisor and u.cod_winthor:
            rows = [r for r in rows if r.get("cod_supervisor") == u.cod_winthor]
        if u.is_fornecedor:
            rows = _filtrar_secoes(rows, u.secoes)
        return {"data_ref": dr, "total_registros": len(rows), "dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/gerencial")
def get_gerencial(data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_supervisor or u.is_vendedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_query("gerencial", date_ref=dr)
        rows = execute_query(sql, params)
        if u.is_fornecedor:
            rows = _filtrar_secoes(rows, u.secoes)
        return {
            "data_ref": dr, "total_registros": len(rows),
            "total_faturado": round(sum(r.get("valor_faturado_secao") or 0 for r in rows), 2),
            "total_meta":     round(sum(r.get("valor_meta_secao")     or 0 for r in rows), 2),
            "dados": rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/vendedor/{cod}")
def get_por_vendedor(cod: int, data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor and u.cod_winthor != cod:
        raise FORBIDDEN
    if u.is_fornecedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_query("vendedor", filtro_id=cod, date_ref=dr)
        rows = execute_query(sql, params)
        if not rows:
            raise HTTPException(404, f"Vendedor {cod} nao encontrado.")
        if u.is_supervisor and rows[0].get("cod_supervisor") != u.cod_winthor:
            raise FORBIDDEN
        if u.is_fornecedor:
            rows = _filtrar_secoes(rows, u.secoes)
        return {"data_ref": dr, "cod_vendedor": cod,
                "nome_vendedor":   rows[0]["nome_vendedor"]  if rows else "",
                "cod_supervisor":  rows[0]["cod_supervisor"] if rows else None,
                "nome_supervisor": rows[0]["nome_supervisor"] if rows else "",
                "total_registros": len(rows), "dados": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/equipe/{cod}")
def get_por_equipe(cod: int, data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_query("equipe", filtro_id=cod, date_ref=dr)
        rows = execute_query(sql, params)
        if not rows:
            raise HTTPException(404, f"Nenhum dado para supervisor {cod}.")
        if u.is_fornecedor:
            rows = _filtrar_secoes(rows, u.secoes)
        return {"data_ref": dr, "cod_supervisor": cod,
                "nome_supervisor": rows[0]["nome_supervisor"] if rows else "",
                "total_registros": len(rows), "dados": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/supervisor/{cod}")
def get_por_supervisor(cod: int, data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_query("supervisor", filtro_id=cod, date_ref=dr)
        rows = execute_query(sql, params)
        if not rows:
            raise HTTPException(404, f"Supervisor {cod} nao encontrado.")
        if u.is_fornecedor:
            rows = _filtrar_secoes(rows, u.secoes)
        return {"data_ref": dr, "cod_supervisor": cod,
                "nome_supervisor": rows[0]["nome_supervisor"] if rows else "",
                "total_faturado": round(sum(r.get("valor_faturado_secao") or 0 for r in rows), 2),
                "total_meta":     round(sum(r.get("valor_meta_secao")     or 0 for r in rows), 2),
                "total_registros": len(rows), "dados": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Ranking de vendedores ─────────────────────────────────────────────────────
@router.get("/ranking")
def get_ranking(data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    """Vendedores com totais agregados, ordenados por % tendência."""
    if u.is_vendedor or u.is_fornecedor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        filtro = u.cod_winthor if u.is_supervisor else None
        sql, params = build_ranking_query(filtro_supervisor=filtro, date_ref=dr)
        rows = execute_query(sql, params)
        return {"data_ref": dr, "total_registros": len(rows), "dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/ranking/{cod_supervisor}")
def get_ranking_supervisor(cod_supervisor: int, data: Optional[str] = None,
                           u: CurrentUser = Depends(get_current_user)):
    """Ranking da equipe de um supervisor específico."""
    if u.is_vendedor or u.is_fornecedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod_supervisor:
        raise FORBIDDEN
    try:
        dr = parse_data(data)
        sql, params = build_ranking_query(filtro_supervisor=cod_supervisor, date_ref=dr)
        rows = execute_query(sql, params)
        return {"data_ref": dr, "cod_supervisor": cod_supervisor,
                "total_registros": len(rows), "dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))