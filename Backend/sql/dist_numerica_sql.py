"""
SQL da Distribuicao Numerica.

Agrupamentos disponíveis:
  por_fornecedor — agrupa por CODFORNEC (fornecedor)
  por_secao      — agrupa por CODSEC (seção)

Templates:
  BASE_DN_SQL       — linhas por vendedor × (fornecedor|seção)
  BASE_DN_SQL_GER   — COUNT DISTINCT direto por (fornecedor|seção) — sem dupla contagem

build_dn_query(modo, filtro_id, date_ref, agrupamento)
  agrupamento: 'fornecedor' (padrão) | 'secao'
"""
from typing import Optional
from config import FILIAL, FORNEC_ATIVOS_2M, SECAO_ATIVOS_2M
from models.exclusoes import sql_not_in_fornec, sql_not_in_secao, sql_prod_excluido

# ─────────────────────────────────────────────────────────────────────────────
# Janela de "cliente ativo"/meta: 3 meses fechados, exceto pra fornecedor/
# seções com regra comercial própria (config.FORNEC_ATIVOS_2M / SECAO_ATIVOS_2M),
# que usam 2 meses — decidido por produto (PCPRODUT), então funciona igual
# nos agrupamentos por fornecedor e por seção.
# ─────────────────────────────────────────────────────────────────────────────
_COND_ATIVOS_2M = (
    f"PCPRODUT.CODFORNEC IN ({','.join(str(x) for x in FORNEC_ATIVOS_2M) or 'NULL'}) "
    f"OR PCPRODUT.CODSEC IN ({','.join(str(x) for x in SECAO_ATIVOS_2M) or 'NULL'})"
)
_DT_INI_ATIVOS = f"CASE WHEN {_COND_ATIVOS_2M} THEN P.DT_INI_2M ELSE P.DT_INI END"

# ─────────────────────────────────────────────────────────────────────────────
# Bloco PARAMS (igual nos dois templates)
# ─────────────────────────────────────────────────────────────────────────────
_PARAMS = """
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE('{DATE_REF}','YYYY-MM-DD'),'MM'),-3)  AS DT_INI,
        ADD_MONTHS(TRUNC(TO_DATE('{DATE_REF}','YYYY-MM-DD'),'MM'),-2)  AS DT_INI_2M,
        LAST_DAY(ADD_MONTHS(TO_DATE('{DATE_REF}','YYYY-MM-DD'),-1))    AS DT_FIM,
        TRUNC(TO_DATE('{DATE_REF}','YYYY-MM-DD'),'MM')                 AS DT_MES_INI,
        TRUNC(TO_DATE('{DATE_REF}','YYYY-MM-DD'))                      AS DT_HOJE,
        TRUNC(TO_DATE('{DATE_REF}','YYYY-MM-DD'),'DAY')               AS DT_SEMANA_INI,
        TRUNC(TO_DATE('{DATE_REF}','YYYY-MM-DD')) - 1                  AS DT_ONTEM
    FROM DUAL
),"""

# ─────────────────────────────────────────────────────────────────────────────
# Helpers: retornam a parte que varia entre fornecedor e seção
# ─────────────────────────────────────────────────────────────────────────────
def _dim(agrupamento):
    """Retorna (col_id, col_nome, join_extra, group_extra) para cada agrupamento."""
    if agrupamento == "secao":
        return (
            "PCPRODUT.CODSEC",
            "PCSECAO.DESCRICAO AS NOME_SECAO",
            "INNER JOIN PCSECAO ON PCSECAO.CODSEC = PCPRODUT.CODSEC",
            "PCPRODUT.CODSEC, PCSECAO.DESCRICAO",
        )
    else:  # fornecedor
        return (
            "PCPRODUT.CODFORNEC",
            "NVL(NULLIF(TRIM(PCFORNEC.FANTASIA), ''), PCFORNEC.FORNECEDOR) AS NOME_FORNECEDOR",
            "INNER JOIN PCFORNEC ON PCFORNEC.CODFORNEC = PCPRODUT.CODFORNEC",
            "PCPRODUT.CODFORNEC, PCFORNEC.FORNECEDOR, PCFORNEC.FANTASIA",
        )


def _col_id(agrupamento):
    return "codsec" if agrupamento == "secao" else "codfornec"

def _col_nome(agrupamento):
    return "nome_secao" if agrupamento == "secao" else "nome_fornecedor"


