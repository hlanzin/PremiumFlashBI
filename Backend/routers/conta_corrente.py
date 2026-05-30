"""
Router Conta Corrente de RCA — /api/conta-corrente
Visualização de saldos + sistema de solicitações de lançamento.

Fluxo:
  Vendedor → POST /solicitar  → salva no SQLite (status=pendente)
  Admin    → GET  /pendentes  → lista pendentes
  Admin    → POST /aprovar    → executa no Oracle (UPDATE + INSERT logs)
  Admin    → POST /rejeitar   → marca como rejeitado no SQLite
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import sqlite3

from database import execute_query, execute_dml
from routers.auth import get_current_user, CurrentUser
from config import SUP_TO_RCA
from sql.conta_corrente_sql import (
    build_saldos_sql, SQL_SALDO_VENDEDOR, SQL_EXTRATO,
    SQL_SALDO_ATUAL, SQL_UPDATE_VLCORRENTE,
    SQL_INSERT_LOGRCA, SQL_INSERT_LOGDEBCRED,
)

router  = APIRouter(prefix="/api/conta-corrente", tags=["conta-corrente"])
DB_PATH = "flashbi_users.db"


# ── Garante que a tabela existe ───────────────────────────────────────────────
def _ensure_table():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cc_solicitacoes (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                codusur         INTEGER NOT NULL,
                nome_vendedor   TEXT,
                codusur_destino INTEGER,
                nome_destino    TEXT,
                valor           REAL    NOT NULL,
                tipo            TEXT    NOT NULL DEFAULT 'credito',
                historico       TEXT    NOT NULL,
                status          TEXT    NOT NULL DEFAULT 'pendente',
                criado_em       TEXT    NOT NULL,
                resolvido_em    TEXT,
                resolvido_por   TEXT,
                obs_admin       TEXT
            )
        """)
        # Migração: adiciona colunas se não existirem (já existentes ignoram)
        for col in [
            "ALTER TABLE cc_solicitacoes ADD COLUMN codusur_destino INTEGER",
            "ALTER TABLE cc_solicitacoes ADD COLUMN nome_destino TEXT",
        ]:
            try: conn.execute(col)
            except: pass
        conn.commit()

_ensure_table()


# ── Modelos Pydantic ──────────────────────────────────────────────────────────
class SolicitacaoCreate(BaseModel):
    codusur:   int
    valor:     float
    historico: str


class ResolverRequest(BaseModel):
    obs_admin: Optional[str] = None


# ── Helpers SQLite ────────────────────────────────────────────────────────────
def _get_sol(sol_id: int) -> dict:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM cc_solicitacoes WHERE id = ?", [sol_id]
        ).fetchone()
    if not row:
        raise HTTPException(404, "Solicitação não encontrada")
    return dict(row)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def get_saldos(u: CurrentUser = Depends(get_current_user)):
    """Lista saldos dos vendedores conforme cargo."""
    if u.cargo == "vendedor":
        rows = execute_query(SQL_SALDO_VENDEDOR, [u.cod_winthor])
    elif u.cargo == "supervisor":
        sql, params = build_saldos_sql(filtro_supervisor=u.cod_winthor)
        rows = execute_query(sql, params)
    else:
        sql, params = build_saldos_sql()
        rows = execute_query(sql, params)
    return {"dados": rows}


@router.get("/extrato/{codusur}")
def get_extrato(codusur: int, u: CurrentUser = Depends(get_current_user)):
    """Extrato de movimentações do vendedor (PCLOGRCA)."""
    if u.cargo == "vendedor" and u.cod_winthor != codusur:
        raise HTTPException(403, "Acesso negado")
    rows = execute_query(SQL_EXTRATO, [codusur])
    return {"dados": rows}


@router.get("/pendentes")
def get_pendentes(u: CurrentUser = Depends(get_current_user)):
    """Solicitações pendentes (admin/gerencial)."""
    if u.cargo not in ("admin", "gerencial"):
        raise HTTPException(403, "Acesso negado")
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM cc_solicitacoes WHERE status = 'pendente' ORDER BY criado_em DESC"
        ).fetchall()
    return {"dados": [dict(r) for r in rows]}


