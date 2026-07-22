from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data
from routers.auth import get_current_user, CurrentUser
from sql.ranking_clientes_sql import build_ranking_clientes_sql

router = APIRouter(prefix="/api/ranking-clientes", tags=["Ranking Clientes"])


@router.get("")
def get_ranking_clientes(
    codfornec: Optional[str] = None,
    dt_ini: Optional[str] = None,
    dt_fim: Optional[str] = None,
    filtro_supervisor: Optional[int] = None,
    filtro_vendedor: Optional[int] = None,
    u: CurrentUser = Depends(get_current_user),
):
    if u.cargo not in ("fornecedor", "admin", "gerencial", "supervisor", "vendedor"):
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

    dfim = parse_data(dt_fim)
    dini = dt_ini or date.today().replace(day=1).isoformat()

    # Vendedor só vê a própria carteira. Supervisor vê a própria equipe, e
    # pode estreitar pra um vendedor específico dela (filtro_vendedor vindo
    # da URL, mas sempre combinado com o próprio cod_winthor — não dá pra
    # escapar da equipe alterando o parâmetro). Gerencial/admin/fornecedor
    # podem opcionalmente filtrar por qualquer supervisor e/ou vendedor.
    if u.is_vendedor:
        sup_filtro, vend_filtro = None, u.cod_winthor
    elif u.is_supervisor:
        sup_filtro, vend_filtro = u.cod_winthor, filtro_vendedor
    else:
        sup_filtro, vend_filtro = filtro_supervisor, filtro_vendedor

    try:
        sql, params = build_ranking_clientes_sql(
            codfornecs, dini, dfim,
            filtro_vendedor=vend_filtro, filtro_supervisor=sup_filtro)
        rows = execute_query(sql, params)
        return {"total_clientes": len(rows), "periodo": {"dt_ini": dini, "dt_fim": dfim}, "dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/vendedores/{cod_supervisor}")
def get_vendedores_supervisor(cod_supervisor: int, u: CurrentUser = Depends(get_current_user)):
    """Vendedores de um supervisor — pra popular o filtro de carteira na tela."""
    if u.cargo not in ("fornecedor", "admin", "gerencial", "supervisor"):
        raise HTTPException(403, "Acesso negado")
    if u.is_supervisor and u.cod_winthor != cod_supervisor:
        raise HTTPException(403, "Acesso negado")
    try:
        sql = """SELECT PCUSUARI.CODUSUR AS cod_vendedor, PCUSUARI.NOME AS nome_vendedor
                 FROM PCUSUARI
                 WHERE PCUSUARI.CODSUPERVISOR = :sup
                   AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)
                   AND PCUSUARI.NOME LIKE 'PMU%'
                 ORDER BY PCUSUARI.NOME"""
        rows = execute_query(sql, {"sup": cod_supervisor})
        return {"dados": rows}
    except Exception as e:
        raise HTTPException(500, str(e))
