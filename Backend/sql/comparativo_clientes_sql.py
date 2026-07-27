"""
SQL do módulo Comparativo de Clientes — compara um fornecedor ano a ano
(ano atual × ano anterior), no mesmo período do ano (ex.: 01/jan → hoje em
ambos, pra não comparar ano fechado com ano em andamento de forma injusta).

Valor de venda usa a MESMA fórmula do módulo oficial de Faturamento
(rotina 1464 — ver faturamento_sql.py, CTE VENDAS): QT*PUNIT simples
ignorava IPI, ST, frete, outras despesas e o preço de contrato
(CONDVENDA=7), o que deixava o valor sistematicamente menor que o
oficial. Também desconta devolução (NF de entrada, CODOPER='ED'), mesma
fórmula e filtros fiscais do faturamento oficial (CTE DEVOLUCOES),
agrupado por cliente em vez de vendedor/seção — PCNFENT.CODFORNEC guarda
o CÓDIGO DO CLIENTE que devolveu (nomenclatura do Winthor: do ponto de
vista da NF de entrada, quem devolve "fornece" a mercadoria de volta).

build_comparativo_geral_sql   -> 1 linha por cliente, com valor/qtd dos dois
                                  anos lado a lado (FULL OUTER JOIN — cliente
                                  que só apareceu num dos anos também sai).
build_comparativo_mensal_sql  -> totais por mês/ano — vira o gráfico de
                                  linha (geral, ou de 1 cliente só se
                                  cod_cliente for passado).
build_devolucao_mensal_sql    -> devolução por mês/ano — subtraída em Python
                                  do valor de build_comparativo_mensal_sql
                                  (datas de venda e devolução vêm de tabelas
                                  diferentes, mais simples somar à parte).
"""
from typing import List, Optional
from config import FILIAL


def _filtro_carteira(params: dict, filtro_vendedor, filtro_supervisor) -> str:
    """
    Filtra pela carteira do CADASTRO ATUAL do cliente (PCCLIENT.CODUSUR1,
    via U = PCUSUARI joined em C.CODUSUR1) — é o cliente de quem é
    responsável por ele HOJE, não de quem fez a venda no passado. Se a
    área do cliente mudou de supervisor depois da venda, ele deve aparecer
    (inclusive como "perdido") pro responsável ATUAL, não pra quem vendeu.
    Precisa de C (PCCLIENT) e U (PCUSUARI ON U.CODUSUR = C.CODUSUR1) já no
    FROM/JOIN de quem usar.
    """
    filtro = ""
    if filtro_supervisor is not None:
        params["cod_supervisor"] = filtro_supervisor
        filtro += " AND U.CODSUPERVISOR = :cod_supervisor"
    if filtro_vendedor is not None:
        params["cod_vendedor"] = filtro_vendedor
        filtro += " AND C.CODUSUR1 = :cod_vendedor"
    return filtro


def _filtro_carteira_venda(params: dict, filtro_vendedor, filtro_supervisor) -> str:
    """
    Filtra pela carteira de QUEM VENDEU (mesma atribuição usada no
    Faturamento oficial e na Distribuição Numérica — dist_numerica_sql.py:
    NVL(N.CODSUPERVISOR, UV.CODSUPERVISOR), via UV = PCUSUARI joined em
    N.CODUSUR, o vendedor NO MOMENTO DA VENDA). Usado SÓ em
    build_clientes_ativos_sql, pra bater exatamente com o número da tela
    de Distribuição Numérica (que é calculado assim) — o resto do módulo
    usa o cadastro atual (_filtro_carteira), não este. Precisa de N
    (PCNFSAID) e UV (PCUSUARI ON UV.CODUSUR = N.CODUSUR) já no FROM.
    """
    filtro = ""
    if filtro_supervisor is not None:
        params["cod_supervisor"] = filtro_supervisor
        filtro += " AND NVL(N.CODSUPERVISOR, UV.CODSUPERVISOR) = :cod_supervisor"
    if filtro_vendedor is not None:
        params["cod_vendedor"] = filtro_vendedor
        filtro += " AND N.CODUSUR = :cod_vendedor"
    return filtro


