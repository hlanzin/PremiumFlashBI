"""
Incentivos por venda de produtos — modularizado (antes era um dicionário
hardcoded, ver histórico do arquivo). Admin cria/edita pela tela de
configuração; todo mundo vê o ranking (competição amistosa, todas as
equipes visíveis pra qualquer cargo).

Uma equipe pode ter lista de produtos PRÓPRIA (diferente da geral) — quando
isso acontece, a apuração roda uma query separada só pra essa equipe com a
lista dela, e uma query geral pro resto (excluindo quem já tem override),
juntando os dois no ranking final.
"""
import math
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Body
from database import execute_query, get_connection
from sql.incentivos_sql import build_incentivo_sql, build_combo_sql
from routers.auth import get_current_user, CurrentUser
from models.incentivos import (
    create_incentivo_tables, criar_incentivo, listar_incentivos, get_incentivo,
    atualizar_incentivo, excluir_incentivo,
    listar_produtos_gerais, salvar_produtos_gerais,
    listar_faixas, salvar_faixas,
    listar_produtos_equipe, listar_equipes_com_override, salvar_produtos_equipe,
    remover_override_equipe, TIPOS_VALIDOS,
)

create_incentivo_tables()

router = APIRouter(prefix="/api/incentivos", tags=["Incentivos"])


def _exige_admin(u: CurrentUser):
    if not u.is_admin:
        raise HTTPException(403, "Apenas admin pode gerenciar incentivos.")


# ── Público: listar / apurar ────────────────────────────────────────────────
@router.get("")
def listar(u: CurrentUser = Depends(get_current_user)):
    """Lista os incentivos ATIVOS (pra montar o dropdown na sidebar)."""
    ativos = listar_incentivos(apenas_ativos=True)
    return {"incentivos": [
        {"id": i["id"], "nome": i["nome"], "tipo": i["tipo"],
         "data_ini": i["data_ini"], "data_fim": i["data_fim"],
         "valor_por_caixa": i["valor_por_caixa"], "valor_por_combo": i["valor_por_combo"],
         "produtos": [p["codprod"] for p in listar_produtos_gerais(i["id"])],
         "faixas": listar_faixas(i["id"]) if i["tipo"] == "escalonado" else None}
        for i in ativos
    ]}


@router.get("/ranking-geral/consolidado")
def ranking_geral(u: CurrentUser = Depends(get_current_user)):
    """Ranking GERAL: soma o prêmio de TODOS os incentivos ativos por vendedor."""
    ativos = listar_incentivos(apenas_ativos=True)

    geral = {}
    detalhe_incentivos = []
    for cfg in ativos:
        detalhe_incentivos.append({"id": cfg["id"], "nome": cfg["nome"]})
        for v in _apurar_qualquer(cfg):
            cv = v["cod_vendedor"]
            if cv not in geral:
                geral[cv] = {
                    "cod_vendedor": cv, "nome_vendedor": v["nome_vendedor"],
                    "cod_supervisor": v["cod_supervisor"],
                    "nome_supervisor": v["nome_supervisor"],
                    "total_premio": 0.0,
                    "por_incentivo": {},
                }
            geral[cv]["total_premio"] += v["total_premio"]
            geral[cv]["por_incentivo"][cfg["id"]] = v["total_premio"]

    ranking = sorted(geral.values(), key=lambda x: x["total_premio"], reverse=True)
    for i, v in enumerate(ranking):
        v["posicao"] = i + 1

    return {
        "nome": "Ranking Geral",
        "incentivos": detalhe_incentivos,
        "ranking": ranking,
        "total_geral": {"premio": sum(v["total_premio"] for v in ranking)},
    }


