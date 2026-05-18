"""
Modelo SQLite para o módulo de Chamados de Freezer.

Tabelas:
  chamados   — registro de cada chamado aberto
"""
import sqlite3
from models.usuarios import get_db


def create_chamados_tables():
    with get_db() as conn:
        # Cria a tabela se não existir
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS chamados (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                fornecedor     TEXT    NOT NULL CHECK(fornecedor IN ('metalfrio','fricon')),
                cod_vendedor   INTEGER,
                nome_vendedor  TEXT,
                cod_cliente    INTEGER NOT NULL,
                nome_cliente   TEXT,
                cnpj           TEXT,
                endereco       TEXT,
                numero         TEXT,
                bairro         TEXT,
                cidade         TEXT,
                cep            TEXT,
                rg_freezer     TEXT    NOT NULL,
                modelo         TEXT,
                voltagem       TEXT,
                rca_nome       TEXT,
                rca_fone       TEXT,
                defeito        TEXT,
                horario        TEXT,
                ponto_ref      TEXT,
                status         TEXT    NOT NULL DEFAULT 'Aberto',
                numero_os      TEXT,
                numero_chamado TEXT,
                obs_interna    TEXT,
                criado_em      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
                atualizado_em  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            );
        """)
        # Migration: se tabela antiga tinha cod_vendedor NOT NULL, recria preservando dados
        try:
            conn.execute("UPDATE chamados SET cod_vendedor=NULL WHERE cod_vendedor=0")
        except Exception:
            try:
                conn.executescript("""
                    ALTER TABLE chamados RENAME TO chamados_bak;
                    CREATE TABLE chamados (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        fornecedor TEXT NOT NULL,
                        cod_vendedor INTEGER,
                        nome_vendedor TEXT,
                        cod_cliente INTEGER NOT NULL,
                        nome_cliente TEXT,
                        cnpj TEXT, endereco TEXT, numero TEXT,
                        bairro TEXT, cidade TEXT, cep TEXT,
                        rg_freezer TEXT NOT NULL,
                        modelo TEXT, voltagem TEXT,
                        rca_nome TEXT, rca_fone TEXT,
                        defeito TEXT, horario TEXT, ponto_ref TEXT,
                        status TEXT NOT NULL DEFAULT 'Aberto',
                        numero_os TEXT, numero_chamado TEXT, obs_interna TEXT,
                        criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                        atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                    );
                    INSERT INTO chamados(id,fornecedor,cod_vendedor,nome_vendedor,
                        cod_cliente,nome_cliente,cnpj,endereco,numero,bairro,cidade,cep,
                        rg_freezer,modelo,voltagem,defeito,horario,ponto_ref,
                        status,numero_os,numero_chamado,obs_interna,criado_em,atualizado_em)
                    SELECT id,fornecedor,cod_vendedor,nome_vendedor,
                        cod_cliente,nome_cliente,cnpj,endereco,numero,bairro,cidade,cep,
                        rg_freezer,modelo,voltagem,defeito,horario,ponto_ref,
                        status,numero_os,numero_chamado,obs_interna,criado_em,atualizado_em
                    FROM chamados_bak;
                    DROP TABLE chamados_bak;
                """)
            except Exception:
                pass


# ── CRUD ──────────────────────────────────────────────────────────────────────
def criar_chamado(**kwargs) -> int:
    campos = [
        "fornecedor","cod_vendedor","nome_vendedor",
        "cod_cliente","nome_cliente","cnpj",
        "endereco","numero","bairro","cidade","cep",
        "rg_freezer","modelo","voltagem",
        "rca_nome","rca_fone",
        "defeito","horario","ponto_ref",
        "numero_chamado",
    ]
    vals = {c: kwargs.get(c) for c in campos}
    qs   = ",".join(f":{c}" for c in campos)
    cols = ",".join(campos)
    with get_db() as conn:
        cur = conn.execute(
            f"INSERT INTO chamados({cols}) VALUES({qs})", vals)
        return cur.lastrowid


def listar_chamados(cod_vendedor=None, cod_supervisor=None,
                    fornecedor=None, status=None) -> list:
    with get_db() as conn:
        q = "SELECT * FROM chamados WHERE 1=1"
        params = []
        if cod_vendedor:
            q += " AND cod_vendedor=?"; params.append(cod_vendedor)
        if fornecedor:
            q += " AND fornecedor=?"; params.append(fornecedor)
        if status:
            q += " AND status=?"; params.append(status)
        q += " ORDER BY criado_em DESC"
        return [dict(r) for r in conn.execute(q, params).fetchall()]


def get_chamado(chamado_id) -> dict | None:
    with get_db() as conn:
        r = conn.execute(
            "SELECT * FROM chamados WHERE id=?", (chamado_id,)).fetchone()
    return dict(r) if r else None


def atualizar_chamado(chamado_id, **kwargs):
    permitidos = ["status","numero_os","numero_chamado","obs_interna"]
    parts, params = [], []
    for k in permitidos:
        if k in kwargs and kwargs[k] is not None:
            parts.append(f"{k}=?"); params.append(kwargs[k])
    if not parts: return
    parts.append("atualizado_em=datetime('now','localtime')")
    params.append(chamado_id)
    with get_db() as conn:
        conn.execute(
            f"UPDATE chamados SET {','.join(parts)} WHERE id=?", params)