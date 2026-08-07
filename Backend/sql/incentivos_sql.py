"""
Incentivos por venda de produtos.

Cada incentivo tem uma lista de produtos e um valor (R$) por CAIXA FECHADA
vendida, ou por COMBO (cliente que levou todos os produtos). A venda
considera FATURADO (PCNFSAID/PCMOV) - DEVOLUÇÃO (PCNFENT/PCESTCOM, por
quantidade) + CARTEIRA (PCPEDI/PCPEDC não faturado), dentro do período
[dini, dfim] cadastrado pelo admin (models/incentivos.py) — não é mais
preso ao mês corrente. Filtros de CODOPER/CONDVENDA/TIPOVENDA/CODFISCAL do
FAT e da DEVOL calcados na query real da rotina 1464 - Apuração Faturamento
(log de auditoria do Winthor), pra bater exatamente com o oficial.

O SQL de caixas retorna UMA linha por vendedor+produto com a soma de
unidades. A conversão em caixas e o cálculo do prêmio são feitos no
backend (routers/incentivos.py, _apurar_caixas): soma as frações de caixa
(unidades/QTUNITCX) de TODOS os produtos do vendedor primeiro, e só arredonda
pra baixo (FLOOR) UMA VEZ no total — não por produto individual, senão perde
o "resto" de cada produto que juntos formariam mais uma caixa fechada
(confirmado batendo com a rotina 1462 do Winthor).

Uma equipe pode ter lista de produtos PRÓPRIA (override cadastrado em
incentivo_equipe_produtos) — quando isso acontece, o router chama essa
função uma vez por grupo (equipes com override, uma de cada vez; e uma
chamada geral excluindo essas equipes) e junta os resultados em Python.
Aparece SEMPRE por equipe, com TODOS os vendedores de TODAS as equipes
visíveis no ranking (competição amistosa) — independente do cargo de quem
consulta.
"""
from typing import List, Optional
from config import FILIAL

CONDVENDA_NORMAIS = "1,2,3,7,9,14,15,17,18,19,98"
RCA_BONIFICACAO   = "2, 160, 180"


def _filtro_supervisor(apenas_supervisores: Optional[List[int]], excluir_supervisores: Optional[List[int]]) -> str:
    if apenas_supervisores:
        vals = ",".join(str(int(s)) for s in apenas_supervisores)
        return f" AND NVL(UV.CODSUPERVISOR,-1) IN ({vals})"
    if excluir_supervisores:
        vals = ",".join(str(int(s)) for s in excluir_supervisores)
        return f" AND NVL(UV.CODSUPERVISOR,-1) NOT IN ({vals})"
    return ""


