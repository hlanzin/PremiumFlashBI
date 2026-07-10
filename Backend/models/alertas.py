"""
Acompanhamento de alertas RCA: cada alerta (POSSÍVEL DUPLICIDADE, BNF SEM
PEDIDO etc.) é identificado por um ID estável (hash de tipo+cliente+rca), já
que a query roda direto no Winthor (read-only) e não tem chave própria.

O vendedor confirma "certo" ou "errado" e, para tipos ligados a bonificação
(BNF SEM PEDIDO), o motivo é OBRIGATÓRIO ao confirmar — evita bonificação
enviada sem justificativa. Para os demais tipos, o motivo é opcional.
"""
import sqlite3, os, hashlib, time
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "flashbi_users.db")

# Tipos onde o motivo é obrigatório ao confirmar como "certo"
TIPOS_MOTIVO_OBRIGATORIO = {"BNF SEM PEDIDO"}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_tables():
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alertas_rca (
                alerta_id     TEXT PRIMARY KEY,
                tipo          TEXT NOT NULL,
                cod_cliente   TEXT NOT NULL,
                cod_rca       INTEGER,
                status        TEXT NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente','confirmado','errado')),
                motivo        TEXT,
                respondido_por TEXT,
                respondido_em  TEXT,
                primeira_vez  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                ultima_vez    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
        """)
        conn.commit()
    finally:
        conn.close()


try:
    create_tables()
except Exception:
    pass


def gerar_alerta_id(tipo: str, cod_cliente, cod_rca) -> str:
    """ID estável: mesmo tipo+cliente+rca gera o mesmo ID entre execuções
    diárias, preservando o status já respondido."""
    base = f"{tipo}|{cod_cliente}|{cod_rca}"
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def sincronizar_e_buscar_status(alertas: list) -> dict:
    """
    Recebe a lista de alertas vindos do Oracle (cada um já com 'alerta_id'
    calculado), garante que cada um exista na tabela (INSERT se novo, sem
    sobrescrever status existente) e retorna um dict alerta_id -> row de
    status para o router juntar na resposta.
    """
    conn = get_db()
    try:
        agora = time.strftime("%Y-%m-%d %H:%M:%S")
        for a in alertas:
            conn.execute("""
                INSERT INTO alertas_rca (alerta_id, tipo, cod_cliente, cod_rca, ultima_vez)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(alerta_id) DO UPDATE SET ultima_vez = excluded.ultima_vez
            """, (a["alerta_id"], a["tipo"], str(a["cod_cliente"]), a["cod_rca"], agora))
        conn.commit()

        ids = [a["alerta_id"] for a in alertas]
        if not ids:
            return {}
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT * FROM alertas_rca WHERE alerta_id IN ({placeholders})", ids
        ).fetchall()
        return {r["alerta_id"]: dict(r) for r in rows}
    finally:
        conn.close()


def responder_alerta(alerta_id: str, status: str, motivo: Optional[str], respondido_por: str):
    """Grava a confirmação/rejeição do vendedor. Valida motivo obrigatório
    para tipos de bonificação quando o status é 'confirmado'."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT tipo FROM alertas_rca WHERE alerta_id = ?", (alerta_id,)
        ).fetchone()
        if row is None:
            raise ValueError("Alerta não encontrado")

        tipo = row["tipo"]
        motivo_obrigatorio = tipo in TIPOS_MOTIVO_OBRIGATORIO and status == "confirmado"
        if motivo_obrigatorio and not (motivo and motivo.strip()):
            raise ValueError("Motivo é obrigatório para confirmar este tipo de alerta")

        agora = time.strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("""
            UPDATE alertas_rca
            SET status = ?, motivo = ?, respondido_por = ?, respondido_em = ?
            WHERE alerta_id = ?
        """, (status, (motivo or "").strip() or None, respondido_por, agora, alerta_id))
        conn.commit()
    finally:
        conn.close()