# ─────────────────────────────────────────────────────────────────────────────
# Template por linhas (vendedor × dim)
# ─────────────────────────────────────────────────────────────────────────────
def _base_dn_sql(agrupamento="fornecedor"):
    col_id, col_nome_expr, join_dim, group_dim = _dim(agrupamento)
    col_id_pr = col_id.replace("PCPRODUT", "PR")
    return (_PARAMS + f"""
QT_CLI_META AS (
    SELECT
        PCNFSAID.CODUSUR                                               AS COD_VENDEDOR,
        NVL(PCNFSAID.CODSUPERVISOR,
            PCSUPERV.CODSUPERVISOR)                                    AS COD_SUPERVISOR,
        {col_id}                                                       AS DIM_ID,
        {col_nome_expr},
        COUNT(DISTINCT PCMOV.CODCLI)                                   AS QT_CLI_META
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        {join_dim}
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR     = PCNFSAID.CODUSUR
        INNER JOIN PCSUPERV    ON PCSUPERV.CODSUPERVISOR =
                                      NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR)
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI      = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV      BETWEEN {_DT_INI_ATIVOS} AND P.DT_FIM
      AND PCNFSAID.DTSAIDA BETWEEN {_DT_INI_ATIVOS} AND P.DT_FIM
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {{excl_usur}}
      {{filtro_meta}}
    GROUP BY
        PCNFSAID.CODUSUR,
        NVL(PCNFSAID.CODSUPERVISOR, PCSUPERV.CODSUPERVISOR),
        {group_dim}
),
QT_CLI_MES AS (
    SELECT
        PCNFSAID.CODUSUR                                               AS COD_VENDEDOR,
        NVL(PCNFSAID.CODSUPERVISOR,
            PCSUPERV.CODSUPERVISOR)                                    AS COD_SUPERVISOR,
        {col_id}                                                       AS DIM_ID,
        COUNT(DISTINCT PCMOV.CODCLI)                                   AS QT_CLI_MES
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR     = PCNFSAID.CODUSUR
        INNER JOIN PCSUPERV    ON PCSUPERV.CODSUPERVISOR =
                                      NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR)
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI      = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV      BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCNFSAID.DTSAIDA BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {{excl_usur}}
      {{filtro_mes}}
    GROUP BY
        PCNFSAID.CODUSUR,
        NVL(PCNFSAID.CODSUPERVISOR, PCSUPERV.CODSUPERVISOR),
        {col_id}
),
NAO_FAT_SEMANA AS (
    SELECT
        PCUSUARI.CODUSUR    AS COD_VENDEDOR,
        {col_id}            AS DIM_ID,
        COUNT(DISTINCT PCPEDC.CODCLI) AS QT_CLI_NAO_FAT_SEMANA
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA        BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO     <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
      AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
      {{excl_usur}}
      {{filtro_nao_fat_semana}}
      AND NOT EXISTS (
          SELECT 1 FROM PCNFSAID NS
              INNER JOIN PCMOV     MV ON MV.NUMTRANSVENDA = NS.NUMTRANSVENDA
                                     AND MV.CODFILIAL     = NS.CODFILIAL
              INNER JOIN PCPRODUT  PR ON PR.CODPROD        = MV.CODPROD
              CROSS JOIN PARAMS    P2
          WHERE MV.DTMOV      BETWEEN P2.DT_MES_INI AND P2.DT_HOJE
            AND NS.DTSAIDA    BETWEEN P2.DT_MES_INI AND P2.DT_HOJE
            AND MV.CODFILIAL   IN ('{FILIAL}')
            AND NS.CODFILIAL   IN ('{FILIAL}')
            AND MV.CODOPER    NOT IN ('SR','SO')
            AND NVL(NS.TIPOVENDA,'X') NOT IN ('SR','DF')
            AND NS.CODFISCAL  NOT IN (522,622,722,532,632,732)
            AND NS.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
            AND NS.DTCANCEL    IS NULL
            AND MV.CODCLI      = PCPEDC.CODCLI
            AND NS.CODUSUR     = PCPEDC.CODUSUR
            AND {col_id_pr}    = {col_id}
      )
    GROUP BY PCUSUARI.CODUSUR, {col_id}
    HAVING COUNT(DISTINCT PCPEDC.CODCLI) > 0
),
NAO_FAT_HOJE AS (
    SELECT
        PCUSUARI.CODUSUR    AS COD_VENDEDOR,
        {col_id}            AS DIM_ID,
        COUNT(DISTINCT PCPEDC.CODCLI) AS QT_CLI_NAO_FAT_HOJE
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA      = P.DT_HOJE
      AND PCPEDC.CODFILIAL IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO   <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL  IS NULL
      AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
      {{excl_usur}}
      {{filtro_nao_fat_hoje}}
    GROUP BY PCUSUARI.CODUSUR, {col_id}
    HAVING COUNT(DISTINCT PCPEDC.CODCLI) > 0
),
FAT_HOJE AS (
    SELECT
        PCNFSAID.CODUSUR                                               AS COD_VENDEDOR,
        NVL(PCNFSAID.CODSUPERVISOR,
            PCSUPERV.CODSUPERVISOR)                                    AS COD_SUPERVISOR,
        {col_id}                                                       AS DIM_ID,
        COUNT(DISTINCT PCMOV.CODCLI)                                   AS QT_CLI_FAT_HOJE
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR     = PCNFSAID.CODUSUR
        INNER JOIN PCSUPERV    ON PCSUPERV.CODSUPERVISOR =
                                      NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR)
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI      = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV      = P.DT_HOJE
      AND PCNFSAID.DTSAIDA = P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {{excl_usur}}
      {{filtro_fat_hoje}}
    GROUP BY
        PCNFSAID.CODUSUR,
        NVL(PCNFSAID.CODSUPERVISOR, PCSUPERV.CODSUPERVISOR),
        {col_id}
)
{{select_final}}
""").replace("{FILIAL}", FILIAL)


