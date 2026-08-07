"""
Modelo SQLite pro módulo Incentivos (substitui o dicionário hardcoded que
existia em routers/incentivos.py). Só admin cria/edita; todo mundo vê o
ranking (competição amistosa, igual já era).

Tabelas:
  incentivos               — cabeçalho (nome, tipo, vigência, valor)
  incentivo_produtos       — produtos elegíveis GERAIS (aplica a quem não
                              tem override de equipe)
  incentivo_faixas         — faixas de valor por caixa (só tipo='escalonado')
  incentivo_equipe_produtos — produtos elegíveis específicos de uma equipe
                              (cod_supervisor) — quando preenchida, SUBSTITUI
                              a lista geral só pra essa equipe (mesmo
                              mecanismo do Bateu Levou/bl_supervisor_produtos)

tipo:
  'fixo'       -> valor_por_caixa fixo, R$ por caixa fechada
  'escalonado' -> valor por caixa varia pela faixa em que o TOTAL do
                  vendedor se encaixa (ver incentivo_faixas)
  'combo'      -> valor_por_combo fixo, R$ por cliente que levou TODOS os
                  produtos elegíveis
"""
import sqlite3
from models.usuarios import get_db

TIPOS_VALIDOS = ("fixo", "escalonado", "combo")


def create_incentivo_tables():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS incentivos (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                nome            TEXT    NOT NULL,
                tipo            TEXT    NOT NULL CHECK (tipo IN ('fixo','escalonado','combo')),
                valor_por_caixa REAL,
                valor_por_combo REAL,
                data_ini        TEXT    NOT NULL,
                data_fim        TEXT    NOT NULL,
                ativo           INTEGER NOT NULL DEFAULT 1,
                criado_por      TEXT    NOT NULL,
                criado_em       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS incentivo_produtos (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                incentivo_id INTEGER NOT NULL REFERENCES incentivos(id) ON DELETE CASCADE,
                codprod      INTEGER NOT NULL,
                descricao    TEXT,
                UNIQUE(incentivo_id, codprod)
            );

            CREATE TABLE IF NOT EXISTS incentivo_faixas (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                incentivo_id INTEGER NOT NULL REFERENCES incentivos(id) ON DELETE CASCADE,
                ordem        INTEGER NOT NULL,
                limite       REAL,
                valor        REAL    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS incentivo_equipe_produtos (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                incentivo_id   INTEGER NOT NULL REFERENCES incentivos(id) ON DELETE CASCADE,
                cod_supervisor INTEGER NOT NULL,
                codprod        INTEGER NOT NULL,
                descricao      TEXT,
                UNIQUE(incentivo_id, cod_supervisor, codprod)
            );
        """)


# ── Incentivos (cabeçalho) ──────────────────────────────────────────────────
def criar_incentivo(criado_por: str, nome, tipo, data_ini, data_fim,
                     valor_por_caixa=None, valor_por_combo=None) -> int:
    if tipo not in TIPOS_VALIDOS:
        raise ValueError(f"tipo deve ser um de {TIPOS_VALIDOS}")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO incentivos(nome,tipo,valor_por_caixa,valor_por_combo,data_ini,data_fim,criado_por) "
            "VALUES(?,?,?,?,?,?,?)",
            (nome, tipo, valor_por_caixa, valor_por_combo, data_ini, data_fim, criado_por))
        return cur.lastrowid


def listar_incentivos(apenas_ativos: bool = False) -> list:
    with get_db() as conn:
        q = "SELECT * FROM incentivos"
        if apenas_ativos:
            q += " WHERE ativo = 1"
        q += " ORDER BY data_ini DESC, nome"
        return [dict(r) for r in conn.execute(q).fetchall()]


def get_incentivo(incentivo_id) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM incentivos WHERE id=?", (incentivo_id,)).fetchone()
    return dict(row) if row else None


def atualizar_incentivo(incentivo_id, nome=None, tipo=None, ativo=None,
                         data_ini=None, data_fim=None,
                         valor_por_caixa=None, valor_por_combo=None):
    parts, params = [], []
    if nome            is not None: parts.append("nome=?");            params.append(nome)
    if tipo            is not None: parts.append("tipo=?");            params.append(tipo)
    if ativo           is not None: parts.append("ativo=?");           params.append(ativo)
    if data_ini        is not None: parts.append("data_ini=?");        params.append(data_ini)
    if data_fim        is not None: parts.append("data_fim=?");        params.append(data_fim)
    if valor_por_caixa is not None: parts.append("valor_por_caixa=?"); params.append(valor_por_caixa)
    if valor_por_combo is not None: parts.append("valor_por_combo=?"); params.append(valor_por_combo)
    if not parts:
        return
    params.append(incentivo_id)
    with get_db() as conn:
        conn.execute(f"UPDATE incentivos SET {','.join(parts)} WHERE id=?", params)


def excluir_incentivo(incentivo_id):
    """Hard delete — usar com cuidado (ON DELETE CASCADE remove produtos/
    faixas/overrides junto). Preferir atualizar_incentivo(ativo=0) pra só
    tirar de circulação sem perder o cadastro."""
    with get_db() as conn:
        conn.execute("DELETE FROM incentivos WHERE id=?", (incentivo_id,))


# ── Produtos gerais ──────────────────────────────────────────────────────────
def listar_produtos_gerais(incentivo_id) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT codprod, descricao FROM incentivo_produtos WHERE incentivo_id=? ORDER BY descricao",
            (incentivo_id,)).fetchall()
    return [dict(r) for r in rows]


def salvar_produtos_gerais(incentivo_id, codprods_novos: list, prod_map: dict):
    """Sincroniza a lista geral: adiciona novos, remove desmarcados."""
    with get_db() as conn:
        atuais = set(r["codprod"] for r in conn.execute(
            "SELECT codprod FROM incentivo_produtos WHERE incentivo_id=?", (incentivo_id,)).fetchall())
        novos = set(codprods_novos)
        for c in novos - atuais:
            conn.execute(
                "INSERT OR IGNORE INTO incentivo_produtos(incentivo_id,codprod,descricao) VALUES(?,?,?)",
                (incentivo_id, c, prod_map.get(c, "")))
        for c in atuais - novos:
            conn.execute(
                "DELETE FROM incentivo_produtos WHERE incentivo_id=? AND codprod=?",
                (incentivo_id, c))


# ── Faixas (só tipo='escalonado') ────────────────────────────────────────────
def listar_faixas(incentivo_id) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT ordem, limite, valor FROM incentivo_faixas WHERE incentivo_id=? ORDER BY ordem",
            (incentivo_id,)).fetchall()
    return [dict(r) for r in rows]


def salvar_faixas(incentivo_id, faixas: list):
    """Substitui todas as faixas de uma vez. faixas: [{"limite": float|None, "valor": float}, ...]
    em ordem crescente — a última pode ter limite=None (sem teto)."""
    with get_db() as conn:
        conn.execute("DELETE FROM incentivo_faixas WHERE incentivo_id=?", (incentivo_id,))
        for i, f in enumerate(faixas, start=1):
            conn.execute(
                "INSERT INTO incentivo_faixas(incentivo_id,ordem,limite,valor) VALUES(?,?,?,?)",
                (incentivo_id, i, f.get("limite"), f["valor"]))


# ── Produtos por equipe (override) ───────────────────────────────────────────
def listar_produtos_equipe(incentivo_id, cod_supervisor) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT codprod, descricao FROM incentivo_equipe_produtos "
            "WHERE incentivo_id=? AND cod_supervisor=? ORDER BY descricao",
            (incentivo_id, cod_supervisor)).fetchall()
    return [dict(r) for r in rows]


def listar_equipes_com_override(incentivo_id) -> list:
    """Todos os cod_supervisor que têm lista própria configurada nesse incentivo."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT cod_supervisor FROM incentivo_equipe_produtos WHERE incentivo_id=?",
            (incentivo_id,)).fetchall()
    return [r["cod_supervisor"] for r in rows]


def salvar_produtos_equipe(incentivo_id, cod_supervisor, codprods_novos: list, prod_map: dict):
    with get_db() as conn:
        atuais = set(r["codprod"] for r in conn.execute(
            "SELECT codprod FROM incentivo_equipe_produtos WHERE incentivo_id=? AND cod_supervisor=?",
            (incentivo_id, cod_supervisor)).fetchall())
        novos = set(codprods_novos)
        for c in novos - atuais:
            conn.execute(
                "INSERT OR IGNORE INTO incentivo_equipe_produtos(incentivo_id,cod_supervisor,codprod,descricao) "
                "VALUES(?,?,?,?)", (incentivo_id, cod_supervisor, c, prod_map.get(c, "")))
        for c in atuais - novos:
            conn.execute(
                "DELETE FROM incentivo_equipe_produtos WHERE incentivo_id=? AND cod_supervisor=? AND codprod=?",
                (incentivo_id, cod_supervisor, c))


def remover_override_equipe(incentivo_id, cod_supervisor):
    """Remove a lista própria da equipe inteira — volta a usar a lista geral."""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM incentivo_equipe_produtos WHERE incentivo_id=? AND cod_supervisor=?",
            (incentivo_id, cod_supervisor))