def _excl_usur_especiais(filtro_vendedor, filtro_supervisor) -> str:
    """
    Mesma exclusão do Faturamento/DN (contas especiais 2/10/160/180): só
    exclui quando o filtro é de um supervisor/vendedor específico — no
    modo geral (sem filtro, ex.: fornecedor vendo todo mundo), essas contas
    continuam somadas ao todo, igual ao Faturamento em modo "gerencial".
    Usado só junto com _filtro_carteira_venda (build_clientes_ativos_sql).
    Precisa de UV (PCUSUARI ON UV.CODUSUR = N.CODUSUR) já no FROM.
    """
    if filtro_supervisor is not None or filtro_vendedor is not None:
        return " AND UV.CODUSUR NOT IN (2,10,160,180)"
    return ""


def _valor_venda_expr() -> str:
    """
    Fórmula EXATA de VLVENDA do faturamento_sql.py (rotina 1464), por linha
    (sem SUM externo) — usa os alias M (PCMOV) e N (PCNFSAID) já usados
    neste arquivo. O QT*PUNIT simples usado antes ignorava IPI, ST, frete,
    outras despesas e o preço de contrato (CONDVENDA=7), o que deixava o
    valor sistematicamente menor que o oficial.
    """
    return """CASE
        WHEN NVL(PCMOVCOMPLE.VLSUBTOTITEM,0) <> 0 THEN
            DECODE(NVL(M.TIPOITEM,'N'), 'I', 0,
                   NVL(PCMOVCOMPLE.VLSUBTOTITEM,0)
                   + (DECODE(NVL(M.TIPOITEM,'N'),'I',NVL(M.QTCONT,0),0)
                      * NVL(M.VLFRETE,0)))
        ELSE
            ROUND(
              DECODE(M.CODOPER,
                     'S', NVL(DECODE(N.CONDVENDA,7,M.QTCONT,M.QT),0),
                     'ST',NVL(DECODE(N.CONDVENDA,7,M.QTCONT,M.QT),0),
                     'SM',NVL(DECODE(N.CONDVENDA,7,M.QTCONT,M.QT),0),0)
              * NVL(DECODE(N.CONDVENDA, 7,
                   NVL(M.PUNITCONT,0)-NVL(M.VLIPI,0)-(NVL(M.ST,0)+NVL(PCMOVCOMPLE.VLSTTRANSFCD,0))+NVL(M.VLFRETE,0)+NVL(M.VLOUTRASDESP,0)+NVL(M.VLFRETE_RATEIO,0)+DECODE(NVL(N.SOMAREPASSEOUTRASDESPNF,'N'),'N',NVL(M.VLOUTROS,0),'S',NVL(M.VLOUTROS,0)-NVL(M.VLREPASSE,0)),
                   NVL(M.PUNIT,0)-NVL(M.VLIPI,0)-(NVL(M.ST,0)+NVL(PCMOVCOMPLE.VLSTTRANSFCD,0))+NVL(M.VLFRETE,0)+NVL(M.VLOUTRASDESP,0)+NVL(M.VLFRETE_RATEIO,0)+DECODE(NVL(N.SOMAREPASSEOUTRASDESPNF,'N'),'N',NVL(M.VLOUTROS,0),'S',NVL(M.VLOUTROS,0)-NVL(M.VLREPASSE,0))
              ),0),2)
            + ROUND(NVL(M.QT,0)*DECODE(N.CONDVENDA,5,0,6,0,11,0,12,0,DECODE(M.CODOPER,'SB',0,NVL(M.ST,0)+NVL(PCMOVCOMPLE.VLSTTRANSFCD,0))),2)
            + ROUND(NVL(M.QT,0)*DECODE(N.CONDVENDA,5,0,6,0,11,0,12,0,DECODE(M.CODOPER,'SB',0,NVL(M.VLIPI,0))),2)
    END"""


