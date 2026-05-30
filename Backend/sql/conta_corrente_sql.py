"""
SQL do módulo Conta Corrente de RCA.
Baseado na rotina 356 do Winthor.
Tabelas: PCUSUARI, PCLOGRCA, PCLOGDEBCRED
"""
from config import FILIAL

# ── Saldos de todos os vendedores ────────────────────────────────────────────
SQL_SALDOS = f"""
SELECT
    U.CODUSUR                                        AS cod_vendedor,
    U.NOME                                           AS nome_vendedor,
    U.CODSUPERVISOR                                  AS cod_supervisor,
    S.NOME                                           AS nome_supervisor,
    NVL(U.VLCORRENTE, 0)                             AS vlcorrente,
    NVL(U.VLLIMCRED,  0)                             AS vllimcred,
    NVL(U.VLLIMCRED,  0) - NVL(U.VLCORRENTE, 0)     AS disponivel
FROM PCUSUARI U
    LEFT JOIN PCSUPERV S ON S.CODSUPERVISOR = U.CODSUPERVISOR
WHERE U.DTTERMINO    IS NULL
  AND U.CODUSUR      <> 9999
  AND U.CODUSUR      NOT IN (2, 160, 180)
  {{filtro}}
ORDER BY S.NOME, U.NOME
"""

# ── Saldo de um vendedor específico ──────────────────────────────────────────
SQL_SALDO_VENDEDOR = """
SELECT
    U.CODUSUR                                        AS cod_vendedor,
    U.NOME                                           AS nome_vendedor,
    NVL(U.VLCORRENTE, 0)                             AS vlcorrente,
    NVL(U.VLLIMCRED,  0)                             AS vllimcred,
    NVL(U.VLLIMCRED,  0) - NVL(U.VLCORRENTE, 0)     AS disponivel
FROM PCUSUARI U
WHERE U.CODUSUR = :cod
"""

# ── Extrato do vendedor (PCLOGRCA) ────────────────────────────────────────────
SQL_EXTRATO = """
SELECT
    L.DATA                                           AS data_mov,
    L.ROTINA,
    NVL(L.VLCORRENTE,    0)                          AS vlcorrente,
    NVL(L.VLLIMCRED,     0)                          AS vllimcred,
    NVL(L.VLCORRENTEANT, 0)                          AS vlcorrenteant,
    NVL(L.VLLIMCREDANT,  0)                          AS vllimcredant,
    L.HISTORICO,
    L.HISTORICO2,
    NVL(L.VLDIFERENCA,   0)                          AS vldiferenca
FROM PCLOGRCA L
WHERE L.CODUSUR = :cod
ORDER BY L.DATA DESC
FETCH FIRST 150 ROWS ONLY
"""

# ── Busca saldo atual para cálculo do lançamento ─────────────────────────────
SQL_SALDO_ATUAL = """
SELECT NVL(VLCORRENTE, 0) AS vlcorrente,
       NVL(VLLIMCRED,  0) AS vllimcred
FROM PCUSUARI
WHERE CODUSUR = :cod
"""

# ── Update de saldo — único SQL, sinal determina direção ─────────────────────
# valor positivo  → VLCORRENTE sobe   (saída  — quem transfere)
# valor negativo  → VLCORRENTE desce  (entrada — quem recebe)
SQL_UPDATE_VLCORRENTE = """
UPDATE PCUSUARI
   SET VLCORRENTE = NVL(VLCORRENTE, 0) + :valor
 WHERE CODUSUR    = :cod
"""

# ── Insert log RCA ────────────────────────────────────────────────────────────
SQL_INSERT_LOGRCA = """
INSERT INTO PCLOGRCA (
    DATA, CODFUNC, CODUSUR, ROTINA,
    VLCORRENTE, VLLIMCRED,
    VLCORRENTEANT, VLLIMCREDANT,
    HISTORICO, HISTORICO2, VLDIFERENCA
) VALUES (
    SYSDATE, :codfunc, :codusur, 356,
    :vlcorrente_novo, :vllimcred,
    :vlcorrente_ant,  :vllimcred_ant,
    :historico, :historico2, 0
)
"""

# ── Insert log débito/crédito ─────────────────────────────────────────────────
SQL_INSERT_LOGDEBCRED = """
INSERT INTO PCLOGDEBCRED (
    DATA, CODFUNC, CODIGO, ROTINA,
    VLCORRENTE, VLLIMCRED,
    VLCORRENTEANT, VLLIMCREDANT,
    HISTORICO, HISTORICO2, VLDIFERENCA,
    TIPOCONTACORRENTE
) VALUES (
    SYSDATE, :codfunc, :codusur, 356,
    :vlcorrente_novo, :vllimcred,
    :vlcorrente_ant,  :vllimcred_ant,
    :historico, :historico2, 0,
    'R'
)
"""


def build_saldos_sql(filtro_supervisor=None, filtro_vendedor=None):
    """Retorna SQL + params para listagem de saldos."""
    params = []
    if filtro_vendedor:
        filtro = "AND U.CODUSUR = :p1"
        params = [filtro_vendedor]
    elif filtro_supervisor:
        filtro = "AND U.CODSUPERVISOR = :p1"
        params = [filtro_supervisor]
    else:
        filtro = ""
    return SQL_SALDOS.format(filtro=filtro), params