# ─────────────────────────────────────────────────────────────────────────────
# Template gerencial (COUNT DISTINCT direto, sem dupla contagem)
# ─────────────────────────────────────────────────────────────────────────────
def _base_dn_sql_ger(agrupamento="fornecedor"):
    col_id, col_nome_expr, join_dim, group_dim = _dim(agrupamento)
    col_id_pr = col_id.replace("PCPRODUT", "PR")
    dim_nome_col = "NOME_SECAO" if agrupamento == "secao" else "NOME_FORNECEDOR"
    _xf = sql_not_in_fornec("PCPRODUT.CODFORNEC") + sql_not_in_secao("PCPRODUT.CODSEC")
    _xf_pr = sql_not_in_fornec("PR.CODFORNEC") + sql_not_in_secao("PR.CODSEC")
    return (_PARAMS + f"""
QT_CLI_META AS (
    SELECT {col_id} AS DIM_ID, {col_nome_expr},
           COUNT(DISTINCT PCMOV.CODCLI) AS QT_CLI_META
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        {join_dim}
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR     = PCNFSAID.CODUSUR
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI      = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV      BETWEEN {_DT_INI_ATIVOS} AND P.DT_FIM
      AND PCNFSAID.DTSAIDA BETWEEN {_DT_INI_ATIVOS} AND P.DT_FIM
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {_xf}
    GROUP BY {group_dim}
),
QT_CLI_MES AS (
    SELECT {col_id} AS DIM_ID, COUNT(DISTINCT PCMOV.CODCLI) AS QT_CLI_MES
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR     = PCNFSAID.CODUSUR
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI      = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV      BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCNFSAID.DTSAIDA BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {_xf}
    GROUP BY {col_id}
),
NAO_FAT_SEMANA AS (
    SELECT {col_id} AS DIM_ID, COUNT(DISTINCT PCPEDC.CODCLI) AS QT_CLI_NAO_FAT_SEMANA
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA        BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO     <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
      {_xf}
      AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
      AND NOT EXISTS (
          SELECT 1 FROM PCNFSAID NS
              INNER JOIN PCMOV    MV ON MV.NUMTRANSVENDA = NS.NUMTRANSVENDA
                                    AND MV.CODFILIAL     = NS.CODFILIAL
              INNER JOIN PCPRODUT PR ON PR.CODPROD        = MV.CODPROD
              CROSS JOIN PARAMS   P2
          WHERE MV.DTMOV      BETWEEN P2.DT_MES_INI AND P2.DT_HOJE
            AND NS.DTSAIDA    BETWEEN P2.DT_MES_INI AND P2.DT_HOJE
            AND MV.CODFILIAL   IN ('{FILIAL}')
            AND NS.CODFILIAL   IN ('{FILIAL}')
            AND MV.CODOPER    NOT IN ('SR','SO')
            AND NVL(NS.TIPOVENDA,'X') NOT IN ('SR','DF')
            AND NS.CODFISCAL  NOT IN (522,622,722,532,632,732)
            AND NS.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
            AND NS.DTCANCEL    IS NULL
              {_xf_pr}
            AND MV.CODCLI      = PCPEDC.CODCLI
            AND {col_id_pr}    = {col_id}
      )
    GROUP BY {col_id}
    HAVING COUNT(DISTINCT PCPEDC.CODCLI) > 0
),
NAO_FAT_HOJE AS (
    SELECT {col_id} AS DIM_ID, COUNT(DISTINCT PCPEDC.CODCLI) AS QT_CLI_NAO_FAT_HOJE
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA      = P.DT_HOJE
      AND PCPEDC.CODFILIAL IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO   <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL  IS NULL
      AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
    GROUP BY {col_id}
    HAVING COUNT(DISTINCT PCPEDC.CODCLI) > 0
),
FAT_HOJE AS (
    SELECT {col_id} AS DIM_ID, COUNT(DISTINCT PCMOV.CODCLI) AS QT_CLI_FAT_HOJE
    FROM PCNFSAID
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSVENDA  = PCNFSAID.NUMTRANSVENDA
                               AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        INNER JOIN PCUSUARI    ON PCUSUARI.CODUSUR     = PCNFSAID.CODUSUR
        INNER JOIN PCCLIENT    ON PCCLIENT.CODCLI      = PCMOV.CODCLI
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV      = P.DT_HOJE
      AND PCNFSAID.DTSAIDA = P.DT_HOJE
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      {_xf}
    GROUP BY {col_id}
)
SELECT
    M.DIM_ID, M.{dim_nome_col},
    M.QT_CLI_META,
    NVL(A.QT_CLI_MES, 0)                                             AS QT_CLI_MES,
    NVL(N.QT_CLI_NAO_FAT_SEMANA, 0)                                  AS QT_CLI_NAO_FAT_SEMANA,
    NVL(A.QT_CLI_MES, 0) + NVL(N.QT_CLI_NAO_FAT_SEMANA, 0)         AS QT_CLI_REALIZADO,
    ROUND(
        (NVL(A.QT_CLI_MES,0) + NVL(N.QT_CLI_NAO_FAT_SEMANA,0))
        / NULLIF(M.QT_CLI_META,0) * 100
    , 2)                                                              AS PCT_ATING,
    NVL(NH.QT_CLI_NAO_FAT_HOJE, 0)                                   AS QT_CLI_NAO_FAT_HOJE,
    NVL(FH.QT_CLI_FAT_HOJE, 0)                                       AS QT_CLI_FAT_HOJE
FROM QT_CLI_META M
    LEFT JOIN QT_CLI_MES     A  ON A.DIM_ID  = M.DIM_ID
    LEFT JOIN NAO_FAT_SEMANA N  ON N.DIM_ID  = M.DIM_ID
    LEFT JOIN NAO_FAT_HOJE   NH ON NH.DIM_ID = M.DIM_ID
    LEFT JOIN FAT_HOJE       FH ON FH.DIM_ID = M.DIM_ID
ORDER BY M.{dim_nome_col}
""").replace("{FILIAL}", FILIAL)


