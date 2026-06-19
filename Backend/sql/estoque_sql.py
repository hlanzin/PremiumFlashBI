"""SQL do módulo de Estoque — usa PCEST (atual) ou PCHISTEST (histórico)."""
from config import FILIAL


def build_estoque_query(codigo_secao: int, date_ref: str) -> tuple:
    """
    Retorna (sql, params).
    Se date_ref == hoje → PCEST (estoque atual).
    Se date_ref < hoje  → PCHISTEST (histórico snapshot).
    """
    from datetime import date
    from database import parse_data
    hoje = date.today().strftime("%Y-%m-%d")
    usa_historico = date_ref != hoje

    if usa_historico:
        tabela = "PCHISTEST"
        estoque_cte = f"""
    ESTOQUE_BASE AS (
        SELECT CODFILIAL, CODPROD, QTESTGER, QTRESERV, QTBLOQUEADA, QTPENDENTE, CUSTOFIN
        FROM PCHISTEST
        WHERE CODFILIAL IN ('{FILIAL}')
          AND DATA = TO_DATE('{date_ref}', 'YYYY-MM-DD')
    )"""
    else:
        tabela = "PCEST"
        estoque_cte = f"""
    ESTOQUE_BASE AS (
        SELECT CODFILIAL, CODPROD, QTESTGER, QTRESERV, QTBLOQUEADA, QTPENDENTE, CUSTOFIN
        FROM PCEST
        WHERE CODFILIAL IN ('{FILIAL}')
    )"""

    sql = f"""
WITH PARAMETROS AS (
    SELECT CODIGO,
           NVL(PARAMFILIAL.OBTERCOMOVARCHAR2('BLOQUEIAVENDAESTPENDENTE', PCFILIAL.CODIGO),
               PCCONSUM.BLOQUEIAVENDAESTPENDENTE) AS BLOQUEIAVENDAESTPENDENTE
    FROM PCFILIAL, PCCONSUM
    WHERE CODIGO IN ('{FILIAL}') AND DTEXCLUSAO IS NULL
),
{estoque_cte}
SELECT
    PCPRODUT.CODPROD,
    PCPRODUT.DESCRICAO,
    PCPRODUT.CODSEC,
    PCSECAO.DESCRICAO                                                    AS SECAO,
    PCPRODUT.QTUNITCX,
    NVL((SELECT TP.PVENDA2
           FROM PCTABPR TP
          WHERE TP.CODPROD = PCPRODUT.CODPROD
            AND TP.NUMREGIAO = 2
            AND NVL(TP.EXCLUIDO,'N') <> 'S'
            AND ROWNUM = 1), 0)                                          AS PVENDA,
    ROUND(NVL((SELECT TP.PVENDA2
                 FROM PCTABPR TP
                WHERE TP.CODPROD = PCPRODUT.CODPROD
                  AND TP.NUMREGIAO = 2
                  AND NVL(TP.EXCLUIDO,'N') <> 'S'
                  AND ROWNUM = 1), 0)
          * DECODE(NVL(PCPRODUT.QTUNITCX,0),0,1,PCPRODUT.QTUNITCX), 2)   AS PVENDA_CX,
    ROUND(SUM(
        NVL(EB.QTESTGER,0) - NVL(EB.QTRESERV,0) - NVL(EB.QTBLOQUEADA,0)
        - CASE WHEN PARAMETROS.BLOQUEIAVENDAESTPENDENTE='S' THEN NVL(EB.QTPENDENTE,0) ELSE 0 END
    ), 2)                                                                AS QTESTOQUE,
    ROUND(SUM(
        (NVL(EB.QTESTGER,0) - NVL(EB.QTRESERV,0) - NVL(EB.QTBLOQUEADA,0)
         - CASE WHEN PARAMETROS.BLOQUEIAVENDAESTPENDENTE='S' THEN NVL(EB.QTPENDENTE,0) ELSE 0 END)
        / DECODE(NVL(PCPRODUT.QTUNITCX,0), 0, 1, PCPRODUT.QTUNITCX)
    ), 2)                                                                AS QTESTOQUECX,
    ROUND(SUM(
        (NVL(EB.QTESTGER,0) - NVL(EB.QTRESERV,0) - NVL(EB.QTBLOQUEADA,0)
         - CASE WHEN PARAMETROS.BLOQUEIAVENDAESTPENDENTE='S' THEN NVL(EB.QTPENDENTE,0) ELSE 0 END)
        * NVL(EB.CUSTOFIN,0)
    ), 2)                                                                AS VALOR_ESTOQUE
FROM PCPRODUT
    JOIN ESTOQUE_BASE EB    ON PCPRODUT.CODPROD   = EB.CODPROD
    LEFT JOIN PCSECAO       ON PCPRODUT.CODSEC    = PCSECAO.CODSEC
    JOIN PARAMETROS         ON PARAMETROS.CODIGO  = EB.CODFILIAL
WHERE PCPRODUT.DTEXCLUSAO IS NULL
  AND PCPRODUT.CODSEC = :codigo_secao
GROUP BY PCPRODUT.CODPROD, PCPRODUT.DESCRICAO, PCPRODUT.CODSEC, PCSECAO.DESCRICAO, PCPRODUT.QTUNITCX
HAVING SUM(NVL(EB.QTESTGER,0)) > 0
ORDER BY VALOR_ESTOQUE DESC
"""
    return sql, {"codigo_secao": codigo_secao}


SQL_SECOES = f"""
SELECT CODSEC, DESCRICAO
FROM PCSECAO
WHERE CODSEC IN (
    SELECT DISTINCT PCPRODUT.CODSEC
    FROM PCEST
        JOIN PCPRODUT ON PCPRODUT.CODPROD = PCEST.CODPROD
    WHERE PCEST.CODFILIAL IN ('{FILIAL}')
      AND NVL(PCEST.QTESTGER,0) > 0
      AND PCPRODUT.DTEXCLUSAO IS NULL
)
  AND CODSEC NOT IN (120427, 11026, 120423, 10043, 120426, 120421, 120422, 120098, 9001, 120425, 7011)
ORDER BY DESCRICAO
"""