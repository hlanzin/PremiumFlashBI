"""
SQL do módulo Vendas por Produto — fornecedor.
Retorna vendas agrupadas por vendedor + cliente + produto no mês selecionado.
"""
from typing import List
from config import FILIAL


def build_vendas_produto_sql(codfornecs: List[int], mes_ref: str) -> tuple:
    """
    codfornecs : lista de CODFORNECs
    mes_ref    : 'YYYY-MM'
    """
    if not codfornecs:
        return "SELECT 1 FROM DUAL WHERE 1=0", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {"mes_ref": mes_ref}
    for i, cod in enumerate(codfornecs):
        params[f"f{i}"] = cod

    sql = f"""
WITH PARAMS AS (
    SELECT
        TRUNC(TO_DATE(:mes_ref,'YYYY-MM'),'MM')              AS DT_INI,
        LAST_DAY(TRUNC(TO_DATE(:mes_ref,'YYYY-MM'),'MM'))    AS DT_FIM
    FROM DUAL
)
SELECT
    N.CODUSUR                                                AS cod_vendedor,
    U.NOME                                                   AS nome_vendedor,
    M.CODCLI                                                 AS cod_cliente,
    NVL(NULLIF(TRIM(C.FANTASIA),''), C.CLIENTE)              AS nome_cliente,
    M.CODPROD                                                AS cod_produto,
    PR.DESCRICAO                                             AS nome_produto,
    SUM(NVL(M.QT,0))                                         AS quantidade,
    ROUND(SUM(NVL(M.QT,0) * NVL(M.PUNIT,0)) /
          NULLIF(SUM(NVL(M.QT,0)),0), 2)                     AS vl_unitario,
    ROUND(SUM(NVL(M.QT,0) * NVL(M.PUNIT,0)), 2)             AS vl_total
FROM PCMOV M
    INNER JOIN PCNFSAID N   ON N.NUMTRANSVENDA  = M.NUMTRANSVENDA
                            AND N.CODFILIAL      = M.CODFILIAL
    INNER JOIN PCPRODUT PR  ON PR.CODPROD        = M.CODPROD
    INNER JOIN PCCLIENT C   ON C.CODCLI          = M.CODCLI
    LEFT  JOIN PCUSUARI U   ON U.CODUSUR         = N.CODUSUR
    CROSS JOIN PARAMS P
WHERE PR.CODFORNEC          IN ({placeholders})
  AND N.DTSAIDA             BETWEEN P.DT_INI AND P.DT_FIM
  AND N.CODFILIAL            IN ('{FILIAL}')
  AND M.CODFILIAL            IN ('{FILIAL}')
  AND M.CODOPER             NOT IN ('SR','SO')
  AND NVL(N.TIPOVENDA,'X')  NOT IN ('SR','DF')
  AND N.CODFISCAL           NOT IN (522,622,722,532,632,732)
  AND N.CONDVENDA           NOT IN (4,8,10,13,20,98,99)
  AND N.DTCANCEL             IS NULL
GROUP BY
    N.CODUSUR, U.NOME,
    M.CODCLI, C.FANTASIA, C.CLIENTE,
    M.CODPROD, PR.DESCRICAO
ORDER BY U.NOME, C.CLIENTE, PR.DESCRICAO
"""
    return sql, params
