import os
from typing import Dict

# ── Banco Oracle ──────────────────────────────────────────────────────────────
DB_CONFIG = {
    "lib_dir": r"C:\InstantClient2",
    "host":    "192.168.38.250",
    "port":    1521,
    "service": "WINT",
    "user":    "PONTUAL",
    "password":"PONTUAL",
}

# ── Filial padrão ─────────────────────────────────────────────────────────────
FILIAL = "3"

# ── Autenticação ──────────────────────────────────────────────────────────────
# Chave secreta para assinar os tokens JWT.
# Em produção substitua por uma variável de ambiente forte.
SECRET_KEY  = os.getenv("SECRET_KEY", "premium-flash-secret-2026")
ALGORITHM   = "HS256"
TOKEN_EXPIRE_HOURS = 12

# Usuários válidos: {"username": "senha_em_texto"}
# Em produção use hash bcrypt e banco de dados.
USERS: Dict[str, str] = {
    "admin":   "premium@2026",
    "gerente": "flash@2026",
}

# ── Vendedores excluídos (exceto gerencial) ───────────────────────────────────
CODUSUR_EXCLUIDOS = [2, 10, 160, 180]
