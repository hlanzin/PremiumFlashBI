"""
Campanha Fini — fornecedor 1488.
Visualização por CLIENTE, com a lógica do Faturamento (1464 + carteira 322),
mas filtrada apenas pelas vendas do fornecedor Fini.

Meta = (faturado dos 3 meses anteriores / 3) * 1.20  — recalcula sozinha.

Colunas por cliente:
  - meta_cliente          : média trimestral +20%
  - faturado_mes          : faturado real do mês (1464), dia 1 até a data ref
  - cart_semana           : pedidos não faturados domingo→ontem (322 normal)
  - realizado_mes_atual   : faturado_mes + cart_semana
  - realizado_dia         : pedidos não faturados de hoje (322)
  - pct_meta, resta, etc.
"""
from typing import Optional
from config import FILIAL

COD_FORNEC_FINI = 1488

# Condições de venda normais (exclui troca 5/11, bonificação, etc.)
CONDVENDA_NORMAIS = "1,2,3,7,9,14,15,17,18,19,98"

# Contas RCA que só enviam bonificação (tipo de venda 5) — não são venda real.
RCA_BONIFICACAO = "2, 160, 180, 10"


def build_campanha_fini_sql(modo: str = "todos",
                            filtro_id: Optional[int] = None,
                            date_ref: Optional[str] = None) -> tuple:
    """
    modo      : 'todos' | 'vendedor' | 'supervisor'
    filtro_id : CODUSUR (vendedor) ou CODSUPERVISOR conforme o modo
    date_ref  : 'YYYY-MM-DD' (padrão hoje)
    Retorna (sql, params_dict)
    """
    from database import parse_data
    from datetime import date, timedelta

    dr = date_ref or parse_data(None)
    dr_date = date.fromisoformat(dr)

    # Carteira da semana: do último domingo até ontem
    dias_ate_dom = (dr_date.weekday() + 1) % 7
    ultimo_dom   = dr_date - timedelta(days=dias_ate_dom)
    mes_ini      = dr_date.replace(day=1)
    sem_ini      = max(mes_ini, ultimo_dom)
    sem_fim      = dr_date - timedelta(days=1)

    params = {
        "sem_ini":  sem_ini.strftime("%Y-%m-%d"),
        "sem_fim":  sem_fim.strftime("%Y-%m-%d"),
    }

    # Filtro por cargo
    if modo == "vendedor" and filtro_id is not None:
        params["filtro"] = filtro_id
        filtro_fat = "AND PCNFSAID.CODUSUR = :filtro"
        filtro_car = "AND PCPEDC.CODUSUR = :filtro"
        filtro_met = "AND PCPEDC.CODUSUR = :filtro"
    elif modo == "supervisor" and filtro_id is not None:
        params["filtro"] = filtro_id
        filtro_fat = "AND NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR) = :filtro"
        filtro_car = "AND PCPEDC.CODSUPERVISOR = :filtro"
        filtro_met = "AND PCPEDC.CODSUPERVISOR = :filtro"
    else:
        filtro_fat = filtro_car = filtro_met = ""

    sql = f"""
WITH PARAMS AS (
    SELECT
        TO_DATE('{dr}','YYYY-MM-DD')                              AS DT_HOJE,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM')                  AS DT_MES_INI,
        ADD_MONTHS(TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM'),-3)   AS DT_HIST_INI,
        TRUNC(TO_DATE('{dr}','YYYY-MM-DD'),'MM') - 1              AS DT_HIST_FIM
    FROM DUAL
),
-- ── Meta: faturado dos 3 meses anteriores (pedidos Fini, venda normal) ────────
META AS (
    SELECT
        PCPEDC.CODCLI,
        ROUND(SUM(NVL(PCPEDI.QT,0) * (NVL(PCPEDI.PVENDA,0)
            + NVL(PCPEDI.VLOUTRASDESP,0) + NVL(PCPEDI.VLFRETE,0))) / 3 * 1.20, 2) AS META
    FROM PCPEDI, PCPEDC, PCPRODUT, PARAMS P
    WHERE PCPEDC.NUMPED      = PCPEDI.NUMPED
      AND PCPEDI.CODPROD     = PCPRODUT.CODPROD
      AND PCPRODUT.CODFORNEC = {COD_FORNEC_FINI}
      AND PCPEDC.DATA        BETWEEN P.DT_HIST_INI AND P.DT_HIST_FIM
      AND PCPEDC.CODFILIAL    IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA    IN ({CONDVENDA_NORMAIS})
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.CODUSUR     NOT IN ({RCA_BONIFICACAO})
      AND PCPEDC.DTCANCEL     IS NULL
      {filtro_met}
    GROUP BY PCPEDC.CODCLI
),
-- ── Faturado do mês (1464) — só itens Fini ───────────────────────────────────
FAT_MES AS (
    SELECT
        PCNFSAID.CODCLI,
        MAX(PCNFSAID.CODUSUR)        AS CODUSUR,
        MAX(NVL(PCNFSAID.CODSUPERVISOR, PCUSUARI.CODSUPERVISOR)) AS CODSUPERVISOR,
        ROUND(SUM(
            DECODE(PCMOV.CODOPER,'S',NVL(PCMOV.QT,0),'ST',NVL(PCMOV.QT,0),'SM',NVL(PCMOV.QT,0),0)
            * (NVL(PCMOV.PUNIT,0) + NVL(PCMOV.VLFRETE,0) + NVL(PCMOV.VLOUTRASDESP,0))
        ), 2) AS VL_FAT
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA AND PCMOV.CODFILIAL = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD    = PCMOV.CODPROD
        INNER JOIN PCUSUARI ON PCUSUARI.CODUSUR    = PCNFSAID.CODUSUR
        CROSS JOIN PARAMS P
    WHERE PCPRODUT.CODFORNEC  = {COD_FORNEC_FINI}
      AND PCNFSAID.DTSAIDA    BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCMOV.DTMOV         BETWEEN P.DT_MES_INI AND P.DT_HOJE
      AND PCNFSAID.CODFILIAL   IN ('{FILIAL}')
      AND PCMOV.CODFILIAL      IN ('{FILIAL}')
      AND PCMOV.CODOPER       NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.CODUSUR    NOT IN ({RCA_BONIFICACAO})
      AND PCNFSAID.DTCANCEL    IS NULL
      {filtro_fat}
    GROUP BY PCNFSAID.CODCLI
),
-- ── Carteira da semana: domingo → ontem (322 normal, Fini) ───────────────────
CART_SEM AS (
    SELECT
        PCPEDC.CODCLI,
        ROUND(SUM(NVL(PCPEDI.QT,0) * (NVL(PCPEDI.PVENDA,0)
            + NVL(PCPEDI.VLOUTRASDESP,0) + NVL(PCPEDI.VLFRETE,0))), 2) AS VL_CART
    FROM PCPEDI, PCPEDC, PCPRODUT
    WHERE PCPEDC.NUMPED      = PCPEDI.NUMPED
      AND PCPEDI.CODPROD     = PCPRODUT.CODPROD
      AND PCPRODUT.CODFORNEC = {COD_FORNEC_FINI}
      AND PCPEDC.DATA        BETWEEN TO_DATE(:sem_ini,'YYYY-MM-DD') AND TO_DATE(:sem_fim,'YYYY-MM-DD')
      AND PCPEDC.CODFILIAL    IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA    IN ({CONDVENDA_NORMAIS})
      AND PCPEDC.POSICAO     <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.CODUSUR     NOT IN ({RCA_BONIFICACAO})
      AND PCPEDC.DTCANCEL     IS NULL
      {filtro_car}
    GROUP BY PCPEDC.CODCLI
),
-- ── Carteira de hoje (322 normal, Fini) ──────────────────────────────────────
CART_HOJE AS (
    SELECT
        PCPEDC.CODCLI,
        ROUND(SUM(NVL(PCPEDI.QT,0) * (NVL(PCPEDI.PVENDA,0)
            + NVL(PCPEDI.VLOUTRASDESP,0) + NVL(PCPEDI.VLFRETE,0))), 2) AS VL_HOJE
    FROM PCPEDI, PCPEDC, PCPRODUT, PARAMS P
    WHERE PCPEDC.NUMPED      = PCPEDI.NUMPED
      AND PCPEDI.CODPROD     = PCPRODUT.CODPROD
      AND PCPRODUT.CODFORNEC = {COD_FORNEC_FINI}
      AND PCPEDC.DATA        = P.DT_HOJE
      AND PCPEDC.CODFILIAL    IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA    IN ({CONDVENDA_NORMAIS})
      AND PCPEDC.POSICAO     <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.CODUSUR     NOT IN ({RCA_BONIFICACAO})
      AND PCPEDC.DTCANCEL     IS NULL
      {filtro_car}
    GROUP BY PCPEDC.CODCLI
),
-- ── Universo de clientes: união de quem tem meta, faturado ou carteira ───────
CLIENTES AS (
    SELECT CODCLI FROM META WHERE META > 0
)
SELECT
    CL.CODCLI                                                AS cod_cliente,
    NVL(NULLIF(TRIM(C.FANTASIA),''), C.CLIENTE)             AS nome_cliente,
    C.CLIENTE                                               AS razao_social,
    NVL(CD.NOMECIDADE,'—')                                 AS nome_cidade,
    NVL(FM.CODSUPERVISOR, UCLI.CODSUPERVISOR)             AS cod_supervisor,
    SUP.NOME                                                AS nome_supervisor,
    NVL(FM.CODUSUR, C.CODUSUR1)                            AS cod_vendedor,
    U.NOME                                                  AS nome_vendedor,
    NVL(MT.META, 0)                                        AS meta_cliente,
    NVL(FM.VL_FAT, 0)                                      AS faturado_mes,
    NVL(CS.VL_CART, 0)                                     AS cart_semana,
    ROUND(NVL(FM.VL_FAT,0) + NVL(CS.VL_CART,0), 2)        AS realizado_mes_atual,
    NVL(CH.VL_HOJE, 0)                                    AS realizado_dia,
    ROUND(NVL(MT.META,0) - (NVL(FM.VL_FAT,0) + NVL(CS.VL_CART,0)), 2) AS resta_a_fazer,
    CASE WHEN NVL(MT.META,0) > 0
         THEN ROUND((NVL(FM.VL_FAT,0) + NVL(CS.VL_CART,0)) / MT.META * 100, 1)
         ELSE NULL END                                     AS pct_meta
FROM CLIENTES CL
    INNER JOIN PCCLIENT C    ON C.CODCLI          = CL.CODCLI
    LEFT  JOIN META      MT  ON MT.CODCLI         = CL.CODCLI
    LEFT  JOIN FAT_MES   FM  ON FM.CODCLI         = CL.CODCLI
    LEFT  JOIN CART_SEM  CS  ON CS.CODCLI         = CL.CODCLI
    LEFT  JOIN CART_HOJE CH  ON CH.CODCLI         = CL.CODCLI
    LEFT  JOIN PCUSUARI  U    ON U.CODUSUR         = NVL(FM.CODUSUR, C.CODUSUR1)
    LEFT  JOIN PCUSUARI  UCLI ON UCLI.CODUSUR      = C.CODUSUR1
    LEFT  JOIN PCSUPERV  SUP  ON SUP.CODSUPERVISOR = NVL(FM.CODSUPERVISOR, UCLI.CODSUPERVISOR)
    LEFT  JOIN PCCIDADE  CD   ON CD.CODCIDADE      = C.CODCIDADE
ORDER BY SUP.NOME, U.NOME, C.CLIENTE
"""
    return sql, params