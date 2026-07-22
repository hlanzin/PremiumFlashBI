"""
SQL do módulo Ranking de Clientes — ranking dos clientes que mais compram
de um fornecedor (por valor ou por peso), num período.

Vendedor/supervisor veem só a própria carteira (filtro_vendedor /
filtro_supervisor); gerencial/admin/fornecedor veem todo mundo.

A ordenação por valor/peso é feita no frontend (mesmo dado serve pros
dois); aqui só se traz tudo já calculado por cliente.
"""
from typing import List, Optional
from config import FILIAL


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

    sql = f"""
WITH PARAMS AS (
    SELECT TO_DATE(:dt_ini,'YYYY-MM-DD') AS DT_INI,
           TO_DATE(:dt_fim,'YYYY-MM-DD') AS DT_FIM
    FROM DUAL
)
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
    ROUND(SUM(NVL(M.QT,0) * NVL(M.PUNIT,0)), 2)              AS valor_total,
    COUNT(DISTINCT N.NUMTRANSVENDA)                            AS qt_notas,
    MAX(N.DTSAIDA)                                             AS ultima_compra
FROM PCMOV M
    INNER JOIN PCNFSAID N   ON N.NUMTRANSVENDA  = M.NUMTRANSVENDA
                            AND N.CODFILIAL      = M.CODFILIAL
    INNER JOIN PCPRODUT PR  ON PR.CODPROD        = M.CODPROD
    INNER JOIN PCCLIENT C   ON C.CODCLI          = M.CODCLI
    LEFT  JOIN PCUSUARI U   ON U.CODUSUR         = C.CODUSUR1
    LEFT  JOIN PCCIDADE CD  ON CD.CODCIDADE      = C.CODCIDADE
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
    C.CODUSUR1, U.NOME, U.CODSUPERVISOR
ORDER BY valor_total DESC
"""
    return sql, params