@router.get("/{incentivo_id}")
def get_apuracao(incentivo_id: int, u: CurrentUser = Depends(get_current_user)):
    """Apuração do incentivo, agrupada por equipe (supervisor) → vendedor."""
    cfg = get_incentivo(incentivo_id)
    if not cfg:
        raise HTTPException(404, "Incentivo não encontrado")

    if cfg["tipo"] == "combo":
        ranking = _apurar_combo(cfg)
        total_geral = {
            "combos": sum(v["total_combos"] for v in ranking),
            "premio": sum(v["total_premio"] for v in ranking),
        }
        return {
            "incentivo": {"id": cfg["id"], "nome": cfg["nome"], "tipo": "combo",
                          "valor_por_combo": cfg["valor_por_combo"],
                          "data_ini": cfg["data_ini"], "data_fim": cfg["data_fim"],
                          "produtos": [p["codprod"] for p in listar_produtos_gerais(cfg["id"])]},
            "ranking": ranking, "total_geral": total_geral,
        }

    ranking = _apurar_caixas(cfg)
    total_geral = {
        "caixas": sum(v["total_caixas"] for v in ranking),
        "premio": sum(v["total_premio"] for v in ranking),
    }
    faixas = listar_faixas(cfg["id"]) if cfg["tipo"] == "escalonado" else None
    return {
        "incentivo": {"id": cfg["id"], "nome": cfg["nome"], "tipo": cfg["tipo"],
                      "valor_por_caixa": cfg["valor_por_caixa"], "faixas": faixas,
                      "data_ini": cfg["data_ini"], "data_fim": cfg["data_fim"],
                      "produtos": [p["codprod"] for p in listar_produtos_gerais(cfg["id"])]},
        "ranking": ranking, "total_geral": total_geral,
    }


# ── Apuração — resolve produtos gerais x por equipe e junta os resultados ───
def _grupos_de_produtos(incentivo_id: int):
    """Retorna [(produtos, apenas_sup, excluir_sup), ...] — 1 entrada por
    grupo de apuração: uma por equipe com lista própria, + 1 geral (se
    sobrar produto geral e/ou equipe sem override)."""
    geral = [p["codprod"] for p in listar_produtos_gerais(incentivo_id)]
    equipes_override = listar_equipes_com_override(incentivo_id)

    grupos = []
    for sup in equipes_override:
        prods_equipe = [p["codprod"] for p in listar_produtos_equipe(incentivo_id, sup)]
        if prods_equipe:
            grupos.append((prods_equipe, [sup], None))
    if geral:
        grupos.append((geral, None, equipes_override or None))
    return grupos


def _apurar_caixas(cfg: dict) -> list:
    """
    Caixas = FLOOR(SOMA de unidades/QTUNITCX de TODOS os produtos do
    incentivo, por vendedor) — o arredondamento pra baixo acontece uma vez
    só, no total do vendedor, não por produto individual. Arredondar por
    produto e depois somar perde "resto" de cada um (ex.: 3 produtos com
    mesma caixa de 24un e sobras de 10+9+8un cada — 27un, mais de 1 caixa —
    ficariam de fora se cada produto fosse arredondado pra baixo antes de
    somar). Confirmado batendo com a rotina 1462 do Winthor.
    """
    vendedores = {}
    for prods, apenas_sup, excluir_sup in _grupos_de_produtos(cfg["id"]):
        try:
            sql, params = build_incentivo_sql(prods, cfg["data_ini"], cfg["data_fim"],
                                               apenas_supervisores=apenas_sup,
                                               excluir_supervisores=excluir_sup)
            linhas = execute_query(sql, params)
        except Exception as e:
            raise HTTPException(500, str(e))

        for r in linhas:
            cv = r["cod_vendedor"]
            qtcx = r["qt_unit_cx"] or 1
            unid = r["unidades"] or 0
            frac_caixas = (unid / qtcx) if qtcx else 0.0
            if cv not in vendedores:
                vendedores[cv] = {
                    "cod_vendedor": cv, "nome_vendedor": r["nome_vendedor"],
                    "cod_supervisor": r["cod_supervisor"],
                    "nome_supervisor": r["nome_supervisor"] or f"Supervisor #{r['cod_supervisor']}",
                    "_caixas_frac": 0.0, "total_premio": 0.0,
                }
            vendedores[cv]["_caixas_frac"] += frac_caixas

    faixas = listar_faixas(cfg["id"]) if cfg["tipo"] == "escalonado" else None
    for v in vendedores.values():
        v["total_caixas"] = int(math.floor(v.pop("_caixas_frac")))
        vcx = _valor_por_caixa(cfg, faixas, v["total_caixas"])
        v["valor_caixa_aplicado"] = vcx
        v["total_premio"] = v["total_caixas"] * vcx

    ranking = sorted(vendedores.values(), key=lambda x: (x["total_premio"], x["total_caixas"]), reverse=True)
    for i, v in enumerate(ranking):
        v["posicao"] = i + 1
    return ranking