# ─────────────────────────────────────────────────────────────────────────────
# SELECTs finais para o template por linhas
# ─────────────────────────────────────────────────────────────────────────────
def _select_linhas(agrupamento):
    dim_nome_col = "NOME_SECAO" if agrupamento == "secao" else "NOME_FORNECEDOR"
    return f"""
SELECT
    M.COD_VENDEDOR,
    U.NOME                                                        AS NOME_VENDEDOR,
    M.COD_SUPERVISOR,
    S.NOME                                                        AS NOME_SUPERVISOR,
    M.DIM_ID, M.{dim_nome_col},
    M.QT_CLI_META,
    NVL(A.QT_CLI_MES, 0)                                         AS QT_CLI_MES,
    NVL(N.QT_CLI_NAO_FAT_SEMANA, 0)                              AS QT_CLI_NAO_FAT_SEMANA,
    NVL(A.QT_CLI_MES, 0) + NVL(N.QT_CLI_NAO_FAT_SEMANA, 0)     AS QT_CLI_REALIZADO,
    ROUND(
        (NVL(A.QT_CLI_MES,0) + NVL(N.QT_CLI_NAO_FAT_SEMANA,0))
        / NULLIF(M.QT_CLI_META,0) * 100
    , 2)                                                          AS PCT_ATING,
    NVL(NH.QT_CLI_NAO_FAT_HOJE, 0)                               AS QT_CLI_NAO_FAT_HOJE,
    NVL(FH.QT_CLI_FAT_HOJE, 0)                                   AS QT_CLI_FAT_HOJE
FROM QT_CLI_META M
    INNER JOIN PCUSUARI U ON U.CODUSUR       = M.COD_VENDEDOR
    INNER JOIN PCSUPERV S ON S.CODSUPERVISOR = M.COD_SUPERVISOR
    LEFT JOIN QT_CLI_MES     A  ON A.COD_VENDEDOR  = M.COD_VENDEDOR AND A.DIM_ID  = M.DIM_ID
    LEFT JOIN NAO_FAT_SEMANA N  ON N.COD_VENDEDOR  = M.COD_VENDEDOR AND N.DIM_ID  = M.DIM_ID
    LEFT JOIN NAO_FAT_HOJE   NH ON NH.COD_VENDEDOR = M.COD_VENDEDOR AND NH.DIM_ID = M.DIM_ID
    LEFT JOIN FAT_HOJE       FH ON FH.COD_VENDEDOR = M.COD_VENDEDOR AND FH.DIM_ID = M.DIM_ID
ORDER BY M.COD_SUPERVISOR, M.COD_VENDEDOR, M.{dim_nome_col}
"""


