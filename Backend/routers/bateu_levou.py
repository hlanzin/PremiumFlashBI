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
from sql.bateu_levou_positivacao_sql import (
    build_positivacao_sql, agregar_positivacao_por_vendedor, build_debug_cliente_sql,
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
# Fornecedores autorizados a ver/criar campanhas do tipo "positivação"
FORNEC_POSITIVACAO = {1658, 2041}


class CampanhaCreate(BaseModel):
    nome: str
    tipo: str = "produto"           # 'produto' | 'positivacao'
    codsec:    Optional[int] = None  # obrigatório se tipo='produto'
    codfornec: Optional[int] = None  # obrigatório se tipo='positivacao'
    positivacao_modo: str = "cliente"  # 'cliente' | 'produto' (só tipo='positivacao')
    unidade: str = "UN"
    exigir_caixa_fechada: bool = False  # só tipo='produto': só conta pedido com caixa fechada
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
    if body.tipo not in ("produto","positivacao"):
        raise HTTPException(400,"tipo deve ser 'produto' ou 'positivacao'.")
    if body.positivacao_modo not in ("cliente","produto"):
        raise HTTPException(400,"positivacao_modo deve ser 'cliente' ou 'produto'.")
    if body.tipo == "produto" and body.codsec is None:
        raise HTTPException(400,"codsec é obrigatório para campanha tipo='produto'.")
    if body.tipo == "positivacao":
        if body.codfornec is None:
            raise HTTPException(400,"codfornec é obrigatório para campanha tipo='positivacao'.")
        # Fornecedor só pode criar campanha de positivação para os próprios
        # códigos vinculados, e só se algum deles estiver na lista autorizada
        if u.is_fornecedor and (
            not set(u.codfornecs) & FORNEC_POSITIVACAO
            or body.codfornec not in u.codfornecs
        ):
            raise FORBIDDEN
    try:
        cid = criar_campanha(_uid(u), body.nome, body.semana_ini, body.semana_fim,
                             tipo=body.tipo, codsec=body.codsec, codfornec=body.codfornec,
                             positivacao_modo=body.positivacao_modo, unidade=body.unidade,
                             exigir_caixa_fechada=body.exigir_caixa_fechada)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"id": cid, "ok": True}


@router.get("/campanhas")
def get_campanhas(semana_ini: Optional[str] = None, u: CurrentUser = Depends(get_current_user)):
    uid = _uid(u) if u.is_fornecedor else None
    campanhas = listar_campanhas(usuario_id=uid, semana_ini=semana_ini)
    # Campanhas tipo='positivacao' só aparecem para fornecedor cujo código
    # vinculado esteja entre os autorizados (1658/2041). Admin/gerencial
    # (uid=None acima) sempre vê tudo, sem essa restrição.
    if u.is_fornecedor and not (set(u.codfornecs) & FORNEC_POSITIVACAO):
        campanhas = [c for c in campanhas if c["tipo"] != "positivacao"]
    return {"dados": campanhas}


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


@router.get("/campanhas/{cid}/supervisor/{sup}/meta-sugerida")
def get_meta_sugerida(cid: int, sup: int, u: CurrentUser = Depends(get_current_user)):
    """
    Só para campanhas tipo='positivacao': sugere a meta de cada vendedor
    como o tamanho da lista negra dele (fornecedor da campanha) ao início
    da semana. O admin/fornecedor pode aceitar ou ajustar manualmente
    depois (ver PUT /metas) — ou deixar 0 para 'sem meta'.
    """
    camp = _check(cid, u)
    if camp["tipo"] != "positivacao":
        raise HTTPException(400, "Meta sugerida só se aplica a campanhas tipo='positivacao'.")

    codprods = None
    if camp["positivacao_modo"] == "produto":
        prods = listar_produtos_supervisor(cid, sup)
        if not prods:
            return {"dados": []}
        codprods = [p["codprod"] for p in prods]

    sql, _ = build_positivacao_sql(camp["codfornec"], camp["semana_ini"],
                                    camp["semana_ini"], cod_supervisor=sup, codprods=codprods)
    try:
        rows = execute_query(sql, [])
    except Exception as e:
        raise HTTPException(500, str(e))
    agregado = agregar_positivacao_por_vendedor(rows, {})
    return {"dados": [{"cod_vendedor": v["cod_vendedor"], "nome_vendedor": v["nome_vendedor"],
                        "meta_sugerida": v["elegiveis_total"]} for v in agregado]}