def _valor_por_caixa(cfg: dict, faixas: Optional[list], total_caixas: int) -> float:
    if cfg["tipo"] != "escalonado" or not faixas:
        return cfg.get("valor_por_caixa") or 0.0
    for f in faixas:
        if f["limite"] is None or total_caixas <= f["limite"]:
            return f["valor"]
    return faixas[-1]["valor"]


def _apurar_combo(cfg: dict) -> list:
    valor_combo = cfg.get("valor_por_combo") or 0.0
    vendedores = {}
    for prods, apenas_sup, excluir_sup in _grupos_de_produtos(cfg["id"]):
        try:
            sql, params = build_combo_sql(prods, cfg["data_ini"], cfg["data_fim"],
                                           apenas_supervisores=apenas_sup,
                                           excluir_supervisores=excluir_sup)
            linhas = execute_query(sql, params)
        except Exception as e:
            raise HTTPException(500, str(e))

        for r in linhas:
            combos = r["combos"] or 0
            vendedores[r["cod_vendedor"]] = {
                "cod_vendedor": r["cod_vendedor"], "nome_vendedor": r["nome_vendedor"],
                "cod_supervisor": r["cod_supervisor"],
                "nome_supervisor": r["nome_supervisor"] or f"Supervisor #{r['cod_supervisor']}",
                "total_combos": combos, "total_premio": combos * valor_combo,
            }

    ranking = sorted(vendedores.values(), key=lambda x: (x["total_premio"], x["total_combos"]), reverse=True)
    for i, v in enumerate(ranking):
        v["posicao"] = i + 1
    return ranking


def _apurar_qualquer(cfg: dict) -> list:
    return _apurar_combo(cfg) if cfg["tipo"] == "combo" else _apurar_caixas(cfg)


# ── Admin: CRUD ──────────────────────────────────────────────────────────────
@router.get("/admin/produtos/buscar")
def admin_buscar_produtos(q: str, u: CurrentUser = Depends(get_current_user)):
    """Busca livre por descrição/código — só pra tela de admin montar a
    lista de produtos de um incentivo (não precisa de codsec/codfornec)."""
    _exige_admin(u)
    if not q or len(q.strip()) < 2:
        raise HTTPException(400, "Informe ao menos 2 caracteres.")
    try:
        sql = """
            SELECT CODPROD, DESCRICAO, QTUNITCX FROM (
                SELECT CODPROD, DESCRICAO, QTUNITCX FROM PCPRODUT
                WHERE DTEXCLUSAO IS NULL
                  AND (UPPER(DESCRICAO) LIKE UPPER(:q) OR TO_CHAR(CODPROD) = :qcod)
                ORDER BY DESCRICAO
            ) WHERE ROWNUM <= 100
        """
        params = {"q": f"%{q.strip()}%", "qcod": q.strip()}
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(sql, params)
            cols = [c[0].lower() for c in cur.description]
            return {"dados": [dict(zip(cols, r)) for r in cur.fetchall()]}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/admin/listar")
def admin_listar(u: CurrentUser = Depends(get_current_user)):
    """Todos os incentivos (ativos e inativos) — pra tela de gestão do admin."""
    _exige_admin(u)
    incs = listar_incentivos(apenas_ativos=False)
    for i in incs:
        i["produtos"] = listar_produtos_gerais(i["id"])
        i["faixas"] = listar_faixas(i["id"]) if i["tipo"] == "escalonado" else []
        i["equipes_override"] = listar_equipes_com_override(i["id"])
    return {"incentivos": incs}


@router.post("/admin")
def admin_criar(body: dict = Body(...), u: CurrentUser = Depends(get_current_user)):
    _exige_admin(u)
    nome = body.get("nome")
    tipo = body.get("tipo")
    data_ini = body.get("data_ini")
    data_fim = body.get("data_fim")
    if not nome or not tipo or not data_ini or not data_fim:
        raise HTTPException(400, "nome, tipo, data_ini e data_fim são obrigatórios.")
    if tipo not in TIPOS_VALIDOS:
        raise HTTPException(400, f"tipo deve ser um de {TIPOS_VALIDOS}")
    novo_id = criar_incentivo(
        criado_por=u.username, nome=nome, tipo=tipo, data_ini=data_ini, data_fim=data_fim,
        valor_por_caixa=body.get("valor_por_caixa"), valor_por_combo=body.get("valor_por_combo"))
    return {"id": novo_id}


