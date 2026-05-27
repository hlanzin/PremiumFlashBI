"""
SQL do módulo Pedidos (baseado na rotina 335 do Winthor).
"""
from typing import Optional
from config import FILIAL


POSICAO_LABEL = {
    'A': 'Atendido',   'B': 'Bloqueado',  'C': 'Cancelado',
    'E': 'Em Separação','F': 'Faturado',  'I': 'Importado',
    'L': 'Liberado',   'N': 'Pendente',   'P': 'Pré-venda',
    'S': 'Separado',
}


def build_pedidos_sql(
    dt_ini:        str,
    dt_fim:        str,
    cod_vendedor:  Optional[int] = None,
    cod_supervisor:Optional[int] = None,
    codcli:        Optional[int] = None,
    numped:        Optional[int] = None,
) -> tuple:
    filtros = []
    if cod_vendedor:
        filtros.append(f"AND PCPEDC.CODUSUR = {cod_vendedor}")
    elif cod_supervisor:
        filtros.append(f"AND U.CODSUPERVISOR = {cod_supervisor}")
    if codcli:
        filtros.append(f"AND PCPEDC.CODCLI = {codcli}")
    if numped:
        filtros.append(f"AND PCPEDC.NUMPED = {numped}")

    filtros_str = "\n      ".join(filtros)

    sql = f"""
SELECT
    PCPEDC.NUMPED                                      AS numped,
    PCPEDC.DATA                                        AS dt_pedido,
    PCPEDC.CODCLI                                      AS codcli,
    C.CLIENTE                                          AS razao_social,
    C.FANTASIA                                         AS fantasia,
    PCPEDC.POSICAO                                     AS posicao,
    PCPEDC.VLTOTAL                                     AS vl_total,
    PCPEDC.CODUSUR                                     AS cod_vendedor,
    U.NOME                                             AS nome_vendedor,
    U.CODSUPERVISOR                                    AS cod_supervisor,
    S.NOME                                             AS nome_supervisor,
    PCPEDC.DTFAT                                       AS dt_faturamento,
    PCPEDC.DTCANCEL                                    AS dt_cancelamento,
    PCPEDC.CONDVENDA                                   AS condvenda,
    NVL(PCPEDC.NUMITENS, 0)                            AS num_itens,
    (SELECT MIN(NF.NUMNOTA)
       FROM PCNFSAID NF
      WHERE NF.NUMTRANSVENDA = PCPEDC.NUMTRANSVENDA
        AND NF.CODFILIAL      = PCPEDC.CODFILIAL)       AS num_nota
FROM PCPEDC
    INNER JOIN PCCLIENT  C ON C.CODCLI          = PCPEDC.CODCLI
    INNER JOIN PCUSUARI  U ON U.CODUSUR         = PCPEDC.CODUSUR
    LEFT  JOIN PCSUPERV  S ON S.CODSUPERVISOR   = U.CODSUPERVISOR
WHERE PCPEDC.DATA      BETWEEN TO_DATE('{dt_ini}','YYYY-MM-DD')
                           AND TO_DATE('{dt_fim}','YYYY-MM-DD')
  AND PCPEDC.CODFILIAL  IN ('{FILIAL}')
  AND U.NOME            LIKE 'PMU%'
  AND U.CODSUPERVISOR   NOT IN ('9999','999999')
  {filtros_str}
ORDER BY PCPEDC.DATA DESC, PCPEDC.NUMPED DESC
"""
    return sql, []


def build_itens_sql(numped: int) -> tuple:
    sql = f"""
SELECT
    I.NUMSEQ                                           AS numseq,
    I.CODPROD                                          AS codprod,
    P.DESCRICAO                                        AS descricao,
    P.EMBALAGEM                                        AS embalagem,
    F.FORNECEDOR                                       AS fornecedor,
    I.QT                                               AS qt,
    I.PVENDA                                           AS pvenda,
    I.PTABELA                                          AS ptabela,
    ROUND(I.QT * I.PVENDA, 2)                          AS subtotal,
    ROUND(((NVL(I.PTABELA,0) - NVL(I.PVENDA,0))
           / DECODE(NVL(I.PTABELA,0),0,1,I.PTABELA)
           ) * 100, 2)                                 AS perdesc,
    NVL(I.BONIFIC,'N')                                 AS bonific,
    I.ST                                               AS st
FROM PCPEDI I
    INNER JOIN PCPRODUT  P ON P.CODPROD   = I.CODPROD
    LEFT  JOIN PCFORNEC  F ON F.CODFORNEC = P.CODFORNEC
WHERE I.NUMPED = {numped}
ORDER BY I.NUMSEQ
"""
    return sql, []
