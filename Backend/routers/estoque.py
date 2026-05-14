from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data, get_connection
from sql.estoque_sql import build_estoque_query, SQL_SECOES
from routers.auth import get_current_user

router = APIRouter(prefix="/api/estoque", tags=["Estoque"])


@router.get("/secoes")
def get_secoes(_: str = Depends(get_current_user)):
    """Lista de seções que possuem estoque na filial."""
    try:
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(SQL_SECOES)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{codigo_secao}")
def get_estoque_secao(
    codigo_secao: int,
    data: Optional[str] = None,
    _: str = Depends(get_current_user),
):
    """
    Estoque da seção por produto.
    Sem ?data  → estoque atual (PCEST).
    Com ?data  → snapshot histórico (PCHISTEST).
    """
    try:
        dr = parse_data(data)
        sql, params = build_estoque_query(codigo_secao, dr)
        rows = execute_query(sql, list(params.values()) if isinstance(params, dict) else params)
        return {
            "codigo_secao":    codigo_secao,
            "data_ref":        dr,
            "historico":       data is not None,
            "total_registros": len(rows),
            "total_valor":     round(sum(r["valor_estoque"] or 0 for r in rows), 2),
            "dados": rows,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
