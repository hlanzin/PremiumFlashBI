from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data, get_connection
from sql.faturamento_sql import build_query, build_ranking_query
from routers.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/faturamento", tags=["Faturamento"])
FORBIDDEN = HTTPException(status_code=403, detail="Acesso negado para seu cargo.")


def _executar_select(sql: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(sql)
        cols = [c[0].lower() for c in cur.description]
        dados = [dict(zip(cols, r)) for r in cur.fetchall()]
        conn.close()
        return dados
    except Exception as e:
        raise HTTPException(500, str(e))


def _filtrar_secoes(rows: list, secoes: List[int]) -> list:
    if not secoes:
        return []
    s = set(int(x) for x in secoes)
    return [r for r in rows if int(r.get("cod_secao") or 0) in s]


def _query_faturamento(mode: str, data: str, u: CurrentUser, filtro_id: int = None):
    dr = parse_data(data)
    sql, params = build_query(mode, filtro_id=filtro_id, date_ref=dr)
    rows = execute_query(sql, params)
    if u.is_fornecedor:
        rows = _filtrar_secoes(rows, u.secoes)
    return dr, rows


@router.get("/secoes-disponiveis", tags=["Listas"])
def get_secoes_disponiveis():
    return {"dados": _executar_select("SELECT CODSEC, DESCRICAO FROM PCSECAO ORDER BY DESCRICAO")}


@router.get("/vendedores", tags=["Listas"])
def get_vendedores(u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
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
    return {"dados": _executar_select(sql)}


@router.get("/supervisores", tags=["Listas"])
def get_supervisores(u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    return {"dados": _executar_select("""
        SELECT DISTINCT PCSUPERV.CODSUPERVISOR AS COD_SUPERVISOR, PCSUPERV.NOME AS NOME_SUPERVISOR
        FROM PCSUPERV
        WHERE PCSUPERV.CODSUPERVISOR NOT IN (9999) AND PCSUPERV.NOME LIKE 'PMU%'
        ORDER BY PCSUPERV.NOME
    """)}


@router.get("")
def get_todos(data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    dr, rows = _query_faturamento("todos", data, u)
    if u.is_supervisor and u.cod_winthor:
        rows = [r for r in rows if r.get("cod_supervisor") == u.cod_winthor]
    return {"data_ref": dr, "total_registros": len(rows), "dados": rows}


@router.get("/gerencial")
def get_gerencial(data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_supervisor or u.is_vendedor:
        raise FORBIDDEN
    dr, rows = _query_faturamento("gerencial", data, u)
    return {
        "data_ref": dr, "total_registros": len(rows),
        "total_faturado": round(sum(r.get("valor_faturado_secao") or 0 for r in rows), 2),
        "total_meta":     round(sum(r.get("valor_meta_secao")     or 0 for r in rows), 2),
        "dados": rows,
    }


@router.get("/vendedor/{cod}")
def get_por_vendedor(cod: int, data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor and u.cod_winthor != cod:
        raise FORBIDDEN
    if u.is_fornecedor:
        raise FORBIDDEN
    dr, rows = _query_faturamento("vendedor", data, u, filtro_id=cod)
    if not rows:
        raise HTTPException(404, f"Vendedor {cod} nao encontrado.")
    if u.is_supervisor and rows[0].get("cod_supervisor") != u.cod_winthor:
        raise FORBIDDEN
    return {
        "data_ref": dr, "cod_vendedor": cod,
        "nome_vendedor": rows[0]["nome_vendedor"] if rows else "",
        "cod_supervisor": rows[0]["cod_supervisor"] if rows else None,
        "nome_supervisor": rows[0]["nome_supervisor"] if rows else "",
        "total_registros": len(rows), "dados": rows,
    }


@router.get("/equipe/{cod}")
def get_por_equipe(cod: int, data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod:
        raise FORBIDDEN
    dr, rows = _query_faturamento("equipe", data, u, filtro_id=cod)
    if not rows:
        raise HTTPException(404, f"Nenhum dado para supervisor {cod}.")
    return {
        "data_ref": dr, "cod_supervisor": cod,
        "nome_supervisor": rows[0]["nome_supervisor"] if rows else "",
        "total_registros": len(rows), "dados": rows,
    }


@router.get("/supervisor/{cod}")
def get_por_supervisor(cod: int, data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod:
        raise FORBIDDEN
    dr, rows = _query_faturamento("supervisor", data, u, filtro_id=cod)
    if not rows:
        raise HTTPException(404, f"Supervisor {cod} nao encontrado.")
    return {
        "data_ref": dr, "cod_supervisor": cod,
        "nome_supervisor": rows[0]["nome_supervisor"] if rows else "",
        "total_faturado": round(sum(r.get("valor_faturado_secao") or 0 for r in rows), 2),
        "total_meta":     round(sum(r.get("valor_meta_secao")     or 0 for r in rows), 2),
        "total_registros": len(rows), "dados": rows,
    }


@router.get("/ranking")
def get_ranking(data: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor or u.is_fornecedor:
        raise FORBIDDEN
    dr = parse_data(data)
    filtro = u.cod_winthor if u.is_supervisor else None
    sql, params = build_ranking_query(filtro_supervisor=filtro, date_ref=dr)
    rows = execute_query(sql, params)
    return {"data_ref": dr, "total_registros": len(rows), "dados": rows}


@router.get("/ranking/{cod_supervisor}")
def get_ranking_supervisor(cod_supervisor: int, data: Optional[str] = None,
                           u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor or u.is_fornecedor:
        raise FORBIDDEN
    if u.is_supervisor and u.cod_winthor != cod_supervisor:
        raise FORBIDDEN
    dr = parse_data(data)
    sql, params = build_ranking_query(filtro_supervisor=cod_supervisor, date_ref=dr)
    rows = execute_query(sql, params)
    return {"data_ref": dr, "cod_supervisor": cod_supervisor,
            "total_registros": len(rows), "dados": rows}
