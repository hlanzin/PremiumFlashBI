"""
Campanhas tipo 'positivação': conta quantos clientes que estavam na Lista
Negra do fornecedor (mesmo critério do módulo Lista Negra) ao INÍCIO da
campanha voltaram a comprar — durante a semana da campanha.

A ELEGIBILIDADE (quem está na lista negra) é SEMPRE baseada no fornecedor
inteiro, independente do modo abaixo. Já o critério de "positivou" tem
dois modos (campanha.positivacao_modo), e em AMBOS conta-se o CLIENTE
(0/1: positivou ou não) — a diferença é só o filtro de que compra conta:

  'cliente' (codprods=None) -> QUALQUER produto do fornecedor conta como
                                 "voltou a comprar".
  'produto' (codprods=[...]) -> só conta se comprar um dos produtos
                                 específicos habilitados pelo supervisor
                                 (mesma lista "x ou y" do tipo 'produto').

Fonte do "positivou" (PEDIDO vs FATURADO) depende de a campanha estar em
curso ou já ter fechado — ver _positivou_ctes().

Elegibilidade (mesma lógica de sql/lista_negra_sql.py):
  BASE_META    = cliente comprou do fornecedor nos últimos 3 meses
                 (terminando no mês anterior ao início da campanha)
  FAT_MES      = já faturou do fornecedor no mês corrente (antes da campanha
                 começar) -> NÃO entra na lista negra
  CART_ABERTA  = já tem pedido em aberto do fornecedor no mês corrente
                 (antes da campanha começar) -> NÃO entra na lista negra
  ELEGIVEIS    = BASE_META menos FAT_MES menos CART_ABERTA
"""
from typing import List, Optional
from config import FILIAL


def _positivou_ctes(codfornec: int, janela_realizado: str, fechamento: bool,
                     codprods: Optional[List[int]]):
    """
    Monta as CTEs POSITIVOU_REALIZADO/POSITIVOU_HOJE: 1 linha por CODCLI que
    positivou (comprou) — sempre existência (0/1). codprods=None (modo
    'cliente'): qualquer produto do fornecedor conta. codprods=[...] (modo
    'produto'): só conta se comprar um dos produtos da lista — o filtro é
    a única diferença entre os dois modos.

    Fonte do dado depende de `fechamento`:
      - campanha em curso (fechamento=False): conta PEDIDO lançado
        (PCPEDI/PCPEDC), faturado ou não — mesmo critério já usado na
        elegibilidade (CART_ABERTA trata pedido em aberto como "cliente
        ativo") e no tipo 'produto' normal (rotina 322). Assim o vendedor
        vê o resultado assim que vende, sem esperar a nota sair.
      - campanha encerrada (fechamento=True): conta só o que foi FATURADO
        de fato (PCNFSAID/PCMOV) — número oficial da campanha, sem contar
        pedido que ainda pode ser cancelado.
    """
    if fechamento:
        filtro_prod = (
            f"AND PCMOV.CODPROD IN ({','.join(str(p) for p in codprods)})"
            if codprods else ""
        )
        cte_realizado = f"""
POSITIVOU_REALIZADO AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                             AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPRODUT.CODFORNEC = {codfornec}
      {filtro_prod}
      AND PCMOV.DTMOV       {janela_realizado}
      AND PCNFSAID.DTSAIDA  {janela_realizado}
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
)"""
        # Campanha encerrada: não existe mais "hoje" separado — tudo já foi
        # incorporado ao total de POSITIVOU_REALIZADO.
        cte_hoje = "POSITIVOU_HOJE AS (SELECT CAST(NULL AS NUMBER) AS CODCLI FROM DUAL WHERE 1=0)"
        select_final_real = "CASE WHEN PR.CODCLI IS NOT NULL THEN 1 ELSE 0 END"
        select_final_hoje = "0"
        return cte_realizado, cte_hoje, select_final_real, select_final_hoje

    # Campanha em curso: conta PEDIDO lançado (PCPEDI/PCPEDC), faturado ou não.
    filtro_prod = (
        f"AND PCPEDI.CODPROD IN ({','.join(str(p) for p in codprods)})"
        if codprods else ""
    )
    base_pedido = f"""FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPRODUT.CODFORNEC = {codfornec}
      {filtro_prod}
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (1,2,3,7,9,14,15,17,18,19,98)
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL"""

    cte_realizado = f"""
POSITIVOU_REALIZADO AS (
    SELECT DISTINCT PCPEDC.CODCLI
    {base_pedido}
      AND PCPEDC.DATA {janela_realizado}
)"""
    cte_hoje = f"""
POSITIVOU_HOJE AS (
    SELECT DISTINCT PCPEDC.CODCLI
    {base_pedido}
      AND PCPEDC.DATA = P.DT_HOJE
)"""
    select_final_real = "CASE WHEN PR.CODCLI IS NOT NULL THEN 1 ELSE 0 END"
    select_final_hoje = "CASE WHEN PH.CODCLI IS NOT NULL THEN 1 ELSE 0 END"
    return cte_realizado, cte_hoje, select_final_real, select_final_hoje


