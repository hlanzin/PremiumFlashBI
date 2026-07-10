"""
Dados brutos (cliente, pedido, produto) do período — sem agregação — para o
Python agrupar em CLUSTERS de pedidos realmente parecidos entre si (que
compartilham produto repetido), em vez de misturar todos os pedidos do
cliente num alerta só. Ver routers/alertas.py: compute_duplicidade_clusters().
"""


def build_duplicidade_raw_sql() -> str:
    return """
WITH NOMES AS (
    SELECT
        CODUSUR,
        CODSUPERVISOR,
        NVL(
            SUBSTR(NOME, INSTR(NOME,' ')+1, INSTR(NOME,' ',INSTR(NOME,' ')+1)-INSTR(NOME,' ')-1),
            NOME
        ) AS NOME_CURTO
    FROM PONTUAL.PCUSUARI
)
SELECT DISTINCT
    PEDC.CODCLI       AS CODCLI,
    PEDC.CODUSUR      AS CODUSUR,
    N.NOME_CURTO      AS NOME,
    N.CODSUPERVISOR   AS COD_SUPERVISOR,
    PED.NUMPED        AS NUMPED,
    PED.CODPROD       AS CODPROD
FROM PONTUAL.PCPEDI PED
JOIN PONTUAL.PCPEDC PEDC
    ON PED.CODCLI = PEDC.CODCLI
   AND PED.NUMPED = PEDC.NUMPED
   AND PED.DATA   = PEDC.DATA
LEFT JOIN NOMES N ON N.CODUSUR = PEDC.CODUSUR
WHERE PED.DATA BETWEEN SYSDATE-7 AND SYSDATE
  AND PED.POSICAO NOT IN ('F','C')
  AND PEDC.CONDVENDA NOT IN (5,11)
"""


def build_duplicidade_pedidos_por_numped_sql() -> str:
    """Cabeçalho dos pedidos de UM cluster específico (lista fechada de
    NUMPED), não de todos os pedidos do cliente no período."""
    return """
SELECT
    PEDC.NUMPED,
    PEDC.DATA,
    PEDC.CODUSUR,
    N.NOME_CURTO AS NOME_RCA,
    PEDC.CONDVENDA,
    PEDC.POSICAO,
    NVL(PEDC.VLTOTAL, 0) AS VLTOTAL,
    NVL(PEDC.VLATEND, 0) AS VLATEND,
    (SELECT COUNT(*) FROM PONTUAL.PCPEDI I WHERE I.NUMPED = PEDC.NUMPED) AS QT_ITENS
FROM PONTUAL.PCPEDC PEDC
LEFT JOIN (
    SELECT CODUSUR,
           NVL(SUBSTR(NOME, INSTR(NOME,' ')+1, INSTR(NOME,' ',INSTR(NOME,' ')+1)-INSTR(NOME,' ')-1), NOME) AS NOME_CURTO
    FROM PONTUAL.PCUSUARI
) N ON N.CODUSUR = PEDC.CODUSUR
WHERE PEDC.NUMPED IN ({numped_list})
ORDER BY PEDC.DATA DESC, PEDC.NUMPED DESC
"""