def _select_supervisor(agrupamento):
    dim_nome_col = "NOME_SECAO" if agrupamento == "secao" else "NOME_FORNECEDOR"
    return f"""
SELECT
    M.COD_SUPERVISOR, S.NOME AS NOME_SUPERVISOR,
    M.DIM_ID, M.{dim_nome_col},
    SUM(M.QT_CLI_META)                                                           AS QT_CLI_META,
    SUM(NVL(A.QT_CLI_MES, 0))                                                    AS QT_CLI_MES,
    SUM(NVL(N.QT_CLI_NAO_FAT_SEMANA, 0))                                         AS QT_CLI_NAO_FAT_SEMANA,
    SUM(NVL(A.QT_CLI_MES,0)+NVL(N.QT_CLI_NAO_FAT_SEMANA,0))                    AS QT_CLI_REALIZADO,
    ROUND(SUM(NVL(A.QT_CLI_MES,0)+NVL(N.QT_CLI_NAO_FAT_SEMANA,0))
          /NULLIF(SUM(M.QT_CLI_META),0)*100,2)                                   AS PCT_ATING,
    SUM(NVL(NH.QT_CLI_NAO_FAT_HOJE, 0))                                          AS QT_CLI_NAO_FAT_HOJE,
    SUM(NVL(FH.QT_CLI_FAT_HOJE, 0))                                              AS QT_CLI_FAT_HOJE
FROM QT_CLI_META M
    INNER JOIN PCUSUARI U ON U.CODUSUR       = M.COD_VENDEDOR
    INNER JOIN PCSUPERV S ON S.CODSUPERVISOR = M.COD_SUPERVISOR
    LEFT JOIN QT_CLI_MES     A  ON A.COD_VENDEDOR  = M.COD_VENDEDOR AND A.DIM_ID  = M.DIM_ID
    LEFT JOIN NAO_FAT_SEMANA N  ON N.COD_VENDEDOR  = M.COD_VENDEDOR AND N.DIM_ID  = M.DIM_ID
    LEFT JOIN NAO_FAT_HOJE   NH ON NH.COD_VENDEDOR = M.COD_VENDEDOR AND NH.DIM_ID = M.DIM_ID
    LEFT JOIN FAT_HOJE       FH ON FH.COD_VENDEDOR = M.COD_VENDEDOR AND FH.DIM_ID = M.DIM_ID
GROUP BY M.COD_SUPERVISOR, S.NOME, M.DIM_ID, M.{dim_nome_col}
ORDER BY M.{dim_nome_col}
"""


# ─────────────────────────────────────────────────────────────────────────────
# build_dn_query — entrada única
# ─────────────────────────────────────────────────────────────────────────────
def build_dn_query(modo: str, filtro_id: Optional[int] = None,
                   date_ref: Optional[str] = None,
                   agrupamento: str = "fornecedor") -> tuple:
    from database import parse_data
    dr = date_ref or parse_data(None)

    if modo == "gerencial":
        sql = _base_dn_sql_ger(agrupamento).replace("{DATE_REF}", dr)
        return sql, []

    excl = "AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)"
    excl += sql_not_in_fornec("PCPRODUT.CODFORNEC")
    excl += sql_not_in_secao("PCPRODUT.CODSEC")

    if modo == "vendedor" and filtro_id is not None:
        fm   = "AND PCNFSAID.CODUSUR = :p1"
        fms  = "AND PCNFSAID.CODUSUR = :p2"
        fnfs = "AND PCUSUARI.CODUSUR = :p3"
        fnfh = "AND PCUSUARI.CODUSUR = :p4"
        ffh  = "AND PCNFSAID.CODUSUR = :p5"
        params = [filtro_id] * 5
        sel = _select_linhas(agrupamento)
    elif modo in ("equipe", "supervisor") and filtro_id is not None:
        fm   = "AND NVL(PCNFSAID.CODSUPERVISOR,PCSUPERV.CODSUPERVISOR) = :p1"
        fms  = "AND NVL(PCNFSAID.CODSUPERVISOR,PCSUPERV.CODSUPERVISOR) = :p2"
        fnfs = "AND PCUSUARI.CODSUPERVISOR = :p3"
        fnfh = "AND PCUSUARI.CODSUPERVISOR = :p4"
        ffh  = "AND NVL(PCNFSAID.CODSUPERVISOR,PCSUPERV.CODSUPERVISOR) = :p5"
        params = [filtro_id] * 5
        sel = _select_linhas(agrupamento) if modo == "equipe" else _select_supervisor(agrupamento)
    else:  # todos
        fm = fms = fnfs = fnfh = ffh = ""
        params = []
        sel = _select_linhas(agrupamento)

    sql = (_base_dn_sql(agrupamento)
           .replace("{DATE_REF}", dr)
           .format(
               excl_usur=excl,
               filtro_meta=fm,             filtro_mes=fms,
               filtro_nao_fat_semana=fnfs, filtro_nao_fat_hoje=fnfh,
               filtro_fat_hoje=ffh,        select_final=sel,
           ))
    return sql, params