def build_positivacao_sql(
    codfornec: int,
    semana_ini: str,
    date_ref: str,
    cod_supervisor: Optional[int] = None,
    fechamento: bool = False,
    codprods: Optional[List[int]] = None,
) -> tuple:
    """
    Uma linha por cliente ELEGÍVEL (estava na lista negra do fornecedor ao
    início da campanha), com flags positivou_realizado e positivou_hoje
    (0/1). A agregação por vendedor é feita em Python — ver
    agregar_positivacao_por_vendedor().

    codprods=None -> positivação de CLIENTE: qualquer produto do fornecedor
                      conta como "voltou a comprar".
    codprods=[...] -> positivação de PRODUTO: só conta se comprar um dos
                       produtos da lista (mesmo padrão do tipo 'produto').

    fechamento=False (semana em curso): conta PEDIDO lançado, faturado ou
    não (ver _positivou_ctes):
        positivou_realizado = semana_ini → date_ref - 1 (ontem)
        positivou_hoje       = date_ref (hoje)
    fechamento=True (campanha encerrada — navegando pro passado depois que
    a semana já fechou): conta só o que foi FATURADO de fato:
        positivou_realizado = semana_ini → date_ref (semana toda)
        positivou_hoje       = sempre 0 (não existe mais "hoje" a mostrar
                                separado — tudo já foi incorporado ao total)
    """
    filtro_sup = f"AND U1.CODSUPERVISOR = {cod_supervisor}" if cod_supervisor else ""

    if fechamento:
        janela_realizado = "BETWEEN P.DT_SEMANA_INI AND P.DT_HOJE"
    else:
        janela_realizado = "BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM"

    cte_realizado, cte_hoje, select_final_real, select_final_hoje = _positivou_ctes(
        codfornec, janela_realizado, fechamento, codprods)

    sql = f"""
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE('{semana_ini}','YYYY-MM-DD'),'MM'),-3) AS DT_INI,
        LAST_DAY(ADD_MONTHS(TO_DATE('{semana_ini}','YYYY-MM-DD'),-1))   AS DT_FIM,
        TRUNC(TO_DATE('{semana_ini}','YYYY-MM-DD'),'MM')                AS DT_MES_INI,
        TO_DATE('{semana_ini}','YYYY-MM-DD')                            AS DT_SEMANA_INI,
        TO_DATE('{date_ref}','YYYY-MM-DD')                              AS DT_HOJE,
        TO_DATE('{date_ref}','YYYY-MM-DD') - 1                          AS DT_ONTEM
    FROM DUAL
),

BASE_META AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                            AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
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
      AND PCPRODUT.CODFORNEC = {codfornec}
),

FAT_MES AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                            AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_MES_INI AND P.DT_SEMANA_INI - 1
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_MES_INI AND P.DT_SEMANA_INI - 1
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      AND PCPRODUT.CODFORNEC = {codfornec}
),

CART_ABERTA AS (
    SELECT DISTINCT PCPEDC.CODCLI
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA       BETWEEN P.DT_MES_INI AND P.DT_SEMANA_INI - 1
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO    <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
      AND PCPRODUT.CODFORNEC = {codfornec}
),

ELEGIVEIS AS (
    SELECT B.CODCLI
    FROM BASE_META B
    WHERE B.CODCLI NOT IN (SELECT CODCLI FROM FAT_MES)
      AND B.CODCLI NOT IN (SELECT CODCLI FROM CART_ABERTA)
),
{cte_realizado},
{cte_hoje}

SELECT
    E.CODCLI                                              AS cod_cliente,
    C.CLIENTE                                             AS razao_social,
    C.CODUSUR1                                             AS cod_vendedor,
    U1.NOME                                                AS nome_vendedor,
    U1.CODSUPERVISOR                                       AS cod_supervisor,
    {select_final_real}                                   AS positivou_realizado,
    {select_final_hoje}                                   AS positivou_hoje
FROM ELEGIVEIS E
    INNER JOIN PCCLIENT C  ON C.CODCLI   = E.CODCLI
    LEFT  JOIN PCUSUARI U1 ON U1.CODUSUR = C.CODUSUR1
    LEFT  JOIN POSITIVOU_REALIZADO PR ON PR.CODCLI = E.CODCLI
    LEFT  JOIN POSITIVOU_HOJE      PH ON PH.CODCLI = E.CODCLI
WHERE 1=1 {filtro_sup}
ORDER BY U1.CODSUPERVISOR, C.CODUSUR1, C.CLIENTE
"""
    return sql, []


