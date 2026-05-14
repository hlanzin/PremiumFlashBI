"""
Gerenciador de usuarios Flash BI
Execute: python manage_users.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.usuarios import (
    create_tables, criar_usuario, adicionar_secao_fornecedor,
    remover_secao_fornecedor, alterar_senha, desativar_usuario,
    listar_usuarios, get_db, CARGOS_VALIDOS
)
import sqlite3

create_tables()

# ── Helpers visuais ───────────────────────────────────────────────────────────
def cls():
    os.system("cls" if os.name == "nt" else "clear")

def linha(char="─", n=56):
    print(char * n)

def titulo(txt):
    cls()
    linha("═")
    print(f"  Flash BI — {txt}")
    linha("═")
    print()

def pausar():
    input("\n  Pressione Enter para continuar...")

def input_op(opcoes):
    while True:
        op = input("\n  Opcao: ").strip()
        if op in opcoes:
            return op
        print(f"  Opcao invalida. Use: {', '.join(opcoes)}")

def confirmar(msg="Confirmar?"):
    r = input(f"  {msg} (s/n): ").strip().lower()
    return r == "s"


# ── Listagem ──────────────────────────────────────────────────────────────────
CARGO_LABELS = {
    "gerencial":  "Gerencial ",
    "supervisor": "Supervisor",
    "vendedor":   "Vendedor  ",
    "fornecedor": "Fornecedor",
}

def exibir_usuarios(filtro_cargo=None):
    usuarios = listar_usuarios()
    if filtro_cargo:
        usuarios = [u for u in usuarios if u["cargo"] == filtro_cargo]

    if not usuarios:
        print("  Nenhum usuario encontrado.")
        return

    linha()
    print(f"  {'ID':>3}  {'USERNAME':<22} {'CARGO':<10}  {'NOME':<24} {'COD':>5}  ATIVO")
    linha()
    for u in usuarios:
        ativo  = "Sim" if u["ativo"] else "NAO"
        cod    = str(u["cod_winthor"]) if u["cod_winthor"] else "—"
        label  = CARGO_LABELS.get(u["cargo"], u["cargo"])
        print(f"  {u['id']:>3}  {u['username']:<22} {label}  {(u['nome'] or ''):<24} {cod:>5}  {ativo}")
        if u["cargo"] == "fornecedor" and u["secoes"]:
            secoes = ", ".join(str(s) for s in u["secoes"].split(","))
            print(f"       Secoes: {secoes}")
    linha()
    print(f"  Total: {len(usuarios)} usuario(s)")


# ── Criar usuario ─────────────────────────────────────────────────────────────
def menu_criar():
    titulo("Criar Usuario")

    username = input("  Username (login): ").strip()
    if not username:
        print("  Username nao pode ser vazio."); pausar(); return

    senha = input("  Senha: ").strip()
    if not senha:
        print("  Senha nao pode ser vazia."); pausar(); return

    nome = input("  Nome completo: ").strip() or username

    print("\n  Cargos disponíveis:")
    print("  1. gerencial   — acesso total")
    print("  2. supervisor  — ve equipe do proprio codigo")
    print("  3. vendedor    — ve apenas o proprio codigo")
    print("  4. fornecedor  — ve secoes autorizadas (nivel gerencial)")
    op = input_op(["1","2","3","4"])
    cargo = ["gerencial","supervisor","vendedor","fornecedor"][int(op)-1]

    cod_winthor = None
    if cargo in ("supervisor", "vendedor"):
        while True:
            try:
                cod_winthor = int(input(f"  Codigo Winthor ({cargo}): ").strip())
                break
            except ValueError:
                print("  Digite um numero inteiro.")

    print(f"\n  Resumo:")
    print(f"    Username : {username}")
    print(f"    Nome     : {nome}")
    print(f"    Cargo    : {cargo}")
    if cod_winthor:
        print(f"    Cod      : {cod_winthor}")

    if not confirmar("Criar este usuario?"):
        return

    try:
        uid = criar_usuario(username, senha, nome, cargo, cod_winthor)
        print(f"\n  Usuario '{username}' criado com ID {uid}.")

        if cargo == "fornecedor":
            print("\n  Adicionar secoes ao fornecedor:")
            _menu_secoes_fornecedor(uid, username)
    except sqlite3.IntegrityError:
        print(f"\n  ERRO: username '{username}' ja existe.")

    pausar()


# ── Secoes de fornecedor ──────────────────────────────────────────────────────
def _menu_secoes_fornecedor(uid, username):
    while True:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT codsec FROM fornecedor_secoes WHERE usuario_id=? ORDER BY codsec", (uid,)
            ).fetchall()
        secoes = [r["codsec"] for r in rows]

        print(f"\n  Secoes (Faturamento) de '{username}': {secoes if secoes else 'nenhuma'}")
        print("  a) Adicionar secao")
        print("  r) Remover secao")
        print("  v) Voltar")
        op = input_op(["a","r","v"])

        if op == "v":
            break
        elif op == "a":
            try:
                cod = int(input("  Codigo da secao (CODSEC): ").strip())
                adicionar_secao_fornecedor(uid, cod)
                print(f"  Secao {cod} adicionada.")
            except ValueError:
                print("  Codigo invalido.")
        elif op == "r":
            if not secoes:
                print("  Nenhuma secao para remover.")
                continue
            try:
                cod = int(input("  Codigo da secao a remover: ").strip())
                if cod in secoes:
                    remover_secao_fornecedor(uid, cod)
                    print(f"  Secao {cod} removida.")
                else:
                    print("  Secao nao encontrada.")
            except ValueError:
                print("  Codigo invalido.")


def _menu_codfornec(uid, username):
    from models.usuarios import adicionar_codfornec, remover_codfornec
    while True:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT codfornec FROM fornecedor_codfornec WHERE usuario_id=? ORDER BY codfornec", (uid,)
            ).fetchall()
        fornecs = [r["codfornec"] for r in rows]

        print(f"\n  Fornecedores (Dist. Numerica) de '{username}': {fornecs if fornecs else 'nenhum'}")
        print("  a) Adicionar codfornec")
        print("  r) Remover codfornec")
        print("  v) Voltar")
        op = input_op(["a","r","v"])

        if op == "v":
            break
        elif op == "a":
            try:
                cod = int(input("  Codigo do fornecedor (CODFORNEC Oracle): ").strip())
                adicionar_codfornec(uid, cod)
                print(f"  Fornecedor {cod} adicionado.")
            except ValueError:
                print("  Codigo invalido.")
        elif op == "r":
            if not fornecs:
                print("  Nenhum fornecedor para remover.")
                continue
            try:
                cod = int(input("  Codigo do fornecedor a remover: ").strip())
                if cod in fornecs:
                    remover_codfornec(uid, cod)
                    print(f"  Fornecedor {cod} removido.")
                else:
                    print("  Fornecedor nao encontrado.")
            except ValueError:
                print("  Codigo invalido.")


# ── Editar usuario ────────────────────────────────────────────────────────────
def menu_editar():
    titulo("Editar Usuario")
    exibir_usuarios()

    username = input("\n  Username a editar (ou Enter para cancelar): ").strip()
    if not username:
        return

    with get_db() as conn:
        row = conn.execute("SELECT * FROM usuarios WHERE username=?", (username,)).fetchone()
    if not row:
        print(f"  Usuario '{username}' nao encontrado."); pausar(); return

    uid = row["id"]
    print(f"\n  Editando: {username} [{row['cargo']}]")
    print("  1. Alterar senha")
    print("  2. Alterar nome")
    print("  3. Alterar cargo / cod Winthor")
    if row["cargo"] == "fornecedor":
        print("  4. Gerenciar secoes (Faturamento)")
        print("  5. Gerenciar fornecedores DN (Dist. Numerica)")
    print("  5. Desativar usuario")
    print("  6. Reativar usuario")
    print("  0. Voltar")

    opcoes = ["0","1","2","3","4","5","6"] if row["cargo"]=="fornecedor" else ["0","1","2","3","5","6"]
    op = input_op(opcoes)

    if op == "0":
        return

    elif op == "1":
        nova = input("  Nova senha: ").strip()
        if nova and confirmar():
            alterar_senha(username, nova)
            print("  Senha alterada.")

    elif op == "2":
        novo_nome = input("  Novo nome: ").strip()
        if novo_nome and confirmar():
            with get_db() as conn:
                conn.execute("UPDATE usuarios SET nome=? WHERE id=?", (novo_nome, uid))
            print("  Nome alterado.")

    elif op == "3":
        print("\n  Cargos: " + ", ".join(CARGOS_VALIDOS))
        novo_cargo = input("  Novo cargo (Enter para manter): ").strip()
        if novo_cargo and novo_cargo not in CARGOS_VALIDOS:
            print("  Cargo invalido."); pausar(); return
        novo_cod = input("  Novo cod Winthor (Enter para manter, 0 para limpar): ").strip()
        if confirmar():
            if novo_cargo:
                with get_db() as conn:
                    conn.execute("UPDATE usuarios SET cargo=? WHERE id=?", (novo_cargo, uid))
            if novo_cod == "0":
                with get_db() as conn:
                    conn.execute("UPDATE usuarios SET cod_winthor=NULL WHERE id=?", (uid,))
            elif novo_cod:
                try:
                    with get_db() as conn:
                        conn.execute("UPDATE usuarios SET cod_winthor=? WHERE id=?", (int(novo_cod), uid))
                except ValueError:
                    print("  Cod invalido.")
            print("  Atualizado.")

    elif op == "4":
        _menu_secoes_fornecedor(uid, username)

    elif op == "5" and row["cargo"] == "fornecedor":
        _menu_codfornec(uid, username)

    elif op == "5":
        if confirmar(f"Desativar '{username}'?"):
            desativar_usuario(username)
            print("  Usuario desativado.")

    elif op == "6":
        if confirmar(f"Reativar '{username}'?"):
            with get_db() as conn:
                conn.execute("UPDATE usuarios SET ativo=1 WHERE username=?", (username,))
            print("  Usuario reativado.")

    pausar()


# ── Menu principal ────────────────────────────────────────────────────────────
def main():
    while True:
        titulo("Gerenciador de Usuarios")
        print("  1. Listar todos os usuarios")
        print("  2. Listar por cargo")
        print("  3. Criar novo usuario")
        print("  4. Editar usuario")
        print("  0. Sair")

        op = input_op(["0","1","2","3","4"])

        if op == "0":
            print("\n  Ate mais!\n"); break

        elif op == "1":
            titulo("Todos os Usuarios")
            exibir_usuarios()
            pausar()

        elif op == "2":
            titulo("Filtrar por Cargo")
            print("  1. gerencial")
            print("  2. supervisor")
            print("  3. vendedor")
            print("  4. fornecedor")
            c = input_op(["1","2","3","4"])
            cargo = ["gerencial","supervisor","vendedor","fornecedor"][int(c)-1]
            titulo(f"Usuarios — {cargo}")
            exibir_usuarios(cargo)
            pausar()

        elif op == "3":
            menu_criar()

        elif op == "4":
            menu_editar()


if __name__ == "__main__":
    main()
