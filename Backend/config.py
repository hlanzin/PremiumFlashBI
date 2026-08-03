import os
from dotenv import load_dotenv

load_dotenv()  # carrega o .env da pasta atual

# ── Banco Oracle ──────────────────────────────────────────────────────────────
DB_CONFIG = {
    "lib_dir": os.getenv("DB_LIB_DIR",  r"C:\InstantClient2"),
    "host":    os.getenv("DB_HOST",     "192.168.38.250"),
    "port":    int(os.getenv("DB_PORT", "1521")),
    "service": os.getenv("DB_SERVICE",  "WINT"),
    "user":    os.getenv("DB_USER",     "PONTUAL"),
    "password":os.getenv("DB_PASSWORD", "PONTUAL"),
}

# ── Filial ────────────────────────────────────────────────────────────────────
FILIAL = os.getenv("FILIAL", "3")

# ── Auth ──────────────────────────────────────────────────────────────────────
SECRET_KEY         = os.getenv("SECRET_KEY",         "premium-flash-secret-2026")
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "720"))  # 30 dias

# ── Conta Corrente: supervisor → conta RCA própria ────────────────────────────
SUP_TO_RCA = {2: 2, 8: 160, 9: 180}

# ── Janela de "clientes ativos" (regra comercial específica) ──────────────────
# Fornecedor/seções que usam janela de 2 meses fechados em vez de 3 meses pra
# contar "cliente ativo"/meta — Lista Negra, Distribuição Numérica e
# Comparativo de Clientes (pedido específico da Premium, 2026-07).
FORNEC_ATIVOS_2M = {1841}
SECAO_ATIVOS_2M  = {120430, 120432}