from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import execute_query, parse_data, get_connection
from routers.auth import get_current_user, CurrentUser
from models.bateu_levou import (
    create_bl_tables, criar_campanha, listar_campanhas, get_campanha,
    atualizar_campanha, listar_supervisores_campanha,
    listar_produtos_supervisor, salvar_produtos_supervisor,
    upsert_meta, listar_metas_supervisor, listar_todas_metas,
)
from sql.bateu_levou_sql import (
    sql_322_supervisor, agregar_por_vendedor,
)

create_bl_tables()

router    = APIRouter(prefix="/api/bl", tags=["Bateu Levou"])
FORBIDDEN = HTTPException(403, "Acesso negado.")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _uid(u: CurrentUser) -> int:
    from models.usuarios import get_db
    with get_db() as conn:
        row = conn.execute("SELECT id FROM usuarios WHERE username=?", (u.username,)).fetchone()
    if not row: raise HTTPException(401, "Usuario nao encontrado.")
    return row["id"]


def _check(campanha_id, u) -> dict:
    camp = get_campanha(campanha_id)
    if not camp: raise HTTPException(404, "Campanha nao encontrada.")
    if u.is_fornecedor and camp["usuario_id"] != _uid(u):
        raise FORBIDDEN
    return camp


# ── Campanhas ─────────────────────────────────────────────────────────────────
class CampanhaCreate(BaseModel):
    nome: str; codsec: int; unidade: str = "UN"
    semana_ini: str; semana_fim: str

class CampanhaUpdate(BaseModel):
    nome:       Optional[str] = None
    semana_ini: Optional[str] = None
    semana_fim: Optional[str] = None
    ativa:      Optional[int] = None