def build_incentivo_sql(cod_produtos: List[int], dini: str, dfim: str,
                         apenas_supervisores: Optional[List[int]] = None,
                         excluir_supervisores: Optional[List[int]] = None) -> tuple:
    """
    cod_produtos : lista de CODPROD do incentivo (ou da equipe, se override)
    dini/dfim    : 'YYYY-MM-DD' — período de vigência do incentivo
    apenas_supervisores / excluir_supervisores: mutuamente exclusivos — usados
        pra separar a apuração quando uma equipe tem lista de produto própria
        (ver docstring do módulo)

    Retorna (sql, params_dict). Uma linha por vendedor+produto:
      cod_vendedor, nome_vendedor, cod_supervisor, nome_supervisor,
      cod_produto, descricao, qt_unit_cx, unidades
    """
    prods = ",".join(str(int(p)) for p in cod_produtos)
    params = {"dini": dini, "dfim": dfim}
    filtro_sup = _filtro_supervisor(apenas_supervisores, excluir_supervisores)

    sql = f"""
WITH FAT AS (
    SELECT PCNFSAID.CODUSUR      AS CODUSUR,
           PCMOV.CODPROD         AS CODPROD,
           SUM(NVL(PCMOV.QT,0))  AS UNID
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                           AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
    WHERE PCNFSAID.CODFILIAL  IN ('{FILIAL}')
      AND PCMOV.CODPROD       IN ({prods})
      AND PCNFSAID.DTSAIDA    BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCMOV.CODOPER       NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.CODUSUR    NOT IN ({RCA_BONIFICACAO})
      AND PCNFSAID.CODUSUR    <> 10
      AND PCNFSAID.DTCANCEL   IS NULL
    GROUP BY PCNFSAID.CODUSUR, PCMOV.CODPROD
),
DEVOL AS (
    -- Devolução (NF de entrada) no mesmo período — mesma fonte/filtros do
    -- faturamento oficial (faturamento_sql.py, CTE DEVOLUCOES), só que por
    -- QUANTIDADE em vez de valor, pra descontar das unidades/caixas.
    SELECT PCNFENT.CODUSURDEVOL  AS CODUSUR,
           PCMOV.CODPROD         AS CODPROD,
           SUM(NVL(PCMOV.QT,0))  AS UNID
    FROM PCNFENT
        INNER JOIN PCESTCOM ON PCESTCOM.NUMTRANSENT   = PCNFENT.NUMTRANSENT
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSENT      = PCESTCOM.NUMTRANSENT AND PCMOV.CODFILIAL = PCNFENT.CODFILIAL
        LEFT  JOIN PCNFSAID ON PCNFSAID.NUMTRANSVENDA = PCESTCOM.NUMTRANSVENDA
    WHERE PCNFENT.DTENT      BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCMOV.DTMOV        BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCNFENT.CODFILIAL  IN ('{FILIAL}')
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCMOV.CODPROD      IN ({prods})
      AND NVL(PCNFENT.CODFISCAL,0) IN (131,132,231,232,199,299)
      AND PCMOV.CODOPER       = 'ED'
      AND PCNFENT.TIPODESCARGA IN ('6','7','T')
      AND NVL(PCNFENT.TIPOMOVGARANTIA,-1) = -1
      AND NVL(PCNFENT.OBS,'X') <> 'NF CANCELADA'
      AND PCMOV.DTCANCEL      IS NULL
      AND NVL(PCNFSAID.CONDVENDA,0) NOT IN (4,8,10,13,20,98,99)
      AND PCNFENT.CODUSURDEVOL NOT IN ({RCA_BONIFICACAO})
      AND PCNFENT.CODUSURDEVOL <> 10
    GROUP BY PCNFENT.CODUSURDEVOL, PCMOV.CODPROD
),
CART AS (
    SELECT PCPEDC.CODUSUR       AS CODUSUR,
           PCPEDI.CODPROD       AS CODPROD,
           SUM(NVL(PCPEDI.QT,0)) AS UNID
    FROM PCPEDC
        INNER JOIN PCPEDI ON PCPEDI.NUMPED = PCPEDC.NUMPED
    WHERE PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDI.CODPROD     IN ({prods})
      AND PCPEDC.DATA        BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCPEDC.POSICAO     NOT IN ('F','C')
      AND PCPEDC.CONDVENDA   IN ({CONDVENDA_NORMAIS})
      AND PCPEDC.CODUSUR     NOT IN ({RCA_BONIFICACAO})
      AND PCPEDC.CODUSUR     <> 10
      AND PCPEDC.DTCANCEL    IS NULL
    GROUP BY PCPEDC.CODUSUR, PCPEDI.CODPROD
),
UNIDS AS (
    -- Venda líquida: faturado + carteira - devolução (por vendedor+produto,
    -- pode ficar negativo numa linha isolada se devolveu mais do que vendeu
    -- nesse produto especificamente; o total do vendedor entre produtos é
    -- que importa pro cálculo de caixas, feito em Python).
    SELECT CODUSUR, CODPROD, SUM(UNID) AS UNID FROM (
        SELECT CODUSUR, CODPROD, UNID FROM FAT
        UNION ALL
        SELECT CODUSUR, CODPROD, -UNID AS UNID FROM DEVOL
        UNION ALL
        SELECT CODUSUR, CODPROD, UNID FROM CART
    )
    GROUP BY CODUSUR, CODPROD
)
SELECT
    U.CODUSUR                          AS COD_VENDEDOR,
    UV.NOME                            AS NOME_VENDEDOR,
    UV.CODSUPERVISOR                   AS COD_SUPERVISOR,
    SUP.NOME                           AS NOME_SUPERVISOR,
    U.CODPROD                          AS COD_PRODUTO,
    P.DESCRICAO                        AS DESCRICAO,
    P.QTUNITCX                         AS QT_UNIT_CX,
    U.UNID                             AS UNIDADES
FROM UNIDS U
    INNER JOIN PCPRODUT  P   ON P.CODPROD        = U.CODPROD
    INNER JOIN PCUSUARI  UV  ON UV.CODUSUR       = U.CODUSUR
    LEFT  JOIN PCSUPERV  SUP ON SUP.CODSUPERVISOR = UV.CODSUPERVISOR
WHERE U.UNID <> 0
  {filtro_sup}
ORDER BY NOME_SUPERVISOR, NOME_VENDEDOR, P.DESCRICAO
"""
    return sql, params


