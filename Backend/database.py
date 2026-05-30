from datetime import date, datetime
from typing import Optional, List, Dict, Any
import oracledb
from config import DB_CONFIG


def get_connection():
    oracledb.init_oracle_client(lib_dir=DB_CONFIG["lib_dir"])
    dsn = oracledb.makedsn(DB_CONFIG["host"], DB_CONFIG["port"], service_name=DB_CONFIG["service"])
    return oracledb.connect(user=DB_CONFIG["user"], password=DB_CONFIG["password"], dsn=dsn)


def execute_query(sql: str, params: list) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        columns = [col[0].lower() for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
    finally:
        conn.close()


def execute_dml(statements: list) -> None:
    """Executa múltiplos DML statements em uma única transação.
    statements: lista de (sql, params)"""
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
        conn.close()


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