@router.put("/admin/{incentivo_id}")
def admin_atualizar(incentivo_id: int, body: dict = Body(...), u: CurrentUser = Depends(get_current_user)):
    _exige_admin(u)
    if not get_incentivo(incentivo_id):
        raise HTTPException(404, "Incentivo não encontrado")
    tipo = body.get("tipo")
    if tipo is not None and tipo not in TIPOS_VALIDOS:
        raise HTTPException(400, f"tipo deve ser um de {TIPOS_VALIDOS}")
    atualizar_incentivo(
        incentivo_id, nome=body.get("nome"), tipo=tipo, ativo=body.get("ativo"),
        data_ini=body.get("data_ini"), data_fim=body.get("data_fim"),
        valor_por_caixa=body.get("valor_por_caixa"), valor_por_combo=body.get("valor_por_combo"))
    return {"ok": True}


@router.delete("/admin/{incentivo_id}")
def admin_excluir(incentivo_id: int, u: CurrentUser = Depends(get_current_user)):
    _exige_admin(u)
    if not get_incentivo(incentivo_id):
        raise HTTPException(404, "Incentivo não encontrado")
    excluir_incentivo(incentivo_id)
    return {"ok": True}


@router.put("/admin/{incentivo_id}/produtos")
def admin_salvar_produtos(incentivo_id: int, body: dict = Body(...), u: CurrentUser = Depends(get_current_user)):
    """body: {"produtos": [{"codprod": 123, "descricao": "..."}]}"""
    _exige_admin(u)
    if not get_incentivo(incentivo_id):
        raise HTTPException(404, "Incentivo não encontrado")
    produtos = body.get("produtos", [])
    prod_map = {int(p["codprod"]): p.get("descricao", "") for p in produtos}
    salvar_produtos_gerais(incentivo_id, list(prod_map.keys()), prod_map)
    return {"ok": True}


@router.put("/admin/{incentivo_id}/faixas")
def admin_salvar_faixas(incentivo_id: int, body: dict = Body(...), u: CurrentUser = Depends(get_current_user)):
    """body: {"faixas": [{"limite": 40, "valor": 1.0}, ..., {"limite": null, "valor": 4.0}]}"""
    _exige_admin(u)
    cfg = get_incentivo(incentivo_id)
    if not cfg:
        raise HTTPException(404, "Incentivo não encontrado")
    if cfg["tipo"] != "escalonado":
        raise HTTPException(400, "Faixas só se aplicam a incentivo do tipo 'escalonado'.")
    faixas = body.get("faixas", [])
    if not faixas:
        raise HTTPException(400, "Informe ao menos uma faixa.")
    salvar_faixas(incentivo_id, faixas)
    return {"ok": True}


@router.get("/admin/{incentivo_id}/equipe/{cod_supervisor}/produtos")
def admin_listar_produtos_equipe(incentivo_id: int, cod_supervisor: int, u: CurrentUser = Depends(get_current_user)):
    _exige_admin(u)
    return {"produtos": listar_produtos_equipe(incentivo_id, cod_supervisor)}


@router.put("/admin/{incentivo_id}/equipe/{cod_supervisor}/produtos")
def admin_salvar_produtos_equipe(incentivo_id: int, cod_supervisor: int, body: dict = Body(...),
                                  u: CurrentUser = Depends(get_current_user)):
    """body: {"produtos": [{"codprod": 123, "descricao": "..."}]} — lista
    própria da equipe; substitui a lista geral SÓ pra ela. Mandar lista
    vazia é o mesmo que remover o override (volta a usar a geral)."""
    _exige_admin(u)
    if not get_incentivo(incentivo_id):
        raise HTTPException(404, "Incentivo não encontrado")
    produtos = body.get("produtos", [])
    if not produtos:
        remover_override_equipe(incentivo_id, cod_supervisor)
        return {"ok": True}
    prod_map = {int(p["codprod"]): p.get("descricao", "") for p in produtos}
    salvar_produtos_equipe(incentivo_id, cod_supervisor, list(prod_map.keys()), prod_map)
    return {"ok": True}


@router.delete("/admin/{incentivo_id}/equipe/{cod_supervisor}")
def admin_remover_override_equipe(incentivo_id: int, cod_supervisor: int, u: CurrentUser = Depends(get_current_user)):
    _exige_admin(u)
    remover_override_equipe(incentivo_id, cod_supervisor)
    return {"ok": True}