def _devolucao_valor_expr() -> str:
    """Mesma fórmula de VLDEVOLUCAO do faturamento_sql.py (rotina 1464)."""
    return """CASE WHEN NVL(PCMOVCOMPLE.VLSUBTOTITEM,0)<>0 THEN
                NVL(PCMOVCOMPLE.VLSUBTOTITEM,0)
                -ROUND(NVL(PCMOV.QT,0)*DECODE(PCNFSAID.CONDVENDA,5,0,6,0,11,0,12,0,DECODE(PCMOV.CODOPER,'SB',0,NVL(PCMOV.VLIPI,0))),2)
                -ROUND(NVL(PCMOV.QT,0)*DECODE(PCNFSAID.CONDVENDA,5,0,6,0,11,0,12,0,DECODE(PCMOV.CODOPER,'SB',0,NVL(PCMOV.ST,0))),2)
            ELSE
                DECODE(PCNFSAID.CONDVENDA,5,0,DECODE(NVL(PCMOVCOMPLE.BONIFIC,'N'),'N',NVL(PCMOV.QT,0),0))
                *DECODE(PCNFSAID.CONDVENDA,5,0,6,0,11,0,
                        DECODE(PCMOV.PUNIT,0,NVL(PCMOV.PUNITCONT,0),NULL,NVL(PCMOV.PUNITCONT,0),NVL(PCMOV.PUNIT,0))
                        +NVL(PCMOV.VLFRETE,0)+NVL(PCMOV.VLOUTRASDESP,0)+NVL(PCMOV.VLFRETE_RATEIO,0)
                        -DECODE(NVL(PCNFSAID.SOMAREPASSEOUTRASDESPNF,'N'),'N',DECODE(NVL(PCMOV.VLOUTROS,0),0,NVL(PCMOV.VLREPASSE,0),0),'S',NVL(PCMOV.VLREPASSE,0))
                        +NVL(PCMOV.VLOUTROS,0))
        END"""


def _devolucao_from_where(placeholders: str, dt_ini_expr: str, dt_fim_expr: str,
                           filtro_cliente: str = "", filtro_carteira: str = "") -> str:
    """
    FROM/WHERE compartilhado das CTEs de devolução — só muda o intervalo de
    data e os filtros opcionais de cliente/carteira.

    DC/DU (PCCLIENT/PCUSUARI em cima de PCNFENT.CODFORNEC, o CLIENTE que
    devolveu) só entram pra permitir o filtro_carteira opcional — usado por
    build_devolucao_mensal_sql quando chamado SEM cod_cliente (visão geral
    do mês, não drill-down de 1 cliente): sem esse filtro, a devolução da
    EMPRESA INTEIRA pro fornecedor era subtraída do valor de um vendedor/
    supervisor só, podendo virar um mês bem negativo mesmo a venda dele
    tendo sido positiva.
    """
    return f"""FROM PCNFENT
        INNER JOIN PCESTCOM    ON PCESTCOM.NUMTRANSENT   = PCNFENT.NUMTRANSENT
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSENT      = PCESTCOM.NUMTRANSENT AND PCMOV.CODFILIAL = PCNFENT.CODFILIAL
        LEFT  JOIN PCNFSAID    ON PCNFSAID.NUMTRANSVENDA = PCESTCOM.NUMTRANSVENDA
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD       = PCMOV.CODPROD
        LEFT  JOIN PCCLIENT  DC ON DC.CODCLI  = PCNFENT.CODFORNEC
        LEFT  JOIN PCUSUARI  DU ON DU.CODUSUR = DC.CODUSUR1
        CROSS JOIN PARAMS P
    WHERE PCNFENT.DTENT BETWEEN {dt_ini_expr} AND {dt_fim_expr}
      AND PCMOV.DTMOV   BETWEEN {dt_ini_expr} AND {dt_fim_expr}
      AND PCNFENT.CODFILIAL IN ('{FILIAL}') AND PCMOV.CODFILIAL IN ('{FILIAL}')
      AND PCPRODUT.CODFORNEC IN ({placeholders})
      AND NVL(PCNFENT.CODFISCAL,0) IN (131,132,231,232,199,299)
      AND PCMOV.CODOPER = 'ED'
      AND PCNFENT.TIPODESCARGA IN ('6','7','T')
      AND NVL(PCNFENT.TIPOMOVGARANTIA,-1)=-1
      AND NVL(PCNFENT.OBS,'X')<>'NF CANCELADA'
      AND PCMOV.DTCANCEL IS NULL
      AND NVL(PCNFSAID.CONDVENDA,0) NOT IN (4,8,10,13,20,98,99)
      {filtro_cliente}
      {filtro_carteira}"""


