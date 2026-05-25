"""
SQL do módulo TROCA.

Colunas por vendedor:
  PLF_FAT   — seções 10040/10042/120239 faturadas no mês (R$)
  PLF_CART  — seções PLF em carteira de domingo até hoje (R$)
  TROCA     — pedidos CONDVENDA 5 ou 11 no mês (R$)  [rotina 322]
  PCT_TROCA — TROCA / PLF_FAT * 100
  FLEX      — verba abaixo da tabela dos fornecedores PMU no mês (R$)
"""
from typing import Optional
from config import FILIAL

FLEX_FORNECS = "1658,588,1727,1728,2118,850,1225,1321,1623,1607,2041,1541,1719,1488"
PLF_SECS     = "10040,10042,120239"


def build_troca_sql(
    date_ref: Optional[str] = None,
    filtro_vendedor:   Optional[int] = None,
    filtro_supervisor: Optional[int] = None,
) -> tuple:
    from database import parse_data
    dr = date_ref or parse_data(None)

    filtro_acesso = ""
    if filtro_vendedor:
        filtro_acesso = f"AND U.CODUSUR = {filtro_vendedor}"
    elif filtro_supervisor:
        filtro_acesso = f"AND U.CODSUPERVISOR = {filtro_supervisor}"

    sql = f"""
WITH PARAMS AS (
    SELECT
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM')          AS DT_MES_INI,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'))                AS DT_HOJE,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'DAY')          AS DT_SEM_INI
    FROM DUAL
),

-- PLF faturado no mês (seções PLF via PCMOV, mesmas condições 1464)
PLF_FAT AS (
    SELECT
        PCNFSAID.CODUSUR,
        SUM(PCMOV.PUNIT * PCMOV.QT)      AS VL_PLF_FAT
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL      = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD      = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCPRODUT.CODSEC    IN ({PLF_SECS})
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
    GROUP BY PCNFSAID.CODUSUR
),

-- PLF carteira de domingo até hoje (rotina 322 — não faturado)
PLF_CART AS (
    SELECT
        PCPEDC.CODUSUR,
        SUM(PCPEDI.QT * (PCPEDI.PVENDA
            + NVL(PCPEDI.VLOUTRASDESP,0)
            + NVL(PCPEDI.VLFRETE,0)))    AS VL_PLF_CART
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED  = PCPEDI.NUMPED
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA       BETWEEN P.DT_SEM_INI AND P.DT_HOJE
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPRODUT.CODSEC    IN ({PLF_SECS})
      AND PCPEDC.POSICAO    <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
    GROUP BY PCPEDC.CODUSUR
),

-- TROCA: pedidos CONDVENDA 5 ou 11 no mês (rotina 322)
TROCA AS (
    SELECT
        PCPEDC.CODUSUR,
        SUM(PCPEDI.QT * (PCPEDI.PVENDA
            + NVL(PCPEDI.VLOUTRASDESP,0)
            + NVL(PCPEDI.VLFRETE,0)))    AS VL_TROCA
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED  = PCPEDI.NUMPED
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA       BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (5,11)
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
      AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
    GROUP BY PCPEDC.CODUSUR
),

-- FLEX: verba abaixo da tabela dos fornecedores PMU
FLEX AS (
    SELECT
        a.codusur AS CODUSUR,
        SUM(CASE WHEN (a.ptabela - a.punit) < 0
                 THEN (a.ptabela - a.punit) * a.qt
                 ELSE 0 END)             AS VL_FLEX
    FROM PCMOV a
        CROSS JOIN PARAMS P
    WHERE a.dtmov     BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND a.CODFORNEC IN ({FLEX_FORNECS})
    GROUP BY a.codusur
)

SELECT
    U.CODUSUR                                                     AS cod_vendedor,
    U.NOME                                                        AS nome_vendedor,
    U.CODSUPERVISOR                                               AS cod_supervisor,
    S.NOME                                                        AS nome_supervisor,
    NVL(F.VL_PLF_FAT,  0)                                        AS plf_fat,
    NVL(C.VL_PLF_CART, 0)                                        AS plf_cart,
    NVL(F.VL_PLF_FAT,  0) + NVL(C.VL_PLF_CART, 0)              AS plf_total,
    NVL(T.VL_TROCA,    0)                                        AS troca,
    CASE WHEN NVL(F.VL_PLF_FAT,0) > 0
         THEN ROUND(NVL(T.VL_TROCA,0) / F.VL_PLF_FAT * 100, 2)
         ELSE NULL END                                            AS pct_troca,
    NVL(X.VL_FLEX,     0) * -1                                   AS flex,
    CASE WHEN NVL(F.VL_PLF_FAT,0) > 0
         THEN ROUND((NVL(T.VL_TROCA,0) - (NVL(X.VL_FLEX,0) * -1)) / NVL(F.VL_PLF_FAT,0) * 100, 2)
         ELSE NULL END                                            AS pct_flex_troca
FROM PCUSUARI U
    LEFT JOIN PCSUPERV  S ON S.CODSUPERVISOR = U.CODSUPERVISOR
    LEFT JOIN PLF_FAT   F ON F.CODUSUR = U.CODUSUR
    LEFT JOIN PLF_CART  C ON C.CODUSUR = U.CODUSUR
    LEFT JOIN TROCA     T ON T.CODUSUR = U.CODUSUR
    LEFT JOIN FLEX      X ON X.CODUSUR = U.CODUSUR
WHERE U.NOME LIKE 'PMU%'
  AND U.CODSUPERVISOR NOT IN ('9999','999999')
  AND U.CODUSUR NOT IN (2, 160, 180)
  AND (F.VL_PLF_FAT IS NOT NULL
       OR T.VL_TROCA IS NOT NULL
       OR X.VL_FLEX  IS NOT NULL)
  {filtro_acesso}
ORDER BY U.CODSUPERVISOR, U.NOME
"""
    return sql, []