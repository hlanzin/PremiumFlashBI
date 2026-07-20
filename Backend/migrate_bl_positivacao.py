"""
Migração da tabela bl_campanhas: adiciona TIPO ('produto' | 'positivacao')
e CODFORNEC (fornecedor cujo critério de Lista Negra define os clientes
elegíveis, usado só quando tipo='positivacao').

Rode UMA VEZ na pasta Backend/:
    python migrate_bl_positivacao.py
"""
import sqlite3, sys, os

DB = os.path.join(os.path.dirname(__file__), "flashbi_users.db")

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

info = conn.execute("PRAGMA table_info(bl_campanhas)").fetchall()
cols = {c["name"]: c for c in info}

if not cols:
    print("Tabela bl_campanhas não existe ainda — nada a fazer "
          "(será criada já com as colunas novas no próximo start do backend).")
    conn.close(); sys.exit(0)

has_tipo      = "tipo" in cols
has_codfornec = "codfornec" in cols

print(f"coluna 'tipo' existe:      {has_tipo}")
print(f"coluna 'codfornec' existe: {has_codfornec}")

if not has_tipo:
    print("Adicionando coluna 'tipo' (default 'produto', preserva campanhas existentes)...")
    conn.execute("ALTER TABLE bl_campanhas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'produto'")

if not has_codfornec:
    print("Adicionando coluna 'codfornec' (nullable, só usada em tipo='positivacao')...")
    conn.execute("ALTER TABLE bl_campanhas ADD COLUMN codfornec INTEGER")

conn.commit()
conn.close()
print("Migração concluída. Campanhas existentes viraram tipo='produto' automaticamente.")
