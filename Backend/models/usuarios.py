"""
Gerenciamento de usuarios com SQLite.

Tabelas:
  usuarios              — login, senha, cargo, cod_winthor
  fornecedor_secoes     — CODSECs Oracle que o fornecedor ve no Faturamento
  fornecedor_codfornec  — CODFORNECs Oracle que o fornecedor ve na Dist. Numerica
"""
import sqlite3, hashlib, secrets, os
from typing import Optional, List

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "flashbi_users.db")
CARGOS_VALIDOS = {"gerencial", "supervisor", "vendedor", "fornecedor"}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_tables():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                username     TEXT    UNIQUE NOT NULL,
                senha_hash   TEXT    NOT NULL,
                nome         TEXT,
                cargo        TEXT    NOT NULL DEFAULT 'vendedor',
                cod_winthor  INTEGER,
                ativo        INTEGER NOT NULL DEFAULT 1,
                criado_em    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS fornecedor_secoes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                codsec     INTEGER NOT NULL,
                UNIQUE(usuario_id, codsec)
            );

            CREATE TABLE IF NOT EXISTS fornecedor_codfornec (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                codfornec  INTEGER NOT NULL,
                UNIQUE(usuario_id, codfornec)
            );
        """)


# ── Hash ──────────────────────────────────────────────────────────────────────
def hash_senha(senha: str) -> str:
    salt = secrets.token_hex(16)
    return f"{salt}:{hashlib.sha256(f'{salt}{senha}'.encode()).hexdigest()}"

def verificar_senha(senha: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        return hashlib.sha256(f"{salt}{senha}".encode()).hexdigest() == h
    except Exception:
        return False


# ── CRUD usuarios ─────────────────────────────────────────────────────────────
def criar_usuario(username, senha, nome, cargo, cod_winthor=None) -> int:
    if cargo not in CARGOS_VALIDOS:
        raise ValueError(f"Cargo invalido: {cargo}")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO usuarios (username,senha_hash,nome,cargo,cod_winthor) VALUES(?,?,?,?,?)",
            (username, hash_senha(senha), nome, cargo, cod_winthor))
        return cur.lastrowid

def alterar_senha(username: str, nova: str) -> bool:
    with get_db() as conn:
        return conn.execute("UPDATE usuarios SET senha_hash=? WHERE username=?",
                            (hash_senha(nova), username)).rowcount > 0

def desativar_usuario(username: str) -> bool:
    with get_db() as conn:
        return conn.execute("UPDATE usuarios SET ativo=0 WHERE username=?",
                            (username,)).rowcount > 0

def listar_usuarios() -> list:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT u.id, u.username, u.nome, u.cargo, u.cod_winthor, u.ativo, u.criado_em,
                   (SELECT GROUP_CONCAT(codsec)    FROM fornecedor_secoes    WHERE usuario_id=u.id) AS secoes,
                   (SELECT GROUP_CONCAT(codfornec) FROM fornecedor_codfornec WHERE usuario_id=u.id) AS codfornecs
            FROM usuarios u ORDER BY u.cargo, u.nome
        """).fetchall()
    return [dict(r) for r in rows]


# ── CRUD secoes (Faturamento) ──────────────────────────────────────────────────
def adicionar_secao_fornecedor(usuario_id: int, codsec: int):
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO fornecedor_secoes(usuario_id,codsec) VALUES(?,?)",
                     (usuario_id, codsec))

def remover_secao_fornecedor(usuario_id: int, codsec: int):
    with get_db() as conn:
        conn.execute("DELETE FROM fornecedor_secoes WHERE usuario_id=? AND codsec=?",
                     (usuario_id, codsec))


# ── CRUD codfornec (Distribuicao Numerica) ────────────────────────────────────
def adicionar_codfornec(usuario_id: int, codfornec: int):
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO fornecedor_codfornec(usuario_id,codfornec) VALUES(?,?)",
                     (usuario_id, codfornec))

def remover_codfornec(usuario_id: int, codfornec: int):
    with get_db() as conn:
        conn.execute("DELETE FROM fornecedor_codfornec WHERE usuario_id=? AND codfornec=?",
                     (usuario_id, codfornec))


# ── Autenticacao ──────────────────────────────────────────────────────────────
def autenticar(username: str, senha: str) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM usuarios WHERE username=? AND ativo=1",
                           (username,)).fetchone()
    if not row or not verificar_senha(senha, row["senha_hash"]):
        return None

    secoes: List[int] = []
    codfornecs: List[int] = []
    if row["cargo"] == "fornecedor":
        with get_db() as conn:
            secoes    = [r["codsec"]    for r in conn.execute(
                "SELECT codsec    FROM fornecedor_secoes    WHERE usuario_id=?", (row["id"],)).fetchall()]
            codfornecs = [r["codfornec"] for r in conn.execute(
                "SELECT codfornec FROM fornecedor_codfornec WHERE usuario_id=?", (row["id"],)).fetchall()]

    return {
        "id": row["id"], "username": row["username"], "nome": row["nome"],
        "cargo": row["cargo"], "cod_winthor": row["cod_winthor"],
        "secoes": secoes, "codfornecs": codfornecs,
    }
