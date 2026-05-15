"""
SQL do Bateu Levou — baseado na rotina 322 (Venda Por Departamento).

Usa PCPEDI + PCPEDC, sem filtro de POSICAO, igual à 322.
Uma única consulta, sem toggle faturado/não faturado.

fechamento=False (semana em curso):
  QT_REALIZADO = semana_ini → data_ref - 1 (ontem)
  QT_DIA       = data_ref (hoje)

fechamento=True (campanha encerrada):
  QT_REALIZADO = semana_ini → data_ref (semana toda)
  QT_DIA       = 0
"""
from config import FILIAL
from typing import List


def _qt_expr(unidade: str) -> str:
    if unidade == "CX":
        return "ROUND(NVL(PCPEDI.QT,0) / DECODE(NVL(PCPRODUT.QTUNITCX,0),0,1,PCPRODUT.QTUNITCX), 3)"
    return "NVL(PCPEDI.QT, 0)"


def _in_produtos(codprods: List[int]) -> str:
    return "(" + ",".join(str(c) for c in codprods) + ")"


def sql_322_supervisor(codprods: List[int], unidade: str,
                       semana_ini: str, data_ref: str,
                       cod_supervisor: int,
                       fechamento: bool = False) -> str:
    qt    = _qt_expr(unidade)
    prods = _in_produtos(codprods)

    if fechamento:
        # Campanha encerrada: semana toda vai pro realizado, dia = 0
        case_real = (
            f"WHEN PCPEDC.DATA BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')"
            f" AND TO_DATE('{data_ref}','YYYY-MM-DD') THEN {qt}"
        )
        case_dia = "WHEN 1=0 THEN 0"
    else:
        # Semana em curso: realizado = dom→ontem, dia = hoje
        case_real = (
            f"WHEN PCPEDC.DATA BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')"
            f" AND TO_DATE('{data_ref}','YYYY-MM-DD') - 1 THEN {qt}"
        )
        case_dia = f"WHEN PCPEDC.DATA = TO_DATE('{data_ref}','YYYY-MM-DD') THEN {qt}"

    return f"""
SELECT
    PCUSUARI.CODUSUR                                               AS COD_VENDEDOR,
    PCUSUARI.NOME                                                  AS NOME_VENDEDOR,
    PCUSUARI.CODSUPERVISOR                                         AS COD_SUPERVISOR,
    PCSUPERV.NOME                                                  AS NOME_SUPERVISOR,
    PCPEDI.CODPROD,
    PCPRODUT.DESCRICAO,
    SUM(CASE {case_real} ELSE 0 END)                               AS QT_REALIZADO,
    SUM(CASE {case_dia}  ELSE 0 END)                               AS QT_DIA
FROM PCPEDI
    ,PCPEDC
    ,PCPRODUT
    ,PCUSUARI
    ,PCSUPERV
WHERE PCPEDI.NUMPED             = PCPEDC.NUMPED
  AND PCPEDI.CODPROD            = PCPRODUT.CODPROD
  AND PCPEDC.CODUSUR            = PCUSUARI.CODUSUR
  AND PCUSUARI.CODSUPERVISOR    = PCSUPERV.CODSUPERVISOR
  AND PCPEDC.DATA BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')
                      AND TO_DATE('{data_ref}','YYYY-MM-DD')
  AND PCPEDC.CODFILIAL          IN ('{FILIAL}')
  AND PCPEDC.CONDVENDA          IN (1,2,3,7,9,14,15,17,18,19,98)
  AND NVL(PCPEDI.BONIFIC,'N')   = 'N'
  AND PCPEDC.DTCANCEL           IS NULL
  AND PCUSUARI.CODSUPERVISOR    NOT IN ('9999')
  AND PCUSUARI.CODUSUR          NOT IN (2,10,160,180)
  AND PCUSUARI.CODSUPERVISOR    = {cod_supervisor}
  AND PCPEDI.CODPROD            IN {prods}
GROUP BY
    PCUSUARI.CODUSUR, PCUSUARI.NOME,
    PCUSUARI.CODSUPERVISOR, PCSUPERV.NOME,
    PCPEDI.CODPROD, PCPRODUT.DESCRICAO
HAVING SUM({qt}) > 0
ORDER BY PCUSUARI.CODUSUR, PCPRODUT.DESCRICAO
"""


def agregar_por_vendedor(oracle_rows: list, metas_sup: dict) -> list:
    vendedores = {}
    for row in oracle_rows:
        cod_v = row["cod_vendedor"]
        if cod_v not in vendedores:
            vendedores[cod_v] = {
                "cod_vendedor":    cod_v,
                "nome_vendedor":   row["nome_vendedor"],
                "cod_supervisor":  row["cod_supervisor"],
                "nome_supervisor": row["nome_supervisor"],
                "meta":            float(metas_sup.get(cod_v, 0)),
                "qt_realizado":    0.0,
                "qt_dia":          0.0,
                "produtos":        [],
            }
        qt_r = float(row.get("qt_realizado") or 0)
        qt_d = float(row.get("qt_dia")       or 0)
        vendedores[cod_v]["qt_realizado"] += qt_r
        vendedores[cod_v]["qt_dia"]       += qt_d
        vendedores[cod_v]["produtos"].append({
            "codprod":      row["codprod"],
            "descricao":    row["descricao"],
            "qt_realizado": round(qt_r, 2),
            "qt_dia":       round(qt_d, 2),
        })

    result = []
    for v in vendedores.values():
        v["qt_realizado"] = round(v["qt_realizado"], 2)
        v["qt_dia"]       = round(v["qt_dia"],       2)
        meta = v["meta"]
        v["pct_ating"] = round(v["qt_realizado"] / meta * 100, 2) if meta > 0 else None
        result.append(v)

    result.sort(key=lambda x: -(x["pct_ating"] or 0))
    return result