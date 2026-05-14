"""
SQL do Bateu Levou — agora com produtos por supervisor.
"""
from config import FILIAL
from typing import List


def _qt_pedido(unidade):
    if unidade == "CX":
        return "ROUND(NVL(PCPEDI.QT,0)/DECODE(NVL(PCPRODUT.QTUNITCX,0),0,1,PCPRODUT.QTUNITCX),3)"
    return "NVL(PCPEDI.QT,0)"


def _qt_nota(unidade):
    if unidade == "CX":
        return "ROUND(NVL(DECODE(PCNFSAID.CONDVENDA,7,PCMOV.QTCONT,PCMOV.QT),0)/DECODE(NVL(PCPRODUT.QTUNITCX,0),0,1,PCPRODUT.QTUNITCX),3)"
    return "NVL(DECODE(PCNFSAID.CONDVENDA,7,PCMOV.QTCONT,PCMOV.QT),0)"


def _in(codprods):
    return "(" + ",".join(str(c) for c in codprods) + ")"


def sql_nao_faturado_supervisor(codprods, unidade, semana_ini, data_ref, cod_supervisor):
    qt, prods = _qt_pedido(unidade), _in(codprods)
    return f"""
SELECT PCUSUARI.CODUSUR AS COD_VENDEDOR, PCUSUARI.NOME AS NOME_VENDEDOR,
       PCUSUARI.CODSUPERVISOR AS COD_SUPERVISOR,
       PCSUPERV.NOME AS NOME_SUPERVISOR,
       PCPEDI.CODPROD, PCPRODUT.DESCRICAO,
       SUM(CASE WHEN PCPEDC.DATA BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')
                                     AND TO_DATE('{data_ref}','YYYY-MM-DD') - 1
                THEN {qt} ELSE 0 END) AS QT_REALIZADO,
       SUM(CASE WHEN PCPEDC.DATA = TO_DATE('{data_ref}','YYYY-MM-DD')
                THEN {qt} ELSE 0 END) AS QT_DIA
FROM PCPEDI
    INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
    INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
    INNER JOIN PCSUPERV ON PCSUPERV.CODSUPERVISOR = PCUSUARI.CODSUPERVISOR
    INNER JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
WHERE PCPEDC.DATA      BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')
                           AND TO_DATE('{data_ref}','YYYY-MM-DD')
  AND PCPEDC.CODFILIAL IN ('{FILIAL}')
  AND PCPEDC.CONDVENDA IN (1,2,3,7,9,14,15,17,18,19,98)
  AND PCPEDC.POSICAO   <> 'F'
  AND NVL(PCPEDI.BONIFIC,'N') = 'N'
  AND PCPEDC.DTCANCEL  IS NULL
  AND PCUSUARI.CODSUPERVISOR = {cod_supervisor}
  AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
  AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)
  AND PCPEDI.CODPROD IN {prods}
GROUP BY PCUSUARI.CODUSUR, PCUSUARI.NOME, PCUSUARI.CODSUPERVISOR, PCSUPERV.NOME,
         PCPEDI.CODPROD, PCPRODUT.DESCRICAO
HAVING SUM({qt}) > 0
ORDER BY PCUSUARI.CODUSUR, PCPRODUT.DESCRICAO
"""


def sql_faturado_supervisor(codprods, unidade, semana_ini, data_ref, cod_supervisor):
    qt, prods = _qt_nota(unidade), _in(codprods)
    return f"""
SELECT PCNFSAID.CODUSUR AS COD_VENDEDOR, PCUSUARI.NOME AS NOME_VENDEDOR,
       NVL(PCNFSAID.CODSUPERVISOR,PCSUPERV.CODSUPERVISOR) AS COD_SUPERVISOR,
       PCSUPERV.NOME AS NOME_SUPERVISOR,
       PCMOV.CODPROD, PCPRODUT.DESCRICAO,
       SUM(CASE WHEN PCNFSAID.DTSAIDA BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')
                                          AND TO_DATE('{data_ref}','YYYY-MM-DD') - 1
                THEN {qt} ELSE 0 END) AS QT_REALIZADO,
       SUM(CASE WHEN PCNFSAID.DTSAIDA = TO_DATE('{data_ref}','YYYY-MM-DD')
                THEN {qt} ELSE 0 END) AS QT_DIA
FROM PCNFSAID
    INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA=PCNFSAID.NUMTRANSVENDA AND PCMOV.CODFILIAL=PCNFSAID.CODFILIAL
    INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR=PCNFSAID.CODUSUR
    INNER JOIN PCSUPERV ON PCSUPERV.CODSUPERVISOR=NVL(PCNFSAID.CODSUPERVISOR,PCUSUARI.CODSUPERVISOR)
    INNER JOIN PCPRODUT ON PCPRODUT.CODPROD=PCMOV.CODPROD
WHERE PCNFSAID.DTSAIDA BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')
                           AND TO_DATE('{data_ref}','YYYY-MM-DD')
  AND PCMOV.DTMOV BETWEEN TO_DATE('{semana_ini}','YYYY-MM-DD')
                      AND TO_DATE('{data_ref}','YYYY-MM-DD')
  AND PCMOV.CODFILIAL IN ('{FILIAL}') AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
  AND PCMOV.CODOPER NOT IN ('SR','SO')
  AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
  AND PCNFSAID.CODFISCAL NOT IN (522,622,722,532,632,732)
  AND PCNFSAID.CONDVENDA NOT IN (4,8,10,13,20,98,99)
  AND PCNFSAID.DTCANCEL IS NULL
  AND NVL(PCNFSAID.CODSUPERVISOR,PCSUPERV.CODSUPERVISOR) = {cod_supervisor}
  AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)
  AND PCMOV.CODPROD IN {prods}
GROUP BY PCNFSAID.CODUSUR, PCUSUARI.NOME,
         NVL(PCNFSAID.CODSUPERVISOR,PCSUPERV.CODSUPERVISOR), PCSUPERV.NOME,
         PCMOV.CODPROD, PCPRODUT.DESCRICAO
HAVING SUM({qt}) > 0
ORDER BY PCNFSAID.CODUSUR, PCPRODUT.DESCRICAO
"""


def agregar_por_vendedor(oracle_rows, metas_sup):
    """
    oracle_rows: linhas Oracle (produto×vendedor)
    metas_sup:   {cod_vendedor: meta} para este supervisor
    Retorna lista de vendedores com produtos aninhados.
    """
    vendedores = {}
    for row in oracle_rows:
        cod_v = row["cod_vendedor"]
        if cod_v not in vendedores:
            vendedores[cod_v] = {
                "cod_vendedor":   cod_v,
                "nome_vendedor":  row["nome_vendedor"],
                "cod_supervisor": row["cod_supervisor"],
                "nome_supervisor":row["nome_supervisor"],
                "meta":           float(metas_sup.get(cod_v, 0)),
                "qt_realizado":   0.0,
                "qt_dia":         0.0,
                "produtos":       [],
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
        v["pct_ating"] = round(v["qt_realizado"]/meta*100, 2) if meta > 0 else None
        result.append(v)

    result.sort(key=lambda x: -(x["pct_ating"] or 0))
    return result