@router.get("/historico")
def get_historico(u: CurrentUser = Depends(get_current_user)):
    """Histórico completo de solicitações."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        if u.cargo in ("admin", "gerencial"):
            rows = conn.execute(
                "SELECT * FROM cc_solicitacoes ORDER BY criado_em DESC LIMIT 200"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM cc_solicitacoes WHERE codusur = ? ORDER BY criado_em DESC LIMIT 50",
                [u.cod_winthor]
            ).fetchall()
    return {"dados": [dict(r) for r in rows]}


@router.post("/solicitar")
def solicitar(req: SolicitacaoCreate, u: CurrentUser = Depends(get_current_user)):
    """Supervisor solicita transferência da própria conta para vendedor da equipe."""
    if u.cargo not in ("supervisor", "admin", "gerencial"):
        raise HTTPException(403, "Apenas supervisor ou admin pode solicitar transferência")
    if req.valor <= 0:
        raise HTTPException(400, "Valor deve ser positivo")

    # Supervisor: valida equipe e usa mapeamento RCA
    if u.cargo == "supervisor":
        if u.cod_winthor not in SUP_TO_RCA:
            raise HTTPException(400, f"Supervisor cod {u.cod_winthor} sem conta RCA configurada")
        check = execute_query(
            "SELECT 1 FROM PCUSUARI WHERE CODUSUR = :cod AND CODSUPERVISOR = :sup",
            [req.codusur, u.cod_winthor]
        )
        if not check:
            raise HTTPException(403, "Vendedor não pertence à sua equipe")
        codusur_origem  = SUP_TO_RCA[u.cod_winthor]
        codusur_destino = req.codusur
    else:
        # Admin/gerencial: origem = cod_winthor ou primeiro SUP_TO_RCA disponível
        cod = u.cod_winthor
        codusur_origem  = SUP_TO_RCA.get(cod, cod) if cod else list(SUP_TO_RCA.values())[0]
        codusur_destino = req.codusur

    # Busca nomes
    rows_orig = execute_query("SELECT NOME FROM PCUSUARI WHERE CODUSUR = :cod", [codusur_origem])
    rows_dest = execute_query("SELECT NOME FROM PCUSUARI WHERE CODUSUR = :cod", [codusur_destino])
    nome_orig = rows_orig[0]["nome"] if rows_orig else f"RCA #{codusur_origem}"
    nome_dest = rows_dest[0]["nome"] if rows_dest else f"RCA #{codusur_destino}"

    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            """INSERT INTO cc_solicitacoes
               (codusur, nome_vendedor, codusur_destino, nome_destino,
                valor, tipo, historico, status, criado_em)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            [codusur_origem, nome_orig, codusur_destino, nome_dest,
             req.valor, "transferencia", req.historico, "pendente",
             datetime.now().isoformat(timespec="seconds")]
        )
        sol_id = cur.lastrowid
        conn.commit()
    return {"id": sol_id, "status": "pendente"}