def build_debug_cliente_sql(
    codfornec: int,
    semana_ini: str,
    date_ref: str,
    codcli: int,
    fechamento: bool = False,
    codprods: Optional[List[int]] = None,
) -> str:
    """
    Diagnóstico para 1 cliente específico: mostra cada etapa da elegibilidade
    (eh_base_meta / eh_fat_mes / eh_cart_aberta / eh_elegivel) e o resultado
    final de positivou_realizado/positivou_hoje — usado quando um cliente que
    comprou não aparece no relatório principal, pra achar em qual etapa ele
    está caindo fora. Reaproveita as mesmas CTEs de build_positivacao_sql
    (via _positivou_ctes), mas parte de PCCLIENT (não de ELEGIVEIS) pra
    mostrar o cliente mesmo que ele não seja elegível.
    """
    if fechamento:
        janela_realizado = "BETWEEN P.DT_SEMANA_INI AND P.DT_HOJE"
    else:
        janela_realizado = "BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM"

    cte_realizado, cte_hoje, select_final_real, select_final_hoje = _positivou_ctes(
        codfornec, janela_realizado, fechamento, codprods)

    return f"""
WITH PARAMS AS (
    SELECT
        ADD_MONTHS(TRUNC(TO_DATE('{semana_ini}','YYYY-MM-DD'),'MM'),-3) AS DT_INI,
        LAST_DAY(ADD_MONTHS(TO_DATE('{semana_ini}','YYYY-MM-DD'),-1))   AS DT_FIM,
        TRUNC(TO_DATE('{semana_ini}','YYYY-MM-DD'),'MM')                AS DT_MES_INI,
        TO_DATE('{semana_ini}','YYYY-MM-DD')                            AS DT_SEMANA_INI,
        TO_DATE('{date_ref}','YYYY-MM-DD')                              AS DT_HOJE,
        TO_DATE('{date_ref}','YYYY-MM-DD') - 1                          AS DT_ONTEM
    FROM DUAL
),

BASE_META AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                            AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
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
      AND PCPRODUT.CODFORNEC = {codfornec}
),

FAT_MES AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                            AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCMOV.DTMOV       BETWEEN P.DT_MES_INI AND P.DT_SEMANA_INI - 1
      AND PCNFSAID.DTSAIDA  BETWEEN P.DT_MES_INI AND P.DT_SEMANA_INI - 1
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
      AND PCPRODUT.CODFORNEC = {codfornec}
),

CART_ABERTA AS (
    SELECT DISTINCT PCPEDC.CODCLI
    FROM PCPEDI
        INNER JOIN PCPEDC   ON PCPEDC.NUMPED    = PCPEDI.NUMPED
        LEFT  JOIN PCPRODUT ON PCPRODUT.CODPROD = PCPEDI.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPEDC.DATA       BETWEEN P.DT_MES_INI AND P.DT_SEMANA_INI - 1
      AND PCPEDC.CODFILIAL   IN ('{FILIAL}')
      AND PCPEDC.CONDVENDA   IN (1,2,3,7,9,14,15,17,18,19,98)
      AND PCPEDC.POSICAO    <> 'F'
      AND NVL(PCPEDI.BONIFIC,'N') = 'N'
      AND PCPEDC.DTCANCEL    IS NULL
      AND PCPRODUT.CODFORNEC = {codfornec}
),
{cte_realizado},
{cte_hoje}

SELECT
    C.CODCLI                                                       AS cod_cliente,
    C.CLIENTE                                                      AS razao_social,
    C.CODUSUR1                                                     AS cod_vendedor,
    U1.NOME                                                        AS nome_vendedor,
    U1.CODSUPERVISOR                                                AS cod_supervisor,
    CASE WHEN C.CODCLI IN (SELECT CODCLI FROM BASE_META)   THEN 1 ELSE 0 END AS eh_base_meta,
    CASE WHEN C.CODCLI IN (SELECT CODCLI FROM FAT_MES)     THEN 1 ELSE 0 END AS eh_fat_mes,
    CASE WHEN C.CODCLI IN (SELECT CODCLI FROM CART_ABERTA) THEN 1 ELSE 0 END AS eh_cart_aberta,
    CASE WHEN C.CODCLI IN (SELECT CODCLI FROM BASE_META)
          AND C.CODCLI NOT IN (SELECT CODCLI FROM FAT_MES)
          AND C.CODCLI NOT IN (SELECT CODCLI FROM CART_ABERTA)
         THEN 1 ELSE 0 END                                                  AS eh_elegivel,
    {select_final_real}                                             AS positivou_realizado,
    {select_final_hoje}                                             AS positivou_hoje
FROM PCCLIENT C
    LEFT JOIN PCUSUARI U1 ON U1.CODUSUR = C.CODUSUR1
    LEFT JOIN POSITIVOU_REALIZADO PR ON PR.CODCLI = C.CODCLI
    LEFT JOIN POSITIVOU_HOJE      PH ON PH.CODCLI = C.CODCLI
WHERE C.CODCLI = {codcli}
"""