def build_combo_sql(cod_produtos: list, dini: str, dfim: str,
                     apenas_supervisores: Optional[List[int]] = None,
                     excluir_supervisores: Optional[List[int]] = None) -> tuple:
    """
    Incentivo de COMBO por cliente: conta quantos CLIENTES levaram TODOS os
    produtos da lista (combo completo), por vendedor. Quantidade não importa —
    basta o cliente ter comprado cada um dos produtos ao menos uma vez.

    Considera faturado (PCNFSAID/PCMOV) + carteira (PCPEDI/PCPEDC), dentro
    de [dini, dfim]. Exclui vendedor 10 e contas de bonificação.

    Retorna (sql, params). Uma linha por vendedor:
      cod_vendedor, nome_vendedor, cod_supervisor, nome_supervisor, combos
    onde 'combos' = nº de clientes que fecharam o combo completo.
    """
    prods = ",".join(str(int(p)) for p in cod_produtos)
    n_prod = len(cod_produtos)
    params = {"dini": dini, "dfim": dfim}
    filtro_sup = _filtro_supervisor(apenas_supervisores, excluir_supervisores)

    sql = f"""
WITH VENDAS AS (
    SELECT DISTINCT
           PCNFSAID.CODUSUR AS CODUSUR,
           PCNFSAID.CODCLI  AS CODCLI,
           PCMOV.CODPROD    AS CODPROD
    FROM PCNFSAID
        INNER JOIN PCMOV ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                        AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
    WHERE PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODPROD      IN ({prods})
      AND PCNFSAID.DTSAIDA   BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND PCMOV.QT           > 0
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.CODUSUR   NOT IN ({RCA_BONIFICACAO})
      AND PCNFSAID.CODUSUR   <> 10
      AND PCNFSAID.DTCANCEL  IS NULL
    UNION
    SELECT DISTINCT
           PCPEDC.CODUSUR AS CODUSUR,
           PCPEDC.CODCLI  AS CODCLI,
           PCPEDI.CODPROD AS CODPROD
    FROM PCPEDC
        INNER JOIN PCPEDI ON PCPEDI.NUMPED = PCPEDC.NUMPED
    WHERE PCPEDC.CODFILIAL IN ('{FILIAL}')
      AND PCPEDI.CODPROD    IN ({prods})
      AND PCPEDC.DATA       BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCPEDC.POSICAO    NOT IN ('F','C')
      AND PCPEDI.QT         > 0
      AND PCPEDC.CONDVENDA  IN ({CONDVENDA_NORMAIS})
      AND PCPEDC.CODUSUR    NOT IN ({RCA_BONIFICACAO})
      AND PCPEDC.CODUSUR    <> 10
      AND PCPEDC.DTCANCEL   IS NULL
),
COMBO_CLI AS (
    SELECT CODUSUR, CODCLI
    FROM VENDAS
    GROUP BY CODUSUR, CODCLI
    HAVING COUNT(DISTINCT CODPROD) = {n_prod}
),
COMBOS AS (
    SELECT CODUSUR, COUNT(*) AS COMBOS
    FROM COMBO_CLI
    GROUP BY CODUSUR
)
SELECT
    CB.CODUSUR        AS COD_VENDEDOR,
    UV.NOME           AS NOME_VENDEDOR,
    UV.CODSUPERVISOR  AS COD_SUPERVISOR,
    SUP.NOME          AS NOME_SUPERVISOR,
    CB.COMBOS         AS COMBOS
FROM COMBOS CB
    INNER JOIN PCUSUARI UV  ON UV.CODUSUR        = CB.CODUSUR
    LEFT  JOIN PCSUPERV SUP ON SUP.CODSUPERVISOR = UV.CODSUPERVISOR
WHERE CB.COMBOS > 0
  {filtro_sup}
ORDER BY CB.COMBOS DESC, NOME_VENDEDOR
"""
    return sql, params