@router.post("/aprovar/{sol_id}")
def aprovar(sol_id: int, req: ResolverRequest,
            u: CurrentUser = Depends(get_current_user)):
    """Admin aprova: executa UPDATE + logs no Oracle e marca como aprovado."""
    if u.cargo != "admin":
        raise HTTPException(403, "Apenas admin pode aprovar")

    sol = _get_sol(sol_id)
    if sol["status"] != "pendente":
        raise HTTPException(400, f"Solicitação já está {sol['status']}")

    codusur_origem  = sol["codusur"]
    codusur_destino = sol["codusur_destino"]
    valor           = sol["valor"]

    if not codusur_destino:
        raise HTTPException(400, "Solicitação sem conta destino definida")

    # Lê saldos atuais
    orig = execute_query(SQL_SALDO_ATUAL, [codusur_origem])
    dest = execute_query(SQL_SALDO_ATUAL, [codusur_destino])
    if not orig: raise HTTPException(404, f"Conta origem (RCA {codusur_origem}) não encontrada")
    if not dest: raise HTTPException(404, f"Conta destino (RCA {codusur_destino}) não encontrada")

    vlcorr_orig_ant  = float(orig[0]["vlcorrente"])
    vllimcred_orig   = float(orig[0]["vllimcred"])
    vlcorr_orig_novo = round(vlcorr_orig_ant + valor, 2)   # origem: VLCORRENTE sobe (saída)

    vlcorr_dest_ant  = float(dest[0]["vlcorrente"])
    vllimcred_dest   = float(dest[0]["vllimcred"])
    vlcorr_dest_novo = round(vlcorr_dest_ant - valor, 2)   # destino: VLCORRENTE desce (entrada)

    historico  = sol["historico"][:40]
    historico2 = (req.obs_admin or "FLASH BI")[:40]
    codfunc    = u.cod_winthor or 999

    execute_dml([
        # Debita origem
        (SQL_UPDATE_VLCORRENTE, {"valor":  valor, "cod": codusur_origem}),
        (SQL_INSERT_LOGRCA, {
            "codfunc": codfunc, "codusur": codusur_origem,
            "vlcorrente_novo": vlcorr_orig_novo, "vllimcred": vllimcred_orig,
            "vlcorrente_ant":  vlcorr_orig_ant,  "vllimcred_ant": vllimcred_orig,
            "historico": historico,
            "historico2": f"TRANSF P/ RCA {codusur_destino}"[:40],
        }),
        (SQL_INSERT_LOGDEBCRED, {
            "codfunc": codfunc, "codusur": codusur_origem,
            "vlcorrente_novo": vlcorr_orig_novo, "vllimcred": vllimcred_orig,
            "vlcorrente_ant":  vlcorr_orig_ant,  "vllimcred_ant": vllimcred_orig,
            "historico": historico,
            "historico2": f"TRANSF P/ RCA {codusur_destino}"[:40],
        }),
        # Credita destino
        (SQL_UPDATE_VLCORRENTE, {"valor": -valor, "cod": codusur_destino}),
        (SQL_INSERT_LOGRCA, {
            "codfunc": codfunc, "codusur": codusur_destino,
            "vlcorrente_novo": vlcorr_dest_novo, "vllimcred": vllimcred_dest,
            "vlcorrente_ant":  vlcorr_dest_ant,  "vllimcred_ant": vllimcred_dest,
            "historico": f"RECEB DE RCA {codusur_origem}"[:40],
            "historico2": historico2,
        }),
        (SQL_INSERT_LOGDEBCRED, {
            "codfunc": codfunc, "codusur": codusur_destino,
            "vlcorrente_novo": vlcorr_dest_novo, "vllimcred": vllimcred_dest,
            "vlcorrente_ant":  vlcorr_dest_ant,  "vllimcred_ant": vllimcred_dest,
            "historico": f"RECEB DE RCA {codusur_origem}"[:40],
            "historico2": historico2,
        }),
    ])

    # Marca aprovado no SQLite
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """UPDATE cc_solicitacoes
               SET status='aprovado', resolvido_em=?, resolvido_por=?, obs_admin=?
               WHERE id=?""",
            [datetime.now().isoformat(timespec="seconds"),
             u.username, req.obs_admin or "", sol_id]
        )
        conn.commit()

    return {
        "status":       "aprovado",
        "vlcorrente_ant": vlcorr_ant,
        "vlcorrente_novo": vlcorr_novo,
    }


@router.post("/rejeitar/{sol_id}")
def rejeitar(sol_id: int, req: ResolverRequest,
             u: CurrentUser = Depends(get_current_user)):
    """Admin rejeita solicitação."""
    if u.cargo not in ("admin", "gerencial"):
        raise HTTPException(403, "Acesso negado")
    sol = _get_sol(sol_id)
    if sol["status"] != "pendente":
        raise HTTPException(400, f"Solicitação já está {sol['status']}")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """UPDATE cc_solicitacoes
               SET status='rejeitado', resolvido_em=?, resolvido_por=?, obs_admin=?
               WHERE id=?""",
            [datetime.now().isoformat(timespec="seconds"),
             u.username, req.obs_admin or "", sol_id]
        )
        conn.commit()
    return {"status": "rejeitado"}