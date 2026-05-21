"""
SQL Lista Negra.

Filtro de vendedor/supervisor aplicado DENTRO do BASE_META
(igual ao filtro_meta da DN) — garante que aparecem todos os clientes
que aquele vendedor atendeu no período, independente de mudança de base.
"""
from typing import Optional
from config import FILIAL


def build_lista_negra_sql(
    agrupamento: str = "fornecedor",
    dim_id: Optional[int] = None,
    date_ref: Optional[str] = None,
    filtro_vendedor: Optional[int] = None,
    filtro_supervisor: Optional[int] = None,
) -> tuple:
    from database import parse_data
    dr = date_ref or parse_data(None)

    # Filtro de dimensão
    if agrupamento == "fornecedor":
        filtro_dim = f"AND PCPRODUT.CODFORNEC = {dim_id}"
    else:
        filtro_dim = f"AND PCPRODUT.CODSEC = {dim_id}"

    # Filtro de acesso — aplicado DENTRO do BASE_META (igual à DN)
    filtro_base = ""
    if filtro_vendedor:
        filtro_base = f"AND PCNFSAID.CODUSUR = {filtro_vendedor}"
    elif filtro_supervisor:
        filtro_base = (
            f"AND NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR) = {filtro_supervisor}"
        )

    # Para mudança de base: vendedor que filtrou (para comparar com CODUSUR1)
    cod_referencia = filtro_vendedor or 0

    sql = f"""
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM'),-3)  AS DT_INI,
        LAST_DAY(ADD_MONTHS(TO_DATE('{dr}','YYYY-MM-DD'),-1))    AS DT_FIM,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM')                 AS DT_MES_INI,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'))                      AS DT_HOJE,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'DAY')                AS DT_SEMANA_INI,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD')) - 1                  AS DT_ONTEM
    FROM DUAL
),

-- Clientes que aquele vendedor/supervisor atendeu no período da meta
BASE_META AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL      = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD      = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR      = PCNFSAID.CODUSUR
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI       = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_INI AND P.DT_FIM
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_INI AND P.DT_FIM
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {filtro_dim}
      {filtro_base}
),

-- Faturado esse mês (sem filtro de vendedor — verifica se comprou de qualquer um)
FAT_MES AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL      = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD      = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR      = PCNFSAID.CODUSUR
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI       = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {filtro_dim}
),

-- Carteira essa semana (sem filtro de vendedor)
CART_SEM AS (
    SELECT DISTINCT PCPEDC.CODCLI
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA       BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO    <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
      AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
      {filtro_dim}
),

-- Última compra do cliente no período da meta
ULTIMA_COMPRA AS (
    SELECT CODCLI, DT_ULTIMA_COMPRA, VL_ULTIMA_COMPRA
    FROM (
        SELECT
            PCMOV.CODCLI,
            PCNFSAID.DTSAIDA   AS DT_ULTIMA_COMPRA,
            PCNFSAID.VLTOTAL   AS VL_ULTIMA_COMPRA,
            ROW_NUMBER() OVER (
                PARTITION BY PCMOV.CODCLI
                ORDER BY PCNFSAID.DTSAIDA DESC, PCNFSAID.NUMTRANSVENDA DESC
            ) AS RN
        FROM PCNFSAID
            INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                                   AND PCMOV.CODFILIAL      = PCNFSAID.CODFILIAL
            LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
            INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD      = PCMOV.CODPROD
            CROSS JOIN PARAMS P
        WHERE PCMOV.DTMOV       BETWEEN P.DT_INI AND P.DT_FIM
          AND PCNFSAID.DTSAIDA  BETWEEN P.DT_INI AND P.DT_FIM
          AND PCMOV.CODFILIAL    IN ('{FILIAL}')
          AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
          AND PCMOV.CODOPER      NOT IN ('SR','SO')
          AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
          AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
          AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
          AND PCNFSAID.DTCANCEL   IS NULL
          {filtro_dim}
    ) WHERE RN = 1
)

SELECT
    B.CODCLI                                                        AS cod_cliente,
    C.CLIENTE                                                       AS razao_social,
    C.FANTASIA                                                      AS nome_fantasia,
    C.CODUSUR1                                                      AS cod_vendedor,
    U1.NOME                                                         AS nome_vendedor,
    U1.CODSUPERVISOR                                                AS cod_supervisor,
    CASE WHEN {cod_referencia} > 0
              AND NVL(C.CODUSUR1, -1) <> {cod_referencia}
         THEN 1 ELSE 0 END                                          AS mudanca_base,
    UC.DT_ULTIMA_COMPRA                                                 AS dt_ultima_compra,
    UC.VL_ULTIMA_COMPRA                                                 AS vl_ultima_compra,
    CASE WHEN FM.CODCLI IS NOT NULL THEN 1 ELSE 0 END               AS pos_faturado,
    CASE WHEN CS.CODCLI IS NOT NULL THEN 1 ELSE 0 END               AS pos_nao_faturado
FROM BASE_META B
    INNER JOIN PCCLIENT  C  ON C.CODCLI   = B.CODCLI
    LEFT  JOIN PCUSUARI  U1 ON U1.CODUSUR = C.CODUSUR1
    LEFT  JOIN ULTIMA_COMPRA UC ON UC.CODCLI  = B.CODCLI
    LEFT  JOIN FAT_MES   FM ON FM.CODCLI  = B.CODCLI
    LEFT  JOIN CART_SEM  CS ON CS.CODCLI  = B.CODCLI
ORDER BY U1.CODSUPERVISOR, C.CODUSUR1, C.CLIENTE
"""
    return sql, []


