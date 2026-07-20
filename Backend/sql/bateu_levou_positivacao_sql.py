"""
Campanhas tipo 'positivação': conta quantos clientes que estavam na Lista
Negra do fornecedor (mesmo critério do módulo Lista Negra) ao INÍCIO da
campanha voltaram a comprar — durante a semana da campanha.

A ELEGIBILIDADE (quem está na lista negra) é SEMPRE baseada no fornecedor
inteiro, independente do modo abaixo. Já o critério de "positivou" tem
dois modos (campanha.positivacao_modo):

  'cliente' (codprods=None) -> QUALQUER produto do fornecedor conta.
  'produto' (codprods=[...]) -> só conta se comprar um dos produtos
                                 específicos habilitados pelo supervisor
                                 (mesma lista "x ou y" do tipo 'produto').

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
    início da campanha), com flags positivou_realizado e positivou_hoje.
    A agregação por vendedor é feita em Python — ver
    agregar_positivacao_por_vendedor().

    codprods=None -> positivação de CLIENTE: qualquer produto do fornecedor
                      conta como "voltou a comprar".
    codprods=[...] -> positivação de PRODUTO: só conta se comprar um dos
                       produtos da lista (mesmo padrão do tipo 'produto').

    fechamento=False (semana em curso, mesmo padrão do tipo 'produto'):
        positivou_realizado = semana_ini → date_ref - 1 (ontem)
        positivou_hoje       = date_ref (hoje)
    fechamento=True (campanha encerrada — navegando pro passado depois que
    a semana já fechou):
        positivou_realizado = semana_ini → date_ref (semana toda)
        positivou_hoje       = sempre 0 (não existe mais "hoje" a mostrar
                                separado — tudo já foi incorporado ao total)
    """
    filtro_sup = f"AND U1.CODSUPERVISOR = {cod_supervisor}" if cod_supervisor else ""

    if fechamento:
        janela_realizado = "BETWEEN P.DT_SEMANA_INI AND P.DT_HOJE"
    else:
        janela_realizado = "BETWEEN P.DT_SEMANA_INI AND P.DT_ONTEM"

    # Modo 'produto': só conta como positivação se comprar um dos produtos
    # da lista. Modo 'cliente' (codprods=None): qualquer produto do
    # fornecedor conta — o filtro de fornecedor já vem do JOIN PCPRODUT.
    filtro_positivou_prod = (
        f"AND PCMOV.CODPROD IN ({','.join(str(p) for p in codprods)})"
        if codprods else ""
    )

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

-- Positivação = comprou QUALQUER produto do MESMO fornecedor (não uma
-- lista específica) no período "realizado" (semana toda se a campanha já
-- fechou; senão semana_ini até ontem — mesmo padrão do tipo 'produto')
POSITIVOU_REALIZADO AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                             AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPRODUT.CODFORNEC = {codfornec}
      {filtro_positivou_prod}
      AND PCMOV.DTMOV       {janela_realizado}
      AND PCNFSAID.DTSAIDA  {janela_realizado}
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
),

POSITIVOU_HOJE AS (
    SELECT DISTINCT PCMOV.CODCLI
    FROM PCNFSAID
        INNER JOIN PCMOV    ON PCMOV.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
                             AND PCMOV.CODFILIAL     = PCNFSAID.CODFILIAL
        INNER JOIN PCPRODUT ON PCPRODUT.CODPROD     = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCPRODUT.CODFORNEC = {codfornec}
      {filtro_positivou_prod}
      AND {("1=0" if fechamento else "PCMOV.DTMOV = P.DT_HOJE AND PCNFSAID.DTSAIDA = P.DT_HOJE")}
      AND PCMOV.CODFILIAL    IN ('{FILIAL}')
      AND PCNFSAID.CODFILIAL IN ('{FILIAL}')
      AND PCMOV.CODOPER      NOT IN ('SR','SO')
      AND NVL(PCNFSAID.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND PCNFSAID.CODFISCAL  NOT IN (522,622,722,532,632,732)
      AND PCNFSAID.CONDVENDA  NOT IN (4,8,10,13,20,98,99)
      AND PCNFSAID.DTCANCEL   IS NULL
)

SELECT
    E.CODCLI                                              AS cod_cliente,
    C.CLIENTE                                             AS razao_social,
    C.CODUSUR1                                             AS cod_vendedor,
    U1.NOME                                                AS nome_vendedor,
    U1.CODSUPERVISOR                                       AS cod_supervisor,
    CASE WHEN PR.CODCLI IS NOT NULL THEN 1 ELSE 0 END      AS positivou_realizado,
    CASE WHEN PH.CODCLI IS NOT NULL THEN 1 ELSE 0 END      AS positivou_hoje
FROM ELEGIVEIS E
    INNER JOIN PCCLIENT C  ON C.CODCLI   = E.CODCLI
    LEFT  JOIN PCUSUARI U1 ON U1.CODUSUR = C.CODUSUR1
    LEFT  JOIN POSITIVOU_REALIZADO PR ON PR.CODCLI = E.CODCLI
    LEFT  JOIN POSITIVOU_HOJE      PH ON PH.CODCLI = E.CODCLI
WHERE 1=1 {filtro_sup}
ORDER BY U1.CODSUPERVISOR, C.CODUSUR1, C.CLIENTE
"""
    return sql, []


def agregar_positivacao_por_vendedor(rows: list, metas_sup: dict) -> list:
    """
    Agrupa as linhas (uma por cliente elegível) por vendedor. meta vem de
    bl_metas (igual ao tipo 'produto' — reaproveitado). qt_realizado e
    qt_dia contam clientes positivados, não caixas/unidades.
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
                "qt_realizado": 0,
                "qt_dia": 0,
            }
        v = por_vendedor[cv]
        v["elegiveis_total"] += 1
        if r.get("positivou_realizado"):
            v["qt_realizado"] += 1
        if r.get("positivou_hoje"):
            v["qt_dia"] += 1

    resultado = []
    for cv, v in por_vendedor.items():
        meta = float(metas_sup.get(cv, 0) or 0)
        v["meta"] = meta
        v["pct_ating"] = (v["qt_realizado"] / meta * 100) if meta > 0 else 0.0
        v["produtos"] = []
        resultado.append(v)
    return resultado