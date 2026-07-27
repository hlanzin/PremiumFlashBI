"""
Migração da tabela bl_campanhas: adiciona EXIGIR_CAIXA_FECHADA (0|1).

Quando ligado (só faz sentido em tipo='produto'), cada pedido individual
(linha de PCPEDI) só conta na campanha se a quantidade vendida naquela
linha atingir ao menos uma caixa fechada do produto (QT >= QTUNITCX).
A checagem é por pedido individual, não acumulada no período.

Rode UMA VEZ na pasta Backend/:
    python migrate_bl_caixa_fechada.py
"""
import sqlite3, sys, os

DB = os.path.join(os.path.dirname(__file__), "flashbi_users.db")

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

info = conn.execute("PRAGMA table_info(bl_campanhas)").fetchall()
cols = {c["name"]: c for c in info}

if not cols:
    print("Tabela bl_campanhas não existe ainda — nada a fazer "
          "(será criada já com a coluna nova no próximo start do backend).")
    conn.close(); sys.exit(0)

has_caixa = "exigir_caixa_fechada" in cols
print(f"coluna 'exigir_caixa_fechada' existe: {has_caixa}")

if not has_caixa:
    print("Adicionando coluna 'exigir_caixa_fechada' (default 0, preserva campanhas existentes)...")
    conn.execute("ALTER TABLE bl_campanhas ADD COLUMN exigir_caixa_fechada INTEGER NOT NULL DEFAULT 0")

conn.commit()
conn.close()
print("Migração concluída. Campanhas existentes viraram exigir_caixa_fechada=0 automaticamente.")