# ── Debug: por que um cliente específico não aparece como positivado ─────────
@router.get("/campanhas/{cid}/debug-cliente/{codcli}")
def debug_cliente(cid: int, codcli: int, data: Optional[str] = None,
                   u: CurrentUser = Depends(get_current_user)):
    """
    Diagnóstico pra investigar um cliente que comprou mas não apareceu como
    positivado. Mostra cada etapa (elegibilidade, vendedor/supervisor,
    produtos habilitados quando modo='produto') pra achar onde ele cai fora.
    """
    camp = _check(cid, u)
    if camp["tipo"] != "positivacao":
        raise HTTPException(400, "Debug só se aplica a campanhas tipo='positivacao'.")

    dr = parse_data(data)
    from datetime import date as _date
    fechamento = camp["semana_fim"] < _date.today().isoformat()

    sup = None
    prods = []
    codprods = None
    if camp["positivacao_modo"] == "produto":
        sup_rows = execute_query(
            "SELECT U1.CODSUPERVISOR AS cod_supervisor FROM PCCLIENT C "
            "LEFT JOIN PCUSUARI U1 ON U1.CODUSUR = C.CODUSUR1 WHERE C.CODCLI = :codcli",
            {"codcli": codcli})
        sup = sup_rows[0]["cod_supervisor"] if sup_rows else None
        if sup is not None:
            prods = listar_produtos_supervisor(cid, sup)
        codprods = [p["codprod"] for p in prods] if prods else None

    sql = build_debug_cliente_sql(camp["codfornec"], camp["semana_ini"], dr, codcli,
                                   fechamento=fechamento, codprods=codprods)
    try:
        rows = execute_query(sql, [])
    except Exception as e:
        raise HTTPException(500, str(e))
    if not rows:
        return {"encontrado": False, "diagnostico": ["Cliente não encontrado em PCCLIENT."]}

    row = rows[0]
    diagnostico = []
    if row.get("cod_supervisor") is None:
        diagnostico.append(
            "O vendedor cadastrado no cliente (CODUSUR1) não bate com nenhum "
            "registro em PCUSUARI — por isso o cliente não tem supervisor "
            "associado e some do relatório mesmo se for elegível e comprar.")
    if camp["positivacao_modo"] == "produto":
        if sup is None:
            diagnostico.append("Não foi possível achar o supervisor do cliente, "
                                "então também não dá pra saber quais produtos estão habilitados.")
        elif not prods:
            diagnostico.append(
                f"O supervisor #{sup} deste cliente não tem NENHUM produto habilitado "
                "nesta campanha — o cliente nunca é considerado, mesmo comprando.")
    if not row.get("eh_elegivel"):
        if row.get("eh_fat_mes"):
            diagnostico.append("Cliente já tinha comprado do fornecedor neste mês, "
                                "ANTES da campanha começar — por isso não entrou na lista de elegíveis.")
        elif row.get("eh_cart_aberta"):
            diagnostico.append("Cliente já tinha pedido em aberto do fornecedor antes "
                                "da campanha começar — não entrou na lista de elegíveis.")
        elif not row.get("eh_base_meta"):
            diagnostico.append("Cliente não tem compra do fornecedor nos 3 meses "
                                "anteriores à campanha — não se enquadra no critério de elegibilidade.")
    elif not row.get("positivou_realizado") and not row.get("positivou_hoje"):
        diagnostico.append("Cliente é elegível, mas não foi encontrada nenhuma venda "
                            "dos produtos considerados dentro da janela da campanha.")

    return {
        "encontrado": True,
        "supervisor_configurado_com_produtos": bool(prods) if camp["positivacao_modo"] == "produto" else None,
        "produtos_habilitados": [p["codprod"] for p in prods] if prods else None,
        "diagnostico": diagnostico or ["Nada de anormal encontrado — deveria aparecer no relatório."],
        "dados": row,
    }


