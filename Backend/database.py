"""
Camada de acesso a dados — Oracle com pool de conexões + cache TTL.

Pool:  criado uma vez no primeiro uso (lazy), reutiliza conexões entre
       requests. min=2, max=8 conexões. Derruba latência de ~300ms para ~0.

Cache: TTL de 60s para queries de leitura, keyed por (sql, params).
       BI tolera dados de até 1 minuto. DML invalida o cache inteiro.
       Para desabilitar em uma query: execute_query(..., use_cache=False)
"""
import hashlib
import json
import threading
import time
from datetime import date, datetime
from typing import Optional, List, Dict, Any

import oracledb
from config import DB_CONFIG

# ─────────────────────────────────────────────────────────────────────────────
# Pool de conexões (lazy singleton, thread-safe)
# ─────────────────────────────────────────────────────────────────────────────
_pool = None
_pool_lock = threading.Lock()
_client_initialized = False


def _get_pool():
    global _pool, _client_initialized
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is not None:          # double-check após adquirir o lock
            return _pool
        if not _client_initialized:
            oracledb.init_oracle_client(lib_dir=DB_CONFIG["lib_dir"])
            _client_initialized = True
        dsn = oracledb.makedsn(DB_CONFIG["host"], DB_CONFIG["port"],
                               service_name=DB_CONFIG["service"])
        _pool = oracledb.create_pool(
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            dsn=dsn,
            min=2,
            max=8,
            increment=1,
            getmode=oracledb.POOL_GETMODE_WAIT,   # espera se todas ocupadas
            timeout=300,                           # fecha ociosas após 5 min
        )
        return _pool


def get_connection():
    """Pega conexão do pool. Usar com `with get_connection() as conn`
    ou devolver com conn.close() (devolve ao pool, não fecha de verdade)."""
    return _get_pool().acquire()


# ─────────────────────────────────────────────────────────────────────────────
# Cache TTL em memória (thread-safe)
# ─────────────────────────────────────────────────────────────────────────────
CACHE_TTL_SECONDS = 60
_cache: Dict[str, tuple] = {}        # key -> (timestamp, rows)
_cache_lock = threading.Lock()


def _cache_key(sql: str, params) -> str:
    raw = sql + "|" + json.dumps(params, default=str, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _cache_get(key: str):
    with _cache_lock:
        item = _cache.get(key)
        if item is None:
            return None
        ts, rows = item
        if time.time() - ts > CACHE_TTL_SECONDS:
            del _cache[key]
            return None
        return rows


def _cache_set(key: str, rows) -> None:
    with _cache_lock:
        # Limpa entradas expiradas quando o cache passa de 200 chaves
        if len(_cache) > 200:
            now = time.time()
            expired = [k for k, (ts, _) in _cache.items()
                       if now - ts > CACHE_TTL_SECONDS]
            for k in expired:
                del _cache[k]
        _cache[key] = (time.time(), rows)


def cache_clear() -> None:
    """Invalida todo o cache. Chamado automaticamente após DML."""
    with _cache_lock:
        _cache.clear()


# ─────────────────────────────────────────────────────────────────────────────
# API pública — mesma assinatura de antes (drop-in replacement)
# ─────────────────────────────────────────────────────────────────────────────
def execute_query(sql: str, params=None,
                  use_cache: bool = True) -> List[Dict[str, Any]]:
    """SELECT com pool + cache TTL de 60s.
    params pode ser list (bind posicional) ou dict (bind nomeado)."""
    if params is None:
        params = []

    key = _cache_key(sql, params) if use_cache else None
    if key:
        cached = _cache_get(key)
        if cached is not None:
            return cached

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        columns = [col[0].lower() for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    finally:
        conn.close()    # devolve ao pool

    if key:
        _cache_set(key, rows)
    return rows


def execute_dml(statements: list) -> None:
    """Executa múltiplos DML statements em uma única transação.
    statements: lista de (sql, params). Invalida o cache ao final."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        for sql, params in statements:
            cursor.execute(sql, params)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()    # devolve ao pool
    cache_clear()       # dados mudaram → invalida leituras cacheadas


def parse_data(data_str: Optional[str]) -> str:
    """Converte string YYYY-MM-DD em string validada. Futuro -> hoje."""
    hoje = date.today()
    if not data_str:
        return hoje.strftime("%Y-%m-%d")
    try:
        d = datetime.strptime(data_str, "%Y-%m-%d").date()
        return min(d, hoje).strftime("%Y-%m-%d")
    except ValueError:
        return hoje.strftime("%Y-%m-%d")