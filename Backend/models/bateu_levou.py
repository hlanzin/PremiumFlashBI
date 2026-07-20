"""
Modelo SQLite para o módulo Bateu Levou.

Tabelas:
  bl_campanhas           — campanha semanal de um fornecedor
  bl_supervisor_produtos — produtos por supervisor dentro da campanha
  bl_metas               — meta por (supervisor × vendedor)
"""
import sqlite3
from models.usuarios import get_db


def create_bl_tables():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS bl_campanhas (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                nome        TEXT    NOT NULL,
                usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
                tipo        TEXT    NOT NULL DEFAULT 'produto',  -- 'produto' | 'positivacao'
                codsec      INTEGER,                             -- usado quando tipo='produto'
                codfornec   INTEGER,                             -- usado quando tipo='positivacao'
                unidade     TEXT    NOT NULL DEFAULT 'UN',
                semana_ini  TEXT    NOT NULL,
                semana_fim  TEXT    NOT NULL,
                ativa       INTEGER NOT NULL DEFAULT 1,
                criado_em   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Produtos elegíveis por supervisor (cada supervisor pode ter lista diferente)
            CREATE TABLE IF NOT EXISTS bl_supervisor_produtos (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                campanha_id    INTEGER NOT NULL REFERENCES bl_campanhas(id) ON DELETE CASCADE,
                cod_supervisor INTEGER NOT NULL,
                codprod        INTEGER NOT NULL,
                descricao      TEXT,
                UNIQUE(campanha_id, cod_supervisor, codprod)
            );

            -- Meta por supervisor × vendedor
            CREATE TABLE IF NOT EXISTS bl_metas (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                campanha_id    INTEGER NOT NULL REFERENCES bl_campanhas(id) ON DELETE CASCADE,
                cod_supervisor INTEGER NOT NULL,
                cod_vendedor   INTEGER NOT NULL,
                meta           REAL    NOT NULL DEFAULT 0,
                UNIQUE(campanha_id, cod_supervisor, cod_vendedor)
            );
        """)


# ── Campanhas ─────────────────────────────────────────────────────────────────
def criar_campanha(usuario_id, nome, semana_ini, semana_fim,
                    tipo="produto", codsec=None, codfornec=None, unidade="UN") -> int:
    """
    tipo='produto'     -> codsec obrigatório (seção dos produtos elegíveis)
    tipo='positivacao' -> codfornec obrigatório (fornecedor cujo critério de
                           Lista Negra define os clientes elegíveis); usa
                           codsec=0 como placeholder (SQLite não permite tirar
                           o NOT NULL de codsec sem reconstruir a tabela, e
                           não é necessário — 0 nunca colide com CODSEC real)
    """
    if tipo not in ("produto", "positivacao"):
        raise ValueError("tipo deve ser 'produto' ou 'positivacao'")
    if tipo == "produto" and codsec is None:
        raise ValueError("codsec é obrigatório para campanha tipo='produto'")
    if tipo == "positivacao" and codfornec is None:
        raise ValueError("codfornec é obrigatório para campanha tipo='positivacao'")

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO bl_campanhas(usuario_id,nome,tipo,codsec,codfornec,unidade,semana_ini,semana_fim) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (usuario_id, nome, tipo, codsec if codsec is not None else 0,
             codfornec, unidade, semana_ini, semana_fim))
        return cur.lastrowid


def listar_campanhas(usuario_id=None, semana_ini=None) -> list:
    with get_db() as conn:
        q = """
            SELECT c.id, c.nome, c.tipo, c.codsec, c.codfornec, c.unidade, c.semana_ini, c.semana_fim,
                   c.ativa, c.usuario_id, u.username, u.nome AS nome_fornecedor
            FROM bl_campanhas c JOIN usuarios u ON u.id = c.usuario_id
            WHERE 1=1
        """
        params = []
        if usuario_id: q += " AND c.usuario_id=?"; params.append(usuario_id)
        if semana_ini: q += " AND c.semana_ini=?"; params.append(semana_ini)
        q += " ORDER BY c.semana_ini DESC, c.nome"
        return [dict(r) for r in conn.execute(q, params).fetchall()]


def get_campanha(campanha_id) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM bl_campanhas WHERE id=?", (campanha_id,)).fetchone()
    return dict(row) if row else None


def atualizar_campanha(campanha_id, nome=None, ativa=None, semana_ini=None, semana_fim=None):
    parts, params = [], []
    if nome       is not None: parts.append("nome=?");       params.append(nome)
    if ativa      is not None: parts.append("ativa=?");      params.append(ativa)
    if semana_ini is not None: parts.append("semana_ini=?"); params.append(semana_ini)
    if semana_fim is not None: parts.append("semana_fim=?"); params.append(semana_fim)
    if not parts: return
    params.append(campanha_id)
    with get_db() as conn:
        conn.execute(f"UPDATE bl_campanhas SET {','.join(parts)} WHERE id=?", params)


# ── Produtos por supervisor ───────────────────────────────────────────────────
def adicionar_produto_supervisor(campanha_id, cod_supervisor, codprod, descricao=""):
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO bl_supervisor_produtos"
            "(campanha_id,cod_supervisor,codprod,descricao) VALUES(?,?,?,?)",
            (campanha_id, cod_supervisor, codprod, descricao))


def remover_produto_supervisor(campanha_id, cod_supervisor, codprod):
    with get_db() as conn:
        conn.execute(
            "DELETE FROM bl_supervisor_produtos WHERE campanha_id=? AND cod_supervisor=? AND codprod=?",
            (campanha_id, cod_supervisor, codprod))


def listar_produtos_supervisor(campanha_id, cod_supervisor) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT codprod, descricao FROM bl_supervisor_produtos "
            "WHERE campanha_id=? AND cod_supervisor=? ORDER BY descricao",
            (campanha_id, cod_supervisor)).fetchall()
    return [dict(r) for r in rows]


def listar_supervisores_campanha(campanha_id) -> list:
    """Retorna todos os cod_supervisor configurados nesta campanha."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT cod_supervisor FROM bl_supervisor_produtos WHERE campanha_id=? ORDER BY cod_supervisor",
            (campanha_id,)).fetchall()
    return [r["cod_supervisor"] for r in rows]


