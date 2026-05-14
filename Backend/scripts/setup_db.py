"""
Script de inicialização do banco de usuários.

Execute uma vez para criar o banco e os usuários iniciais:
    python scripts/setup_db.py

Pode reexecutar sem risco — usuários duplicados são ignorados.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.usuarios import (
    create_tables, criar_usuario, adicionar_secao_fornecedor,
    listar_usuarios, DB_PATH
)
import sqlite3

def seed():
    create_tables()
    print(f"Banco em: {DB_PATH}")

    def add(username, senha, nome, cargo, cod=None, secoes=None):
        try:
            uid = criar_usuario(username, senha, nome, cargo, cod)
            for s in (secoes or []):
                adicionar_secao_fornecedor(uid, s)
            print(f"  Criado : [{cargo:12}] {username} ({nome})")
        except sqlite3.IntegrityError:
            print(f"  Existe  : {username} — ignorado")

    print("\n── Usuários admin ──────────────────────────────────")
    add("admin",   "premium@2026", "Administrador", "gerencial")
    add("gerente", "flash@2026",   "Gerente Geral",  "gerencial")

    print("\n── Supervisores ────────────────────────────────────")
    # cod_winthor = código do supervisor no Winthor (PCSUPERV.CODSUPERVISOR)
    add("supervisor.hiago",  "hiago@2026",  "Hiago (Supervisor)",  "supervisor", cod=2)
    add("supervisor.junior", "junior@2026", "Junior (Supervisor)", "supervisor", cod=8)
    add("supervisor.josean", "josean@2026", "Josean (Supervisor)", "supervisor", cod=9)

    print("\n── Vendedores (exemplos) ───────────────────────────")
    # cod_winthor = CODUSUR do vendedor no Winthor
    # Substitua pelos códigos reais
    add("vendedor.001", "vend001@2026", "Vendedor 001", "vendedor", cod=1)
    add("vendedor.002", "vend002@2026", "Vendedor 002", "vendedor", cod=3)

    print("\n── Fornecedores ────────────────────────────────────")
    # secoes = lista de CODSEC que o fornecedor pode visualizar
    add("dannila",  "dannila@2026",  "Fornecedor Dannila", "fornecedor",
        secoes=[120434, 120424])
    add("fini",     "fini@2026",     "Fornecedor Fini",    "fornecedor",
        secoes=[11007])
    add("danone",   "danone@2026",   "Fornecedor Danone",  "fornecedor",
        secoes=[10040, 10042, 120239, 120434, 120424])  # ajuste as seções reais

    print("\n── Usuários no banco ───────────────────────────────")
    for u in listar_usuarios():
        secoes = f"  seções: {u['secoes']}" if u['secoes'] else ""
        cod    = f"  cod: {u['cod_winthor']}"  if u['cod_winthor'] else ""
        print(f"  {u['username']:25} [{u['cargo']:12}]{cod}{secoes}")

if __name__ == "__main__":
    seed()
    print("\nConcluido.")
