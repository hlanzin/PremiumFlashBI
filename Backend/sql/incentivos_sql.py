"""
Incentivos por venda de produtos.

Cada incentivo tem uma lista de produtos e um valor (R$) por CAIXA FECHADA vendida.
A venda considera FATURADO (PCNFSAID/PCMOV, dia 1 até hoje) + CARTEIRA
(PCPEDI/PCPEDC não faturado). Caixas = FLOOR(unidades / QTUNITCX).

O SQL retorna UMA linha por vendedor+produto com a soma de unidades. A conversão
em caixas (FLOOR) e o cálculo do prêmio são feitos no backend/frontend, para que
caixas parciais de produtos diferentes NÃO se somem antes do arredondamento.

Aparece SEMPRE por equipe, com TODOS os vendedores de TODAS as equipes
(competição amistosa) — independente do cargo de quem consulta.
"""
from typing import List
from config import FILIAL

CONDVENDA_NORMAIS = "1,2,3,7,9,14,15,17,18,19,98"
RCA_BONIFICACAO   = "2, 160, 180"


def build_incentivo_sql(cod_produtos: List[int], date_ref: str = None) -> tuple:
    """
    cod_produtos : lista de CODPROD do incentivo
    date_ref     : 'YYYY-MM-DD' (padrão hoje) — apura do dia 1 do mês até esta data

    Retorna (sql, params_dict). Uma linha por vendedor+produto:
      cod_vendedor, nome_vendedor, cod_supervisor, nome_supervisor,
      cod_produto, descricao, qt_unit_cx, unidades
    """
    from database import parse_data
    dr = date_ref or parse_data(None)

    # Lista de produtos inline (são códigos internos, não entrada de usuário livre)
    prods = ",".join(str(int(p)) for p in cod_produtos)

    params = {"dini": dr[:8] + "01", "dfim": dr}

    sql = f"""
WITH FAT AS (
    -- Faturado (NF emitida) do mês, dia 1 até a data ref
    SELECT PCNFSAID.CODUSUR      AS CODUSUR,
           PCMOV.CODPROD         AS CODPROD,
           SUM(NVL(PCMOV.QT,0))  AS UNID
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                           AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
    WHERE PCNFSAID.CODFILIAL  IN ('{FILIAL}')
      AND PCMOV.CODPROD       IN ({prods})
      AND PCNFSAID.DTSAIDA    BETWEEN TO_DATE(:dini,'YYYY-MM-DD') AND TO_DATE(:dfim,'YYYY-MM-DD')
      AND PCMOV.CODOPER       = 'S'
      AND PCNFSAID.CONDVENDA  IN ({CONDVENDA_NORMAIS})
      AND PCNFSAID.CODUSUR    NOT IN ({RCA_BONIFICACAO})
      AND PCNFSAID.CODUSUR    <> 10
      AND PCNFSAID.DTCANCEL   IS NULL
    GROUP BY PCNFSAID.CODUSUR, PCMOV.CODPROD
),
CART AS (
    -- Carteira: pedidos ainda não faturados (posição diferente de F/C)
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
    SELECT CODUSUR, CODPROD, SUM(UNID) AS UNID FROM (
        SELECT CODUSUR, CODPROD, UNID FROM FAT
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
WHERE U.UNID > 0
ORDER BY NOME_SUPERVISOR, NOME_VENDEDOR, P.DESCRICAO
"""
    return sql, params


def build_combo_sql(cod_produtos: list, date_ref: str = None) -> tuple:
    """
    Incentivo de COMBO por cliente: conta quantos CLIENTES levaram TODOS os
    produtos da lista (combo completo), por vendedor. Quantidade não importa —
    basta o cliente ter comprado cada um dos produtos ao menos uma vez.

    Considera faturado (PCNFSAID/PCMOV) + carteira (PCPEDI/PCPEDC), mês atual.
    Exclui vendedor 10 e contas de bonificação.

    Retorna (sql, params). Uma linha por vendedor:
      cod_vendedor, nome_vendedor, cod_supervisor, nome_supervisor, combos
    onde 'combos' = nº de clientes que fecharam o combo completo.
    """
    from database import parse_data
    dr = date_ref or parse_data(None)
    prods = ",".join(str(int(p)) for p in cod_produtos)
    n_prod = len(cod_produtos)
    params = {"dini": dr[:8] + "01", "dfim": dr}

    sql = f"""
WITH VENDAS AS (
    -- Faturado: cada par (vendedor, cliente, produto) que teve venda
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
      AND PCMOV.CODOPER      = 'S'
      AND PCMOV.QT           > 0
      AND PCNFSAID.CONDVENDA IN ({CONDVENDA_NORMAIS})
      AND PCNFSAID.CODUSUR   NOT IN ({RCA_BONIFICACAO})
      AND PCNFSAID.CODUSUR   <> 10
      AND PCNFSAID.DTCANCEL  IS NULL
    UNION
    -- Carteira: mesmos pares em pedidos não faturados
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
    -- Cliente que comprou os N produtos distintos = combo completo
    SELECT CODUSUR, CODCLI
    FROM VENDAS
    GROUP BY CODUSUR, CODCLI
    HAVING COUNT(DISTINCT CODPROD) = {n_prod}
),
COMBOS AS (
    -- Nº de combos (clientes completos) por vendedor
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
ORDER BY CB.COMBOS DESC, NOME_VENDEDOR
"""
    return sql, params