# ─────────────────────────────────────────────────────────────────────────────
# build_dn_total_query — COUNT DISTINCT sem agrupar por dimensão
# Retorna os totais reais (cliente pode aparecer em vários fornecedores)
# ─────────────────────────────────────────────────────────────────────────────
_TOTAL_SQL = f"""
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE('{{dr}}','YYYY-MM-DD'),'MM'),-3)  AS DT_INI,
        ADD_MONTHS(TRUNC(TO_DATE('{{dr}}','YYYY-MM-DD'),'MM'),-2)  AS DT_INI_2M,
        LAST_DAY(ADD_MONTHS(TO_DATE('{{dr}}','YYYY-MM-DD'),-1))    AS DT_FIM,
        TRUNC(TO_DATE('{{dr}}','YYYY-MM-DD'),'MM')                 AS DT_MES_INI,
        TRUNC(TO_DATE('{{dr}}','YYYY-MM-DD'))                      AS DT_HOJE,
        TRUNC(TO_DATE('{{dr}}','YYYY-MM-DD'),'DAY')               AS DT_SEMANA_INI,
        TRUNC(TO_DATE('{{dr}}','YYYY-MM-DD')) - 1                  AS DT_ONTEM
    FROM DUAL
)
SELECT
    (SELECT COUNT(DISTINCT PCMOV.CODCLI)
       FROM PCNFSAID
       INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                          AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
       INNER JOIN PCPRODUT ON PCPRODUT.CODPROD    = PCMOV.CODPROD
       INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR    = PCNFSAID.CODUSUR
       CROSS JOIN PARAMS P
      WHERE PCMOV.DTMOV      BETWEEN {_DT_INI_ATIVOS} AND P.DT_FIM
        AND PCNFSAID.DTSAIDA BETWEEN {_DT_INI_ATIVOS} AND P.DT_FIM
        AND PCMOV.CODFILIAL    IN ('{FILIAL}')
        AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
        AND PCMOV.CODOPER NOT IN ('SR','SO')
        AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
        AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
        AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
        AND PCNFSAID.DTCANCEL   IS NULL
        {{excl_usur}} {{f_meta}}
    ) AS QT_TOTAL_META,
    (SELECT COUNT(DISTINCT PCMOV.CODCLI)
       FROM PCNFSAID
       INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                          AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
       INNER JOIN PCPRODUT ON PCPRODUT.CODPROD    = PCMOV.CODPROD
       INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR    = PCNFSAID.CODUSUR
       CROSS JOIN PARAMS P
      WHERE PCMOV.DTMOV      BETWEEN P.DT_MES_INI AND P.DT_HOJE
        AND PCNFSAID.DTSAIDA BETWEEN P.DT_MES_INI AND P.DT_HOJE
        AND PCMOV.CODFILIAL    IN ('{FILIAL}')
        AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
        AND PCMOV.CODOPER NOT IN ('SR','SO')
        AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
        AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
        AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
        AND PCNFSAID.DTCANCEL   IS NULL
        {{excl_usur}} {{f_mes}}
    ) AS QT_TOTAL_MES,
    (SELECT COUNT(DISTINCT PCPEDC.CODCLI)
       FROM PCPEDI
       INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
       INNER JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
       INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
       CROSS JOIN PARAMS P
      WHERE PCPEDC.DATA      BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM
        AND PCPEDC.CODFILIAL  IN ('{FILIAL}')
        AND PCPEDC.CONDVENDA  IN (1,2,3,7,9,14,15,17,18,19,98)
        AND PCPEDC.POSICAO   <> 'F'
        AND NVL(PCPEDI.BONIFIC,'N') = 'N'
        AND PCPEDC.DTCANCEL   IS NULL
        AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
        {{excl_usur}} {{f_semana}}
        AND NOT EXISTS (
            SELECT 1 FROM PCNFSAID NS
                INNER JOIN PCMOV MV ON MV.NUMTRANSVENDA = NS.NUMTRANSVENDA
                                   AND MV.CODFILIAL     = NS.CODFILIAL
                CROSS JOIN PARAMS P2
             WHERE MV.DTMOV      BETWEEN P2.DT_MES_INI AND P2.DT_HOJE
               AND NS.DTSAIDA    BETWEEN P2.DT_MES_INI AND P2.DT_HOJE
               AND MV.CODFILIAL   IN ('{FILIAL}')
               AND NS.CODFILIAL   IN ('{FILIAL}')
               AND MV.CODOPER    NOT IN ('SR','SO')
               AND NVL(NS.TIPOVENDA,'X') NOT IN ('SR','DF')
               AND NS.CODFISCAL  NOT IN (522,622,722,532,632,732)
               AND NS.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
               AND NS.DTCANCEL    IS NULL
               AND MV.CODCLI      = PCPEDC.CODCLI
               AND NS.CODUSUR     = PCPEDC.CODUSUR
        )
    ) AS QT_TOTAL_SEMANA,
    (SELECT COUNT(DISTINCT PCPEDC.CODCLI)
       FROM PCPEDI
       INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
       INNER JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
       INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR = PCPEDC.CODUSUR
       CROSS JOIN PARAMS P
      WHERE PCPEDC.DATA     = P.DT_HOJE
        AND PCPEDC.CODFILIAL IN ('{FILIAL}')
        AND PCPEDC.CONDVENDA IN (1,2,3,7,9,14,15,17,18,19,98)
        AND PCPEDC.POSICAO  <> 'F'
        AND NVL(PCPEDI.BONIFIC,'N') = 'N'
        AND PCPEDC.DTCANCEL  IS NULL
        AND PCUSUARI.CODSUPERVISOR NOT IN ('9999')
        {{excl_usur}} {{f_hoje}}
    ) AS QT_TOTAL_HOJE
FROM DUAL
""".replace("{FILIAL}", FILIAL)