def build_comparativo_geral_sql(
    codfornecs: List[int],
    dt_ini_atual: str, dt_fim_atual: str,
    dt_ini_anterior: str, dt_fim_anterior: str,
    filtro_vendedor: Optional[int] = None,
    filtro_supervisor: Optional[int] = None,
) -> tuple:
    """1 linha por cliente que comprou em pelo menos um dos dois períodos,
    com valor/quantidade dos dois anos lado a lado (valor líquido de
    devolução).

    cod_vendedor/nome_vendedor/cod_supervisor vêm do CADASTRO ATUAL do
    cliente (PCCLIENT.CODUSUR1) — quem é responsável por ele HOJE, não
    quem fez a venda no passado. Um cliente que mudou de área continua
    aparecendo (inclusive como "perdido") pro supervisor/vendedor atual,
    não pra quem vendeu antes da mudança — é assim que o time enxerga "os
    meus clientes perdidos" na prática.

    teve_compra_ano_anterior olha o ANO INTEIRO anterior (não só o mesmo
    período-a-data usado em valor_anterior/qtd_anterior) — evita classificar
    como "novo" um cliente que já comprava no ano anterior mas só passou a
    ser atendido depois da data de corte do período comparado (ex.: cliente
    que só começou a comprar em out/2025 aparecia "novo" em 2026 porque o
    período comparado de 2025 era só jan-jul)."""
    if not codfornecs:
        return "SELECT 1 FROM DUAL WHERE 1=0", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {f"f{i}": cod for i, cod in enumerate(codfornecs)}
    params.update({
        "dt_ini_a": dt_ini_atual,    "dt_fim_a": dt_fim_atual,
        "dt_ini_b": dt_ini_anterior, "dt_fim_b": dt_fim_anterior,
        "dt_fim_ano_b": f"{dt_ini_anterior[:4]}-12-31",
    })
    filtro_carteira = _filtro_carteira(params, filtro_vendedor, filtro_supervisor)
    vl_devol  = _devolucao_valor_expr()
    vl_venda  = _valor_venda_expr()

    sql = f"""
WITH PARAMS AS (
    SELECT
        TO_DATE(:dt_ini_a,'YYYY-MM-DD') AS DT_INI_A, TO_DATE(:dt_fim_a,'YYYY-MM-DD') AS DT_FIM_A,
        TO_DATE(:dt_ini_b,'YYYY-MM-DD') AS DT_INI_B, TO_DATE(:dt_fim_b,'YYYY-MM-DD') AS DT_FIM_B
    FROM DUAL
),
BASE AS (
    SELECT M.CODCLI, N.DTSAIDA, NVL(M.QT,0) AS QT,
           {vl_venda} AS VL
    FROM PCMOV M
        INNER JOIN PCNFSAID N  ON N.NUMTRANSVENDA = M.NUMTRANSVENDA AND N.CODFILIAL = M.CODFILIAL
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = M.NUMTRANSITEM
        INNER JOIN PCPRODUT PR ON PR.CODPROD = M.CODPROD
        CROSS JOIN PARAMS P
    WHERE PR.CODFORNEC IN ({placeholders})
      AND N.DTSAIDA BETWEEN LEAST(P.DT_INI_A, P.DT_INI_B) AND GREATEST(P.DT_FIM_A, P.DT_FIM_B)
      AND N.CODFILIAL IN ('{FILIAL}')
      AND M.CODFILIAL IN ('{FILIAL}')
      AND M.CODOPER NOT IN ('SR','SO')
      AND NVL(N.TIPOVENDA,'X') NOT IN ('SR','DF')
      AND N.CODFISCAL NOT IN (522,622,722,532,632,732)
      AND N.CONDVENDA NOT IN (4,8,10,13,20,98,99)
      AND N.DTCANCEL IS NULL
),
AGG_ATUAL AS (
    SELECT B.CODCLI, SUM(B.VL) AS VALOR, SUM(B.QT) AS QTD, MAX(B.DTSAIDA) AS ULTIMA_COMPRA
    FROM BASE B CROSS JOIN PARAMS P
    WHERE B.DTSAIDA BETWEEN P.DT_INI_A AND P.DT_FIM_A
    GROUP BY B.CODCLI
),
AGG_ANTERIOR AS (
    SELECT B.CODCLI, SUM(B.VL) AS VALOR, SUM(B.QT) AS QTD
    FROM BASE B CROSS JOIN PARAMS P
    WHERE B.DTSAIDA BETWEEN P.DT_INI_B AND P.DT_FIM_B
    GROUP BY B.CODCLI
),
AGG_ANTERIOR_ANO AS (
    SELECT B.CODCLI, SUM(B.QT) AS QTD_ANO
    FROM BASE B CROSS JOIN PARAMS P
    WHERE B.DTSAIDA BETWEEN P.DT_INI_B AND TO_DATE(:dt_fim_ano_b,'YYYY-MM-DD')
    GROUP BY B.CODCLI
),
DEVOL_ATUAL AS (
    SELECT PCNFENT.CODFORNEC AS CODCLI, SUM({vl_devol}) AS VLDEVOLUCAO
    {_devolucao_from_where(placeholders, "P.DT_INI_A", "P.DT_FIM_A")}
    GROUP BY PCNFENT.CODFORNEC
),
DEVOL_ANTERIOR AS (
    SELECT PCNFENT.CODFORNEC AS CODCLI, SUM({vl_devol}) AS VLDEVOLUCAO
    {_devolucao_from_where(placeholders, "P.DT_INI_B", "P.DT_FIM_B")}
    GROUP BY PCNFENT.CODFORNEC
)
SELECT
    C.CODCLI                                                 AS cod_cliente,
    NVL(NULLIF(TRIM(C.FANTASIA),''), C.CLIENTE)               AS nome_cliente,
    NVL(CD.NOMECIDADE,'—')                                    AS nome_cidade,
    C.CODUSUR1                                                AS cod_vendedor,
    U.NOME                                                    AS nome_vendedor,
    U.CODSUPERVISOR                                            AS cod_supervisor,
    ROUND(NVL(A.VALOR, 0) - NVL(DA.VLDEVOLUCAO, 0), 2)        AS valor_atual,
    NVL(A.QTD, 0)                                              AS qtd_atual,
    A.ULTIMA_COMPRA                                            AS ultima_compra_atual,
    ROUND(NVL(B.VALOR, 0) - NVL(DB.VLDEVOLUCAO, 0), 2)        AS valor_anterior,
    NVL(B.QTD, 0)                                              AS qtd_anterior,
    CASE WHEN NVL(H.QTD_ANO, 0) > 0 THEN 1 ELSE 0 END          AS teve_compra_ano_anterior
FROM (SELECT CODCLI FROM AGG_ATUAL UNION SELECT CODCLI FROM AGG_ANTERIOR) T
    INNER JOIN PCCLIENT C   ON C.CODCLI  = T.CODCLI
    LEFT  JOIN PCUSUARI U   ON U.CODUSUR = C.CODUSUR1
    LEFT  JOIN PCCIDADE CD  ON CD.CODCIDADE = C.CODCIDADE
    LEFT  JOIN AGG_ATUAL     A  ON A.CODCLI  = T.CODCLI
    LEFT  JOIN AGG_ANTERIOR  B  ON B.CODCLI  = T.CODCLI
    LEFT  JOIN AGG_ANTERIOR_ANO H ON H.CODCLI = T.CODCLI
    LEFT  JOIN DEVOL_ATUAL    DA ON DA.CODCLI = T.CODCLI
    LEFT  JOIN DEVOL_ANTERIOR DB ON DB.CODCLI = T.CODCLI
WHERE 1=1 {filtro_carteira}
ORDER BY valor_atual DESC
"""
    return sql, params


