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
from sql.incentivos_sql import build_incentivo_sql
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
    # "incentivo2": {"id": "incentivo2", "nome": "...", "produtos": [...], "valor_por_caixa": X},
    # "incentivo3": {"id": "incentivo3", "nome": "...", "produtos": [...], "valor_por_caixa": X},
}


@router.get("")
def listar_incentivos(u: CurrentUser = Depends(get_current_user)):
    """Lista os incentivos disponíveis (para montar o dropdown na sidebar)."""
    return {"incentivos": [
        {"id": i["id"], "nome": i["nome"],
         "produtos": i["produtos"], "valor_por_caixa": i["valor_por_caixa"]}
        for i in INCENTIVOS.values()
    ]}


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
    valor_cx = cfg["valor_por_caixa"]

    try:
        sql, params = build_incentivo_sql(cfg["produtos"], dr)
        linhas = execute_query(sql, params)
    except Exception as e:
        raise HTTPException(500, str(e))

    # Monta estrutura: vendedor -> {info, produtos[], totais}
    vendedores = {}
    for r in linhas:
        cv = r["cod_vendedor"]
        qtcx = r["qt_unit_cx"] or 1
        unid = r["unidades"] or 0
        caixas = int(math.floor(unid / qtcx)) if qtcx else 0
        premio = caixas * valor_cx

        if cv not in vendedores:
            vendedores[cv] = {
                "cod_vendedor": cv,
                "nome_vendedor": r["nome_vendedor"],
                "cod_supervisor": r["cod_supervisor"],
                "nome_supervisor": r["nome_supervisor"] or f"Supervisor #{r['cod_supervisor']}",
                "produtos": [],
                "total_caixas": 0,
                "total_premio": 0.0,
            }
        v = vendedores[cv]
        v["produtos"].append({
            "cod_produto": r["cod_produto"],
            "descricao": r["descricao"],
            "qt_unit_cx": qtcx,
            "unidades": unid,
            "caixas": caixas,
            "premio": premio,
        })
        v["total_caixas"] += caixas
        v["total_premio"] += premio

    # Agrupa vendedores por supervisor (equipe)
    equipes = {}
    for v in vendedores.values():
        cs = v["cod_supervisor"]
        if cs not in equipes:
            equipes[cs] = {
                "cod_supervisor": cs,
                "nome_supervisor": v["nome_supervisor"],
                "vendedores": [],
                "total_caixas": 0,
                "total_premio": 0.0,
            }
        equipes[cs]["vendedores"].append(v)
        equipes[cs]["total_caixas"]  += v["total_caixas"]
        equipes[cs]["total_premio"]  += v["total_premio"]

    # Ordena: equipes por prêmio desc, vendedores dentro por prêmio desc
    lista_equipes = sorted(equipes.values(), key=lambda e: e["total_premio"], reverse=True)
    for e in lista_equipes:
        e["vendedores"].sort(key=lambda x: x["total_premio"], reverse=True)

    total_geral = {
        "caixas": sum(e["total_caixas"] for e in lista_equipes),
        "premio": sum(e["total_premio"] for e in lista_equipes),
    }

    return {
        "incentivo": {"id": cfg["id"], "nome": cfg["nome"],
                      "valor_por_caixa": valor_cx, "produtos": cfg["produtos"]},
        "data_ref": dr,
        "equipes": lista_equipes,
        "total_geral": total_geral,
    }
