"""
Incentivos por venda de produtos.

Cada incentivo define produtos + valor por caixa fechada. A apuração soma
faturado + carteira do mês atual, converte em caixas (FLOOR por produto) e
multiplica pelo valor. Retorna SEMPRE todas as equipes e todos os vendedores
(competição amistosa), para qualquer cargo (vendedor, supervisor, gerência).

Para adicionar um novo incentivo, basta incluir uma entrada em INCENTIVOS.
"""
import math
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query, parse_data
from sql.incentivos_sql import build_incentivo_sql, build_combo_sql
from routers.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/incentivos", tags=["Incentivos"])

# ── Configuração dos incentivos ───────────────────────────────────────────────
# Para criar um novo: adicione uma entrada com id único, nome, produtos e valor.
INCENTIVOS = {
    "yopro": {
        "id": "yopro",
        "nome": "Incentivo YoPro",
        "produtos": [19245, 18584, 18291],
        "valor_por_caixa": 5.0,
    },
    "caixas": {
        "id": "caixas",
        "nome": "Incentivo Caixas",
        "produtos": [18179, 18180, 18182, 18361, 18362],
        # Faixa única: todas as caixas valem o preço da faixa atingida.
        # Cada tupla é (limite_superior_inclusive, valor_por_caixa).
        # A última faixa usa None como limite (sem teto).
        "faixas": [
            (40,   1.0),
            (80,   2.0),
            (130,  3.0),
            (None, 4.0),
        ],
    },
    "gulozitos": {
        "id": "gulozitos",
        "nome": "Incentivo Gulozitos",
        "produtos": [18638, 18394, 18518, 18635],
        # Combo por cliente: R$ por cada cliente que levou TODOS os produtos.
        "tipo": "combo",
        "valor_por_combo": 5.0,
    },
    # "incentivo3": {"id": "incentivo3", "nome": "...", "produtos": [...], "valor_por_caixa": X},
}


def valor_por_caixa_de(cfg: dict, total_caixas: int) -> float:
    """Retorna o valor unitário por caixa conforme a config do incentivo.
    - Se tem 'faixas': faixa única — todas as caixas valem o preço da faixa
      em que o TOTAL do vendedor se encaixa.
    - Senão: usa 'valor_por_caixa' fixo.
    """
    faixas = cfg.get("faixas")
    if not faixas:
        return cfg.get("valor_por_caixa", 0.0)
    for limite, valor in faixas:
        if limite is None or total_caixas <= limite:
            return valor
    return faixas[-1][1]


@router.get("")
def listar_incentivos(u: CurrentUser = Depends(get_current_user)):
    """Lista os incentivos disponíveis (para montar o dropdown na sidebar)."""
    return {"incentivos": [
        {"id": i["id"], "nome": i["nome"], "produtos": i["produtos"],
         "tipo": i.get("tipo", "caixas"),
         "valor_por_caixa": i.get("valor_por_caixa"),
         "valor_por_combo": i.get("valor_por_combo"),
         "faixas": [{"ate": lim, "valor": val} for lim, val in i["faixas"]] if i.get("faixas") else None}
        for i in INCENTIVOS.values()
    ]}


@router.get("/ranking-geral/consolidado")
def ranking_geral(data: Optional[str] = None,
                  u: CurrentUser = Depends(get_current_user)):
    """
    Ranking GERAL consolidado: soma o prêmio de TODOS os incentivos por vendedor.
    Exalta o pódio; o frontend marca os últimos como 'lanterninha'.
    """
    dr = parse_data(data)

    # Acumula prêmio por vendedor somando todos os incentivos
    geral = {}
    detalhe_incentivos = []
    for cfg in INCENTIVOS.values():
        detalhe_incentivos.append({"id": cfg["id"], "nome": cfg["nome"]})
        for v in _apurar_qualquer(cfg, dr):
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

    total_geral = {"premio": sum(v["total_premio"] for v in ranking)}

    return {
        "nome": "Ranking Geral",
        "data_ref": dr,
        "incentivos": detalhe_incentivos,
        "ranking": ranking,
        "total_geral": total_geral,
    }