def build_clientes_ativos_sql(
    codfornecs: List[int],
    dt_ini: str, dt_fim: str,
    filtro_vendedor: Optional[int] = None,
    filtro_supervisor: Optional[int] = None,
) -> tuple:
    """
    Clientes ATIVOS de verdade: compraram dentro da janela [dt_ini, dt_fim]
    já calculada pelo chamador como os últimos 3 meses FECHADOS (mesmo
    critério de "elegibilidade"/lista negra usado em lista_negra_sql.py e
    bateu_levou_positivacao_sql.py — ex.: referência em julho -> 01/abr a
    30/jun, não uma janela rolante de 90 dias até hoje) — diferente de
    "atendidos no período", que é só a contagem de quem apareceu em
    build_comparativo_geral_sql (pode incluir cliente que comprou uma vez
    em janeiro e nunca mais, e ainda assim contar como "atendido no ano").

    Único ponto do módulo que filtra pela carteira de QUEM VENDEU
    (_filtro_carteira_venda), não pelo cadastro atual — de propósito, pra
    esse número bater exatamente com a "meta de 3 meses" da tela de
    Distribuição Numérica, que é calculada assim.
    """
    if not codfornecs:
        return "SELECT 0 AS qtd FROM DUAL", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {f"f{i}": cod for i, cod in enumerate(codfornecs)}
    params["dt_ini"] = dt_ini
    params["dt_fim"] = dt_fim
    filtro_carteira = _filtro_carteira_venda(params, filtro_vendedor, filtro_supervisor)
    excl_usur       = _excl_usur_especiais(filtro_vendedor, filtro_supervisor)

    sql = f"""
WITH PARAMS AS (
    SELECT TO_DATE(:dt_ini,'YYYY-MM-DD') AS DT_INI,
           TO_DATE(:dt_fim,'YYYY-MM-DD') AS DT_FIM
    FROM DUAL
)
SELECT COUNT(DISTINCT M.CODCLI) AS qtd
FROM PCMOV M
    INNER JOIN PCNFSAID N  ON N.NUMTRANSVENDA = M.NUMTRANSVENDA AND N.CODFILIAL = M.CODFILIAL
    INNER JOIN PCPRODUT PR ON PR.CODPROD = M.CODPROD
    INNER JOIN PCUSUARI UV ON UV.CODUSUR = N.CODUSUR
    CROSS JOIN PARAMS P
WHERE PR.CODFORNEC IN ({placeholders})
  AND N.DTSAIDA BETWEEN P.DT_INI AND P.DT_FIM
  AND N.CODFILIAL IN ('{FILIAL}')
  AND M.CODFILIAL IN ('{FILIAL}')
  AND M.CODOPER NOT IN ('SR','SO')
  AND NVL(N.TIPOVENDA,'X') NOT IN ('SR','DF')
  AND N.CODFISCAL NOT IN (522,622,722,532,632,732)
  AND N.CONDVENDA NOT IN (4,8,10,13,20,98,99)
  AND N.DTCANCEL IS NULL
  {filtro_carteira}
  {excl_usur}
"""
    return sql, params


