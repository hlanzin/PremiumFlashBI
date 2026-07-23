"""
SQL do módulo Ranking de Clientes — ranking dos clientes que mais compram
de um fornecedor (por valor ou por peso), num período.

Vendedor/supervisor veem só a própria carteira (filtro_vendedor /
filtro_supervisor); gerencial/admin/fornecedor veem todo mundo.

valor_total já desconta devolução (NF de entrada com CODOPER='ED'), mesma
fórmula e mesmos filtros fiscais do módulo oficial de Faturamento
(rotina 1464 — ver faturamento_sql.py, CTE DEVOLUCOES), só que agrupado
por cliente (via PCNFENT.CODFORNEC, que no lançamento de devolução
guarda o CÓDIGO DO CLIENTE que devolveu) em vez de vendedor/seção.

A ordenação por valor/peso é feita no frontend (mesmo dado serve pros
dois); aqui só se traz tudo já calculado por cliente.
"""
from typing import List, Optional
from config import FILIAL


def _valor_venda_expr() -> str:
    """
    Fórmula EXATA de VLVENDA do faturamento_sql.py (rotina 1464), por
    linha (sem SUM externo) — o QT*PUNIT simples usado antes ignorava IPI,
    ST, frete, outras despesas e o preço de contrato (CONDVENDA=7), o que
    deixava o valor sistematicamente menor que o oficial.
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


def _devolucao_cte(placeholders: str) -> str:
    return f"""
DEVOL AS (
    SELECT PCNFENT.CODFORNEC AS CODCLI,
        SUM(CASE WHEN NVL(PCMOVCOMPLE.VLSUBTOTITEM,0)<>0 THEN
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
        END) AS VLDEVOLUCAO
    FROM PCNFENT
        INNER JOIN PCESTCOM    ON PCESTCOM.NUMTRANSENT   = PCNFENT.NUMTRANSENT
        INNER JOIN PCMOV       ON PCMOV.NUMTRANSENT      = PCESTCOM.NUMTRANSENT AND PCMOV.CODFILIAL = PCNFENT.CODFILIAL
        LEFT  JOIN PCNFSAID    ON PCNFSAID.NUMTRANSVENDA = PCESTCOM.NUMTRANSVENDA
        LEFT  JOIN PCMOVCOMPLE ON PCMOVCOMPLE.NUMTRANSITEM = PCMOV.NUMTRANSITEM
        INNER JOIN PCPRODUT    ON PCPRODUT.CODPROD       = PCMOV.CODPROD
        CROSS JOIN PARAMS P
    WHERE PCNFENT.DTENT BETWEEN P.DT_INI AND P.DT_FIM
      AND PCMOV.DTMOV   BETWEEN P.DT_INI AND P.DT_FIM
      AND PCNFENT.CODFILIAL IN ('{FILIAL}') AND PCMOV.CODFILIAL IN ('{FILIAL}')
      AND PCPRODUT.CODFORNEC IN ({placeholders})
      AND NVL(PCNFENT.CODFISCAL,0) IN (131,132,231,232,199,299)
      AND PCMOV.CODOPER = 'ED'
      AND PCNFENT.TIPODESCARGA IN ('6','7','T')
      AND NVL(PCNFENT.TIPOMOVGARANTIA,-1)=-1
      AND NVL(PCNFENT.OBS,'X')<>'NF CANCELADA'
      AND PCMOV.DTCANCEL IS NULL
      AND NVL(PCNFSAID.CONDVENDA,0) NOT IN (4,8,10,13,20,98,99)
    GROUP BY PCNFENT.CODFORNEC
)"""


def build_ranking_clientes_sql(codfornecs: List[int], dt_ini: str, dt_fim: str,
                                filtro_vendedor: Optional[int] = None,
                                filtro_supervisor: Optional[int] = None) -> tuple:
    """
    codfornecs : lista de CODFORNECs
    dt_ini/dt_fim : 'YYYY-MM-DD' — período de venda faturada (PCNFSAID.DTSAIDA)
    filtro_vendedor   : restringe a clientes do próprio vendedor (C.CODUSUR1)
    filtro_supervisor : restringe a clientes de vendedores do supervisor
    """
    if not codfornecs:
        return "SELECT 1 FROM DUAL WHERE 1=0", {}

    placeholders = ", ".join(f":f{i}" for i in range(len(codfornecs)))
    params = {f"f{i}": cod for i, cod in enumerate(codfornecs)}
    params["dt_ini"] = dt_ini
    params["dt_fim"] = dt_fim

    # As duas condições podem valer ao mesmo tempo (ex.: supervisor logado +
    # filtrando um vendedor específico da própria equipe) — cada uma só
    # estreita mais o resultado, nunca conflita.
    filtro_carteira = ""
    if filtro_supervisor is not None:
        params["cod_supervisor"] = filtro_supervisor
        filtro_carteira += " AND U.CODSUPERVISOR = :cod_supervisor"
    if filtro_vendedor is not None:
        params["cod_vendedor"] = filtro_vendedor
        filtro_carteira += " AND C.CODUSUR1 = :cod_vendedor"

    valor_venda = _valor_venda_expr()
    sql = f"""
WITH PARAMS AS (
    SELECT TO_DATE(:dt_ini,'YYYY-MM-DD') AS DT_INI,
           TO_DATE(:dt_fim,'YYYY-MM-DD') AS DT_FIM
    FROM DUAL
),
{_devolucao_cte(placeholders)}
SELECT
    C.CODCLI                                                 AS cod_cliente,
    NVL(NULLIF(TRIM(C.FANTASIA),''), C.CLIENTE)               AS nome_cliente,
    C.CLIENTE                                                AS razao_social,
    NVL(CD.NOMECIDADE,'—')                                    AS nome_cidade,
    C.CODUSUR1                                                AS cod_vendedor,
    U.NOME                                                    AS nome_vendedor,
    U.CODSUPERVISOR                                            AS cod_supervisor,
    SUM(NVL(M.QT,0))                                           AS quantidade,
    ROUND(SUM(NVL(M.QT,0) * NVL(PR.PESOBRUTO,0)), 3)          AS peso_total,
    ROUND(SUM({valor_venda}) - NVL(DV.VLDEVOLUCAO,0), 2)      AS valor_total,
    COUNT(DISTINCT N.NUMTRANSVENDA)                            AS qt_notas,
    MAX(N.DTSAIDA)                                             AS ultima_compra
FROM PCMOV M
    INNER JOIN PCNFSAID N   ON N.NUMTRANSVENDA  = M.NUMTRANSVENDA
                            AND N.CODFILIAL      = M.CODFILIAL
    LEFT  JOIN PCMOVCOMPLE  ON PCMOVCOMPLE.NUMTRANSITEM = M.NUMTRANSITEM
    INNER JOIN PCPRODUT PR  ON PR.CODPROD        = M.CODPROD
    INNER JOIN PCCLIENT C   ON C.CODCLI          = M.CODCLI
    LEFT  JOIN PCUSUARI U   ON U.CODUSUR         = C.CODUSUR1
    LEFT  JOIN PCCIDADE CD  ON CD.CODCIDADE      = C.CODCIDADE
    LEFT  JOIN DEVOL DV     ON DV.CODCLI         = C.CODCLI
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
  {filtro_carteira}
GROUP BY
    C.CODCLI, C.FANTASIA, C.CLIENTE, CD.NOMECIDADE,
    C.CODUSUR1, U.NOME, U.CODSUPERVISOR, DV.VLDEVOLUCAO
ORDER BY valor_total DESC
"""
    return sql, params