@router.get("/{incentivo_id}")
def get_incentivo(incentivo_id: str, data: Optional[str] = None,
                  u: CurrentUser = Depends(get_current_user)):
    """
    Apuração do incentivo, agrupada por equipe (supervisor) → vendedor → produtos.
    Todos os cargos veem todas as equipes (competição amistosa).
    """
    cfg = INCENTIVOS.get(incentivo_id)
    if not cfg:
        raise HTTPException(404, "Incentivo não encontrado")

    dr = parse_data(data)
    if cfg.get("tipo") == "combo":
        ranking = _apurar_combo(cfg, dr)
        total_geral = {
            "combos": sum(v["total_combos"] for v in ranking),
            "premio": sum(v["total_premio"] for v in ranking),
        }
        return {
            "incentivo": {"id": cfg["id"], "nome": cfg["nome"],
                          "tipo": "combo", "valor_por_combo": cfg.get("valor_por_combo", 0.0),
                          "produtos": cfg["produtos"]},
            "data_ref": dr, "ranking": ranking, "total_geral": total_geral,
        }

    ranking = _apurar_caixas(cfg, dr)
    total_geral = {
        "caixas": sum(v["total_caixas"] for v in ranking),
        "premio": sum(v["total_premio"] for v in ranking),
    }
    return {
        "incentivo": {"id": cfg["id"], "nome": cfg["nome"],
                      "valor_por_caixa": cfg.get("valor_por_caixa"),
                      "faixas": [{"ate": lim, "valor": val} for lim, val in cfg["faixas"]] if cfg.get("faixas") else None,
                      "produtos": cfg["produtos"]},
        "data_ref": dr, "ranking": ranking, "total_geral": total_geral,
    }


# ── Funções de apuração (reusadas pelo endpoint individual e pelo ranking geral) ─

def _apurar_caixas(cfg: dict, dr: str) -> list:
    """Retorna lista de vendedores com total_caixas, valor_caixa_aplicado, total_premio."""
    try:
        sql, params = build_incentivo_sql(cfg["produtos"], dr)
        linhas = execute_query(sql, params)
    except Exception as e:
        raise HTTPException(500, str(e))

    vendedores = {}
    for r in linhas:
        cv = r["cod_vendedor"]
        qtcx = r["qt_unit_cx"] or 1
        unid = r["unidades"] or 0
        caixas = int(math.floor(unid / qtcx)) if qtcx else 0
        if cv not in vendedores:
            vendedores[cv] = {
                "cod_vendedor": cv, "nome_vendedor": r["nome_vendedor"],
                "cod_supervisor": r["cod_supervisor"],
                "nome_supervisor": r["nome_supervisor"] or f"Supervisor #{r['cod_supervisor']}",
                "total_caixas": 0, "total_premio": 0.0,
            }
        vendedores[cv]["total_caixas"] += caixas

    for v in vendedores.values():
        vcx = valor_por_caixa_de(cfg, v["total_caixas"])
        v["valor_caixa_aplicado"] = vcx
        v["total_premio"] = v["total_caixas"] * vcx

    ranking = sorted(vendedores.values(), key=lambda x: (x["total_premio"], x["total_caixas"]), reverse=True)
    for i, v in enumerate(ranking):
        v["posicao"] = i + 1
    return ranking


def _apurar_combo(cfg: dict, dr: str) -> list:
    """Retorna lista de vendedores com total_combos, total_premio."""
    valor_combo = cfg.get("valor_por_combo", 0.0)
    try:
        sql, params = build_combo_sql(cfg["produtos"], dr)
        linhas = execute_query(sql, params)
    except Exception as e:
        raise HTTPException(500, str(e))

    ranking = []
    for r in linhas:
        combos = r["combos"] or 0
        ranking.append({
            "cod_vendedor": r["cod_vendedor"], "nome_vendedor": r["nome_vendedor"],
            "cod_supervisor": r["cod_supervisor"],
            "nome_supervisor": r["nome_supervisor"] or f"Supervisor #{r['cod_supervisor']}",
            "total_combos": combos, "total_premio": combos * valor_combo,
        })
    ranking.sort(key=lambda x: (x["total_premio"], x["total_combos"]), reverse=True)
    for i, v in enumerate(ranking):
        v["posicao"] = i + 1
    return ranking


def _apurar_qualquer(cfg: dict, dr: str) -> list:
    """Apura um incentivo independente do tipo."""
    return _apurar_combo(cfg, dr) if cfg.get("tipo") == "combo" else _apurar_caixas(cfg, dr)