def build_comparativo_mensal_sql(
    codfornecs: List[int],
    dt_ini: str, dt_fim: str,
    filtro_vendedor: Optional[int] = None,
    filtro_supervisor: Optional[int] = None,
    cod_cliente: Optional[int] = None,
) -> tuple:
    """
    Totais por (ano, mês) dentro de [dt_ini, dt_fim] — cobre os dois anos de
    uma vez, o pivô pra série "atual"/"anterior" por mês é feito em Python.
    cod_cliente, se passado, restringe a 1 cliente só (drill-down). Valor
    BRUTO (sem devolução) — ver build_devolucao_mensal_sql pro desconto.
    """
    if not codfornecs:
        return "SELECT 1 FROM DUAL WHERE 1=0", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {f"f{i}": cod for i, cod in enumerate(codfornecs)}
    params["dt_ini"] = dt_ini
    params["dt_fim"] = dt_fim
    filtro_carteira = _filtro_carteira(params, filtro_vendedor, filtro_supervisor)

    filtro_cliente = ""
    if cod_cliente is not None:
        params["cod_cliente"] = cod_cliente
        filtro_cliente = " AND M.CODCLI = :cod_cliente"

    vl_venda = _valor_venda_expr()
    sql = f"""
WITH PARAMS AS (
    SELECT TO_DATE(:dt_ini,'YYYY-MM-DD') AS DT_INI, TO_DATE(:dt_fim,'YYYY-MM-DD') AS DT_FIM
    FROM DUAL
)
SELECT
    EXTRACT(YEAR  FROM N.DTSAIDA) AS ano,
    EXTRACT(MONTH FROM N.DTSAIDA) AS mes,
    COUNT(DISTINCT M.CODCLI)      AS qtd_clientes,
    ROUND(SUM({vl_venda}),2)      AS valor,
    SUM(NVL(M.QT,0))              AS quantidade
FROM PCMOV M
    INNER JOIN PCNFSAID N  ON N.NUMTRANSVENDA = M.NUMTRANSVENDA AND N.CODFILIAL = M.CODFILIAL
    LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = M.NUMTRANSITEM
    INNER JOIN PCPRODUT PR ON PR.CODPROD = M.CODPROD
    INNER JOIN PCCLIENT C  ON C.CODCLI = M.CODCLI
    LEFT  JOIN PCUSUARI U  ON U.CODUSUR = C.CODUSUR1
    CROSS JOIN PARAMS P
WHERE PR.CODFORNEC IN ({placeholders})
  AND N.DTSAIDA BETWEEN P.DT_INI AND P.DT_FIM
  AND N.CODFILIAL IN ('{FILIAL}')
  AND M.CODFILIAL IN ('{FILIAL}')
  AND M.CODOPER NOT IN ('SR','SO')
  AND NVL(N.TIPOVENDA,'X') NOT IN ('SR','DF')
  AND N.CODFISCAL NOT IN (522,622,722,532,632,732)
  AND N.CONDVENDA NOT IN (4,8,10,13,20,98,99)
  AND N.DTCANCEL IS NULL
  {filtro_carteira}
  {filtro_cliente}
GROUP BY EXTRACT(YEAR FROM N.DTSAIDA), EXTRACT(MONTH FROM N.DTSAIDA)
ORDER BY ano, mes
"""
    return sql, params