def salvar_produtos_supervisor(campanha_id, cod_supervisor, codprods_novos: list, prod_map: dict):
    """Sincroniza a lista de produtos de um supervisor: adiciona novos, remove desmarcados."""
    with get_db() as conn:
        atuais = set(
            r["codprod"] for r in conn.execute(
                "SELECT codprod FROM bl_supervisor_produtos WHERE campanha_id=? AND cod_supervisor=?",
                (campanha_id, cod_supervisor)).fetchall()
        )
        novos = set(codprods_novos)
        for c in novos - atuais:
            conn.execute(
                "INSERT OR IGNORE INTO bl_supervisor_produtos(campanha_id,cod_supervisor,codprod,descricao) VALUES(?,?,?,?)",
                (campanha_id, cod_supervisor, c, prod_map.get(c, "")))
        for c in atuais - novos:
            conn.execute(
                "DELETE FROM bl_supervisor_produtos WHERE campanha_id=? AND cod_supervisor=? AND codprod=?",
                (campanha_id, cod_supervisor, c))


# ── Metas por supervisor × vendedor ──────────────────────────────────────────
def upsert_meta(campanha_id, cod_supervisor, cod_vendedor, meta):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO bl_metas(campanha_id,cod_supervisor,cod_vendedor,meta) VALUES(?,?,?,?) "
            "ON CONFLICT(campanha_id,cod_supervisor,cod_vendedor) DO UPDATE SET meta=excluded.meta",
            (campanha_id, cod_supervisor, cod_vendedor, meta))


def listar_metas_supervisor(campanha_id, cod_supervisor) -> dict:
    """Retorna {cod_vendedor: meta} para um supervisor."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT cod_vendedor, meta FROM bl_metas WHERE campanha_id=? AND cod_supervisor=?",
            (campanha_id, cod_supervisor)).fetchall()
    return {r["cod_vendedor"]: r["meta"] for r in rows}


def listar_todas_metas(campanha_id) -> dict:
    """Retorna {(cod_supervisor, cod_vendedor): meta}."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT cod_supervisor, cod_vendedor, meta FROM bl_metas WHERE campanha_id=?",
            (campanha_id,)).fetchall()
    return {(r["cod_supervisor"], r["cod_vendedor"]): r["meta"] for r in rows}