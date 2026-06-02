from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query
from routers.auth import get_current_user, CurrentUser
from sql.clientes_fornecedor_sql import build_clientes_fornecedor_sql

router = APIRouter(prefix="/api/clientes-fornecedor", tags=["Clientes Fornecedor"])


@router.get("")
def get_clientes_fornecedor(
    codfornec: Optional[str] = None,
    u: CurrentUser = Depends(get_current_user)
):
    if u.cargo not in ("fornecedor", "admin", "gerencial"):
        raise HTTPException(403, "Acesso negado")

    if not codfornec:
        raise HTTPException(400, "Informe ?codfornec=X na URL")

    try:
        codfornecs = [int(x.strip()) for x in codfornec.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "codfornec inválido")

    # Fornecedor só pode consultar seus próprios códigos
    if u.is_fornecedor:
        meus = set(int(x) for x in (u.codfornecs or []))
        codfornecs = [c for c in codfornecs if c in meus]
        if not codfornecs:
            raise HTTPException(403, "Código de fornecedor não autorizado")

    if not codfornecs:
        raise HTTPException(400, "Nenhum fornecedor informado")

    try:
        sql, params = build_clientes_fornecedor_sql(codfornecs)
        rows = execute_query(sql, params)
        return {"total_clientes": len(rows), "dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))