def build_devolucao_mensal_sql(
    codfornecs: List[int],
    dt_ini: str, dt_fim: str,
    cod_cliente: Optional[int] = None,
    filtro_vendedor: Optional[int] = None,
    filtro_supervisor: Optional[int] = None,
) -> tuple:
    """
    Devolução por (ano, mês) dentro de [dt_ini, dt_fim] (mês em que a NF de
    entrada foi lançada — PCNFENT.DTENT — mesma convenção do faturamento
    oficial). Somado à parte porque a data de referência é de uma tabela
    diferente da venda (PCNFENT, não PCNFSAID); o desconto é feito em
    Python no _pivot_mensal do router.

    filtro_vendedor/filtro_supervisor: mesma carteira do CADASTRO ATUAL do
    cliente que devolveu (igual _filtro_carteira das outras funções deste
    módulo) — ESSENCIAL na visão geral (sem cod_cliente): sem isso, a
    devolução da EMPRESA INTEIRA pro fornecedor era subtraída do valor de
    UM vendedor/supervisor só, fazendo o mês dele aparecer bem negativo
    mesmo com venda positiva (o valor batia errado com o Faturamento
    oficial, que já soma a devolução só da carteira de quem está sendo
    visto). No drill-down de 1 cliente (cod_cliente informado) isso não
    fazia diferença, pois a devolução já é só daquele cliente.
    """
    if not codfornecs:
        return "SELECT 1 FROM DUAL WHERE 1=0", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {f"f{i}": cod for i, cod in enumerate(codfornecs)}
    params["dt_ini"] = dt_ini
    params["dt_fim"] = dt_fim
    vl_devol = _devolucao_valor_expr()

    filtro_cliente = ""
    if cod_cliente is not None:
        params["cod_cliente"] = cod_cliente
        filtro_cliente = " AND PCNFENT.CODFORNEC = :cod_cliente"

    filtro_carteira = ""
    if filtro_supervisor is not None:
        params["cod_supervisor"] = filtro_supervisor
        filtro_carteira += " AND DU.CODSUPERVISOR = :cod_supervisor"
    if filtro_vendedor is not None:
        params["cod_vendedor"] = filtro_vendedor
        filtro_carteira += " AND DC.CODUSUR1 = :cod_vendedor"

    sql = f"""
WITH PARAMS AS (
    SELECT TO_DATE(:dt_ini,'YYYY-MM-DD') AS DT_INI, TO_DATE(:dt_fim,'YYYY-MM-DD') AS DT_FIM
    FROM DUAL
)
SELECT
    EXTRACT(YEAR  FROM PCNFENT.DTENT) AS ano,
    EXTRACT(MONTH FROM PCNFENT.DTENT) AS mes,
    SUM({vl_devol}) AS valor_devolucao
{_devolucao_from_where(placeholders, "P.DT_INI", "P.DT_FIM", filtro_cliente, filtro_carteira)}
GROUP BY EXTRACT(YEAR FROM PCNFENT.DTENT), EXTRACT(MONTH FROM PCNFENT.DTENT)
"""
    return sql, params