# ── Busca produtos Oracle ─────────────────────────────────────────────────────
@router.get("/produtos/buscar")
def buscar_produtos(codsec: Optional[int] = None, codfornec: Optional[int] = None,
                    q: Optional[str] = None,
                    u: CurrentUser = Depends(get_current_user)):
    if not (u.is_fornecedor or u.is_gerencial): raise FORBIDDEN
    if not codsec and not codfornec:
        raise HTTPException(400, "Informe codsec ou codfornec.")
    try:
        params = {}
        condicoes = []
        if codsec:
            condicoes.append("PCPRODUT.CODSEC=:codsec"); params["codsec"] = codsec
        if codfornec:
            condicoes.append("PCPRODUT.CODFORNEC=:codfornec"); params["codfornec"] = codfornec
        filtro_dim = " AND ".join(condicoes)
        filtro = ""
        if q and q.strip():
            filtro = "AND UPPER(PCPRODUT.DESCRICAO) LIKE UPPER(:q)"
            params["q"] = f"%{q.strip()}%"
        sql = f"""
            SELECT CODPROD, DESCRICAO, QTUNITCX FROM (
                SELECT PCPRODUT.CODPROD, PCPRODUT.DESCRICAO, PCPRODUT.QTUNITCX
                FROM PCPRODUT
                WHERE {filtro_dim} AND PCPRODUT.DTEXCLUSAO IS NULL {filtro}
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
    semana_fim = camp["semana_fim"]
    unidade    = camp["unidade"]
    todas_metas = listar_todas_metas(cid)

    # Fechamento apenas quando a semana da campanha já terminou de verdade
    from datetime import date as _date
    fechamento = semana_fim < _date.today().isoformat()

    resultado = []

    if camp["tipo"] == "positivacao" and camp["positivacao_modo"] == "cliente":
        # Modo CLIENTE: não depende de "produtos habilitados" nem de
        # supervisor configurado — o único critério é o fornecedor. Roda
        # uma query só (todo o fornecedor) e agrupa por supervisor/vendedor
        # em Python.
        sup_filtro = None
        if u.is_supervisor:
            sup_filtro = u.cod_winthor
        elif filtro_supervisor:
            sup_filtro = filtro_supervisor

        sql, _ = build_positivacao_sql(camp["codfornec"], semana_ini, dr, cod_supervisor=sup_filtro, fechamento=fechamento)
        try:
            rows = execute_query(sql, [])
        except Exception as e:
            raise HTTPException(500, str(e))

        if u.is_vendedor:
            rows = [r for r in rows if r.get("cod_vendedor") == u.cod_winthor]

        por_sup: dict = {}
        for r in rows:
            sup = r.get("cod_supervisor")
            if sup is None: continue
            por_sup.setdefault(sup, []).append(r)

        for sup, sup_rows in por_sup.items():
            metas_sup = {k: v for (s, k), v in todas_metas.items() if s == sup}
            vendedores = agregar_positivacao_por_vendedor(sup_rows, metas_sup)
            vendedores = _com_sem_real(vendedores, metas_sup, sup, u, execute_query)
            if vendedores:
                resultado.append({"cod_supervisor": sup, "vendedores": vendedores})

        return {"campanha": camp, "data_ref": dr, "unidade": unidade, "dados": resultado}

    # ── tipo='produto' OU tipo='positivacao' com modo='produto' ───────────
    # As duas compartilham a mesma estrutura: supervisor configurado com
    # lista de produtos habilitados (bl_supervisor_produtos) — só muda a
    # query (venda normal vs elegibilidade de lista negra + positivação).
    sups = listar_supervisores_campanha(cid)
    if u.is_supervisor:
        sups = [u.cod_winthor] if u.cod_winthor in sups else []
    elif filtro_supervisor:
        sups = [filtro_supervisor] if filtro_supervisor in sups else []

    for sup in sups:
        prods = listar_produtos_supervisor(cid, sup)
        if not prods: continue
        codprods  = [p["codprod"] for p in prods]
        metas_sup = {k: v for (s, k), v in todas_metas.items() if s == sup}

        if camp["tipo"] == "positivacao":
            sql, _ = build_positivacao_sql(camp["codfornec"], semana_ini, dr, cod_supervisor=sup,
                                            fechamento=fechamento, codprods=codprods)
            try:
                rows = execute_query(sql, [])
            except Exception as e:
                raise HTTPException(500, str(e))
            if u.is_vendedor:
                rows = [r for r in rows if r.get("cod_vendedor") == u.cod_winthor]
            vendedores = agregar_positivacao_por_vendedor(rows, metas_sup)
        else:
            sql = sql_322_supervisor(codprods, unidade, semana_ini, dr, sup, fechamento=fechamento,
                                      exigir_caixa_fechada=bool(camp.get("exigir_caixa_fechada")))
            try:
                rows = execute_query(sql, [])
            except Exception as e:
                raise HTTPException(500, str(e))
            # Vendedor só vê a própria linha
            if u.is_vendedor:
                rows = [r for r in rows if r.get("cod_vendedor") == u.cod_winthor]
            vendedores = agregar_por_vendedor(rows, metas_sup)

        vendedores = _com_sem_real(vendedores, metas_sup, sup, u, execute_query)

        if vendedores:
            resultado.append({
                "cod_supervisor": sup,
                "vendedores": vendedores,
            })

    return {"campanha": camp, "data_ref": dr,
            "unidade": unidade, "dados": resultado}


def _com_sem_real(vendedores, metas_sup, sup, u, execute_query):
    """Adiciona vendedores com meta mas sem dados no período — busca nomes
    no Oracle para não mostrar só o código. Compartilhado pelos dois tipos."""
    vend_com_real = {v["cod_vendedor"] for v in vendedores}
    sem_real = [cod_v for cod_v, meta in metas_sup.items()
                if cod_v not in vend_com_real and meta > 0
                and (not u.is_vendedor or cod_v == u.cod_winthor)]
    if not sem_real:
        return vendedores
    try:
        in_list = ",".join(str(c) for c in sem_real)
        nomes = {r["codusur"]: r["nome"] for r in execute_query(
            f"SELECT CODUSUR, NOME FROM PCUSUARI WHERE CODUSUR IN ({in_list})", [])}
    except Exception:
        nomes = {}
    for cod_v in sem_real:
        vendedores.append({
            "cod_vendedor":  cod_v,
            "nome_vendedor": nomes.get(cod_v, f"#{cod_v}"),
            "cod_supervisor": sup, "nome_supervisor": "",
            "meta": float(metas_sup[cod_v]),
            "qt_realizado": 0.0, "qt_dia": 0.0,
            "pct_ating": 0.0, "produtos": [], "clientes": [],
        })
    return vendedores


# ── Exclusão de campanha (admin) ──────────────────────────────────────────────
@router.delete("/campanhas/{cid}")
def del_campanha(cid: int, u: CurrentUser = Depends(get_current_user)):
    if not u.is_admin:
        raise HTTPException(403, "Apenas admin pode excluir campanhas.")
    from models.usuarios import get_db
    with get_db() as conn:
        conn.execute("DELETE FROM bl_campanhas WHERE id=?", (cid,))
    return {"ok": True}