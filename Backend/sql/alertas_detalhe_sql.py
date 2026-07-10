"""
Detalhe da "POSSÍVEL DUPLICIDADE": para um cliente, mostra os pedidos do
período (cabeçalho com valor) e, ao expandir, os itens de cada pedido — para
o vendedor/gerência comparar visualmente os dois pedidos e decidir se é
duplicidade real ou pedidos distintos legítimos.
"""


def build_duplicidade_pedidos_sql() -> tuple:
    """
    Cabeçalho dos pedidos do cliente no período padrão (7 dias), mesmos
    filtros da query de alertas (POSICAO aberta, CONDVENDA normal).
    Params: {codcli}
    """
    sql = """
SELECT
    PEDC.NUMPED,
    PEDC.DATA,
    PEDC.CODUSUR,
    N.NOME_CURTO AS NOME_RCA,
    PEDC.CONDVENDA,
    PEDC.POSICAO,
    NVL(PEDC.VLTOTAL, 0)  AS VLTOTAL,
    NVL(PEDC.VLATEND, 0)  AS VLATEND,
    (SELECT COUNT(*) FROM PONTUAL.PCPEDI I WHERE I.NUMPED = PEDC.NUMPED) AS QT_ITENS
FROM PONTUAL.PCPEDC PEDC
LEFT JOIN (
    SELECT CODUSUR,
           NVL(SUBSTR(NOME, INSTR(NOME,' ')+1, INSTR(NOME,' ',INSTR(NOME,' ')+1)-INSTR(NOME,' ')-1), NOME) AS NOME_CURTO
    FROM PONTUAL.PCUSUARI
) N ON N.CODUSUR = PEDC.CODUSUR
WHERE PEDC.CODCLI = :codcli
  AND PEDC.DATA BETWEEN SYSDATE-7 AND SYSDATE
  AND PEDC.POSICAO NOT IN ('F','C')
  AND PEDC.CONDVENDA NOT IN (5,11)
ORDER BY PEDC.DATA DESC, PEDC.NUMPED DESC
"""
    return sql, {}


def build_duplicidade_itens_sql() -> tuple:
    """
    Itens de um ou mais pedidos (para expandir cada pedido do cabeçalho
    acima). Marca com PRODUTO_DUPLICADO='S' os produtos que aparecem em
    mais de um dos pedidos passados — destaque visual do que está repetido.
    Params: {numped1, numped2, ...} -- usar IN via bind expandido no router
    """
    sql = """
SELECT
    PI.NUMPED,
    PI.CODPROD,
    P.DESCRICAO,
    PI.QT,
    NVL(PI.VLSUBTOTITEM, PI.QT * NVL(PI.PVENDA,0)) AS VLTOTAL,
    (SELECT COUNT(DISTINCT PI2.NUMPED)
     FROM PONTUAL.PCPEDI PI2
     WHERE PI2.CODPROD = PI.CODPROD
       AND PI2.NUMPED IN ({numped_list})
    ) AS QT_PEDIDOS_COM_PRODUTO
FROM PONTUAL.PCPEDI PI
INNER JOIN PONTUAL.PCPRODUT P ON P.CODPROD = PI.CODPROD
WHERE PI.NUMPED IN ({numped_list})
ORDER BY PI.CODPROD, PI.NUMPED
"""
    return sql