def agregar_positivacao_por_vendedor(rows: list, metas_sup: dict) -> list:
    """
    Agrupa as linhas (uma por cliente elegível) por vendedor. meta vem de
    bl_metas (igual ao tipo 'produto' — reaproveitado). qt_realizado e
    qt_dia contam clientes positivados (0/1 por linha), não caixas/unidades.

    v["clientes"] lista os clientes que positivaram (realizado e/ou hoje) —
    usado pelo dropdown de detalhe na tela, igual ao "produtos" do tipo
    'produto' normal.
    """
    por_vendedor: dict = {}
    for r in rows:
        cv = r.get("cod_vendedor")
        if cv is None:
            continue
        if cv not in por_vendedor:
            por_vendedor[cv] = {
                "cod_vendedor": cv,
                "nome_vendedor": r.get("nome_vendedor") or f"#{cv}",
                "cod_supervisor": r.get("cod_supervisor"),
                "nome_supervisor": "",
                "elegiveis_total": 0,
                "qt_realizado": 0.0,
                "qt_dia": 0.0,
                "clientes": [],
            }
        v = por_vendedor[cv]
        v["elegiveis_total"] += 1
        realizado = float(r.get("positivou_realizado") or 0)
        hoje      = float(r.get("positivou_hoje") or 0)
        v["qt_realizado"] += realizado
        v["qt_dia"]       += hoje
        if realizado or hoje:
            v["clientes"].append({
                "cod_cliente": r.get("cod_cliente"),
                "razao_social": r.get("razao_social"),
                "positivou_realizado": bool(realizado),
                "positivou_hoje": bool(hoje),
            })

    resultado = []
    for cv, v in por_vendedor.items():
        v["qt_realizado"] = round(v["qt_realizado"], 2)
        v["qt_dia"]       = round(v["qt_dia"], 2)
        v["clientes"].sort(key=lambda c: c["razao_social"] or "")
        meta = float(metas_sup.get(cv, 0) or 0)
        v["meta"] = meta
        v["pct_ating"] = (v["qt_realizado"] / meta * 100) if meta > 0 else 0.0
        v["produtos"] = []
        resultado.append(v)
    return resultado
