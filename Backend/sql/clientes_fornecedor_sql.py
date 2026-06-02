"""
SQL do módulo Clientes por Fornecedor — versão otimizada.

Mudanças vs versão anterior:
- Sem PCMOVCOMPLE (era o maior gargalo)
- 6 meses fixos como colunas pivô (sem parâmetro de mês)
- Inclui carteira (PCPEDI) no mês corrente
- dt_ultima_compra e vl_ultima_compra calculados em CTEs separadas
- Valor = QT * PUNIT (simples e rápido, adequado para visualização)
"""
from typing import List
from config import FILIAL


def build_clientes_fornecedor_sql(codfornecs: List[int]) -> tuple:
    """
    Retorna (sql, params_dict) com colunas m0..m5:
      m0 = mês atual  (faturado + carteira)
      m1 = mês -1, m2 = mês -2, ..., m5 = mês -5
    """
    if not codfornecs:
        return "SELECT 1 FROM DUAL WHERE 1=0", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {f"f{i}": cod for i, cod in enumerate(codfornecs)}

    sql = f"""
WITH PARAMS AS (
    SELECT
        TRUNC(SYSDATE,'MM')                         AS M0,
        ADD_MONTHS(TRUNC(SYSDATE,'MM'), -1)         AS M1,
        ADD_MONTHS(TRUNC(SYSDATE,'MM'), -2)         AS M2,
        ADD_MONTHS(TRUNC(SYSDATE,'MM'), -3)         AS M3,
        ADD_MONTHS(TRUNC(SYSDATE,'MM'), -4)         AS M4,
        ADD_MONTHS(TRUNC(SYSDATE,'MM'), -5)         AS M5,
        ADD_MONTHS(TRUNC(SYSDATE,'MM'), -5)         AS DT_INI
    FROM DUAL
),
-- ── Vendas faturadas nos últimos 6 meses (sem PCMOVCOMPLE) ────────────────
FAT_BASE AS (
    SELECT
        M.CODCLI,
        TRUNC(N.DTSAIDA,'MM')                       AS MES_TRUNC,
        N.DTSAIDA,
        SUM(ROUND(NVL(M.QT,0) * NVL(M.PUNIT,0), 2)) AS VL
    FROM PCMOV M
        INNER JOIN PCNFSAID N   ON N.NUMTRANSVENDA  = M.NUMTRANSVENDA
                                AND N.CODFILIAL      = M.CODFILIAL
        INNER JOIN PCPRODUT PR  ON PR.CODPROD        = M.CODPROD
        CROSS JOIN PARAMS P
    WHERE PR.CODFORNEC          IN ({placeholders})
      AND N.DTSAIDA             >= P.DT_INI
      AND N.CODFILIAL            IN ('{FILIAL}')
      AND M.CODFILIAL            IN ('{FILIAL}')
      AND M.CODOPER             NOT IN ('SR','SO')
      AND NVL(N.TIPOVENDA,'X')  NOT IN ('SR','DF')
      AND N.CODFISCAL           NOT IN (522,622,722,532,632,732)
      AND N.CONDVENDA           NOT IN (4,8,10,13,20,98,99)
      AND N.DTCANCEL             IS NULL
    GROUP BY M.CODCLI, TRUNC(N.DTSAIDA,'MM'), N.DTSAIDA
),
-- ── Pivot faturado por mês ───────────────────────────────────────────────
FAT_PIVOT AS (
    SELECT
        F.CODCLI,
        SUM(CASE WHEN F.MES_TRUNC = P.M0 THEN F.VL ELSE 0 END) AS M0_FAT,
        SUM(CASE WHEN F.MES_TRUNC = P.M1 THEN F.VL ELSE 0 END) AS M1,
        SUM(CASE WHEN F.MES_TRUNC = P.M2 THEN F.VL ELSE 0 END) AS M2,
        SUM(CASE WHEN F.MES_TRUNC = P.M3 THEN F.VL ELSE 0 END) AS M3,
        SUM(CASE WHEN F.MES_TRUNC = P.M4 THEN F.VL ELSE 0 END) AS M4,
        SUM(CASE WHEN F.MES_TRUNC = P.M5 THEN F.VL ELSE 0 END) AS M5,
        MAX(F.DTSAIDA)                                           AS DT_ULT_FAT
    FROM FAT_BASE F
        CROSS JOIN PARAMS P
    GROUP BY F.CODCLI
),
-- ── Valor na data da última compra faturada ──────────────────────────────
FAT_ULT_VL AS (
    SELECT F.CODCLI, SUM(F.VL) AS VL_ULT_FAT
    FROM FAT_BASE F
        INNER JOIN FAT_PIVOT FP ON FP.CODCLI = F.CODCLI
                                AND F.DTSAIDA = FP.DT_ULT_FAT
    GROUP BY F.CODCLI
),
-- ── Carteira atual (pedidos não faturados) ───────────────────────────────
CART AS (
    SELECT
        PEC.CODCLI,
        SUM(ROUND(NVL(PEI.QT,0) * (NVL(PEI.PVENDA,0)
            + NVL(PEI.VLOUTRASDESP,0)
            + NVL(PEI.VLFRETE,0)), 2))               AS VL_CART,
        MAX(PEC.DATA)                                 AS DT_ULT_CART
    FROM PCPEDI PEI
        INNER JOIN PCPEDC  PEC ON PEC.NUMPED   = PEI.NUMPED
        INNER JOIN PCPRODUT PR ON PR.CODPROD   = PEI.CODPROD
    WHERE PR.CODFORNEC         IN ({placeholders})
      AND PEC.CODFILIAL          IN ('{FILIAL}')
      AND PEC.CONDVENDA          IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PEC.POSICAO           <> 'F'
      AND NVL(PEI.BONIFIC,'N')  = 'N'
      AND PEC.DTCANCEL           IS NULL
    GROUP BY PEC.CODCLI
)
-- ── SELECT final ─────────────────────────────────────────────────────────
SELECT
    C.CODCLI                                                      AS cod_cliente,
    C.CLIENTE                                                     AS razao_social,
    NVL(NULLIF(TRIM(C.FANTASIA),''), C.CLIENTE)                   AS nome_fantasia,
    C.CODUSUR1                                                    AS cod_vendedor,
    U.NOME                                                        AS nome_vendedor,
    U.CODSUPERVISOR                                               AS cod_supervisor,
    NVL(CD.NOMECIDADE,'—')                                        AS nome_cidade,
    NVL(FP.M5, 0)                                                 AS m5,
    NVL(FP.M4, 0)                                                 AS m4,
    NVL(FP.M3, 0)                                                 AS m3,
    NVL(FP.M2, 0)                                                 AS m2,
    NVL(FP.M1, 0)                                                 AS m1,
    NVL(FP.M0_FAT, 0) + NVL(CA.VL_CART, 0)                       AS m0,
    -- Última compra: faturada ou carteira, o que for mais recente
    CASE
        WHEN NVL(FP.DT_ULT_FAT, DATE '1900-01-01') >=
             NVL(CA.DT_ULT_CART, DATE '1900-01-01')
        THEN FP.DT_ULT_FAT
        ELSE CA.DT_ULT_CART
    END                                                           AS dt_ultima_compra,
    CASE
        WHEN NVL(FP.DT_ULT_FAT, DATE '1900-01-01') >=
             NVL(CA.DT_ULT_CART, DATE '1900-01-01')
        THEN NVL(FUV.VL_ULT_FAT, 0)
        ELSE NVL(CA.VL_CART, 0)
    END                                                           AS vl_ultima_compra
FROM PCCLIENT C
    LEFT JOIN PCUSUARI  U   ON U.CODUSUR       = C.CODUSUR1
    LEFT JOIN PCCIDADE  CD  ON CD.CODCIDADE    = C.CODCIDADE
    INNER JOIN FAT_PIVOT FP ON FP.CODCLI       = C.CODCLI
    LEFT JOIN FAT_ULT_VL FUV ON FUV.CODCLI    = C.CODCLI
    LEFT JOIN CART       CA  ON CA.CODCLI      = C.CODCLI
ORDER BY C.CLIENTE
"""
    return sql, params