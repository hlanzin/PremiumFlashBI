"""
Sugestão de pedido por produto de um fornecedor.

Fórmula (por produto):
    media_dia    = venda_periodo / dias_uteis_periodo
    necessidade  = media_dia * dias_estoque_desejados
    sugestao     = necessidade - estoque_disponivel + corte_periodo

onde:
    venda_periodo        = SUM(PCPEDI.QT) no período :dini..:dfim
    dias_uteis_periodo   = COUNT dias úteis (PCDATAS.DIAUTIL='S') no período
    estoque_disponivel   = PCEST.QTEST - PCEST.QTRESERV
    corte_periodo        = SUM(PCCORTEI.QTCORTADA) no período :dcorte_ini..:dcorte_fim
"""
from typing import Optional
from config import FILIAL


def build_sugestao_pedido_sql(codfornec: int,
                              dini: str, dfim: str,
                              dcorte_ini: str, dcorte_fim: str,
                              dias_estoque: int) -> tuple:
    """
    codfornec    : código do fornecedor
    dini/dfim    : período de análise da venda (YYYY-MM-DD)
    dcorte_ini/dcorte_fim : período de análise do corte (YYYY-MM-DD)
    dias_estoque : dias úteis de estoque desejados (número digitado na tela)
    """
    params = {
        "cforn":      codfornec,
        "dini":       dini,
        "dfim":       dfim,
        "dcorte_ini": dcorte_ini,
        "dcorte_fim": dcorte_fim,
        "dias_est":   dias_estoque,
    }

    sql = f"""
WITH DIAS_UTEIS AS (
    SELECT COUNT(*) AS QT
    FROM PCDATAS
    WHERE DATA BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND DIAUTIL = 'S'
),
VENDA AS (
    SELECT
        A.CODPROD,
        SUM(NVL(A.QT,0)) AS QT_VENDIDA
    FROM PCPEDI A, PCPEDC PC
    WHERE A.NUMPED   = PC.NUMPED
      AND PC.DATA    BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PC.CODFILIAL IN ('{FILIAL}')
      AND PC.CONDVENDA IN (1,2,3,7,9,14,15,17,18,19,98)
      AND NVL(A.BONIFIC,'N') = 'N'
      AND PC.DTCANCEL IS NULL
    GROUP BY A.CODPROD
),
CORTE AS (
    SELECT
        CI.CODPROD,
        SUM(NVL(CI.QTCORTADA,0)) AS QT_CORTADA
    FROM PCCORTEI CI
    WHERE CI.DATA BETWEEN TO_DATE(:dcorte_ini,'YYYY-MM-DD') AND TO_DATE(:dcorte_fim,'YYYY-MM-DD')
    GROUP BY CI.CODPROD
)
SELECT
    T.*,
    -- peso da sugestão = qt sugerida × peso bruto unitário
    ROUND(T.sugestao_qt * NVL(T.peso_bruto, 0), 3)         AS peso_sugestao
FROM (
    SELECT
        B.CODFORNEC                                            AS cod_fornecedor,
        B.CODFAB                                               AS cod_fabrica,
        B.CODPROD                                              AS cod_produto,
        B.DESCRICAO                                            AS descricao,
        B.QTUNITCX                                             AS qt_unit_cx,
        B.PESOBRUTO                                            AS peso_bruto,
        B.CUSTOREP                                             AS custo_rep,
        NVL(C.CUSTOULTENT, 0)                                 AS ult_vlr_entrada,
        NVL(V.QT_VENDIDA,0)                                    AS qt_vendida,
        DU.QT                                                  AS dias_uteis,
        NVL(C.QTEST,0)                                         AS qt_estoque,
        NVL(C.QTRESERV,0)                                      AS qt_reservada,
        NVL(C.QTEST,0) - NVL(C.QTRESERV,0)                     AS estoque_disponivel,
        NVL(CO.QT_CORTADA,0)                                   AS qt_cortada,
        -- média de venda por dia útil
        ROUND(NVL(V.QT_VENDIDA,0) / NULLIF(DU.QT,0), 2)        AS media_dia,
        -- sugestão = (media_dia * dias_estoque) - estoque_disp + corte
        CEIL(GREATEST(
            ROUND(NVL(V.QT_VENDIDA,0) / NULLIF(DU.QT,0), 4) * :dias_est
            - (NVL(C.QTEST,0) - NVL(C.QTRESERV,0))
            + NVL(CO.QT_CORTADA,0)
        , 0))                                                  AS sugestao_qt
    FROM PCPRODUT B
        LEFT JOIN PCEST   C  ON C.CODPROD = B.CODPROD AND C.CODFILIAL = {FILIAL}
        LEFT JOIN VENDA   V  ON V.CODPROD = B.CODPROD
        LEFT JOIN CORTE   CO ON CO.CODPROD = B.CODPROD
        CROSS JOIN DIAS_UTEIS DU
    WHERE B.CODFORNEC = :cforn
      AND NVL(B.DTEXCLUSAO, SYSDATE+1) > SYSDATE
      AND (NVL(V.QT_VENDIDA,0) > 0 OR NVL(CO.QT_CORTADA,0) > 0)
) T
ORDER BY T.descricao
"""
    return sql, params