def build_dn_total_query(modo: str, filtro_id: Optional[int] = None,
                         date_ref: Optional[str] = None) -> tuple:
    """Retorna SQL + params para contagem DISTINTA de clientes (sem agrupar por dim)."""
    from database import parse_data
    dr = date_ref or parse_data(None)

    if modo == "gerencial":
        excl = sql_not_in_fornec("PCPRODUT.CODFORNEC") + sql_not_in_secao("PCPRODUT.CODSEC")
        fm = fms = fnfs = fnfh = ""
        params = []
    else:
        excl = "AND PCUSUARI.CODUSUR NOT IN (2,10,160,180)"
        excl += sql_not_in_fornec("PCPRODUT.CODFORNEC")
        excl += sql_not_in_secao("PCPRODUT.CODSEC")
        if modo == "vendedor" and filtro_id is not None:
            fm   = "AND PCNFSAID.CODUSUR = :p1"
            fms  = "AND PCNFSAID.CODUSUR = :p2"
            fnfs = "AND PCUSUARI.CODUSUR = :p3"
            fnfh = "AND PCUSUARI.CODUSUR = :p4"
            params = [filtro_id] * 4
        elif modo in ("equipe", "supervisor") and filtro_id is not None:
            fm   = "AND NVL(PCNFSAID.CODSUPERVISOR,PCUSUARI.CODSUPERVISOR) = :p1"
            fms  = "AND NVL(PCNFSAID.CODSUPERVISOR,PCUSUARI.CODSUPERVISOR) = :p2"
            fnfs = "AND PCUSUARI.CODSUPERVISOR = :p3"
            fnfh = "AND PCUSUARI.CODSUPERVISOR = :p4"
            params = [filtro_id] * 4
        else:
            fm = fms = fnfs = fnfh = ""
            params = []

    sql = _TOTAL_SQL.format(
        dr=dr, excl_usur=excl,
        f_meta=fm, f_mes=fms, f_semana=fnfs, f_hoje=fnfh
    )
    return sql, params