@router.post("/campanhas")
def post_campanha(body: CampanhaCreate, u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    if body.unidade not in ("UN","CX"): raise HTTPException(400,"unidade deve ser UN ou CX.")
    return {"id": criar_campanha(_uid(u), body.nome, body.codsec, body.unidade,
                                 body.semana_ini, body.semana_fim), "ok": True}


@router.get("/campanhas")
def get_campanhas(semana_ini: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    uid = _uid(u) if u.is_fornecedor else None
    return {"dados": listar_campanhas(usuario_id=uid, semana_ini=semana_ini)}


@router.put("/campanhas/{cid}")
def put_campanha(cid: int, body: CampanhaUpdate, u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    _check(cid, u)
    atualizar_campanha(cid, nome=body.nome, ativa=body.ativa,
                       semana_ini=body.semana_ini, semana_fim=body.semana_fim)
    return {"ok": True}


@router.delete("/campanhas/{cid}")
def del_campanha_owner(cid: int, u: CurrentUser = Depends(get_current_user)):
    """Fornecedor dono ou admin podem excluir."""
    camp = _check(cid, u)
    if not (u.is_admin or u.is_fornecedor):
        raise FORBIDDEN
    from models.usuarios import get_db
    with get_db() as conn:
        conn.execute("DELETE FROM bl_campanhas WHERE id=?", (cid,))
    return {"ok": True}


# ── Produtos por supervisor ───────────────────────────────────────────────────
class ProdutosSupervisorBody(BaseModel):
    cod_supervisor: int
    codprods: List[int]          # lista completa de habilitados
    prod_map: dict = {}          # {codprod: descricao}


@router.get("/campanhas/{cid}/supervisor/{sup}/produtos")
def get_prod_sup(cid: int, sup: int, u: CurrentUser = Depends(get_current_user)):
    _check(cid, u)
    return {"dados": listar_produtos_supervisor(cid, sup)}


@router.put("/campanhas/{cid}/supervisor/{sup}/produtos")
def put_prod_sup(cid: int, sup: int, body: ProdutosSupervisorBody,
                 u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    _check(cid, u)
    salvar_produtos_supervisor(cid, sup, body.codprods, body.prod_map)
    return {"ok": True}


# ── Metas por supervisor ──────────────────────────────────────────────────────
class MetasSupervisorBody(BaseModel):
    cod_supervisor: int
    metas: List[dict]   # [{cod_vendedor, meta}]


@router.get("/campanhas/{cid}/supervisor/{sup}/metas")
def get_metas_sup(cid: int, sup: int, u: CurrentUser = Depends(get_current_user)):
    _check(cid, u)
    metas = listar_metas_supervisor(cid, sup)
    return {"dados": [{"cod_vendedor": k, "meta": v} for k, v in metas.items()]}


@router.put("/campanhas/{cid}/supervisor/{sup}/metas")
def put_metas_sup(cid: int, sup: int, body: MetasSupervisorBody,
                  u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    _check(cid, u)
    for item in body.metas:
        upsert_meta(cid, sup, item["cod_vendedor"], item["meta"])
    return {"ok": True}


# ── Busca produtos Oracle ─────────────────────────────────────────────────────
@router.get("/produtos/buscar")
def buscar_produtos(codsec: int, q: Optional[str] = None,
                    u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    try:
        params = {"codsec": codsec}
        filtro = ""
        if q and q.strip():
            filtro = "AND UPPER(PCPRODUT.DESCRICAO) LIKE UPPER(:q)"
            params["q"] = f"%{q.strip()}%"
        sql = f"""
            SELECT CODPROD, DESCRICAO, QTUNITCX FROM (
                SELECT PCPRODUT.CODPROD, PCPRODUT.DESCRICAO, PCPRODUT.QTUNITCX
                FROM PCPRODUT
                WHERE PCPRODUT.CODSEC=:codsec AND PCPRODUT.DTEXCLUSAO IS NULL {filtro}
                ORDER BY PCPRODUT.DESCRICAO
            ) WHERE ROWNUM <= 200
        """
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(sql, params)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally: conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Supervisores Oracle (para popular dropdown na config) ─────────────────────
@router.get("/supervisores")
def get_supervisores_bl(u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    try:
        sql = """SELECT DISTINCT PCSUPERV.CODSUPERVISOR AS COD_SUPERVISOR,
                        PCSUPERV.NOME AS NOME_SUPERVISOR
                 FROM PCSUPERV
                 WHERE PCSUPERV.CODSUPERVISOR NOT IN (9999)
                   AND PCSUPERV.NOME LIKE 'PMU%'
                 ORDER BY PCSUPERV.NOME"""
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(sql)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally: conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Vendedores de um supervisor (Oracle) ──────────────────────────────────────
@router.get("/supervisores/{sup}/vendedores")
def get_vendedores_sup(sup: int, u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    try:
        sql = f"""SELECT PCUSUARI.CODUSUR AS COD_VENDEDOR, PCUSUARI.NOME AS NOME_VENDEDOR
                  FROM PCUSUARI
                  WHERE PCUSUARI.CODSUPERVISOR={sup}
                    AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)
                    AND PCUSUARI.NOME LIKE 'PMU%'
                  ORDER BY PCUSUARI.NOME"""
        conn = get_connection()
        try:
            cur = conn.cursor(); cur.execute(sql)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally: conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Dados para visualização ───────────────────────────────────────────────────
@router.get("/campanhas/{cid}/dados")
def get_dados(cid: int, data: Optional[str] = None,
              filtro_supervisor: Optional[int] = None,
              u: CurrentUser = Depends(get_current_user)):
    """
    Dados do Bateu Levou baseados na rotina 322:
    PCPEDI + PCPEDC, período completo, sem distinção faturado/não faturado.
    QT_REALIZADO = semana_ini → ontem | QT_DIA = hoje
    """
    camp = _check(cid, u)

    dr         = parse_data(data)
    semana_ini = camp["semana_ini"]
    unidade    = camp["unidade"]
    todas_metas = listar_todas_metas(cid)

    # Define quais supervisores processar
    sups = listar_supervisores_campanha(cid)
    if u.is_supervisor:
        sups = [u.cod_winthor] if u.cod_winthor in sups else []
    elif filtro_supervisor:
        sups = [filtro_supervisor] if filtro_supervisor in sups else []

    resultado = []
    for sup in sups:
        prods = listar_produtos_supervisor(cid, sup)
        if not prods: continue
        codprods  = [p["codprod"] for p in prods]
        metas_sup = {k: v for (s, k), v in todas_metas.items() if s == sup}

        sql = sql_322_supervisor(codprods, unidade, semana_ini, dr, sup)
        try:
            rows = execute_query(sql, [])
        except Exception as e:
            raise HTTPException(500, str(e))

        # Vendedor só vê a própria linha
        if u.is_vendedor:
            rows = [r for r in rows if r.get("cod_vendedor") == u.cod_winthor]

        vendedores = agregar_por_vendedor(rows, metas_sup)

        # Adiciona vendedores com meta mas sem pedidos no período
        # Busca os nomes no Oracle para não mostrar só o código
        vend_com_real = {v["cod_vendedor"] for v in vendedores}
        sem_real = [cod_v for cod_v, meta in metas_sup.items()
                    if cod_v not in vend_com_real and meta > 0
                    and (not u.is_vendedor or cod_v == u.cod_winthor)]

        if sem_real:
            try:
                in_list = ",".join(str(c) for c in sem_real)
                nome_sql = f"""
                    SELECT CODUSUR, NOME FROM PCUSUARI
                    WHERE CODUSUR IN ({in_list})
                """
                nomes = {r["codusur"]: r["nome"]
                         for r in execute_query(nome_sql, [])}
            except Exception:
                nomes = {}

            for cod_v in sem_real:
                vendedores.append({
                    "cod_vendedor":  cod_v,
                    "nome_vendedor": nomes.get(cod_v, f"#{cod_v}"),
                    "cod_supervisor": sup, "nome_supervisor": "",
                    "meta": float(metas_sup[cod_v]),
                    "qt_realizado": 0.0, "qt_dia": 0.0,
                    "pct_ating": 0.0, "produtos": [],
                })

        if vendedores:
            resultado.append({
                "cod_supervisor": sup,
                "vendedores": vendedores,
            })

    return {"campanha": camp, "data_ref": dr,
            "unidade": unidade, "dados": resultado}


# ── Exclusão de campanha (admin) ──────────────────────────────────────────────
@router.delete("/campanhas/{cid}")
def del_campanha(cid: int, u: CurrentUser = Depends(get_current_user)):
    if not u.is_admin:
        raise HTTPException(403, "Apenas admin pode excluir campanhas.")
    from models.usuarios import get_db
    with get_db() as conn:
        conn.execute("DELETE FROM bl_campanhas WHERE id=?", (cid,))
    return {"ok": True}