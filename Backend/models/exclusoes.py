"""
Exclusões globais de fornecedores e seções.

Fornecedores e seções listados aqui NÃO aparecem em nenhum dropdown, lista
ou visão gerencial/DN do sistema. Gerenciável pelo admin.

Uso nos SQLs:
    from models.exclusoes import sql_not_in_fornec, sql_not_in_secao
    ... WHERE 1=1 {sql_not_in_fornec('PCPRODUT.CODFORNEC')}
    ... WHERE 1=1 {sql_not_in_secao('PCPRODUT.CODSEC')}
"""
import sqlite3, os, time, threading
from typing import List

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "flashbi_users.db")

# Cache em memória (evita bater no SQLite a cada query pesada)
_cache = {"fornecedor": None, "secao": None, "ts": 0}
_lock = threading.Lock()
_TTL = 30  # segundos


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_tables():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS exclusoes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo      TEXT    NOT NULL CHECK (tipo IN ('fornecedor','secao')),
                valor     INTEGER NOT NULL,
                descricao TEXT,
                criado_em TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
                UNIQUE(tipo, valor)
            );
        """)
        # Seed inicial pedido pela Premium (idempotente)
        seed = [
            ("fornecedor", 2194, None), ("fornecedor", 2118, None),
            ("secao", 120392, None), ("secao", 10046, None), ("secao", 10010, None),
        ]
        for tipo, valor, desc in seed:
            conn.execute(
                "INSERT OR IGNORE INTO exclusoes (tipo, valor, descricao) VALUES (?,?,?)",
                (tipo, valor, desc))


def _load(tipo: str) -> List[int]:
    """Carrega do cache ou do banco (com TTL). Cria a tabela se não existir."""
    with _lock:
        agora = time.time()
        if _cache[tipo] is None or agora - _cache["ts"] > _TTL:
            try:
                with get_db() as conn:
                    for t in ("fornecedor", "secao"):
                        rows = conn.execute(
                            "SELECT valor FROM exclusoes WHERE tipo = ?", (t,)).fetchall()
                        _cache[t] = [r["valor"] for r in rows]
                _cache["ts"] = agora
            except sqlite3.OperationalError:
                # Tabela ainda não existe — cria e tenta de novo
                create_tables()
                with get_db() as conn:
                    for t in ("fornecedor", "secao"):
                        rows = conn.execute(
                            "SELECT valor FROM exclusoes WHERE tipo = ?", (t,)).fetchall()
                        _cache[t] = [r["valor"] for r in rows]
                _cache["ts"] = agora
        return _cache[tipo] or []


def _invalidate():
    with _lock:
        _cache["ts"] = 0


def fornecedores_excluidos() -> List[int]:
    return _load("fornecedor")


def secoes_excluidas() -> List[int]:
    return _load("secao")


def sql_not_in_fornec(coluna: str) -> str:
    """Retorna um fragmento SQL 'AND coluna NOT IN (...)' ou '' se lista vazia."""
    vals = fornecedores_excluidos()
    if not vals:
        return ""
    return f" AND {coluna} NOT IN ({', '.join(str(v) for v in vals)})"


def sql_not_in_secao(coluna: str) -> str:
    vals = secoes_excluidas()
    if not vals:
        return ""
    return f" AND {coluna} NOT IN ({', '.join(str(v) for v in vals)})"


# ── CRUD (admin) ─────────────────────────────────────────────────────────────
def listar() -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, tipo, valor, descricao, criado_em FROM exclusoes ORDER BY tipo, valor"
        ).fetchall()
        return [dict(r) for r in rows]


def adicionar(tipo: str, valor: int, descricao: str = None) -> int:
    if tipo not in ("fornecedor", "secao"):
        raise ValueError("tipo deve ser 'fornecedor' ou 'secao'")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO exclusoes (tipo, valor, descricao) VALUES (?,?,?)",
            (tipo, int(valor), descricao))
        conn.commit()
    _invalidate()
    return cur.lastrowid


def remover(exc_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM exclusoes WHERE id = ?", (exc_id,))
        conn.commit()
    _invalidate()
    return cur.rowcount > 0


# Cria a tabela assim que o módulo é importado — garante que exista antes de
# qualquer SQL que use os helpers (ex.: SQL_SECOES do estoque, avaliado no import).
try:
    create_tables()
except Exception:
    pass