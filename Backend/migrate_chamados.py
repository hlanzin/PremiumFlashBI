"""
Migração da tabela chamados: remove NOT NULL de cod_vendedor,
adiciona colunas rca_nome e rca_fone se não existirem.

Rode UMA VEZ na pasta Backend/:
    python migrate_chamados.py
"""
import sqlite3, sys, os

DB = os.path.join(os.path.dirname(__file__), "flashbi_users.db")

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

# Verifica schema atual
info = conn.execute("PRAGMA table_info(chamados)").fetchall()
cols = {c["name"]: c for c in info}

if not cols:
    print("Tabela chamados não existe ainda — nada a fazer.")
    conn.close(); sys.exit(0)

needs_migration = cols.get("cod_vendedor") and cols["cod_vendedor"]["notnull"] == 1
has_rca_nome    = "rca_nome" in cols
has_rca_fone    = "rca_fone" in cols

print(f"cod_vendedor NOT NULL: {needs_migration}")
print(f"rca_nome existe:       {has_rca_nome}")
print(f"rca_fone existe:       {has_rca_fone}")

try:
    conn.execute("BEGIN")

    if needs_migration:
        print("\nRecriando tabela para remover NOT NULL de cod_vendedor...")
        conn.executescript("""
            ALTER TABLE chamados RENAME TO chamados_old;

            CREATE TABLE chamados (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                fornecedor     TEXT    NOT NULL,
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

            INSERT INTO chamados (
                id, fornecedor, cod_vendedor, nome_vendedor,
                cod_cliente, nome_cliente, cnpj, endereco, numero,
                bairro, cidade, cep, rg_freezer, modelo, voltagem,
                defeito, horario, ponto_ref, status,
                numero_os, numero_chamado, obs_interna,
                criado_em, atualizado_em
            )
            SELECT
                id, fornecedor, cod_vendedor, nome_vendedor,
                cod_cliente, nome_cliente, cnpj, endereco, numero,
                bairro, cidade, cep, rg_freezer, modelo, voltagem,
                defeito, horario, ponto_ref, status,
                numero_os, numero_chamado, obs_interna,
                criado_em, atualizado_em
            FROM chamados_old;

            DROP TABLE chamados_old;
        """)
        print("OK — tabela recriada, dados preservados.")
    else:
        # Só adiciona colunas que faltam
        if not has_rca_nome:
            conn.execute("ALTER TABLE chamados ADD COLUMN rca_nome TEXT")
            print("OK — coluna rca_nome adicionada.")
        if not has_rca_fone:
            conn.execute("ALTER TABLE chamados ADD COLUMN rca_fone TEXT")
            print("OK — coluna rca_fone adicionada.")
        if has_rca_nome and has_rca_fone:
            print("Tabela já está atualizada, nada a fazer.")

    conn.execute("COMMIT")
    print("\nMigração concluída com sucesso!")

except Exception as e:
    conn.execute("ROLLBACK")
    print(f"\nERRO: {e}")
    sys.exit(1)
finally:
    conn.close()