# ─────────────────────────────────────────────────────────────────────────────
# Clientes CADASTRADOS por vendedor — contagem de CADASTRO (PCCLIENT.CODUSUR1),
# não de atividade/compra como o resto da DN. Sem filtro de data (é o cadastro
# atual, não algo apurado num período) e sem depender de venda nenhuma — por
# isso é uma query única e simples, bem diferente das outras deste módulo.
# Exclui contas especiais (2,10,160,180 — bonificação/casa), que não são
# vendedor de carteira de verdade. Traz TODO MUNDO de uma vez só (não tem
# modo/filtro_id como build_dn_query) — o filtro por supervisor/vendedor é
# feito depois, em Python (no router) ou no frontend, igual já é feito com
# a lista de vendedores/supervisores de build_dn_query("todos").
# ─────────────────────────────────────────────────────────────────────────────
def build_clientes_cadastrados_sql(date_ref: Optional[str] = None) -> tuple:
    """
    1 linha por vendedor: cod_vendedor, nome_vendedor, cod_supervisor,
    nome_supervisor, qt_clientes_cadastrados, qt_clientes_atendidos_3m.

    qt_clientes_cadastrados: COUNT(*) FROM PCCLIENT WHERE CODUSUR1 = vendedor
        — cadastro puro, sem depender de compra nenhuma.

    qt_clientes_atendidos_3m: dos cadastrados desse vendedor, quantos
        compraram QUALQUER produto (de qualquer fornecedor) nos últimos 3
        meses FECHADOS — mesma janela de "cliente ativo"/meta usada no
        resto do app (2 meses pra fornecedor/seção de config.
        FORNEC_ATIVOS_2M/SECAO_ATIVOS_2M, 3 pros demais — ver _DT_INI_ATIVOS
        acima) e os mesmos filtros fiscais/CONDVENDA da rotina 1464. É a
        MESMA BASE que a coluna META da DN usa — só que aqui somada em
        TODOS os fornecedores de uma vez (a DN mostra a meta separada por
        fornecedor; aqui é o total do vendedor, pra comparar lado a lado
        com o cadastro: "de X clientes cadastrados, Y foram atendidos nos
        últimos 3 meses").
    """
    from database import parse_data
    dr = date_ref or parse_data(None)
    params = {"dr": dr}

    cond_2m = (
        f"PR.CODFORNEC IN ({','.join(str(x) for x in FORNEC_ATIVOS_2M) or 'NULL'}) "
        f"OR PR.CODSEC IN ({','.join(str(x) for x in SECAO_ATIVOS_2M) or 'NULL'})"
    )

    sql = f"""
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE(:dr,'YYYY-MM-DD'),'MM'),-3) AS DT_INI,
        ADD_MONTHS(TRUNC(TO_DATE(:dr,'YYYY-MM-DD'),'MM'),-2) AS DT_INI_2M,
        LAST_DAY(ADD_MONTHS(TO_DATE(:dr,'YYYY-MM-DD'),-1))   AS DT_FIM
    FROM DUAL
),
CADASTRO AS (
    SELECT
        C.CODUSUR1        AS COD_VENDEDOR,
        U.NOME            AS NOME_VENDEDOR,
        U.CODSUPERVISOR   AS COD_SUPERVISOR,
        S.NOME            AS NOME_SUPERVISOR,
        COUNT(*)          AS QT_CLIENTES_CADASTRADOS
    FROM PCCLIENT C
        INNER JOIN PCUSUARI U ON U.CODUSUR       = C.CODUSUR1
        LEFT  JOIN PCSUPERV S ON S.CODSUPERVISOR = U.CODSUPERVISOR
    WHERE C.CODUSUR1 NOT IN (2,10,160,180)
    GROUP BY C.CODUSUR1, U.NOME, U.CODSUPERVISOR, S.NOME
),
ATENDIDOS AS (
    SELECT
        C.CODUSUR1               AS COD_VENDEDOR,
        COUNT(DISTINCT C.CODCLI) AS QT_CLIENTES_ATENDIDOS_3M
    FROM PCCLIENT C
        INNER JOIN PCMOV     M  ON M.CODCLI        = C.CODCLI
        INNER JOIN PCNFSAID  N  ON N.NUMTRANSVENDA  = M.NUMTRANSVENDA AND N.CODFILIAL = M.CODFILIAL
        INNER JOIN PCPRODUT  PR ON PR.CODPROD       = M.CODPROD
        CROSS JOIN PARAMS P
    WHERE C.CODUSUR1 NOT IN (2,10,160,180)
      AND N.CODFILIAL IN ('{FILIAL}') AND M.CODFILIAL IN ('{FILIAL}')
      AND M.CODOPER NOT IN ('SR','SO')
      AND NVL(N.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND N.CODFISCAL NOT IN (522,622,722,532,632,732)
      AND N.CONDVENDA NOT IN (4,8,10,13,20,98,99)
      AND N.DTCANCEL IS NULL
      AND N.DTSAIDA BETWEEN (CASE WHEN {cond_2m} THEN P.DT_INI_2M ELSE P.DT_INI END) AND P.DT_FIM
      AND M.DTMOV   BETWEEN (CASE WHEN {cond_2m} THEN P.DT_INI_2M ELSE P.DT_INI END) AND P.DT_FIM
    GROUP BY C.CODUSUR1
)
SELECT
    CA.COD_VENDEDOR, CA.NOME_VENDEDOR, CA.COD_SUPERVISOR, CA.NOME_SUPERVISOR,
    CA.QT_CLIENTES_CADASTRADOS,
    NVL(AT.QT_CLIENTES_ATENDIDOS_3M, 0) AS QT_CLIENTES_ATENDIDOS_3M
FROM CADASTRO CA
    LEFT JOIN ATENDIDOS AT ON AT.COD_VENDEDOR = CA.COD_VENDEDOR
ORDER BY CA.NOME_SUPERVISOR, CA.NOME_VENDEDOR
"""
    return sql, params