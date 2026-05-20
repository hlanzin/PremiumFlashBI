"""
SQL Lista Negra.

Lógica:
  1. BASE_META  — clientes do período da meta (idêntico ao QT_CLI_META gerencial da DN,
                  mas SELECT DISTINCT CODCLI em vez de COUNT)
  2. FAT_MES    — clientes faturados esse mês (idêntico ao QT_CLI_MES gerencial da DN)
  3. CART_SEM   — clientes com carteira essa semana (idêntico ao NAO_FAT_SEMANA gerencial da DN)

Vendor info vem de PCCLIENT.CODUSUR1 — vendedor principal fixo do cliente.
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

    # Filtro de dimensão (mesmo do filtro_meta/filtro_mes da DN)
    if agrupamento == "fornecedor":
        filtro_dim = f"AND PCPRODUT.CODFORNEC = {dim_id}"
    else:
        filtro_dim = f"AND PCPRODUT.CODSEC = {dim_id}"

    # Filtro de acesso via vendedor principal (PCCLIENT.CODUSUR1)
    filtro_acesso = ""
    if filtro_vendedor:
        filtro_acesso = f"AND C.CODUSUR1 = {filtro_vendedor}"
    elif filtro_supervisor:
        filtro_acesso = f"AND U1.CODSUPERVISOR = {filtro_supervisor}"

    # Join PCUSUARI para filtro supervisor (só quando necessário)
    join_usur_acesso = ""
    if filtro_supervisor:
        join_usur_acesso = f"INNER JOIN PCUSUARI U1 ON U1.CODUSUR = C.CODUSUR1"

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

-- PASSO 1: lista de clientes do período da meta
-- Mesmos joins e condições do QT_CLI_META gerencial da DN,
-- apenas SELECT DISTINCT CODCLI em vez de COUNT
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
),

-- PASSO 2: clientes faturados esse mês
-- Idêntico ao QT_CLI_MES gerencial da DN
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

-- PASSO 3: clientes com carteira essa semana
-- Idêntico ao NAO_FAT_SEMANA gerencial da DN
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
)

-- PASSO 4: montar resultado com info do cliente e status
SELECT
    B.CODCLI                                                   AS cod_cliente,
    C.CLIENTE                                                  AS razao_social,
    C.FANTASIA                                                 AS nome_fantasia,
    C.CODUSUR1                                                 AS cod_vendedor,
    U1.NOME                                                    AS nome_vendedor,
    U1.CODSUPERVISOR                                           AS cod_supervisor,
    CASE WHEN FM.CODCLI IS NOT NULL THEN 1 ELSE 0 END          AS pos_faturado,
    CASE WHEN CS.CODCLI IS NOT NULL THEN 1 ELSE 0 END          AS pos_nao_faturado
FROM BASE_META B
    INNER JOIN PCCLIENT C  ON C.CODCLI  = B.CODCLI
    LEFT  JOIN PCUSUARI U1 ON U1.CODUSUR = C.CODUSUR1
    {join_usur_acesso}
    LEFT  JOIN FAT_MES  FM ON FM.CODCLI = B.CODCLI
    LEFT  JOIN CART_SEM CS ON CS.CODCLI = B.CODCLI
WHERE 1=1
    {filtro_acesso}
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