def build_fornecedores_sql() -> tuple:
    sql = f"""
        SELECT DISTINCT
            PCPRODUT.CODFORNEC  AS id,
            PCFORNEC.FORNECEDOR AS nome
        FROM PCNFSAID
            INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                                AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
            INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
            INNER JOIN PCFORNEC ON PCFORNEC.CODFORNEC   = PCPRODUT.CODFORNEC
        WHERE PCNFSAID.CODFILIAL IN ('{FILIAL}')
          AND PCMOV.CODFILIAL    IN ('{FILIAL}')
          AND PCMOV.DTMOV        >= SYSDATE - 90
          AND PCMOV.CODOPER      NOT IN ('SR','SO')
          AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
          AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
          AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
          AND PCNFSAID.DTCANCEL   IS NULL
        ORDER BY PCFORNEC.FORNECEDOR
    """
    return sql, []


def build_secoes_sql() -> tuple:
    sql = f"""
        SELECT DISTINCT
            PCPRODUT.CODSEC   AS id,
            PCSECAO.DESCRICAO AS nome
        FROM PCNFSAID
            INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                                AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
            INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
            INNER JOIN PCSECAO  ON PCSECAO.CODSEC       = PCPRODUT.CODSEC
        WHERE PCNFSAID.CODFILIAL IN ('{FILIAL}')
          AND PCMOV.CODFILIAL    IN ('{FILIAL}')
          AND PCMOV.DTMOV        >= SYSDATE - 90
          AND PCMOV.CODOPER      NOT IN ('SR','SO')
          AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
          AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
          AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
          AND PCNFSAID.DTCANCEL   IS NULL
        ORDER BY PCSECAO.DESCRICAO
    """
    return sql, []


def build_lista_negra_vendedor_sql(
    agrupamento: str = "fornecedor",
    dim_id: Optional[int] = None,
    date_ref: Optional[str] = None,
    cod_vendedor: Optional[int] = None,
) -> tuple:
    """
    SQL específico para o endpoint de vendedor.
    Baseado exatamente no SQL da rotina 1464, filtrando por
    fornecedor/seção e RCA (PCNFSAID.CODUSUR).
    """
    from database import parse_data
    dr = date_ref or parse_data(None)

    if agrupamento == "fornecedor":
        filtro_dim = f"AND PCPRODUT.CODFORNEC = {dim_id}"
    else:
        filtro_dim = f"AND PCPRODUT.CODSEC = {dim_id}"

    filtro_rca = f"AND PCNFSAID.CODUSUR = {cod_vendedor}" if cod_vendedor else ""

    # mudanca_base: CODUSUR1 atual != vendedor que vendeu
    cod_ref = cod_vendedor or 0

    sql = f"""
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM'),-3)  AS DT_INI,
        LAST_DAY(ADD_MONTHS(TO_DATE('{dr}','YYYY-MM-DD'),-1))    AS DT_FIM,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM')                 AS DT_MES_INI,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'))                      AS DT_HOJE,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'DAY')                AS DT_SEMANA_INI,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD')) - 1                  AS DT_ONTEM
    FROM DUAL
),

-- Clientes do período da meta filtrados pelo RCA e fornecedor/seção
-- Estrutura de joins baseada no SQL da rotina 1464
BASE_META AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL      = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD      = PCMOV.CODPROD
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI       = PCMOV.CODCLI
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR      = PCNFSAID.CODUSUR
        INNER JOIN PCSUPERV    ON PCSUPERV.CODSUPERVISOR =
                                      NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR)
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_INI AND P.DT_FIM
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_INI AND P.DT_FIM
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {filtro_dim}
      {filtro_rca}
),

-- Faturado esse mês (qualquer vendedor, mesmo fornecedor/seção)
FAT_MES AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL      = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD      = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR      = PCNFSAID.CODUSUR
        INNER JOIN PCSUPERV    ON PCSUPERV.CODSUPERVISOR =
                                      NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR)
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {filtro_dim}
),

-- Última compra do cliente no período da meta (data + valor total da NFSELECT
    B.CODCLI                                                        AS cod_cliente,
    C.CLIENTE                                                       AS razao_social,
    C.FANTASIA                                                      AS nome_fantasia,
    C.CODUSUR1                                                      AS cod_vendedor,
    U1.NOME                                                         AS nome_vendedor,
    U1.CODSUPERVISOR                                                AS cod_supervisor,
    CASE WHEN {cod_ref} > 0
              AND NVL(C.CODUSUR1, -1) <> {cod_ref}
         THEN 1 ELSE 0 END                                          AS mudanca_base,
    CASE WHEN FM.CODCLI IS NOT NULL THEN 1 ELSE 0 END               AS pos_faturado,
    CASE WHEN CS.CODCLI IS NOT NULL THEN 1 ELSE 0 END               AS pos_nao_faturado
FROM BASE_META B
    INNER JOIN PCCLIENT  C  ON C.CODCLI   = B.CODCLI
    LEFT  JOIN PCUSUARI  U1 ON U1.CODUSUR = C.CODUSUR1
    LEFT  JOIN FAT_MES   FM ON FM.CODCLI  = B.CODCLI
    LEFT  JOIN CART_SEM  CS ON CS.CODCLI  = B.CODCLI
ORDER BY C.CODUSUR1, C.CLIENTE
"""
    return sql, []