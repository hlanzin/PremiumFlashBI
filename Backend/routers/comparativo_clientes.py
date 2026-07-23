import calendar
from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query
from routers.auth import get_current_user, CurrentUser
from sql.comparativo_clientes_sql import (
    build_comparativo_geral_sql, build_comparativo_mensal_sql, build_clientes_ativos_sql,
    build_devolucao_mensal_sql,
)

router = APIRouter(prefix="/api/comparativo-clientes", tags=["Comparativo Clientes"])

CARGOS_OK = ("fornecedor", "admin", "gerencial", "supervisor", "vendedor")


def _janelas(ano_atual: int, ano_anterior: int):
    """
    Mesmo período do ano nos dois anos (ex.: 01/jan → hoje em ambos), pra
    não comparar um ano fechado inteiro com um ano ainda em andamento.
    Ano fechado (não é o ano corrente) usa o ano inteiro (31/dez).
    """
    hoje = date.today()
    dt_ini_atual = date(ano_atual, 1, 1)
    dt_fim_atual = hoje if ano_atual == hoje.year else date(ano_atual, 12, 31)

    diff = ano_atual - ano_anterior
    try:
        dt_fim_anterior = dt_fim_atual.replace(year=dt_fim_atual.year - diff)
    except ValueError:
        # 29/fev sem correspondente no ano anterior
        dt_fim_anterior = dt_fim_atual.replace(year=dt_fim_atual.year - diff, day=28)
    dt_ini_anterior = date(ano_anterior, 1, 1)

    return (dt_ini_atual.isoformat(), dt_fim_atual.isoformat(),
            dt_ini_anterior.isoformat(), dt_fim_anterior.isoformat())


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    dia = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, dia)


def _janela_ativos(dt_ref: date):
    """
    Últimos 3 meses FECHADOS terminando no mês anterior ao de dt_ref — mesma
    convenção de "elegibilidade"/lista negra usada em lista_negra_sql.py e
    bateu_levou_positivacao_sql.py (BASE_META):
    ADD_MONTHS(TRUNC(dt_ref,'MM'),-3) até LAST_DAY(ADD_MONTHS(dt_ref,-1)).
    Ex.: dt_ref em qualquer dia de julho -> 01/abr a 30/jun.
    """
    mes_ini_ref = dt_ref.replace(day=1)
    dt_ini = _add_months(mes_ini_ref, -3)
    mes_anterior = _add_months(dt_ref, -1)
    dt_fim = mes_anterior.replace(day=calendar.monthrange(mes_anterior.year, mes_anterior.month)[1])
    return dt_ini, dt_fim


def _codfornecs(codfornec: Optional[str], u: CurrentUser) -> list:
    if not codfornec:
        raise HTTPException(400, "Informe ?codfornec=X na URL")
    try:
        codfornecs = [int(x.strip()) for x in codfornec.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "codfornec inválido")
    if u.is_fornecedor:
        meus = set(int(x) for x in (u.codfornecs or []))
        codfornecs = [c for c in codfornecs if c in meus]
        if not codfornecs:
            raise HTTPException(403, "Código de fornecedor não autorizado")
    if not codfornecs:
        raise HTTPException(400, "Nenhum fornecedor informado")
    return codfornecs


def _filtros_carteira(u: CurrentUser, filtro_supervisor: Optional[int], filtro_vendedor: Optional[int]):
    if u.is_vendedor:
        return None, u.cod_winthor
    if u.is_supervisor:
        return u.cod_winthor, filtro_vendedor
    return filtro_supervisor, filtro_vendedor


def _pivot_mensal(rows: list, devol_rows: list, ano_atual: int, ano_anterior: int) -> list:
    """Vira [{mes, valor_atual, valor_anterior, qtd_atual, qtd_anterior,
    clientes_atual, clientes_anterior}] pros 12 meses, mesmo os sem venda.
    valor_* já sai líquido de devolução (venda do mês - devolução lançada
    naquele mês, mesma convenção do faturamento oficial)."""
    idx       = {(int(r["ano"]), int(r["mes"])): r for r in rows}
    devol_idx = {(int(r["ano"]), int(r["mes"])): float(r["valor_devolucao"] or 0) for r in devol_rows}
    meses = []
    for m in range(1, 13):
        ra = idx.get((ano_atual, m))
        rb = idx.get((ano_anterior, m))
        valor_a = (float(ra["valor"]) if ra else 0.0) - devol_idx.get((ano_atual, m), 0.0)
        valor_b = (float(rb["valor"]) if rb else 0.0) - devol_idx.get((ano_anterior, m), 0.0)
        meses.append({
            "mes": m,
            "valor_atual":       round(valor_a, 2),
            "valor_anterior":    round(valor_b, 2),
            "qtd_atual":         float(ra["quantidade"])   if ra else 0.0,
            "qtd_anterior":      float(rb["quantidade"])   if rb else 0.0,
            "clientes_atual":    int(ra["qtd_clientes"])   if ra else 0,
            "clientes_anterior": int(rb["qtd_clientes"])   if rb else 0,
        })
    return meses


@router.get("/geral")
def get_comparativo_geral(
    codfornec: Optional[str] = None,
    ano_atual: int = None,
    ano_anterior: int = None,
    filtro_supervisor: Optional[int] = None,
    filtro_vendedor: Optional[int] = None,
    u: CurrentUser = Depends(get_current_user),
):
    if u.cargo not in CARGOS_OK:
        raise HTTPException(403, "Acesso negado")

    codfornecs = _codfornecs(codfornec, u)
    ano_atual    = ano_atual    or date.today().year
    ano_anterior = ano_anterior or (ano_atual - 1)
    if ano_anterior >= ano_atual:
        raise HTTPException(400, "ano_anterior deve ser menor que ano_atual")

    sup_filtro, vend_filtro = _filtros_carteira(u, filtro_supervisor, filtro_vendedor)
    dt_ini_a, dt_fim_a, dt_ini_b, dt_fim_b = _janelas(ano_atual, ano_anterior)

    try:
        sql_cli, params_cli = build_comparativo_geral_sql(
            codfornecs, dt_ini_a, dt_fim_a, dt_ini_b, dt_fim_b,
            filtro_vendedor=vend_filtro, filtro_supervisor=sup_filtro)
        clientes = execute_query(sql_cli, params_cli)

        sql_mes, params_mes = build_comparativo_mensal_sql(
            codfornecs, dt_ini_b, dt_fim_a,
            filtro_vendedor=vend_filtro, filtro_supervisor=sup_filtro)
        mensal_rows = execute_query(sql_mes, params_mes)

        sql_devol, params_devol = build_devolucao_mensal_sql(codfornecs, dt_ini_b, dt_fim_a)
        devol_rows = execute_query(sql_devol, params_devol)

        # "Ativos" de verdade: últimos 3 meses FECHADOS terminando no mês
        # anterior à data de corte de cada ano (não uma janela rolante de
        # 90 dias) — diferente de "atendidos" (só apareceu 1x no período).
        dt_ini_ativ_a, dt_fim_ativ_a = _janela_ativos(date.fromisoformat(dt_fim_a))
        dt_ini_ativ_b, dt_fim_ativ_b = _janela_ativos(date.fromisoformat(dt_fim_b))

        sql_ativ_a, params_ativ_a = build_clientes_ativos_sql(
            codfornecs, dt_ini_ativ_a.isoformat(), dt_fim_ativ_a.isoformat(),
            filtro_vendedor=vend_filtro, filtro_supervisor=sup_filtro)
        ativos_atual = execute_query(sql_ativ_a, params_ativ_a)[0]["qtd"]

        sql_ativ_b, params_ativ_b = build_clientes_ativos_sql(
            codfornecs, dt_ini_ativ_b.isoformat(), dt_fim_ativ_b.isoformat(),
            filtro_vendedor=vend_filtro, filtro_supervisor=sup_filtro)
        ativos_anterior = execute_query(sql_ativ_b, params_ativ_b)[0]["qtd"]
    except Exception as e:
        raise HTTPException(500, str(e))

    for c in clientes:
        va, vb = c["valor_atual"], c["valor_anterior"]
        c["crescimento_pct"] = round((va - vb) / vb * 100, 1) if vb > 0 else None
        # "Novo" olha o ANO INTEIRO anterior (teve_compra_ano_anterior), não
        # só o mesmo período-a-data usado em vb/crescimento_pct — senão um
        # cliente que só passou a comprar depois da data de corte do ano
        # anterior (ex.: começou em out/2025, período comparado é jan-jul)
        # aparecia como "novo" mesmo já tendo histórico.
        teve_ano_anterior = bool(c.get("teve_compra_ano_anterior"))
        c["status"] = "novo" if not teve_ano_anterior else ("perdido" if va == 0 else "recorrente")
        # Perdido no Ano: cliente que comprou este ano (va > 0) mas cuja
        # última compra é anterior ao início da janela de "ativos" — ou
        # seja, parou de comprar há mais de 3 meses fechados. Conceito
        # diferente de "perdido" (comparação ano a ano, va == 0).
        ultima = c.get("ultima_compra_atual")
        ultima_data = ultima.date() if hasattr(ultima, "date") else ultima
        c["perdido_no_ano"] = bool(va > 0 and ultima_data is not None and ultima_data < dt_ini_ativ_a)

    resumo = {
        # Atendidos: clientes únicos que compraram em ALGUM momento do
        # período (01/jan → data de corte) — não indica se ainda compram.
        "atendidos_atual":    sum(1 for c in clientes if c["valor_atual"] > 0),
        "atendidos_anterior": sum(1 for c in clientes if c["valor_anterior"] > 0),
        # Ativos: compraram nos últimos 3 meses FECHADOS terminando na data
        # de corte de cada ano — esse sim reflete quem está sendo atendido
        # "agora".
        "ativos_atual":    ativos_atual,
        "ativos_anterior": ativos_anterior,
        "valor_total_atual":     round(sum(c["valor_atual"] for c in clientes), 2),
        "valor_total_anterior":  round(sum(c["valor_anterior"] for c in clientes), 2),
        "novos":       sum(1 for c in clientes if c["status"] == "novo"),
        "recorrentes": sum(1 for c in clientes if c["status"] == "recorrente"),
        "perdidos":    sum(1 for c in clientes if c["status"] == "perdido"),
        "perdidos_no_ano": sum(1 for c in clientes if c["perdido_no_ano"]),
    }

    return {
        "ano_atual": ano_atual, "ano_anterior": ano_anterior,
        "periodo": {"dt_ini_atual": dt_ini_a, "dt_fim_atual": dt_fim_a,
                    "dt_ini_anterior": dt_ini_b, "dt_fim_anterior": dt_fim_b,
                    "dt_ini_ativos_atual": dt_ini_ativ_a.isoformat(),
                    "dt_fim_ativos_atual": dt_fim_ativ_a.isoformat()},
        "resumo": resumo,
        "mensal": _pivot_mensal(mensal_rows, devol_rows, ano_atual, ano_anterior),
        "clientes": clientes,
    }


@router.get("/cliente/{cod_cliente}")
def get_comparativo_cliente(
    cod_cliente: int,
    codfornec: Optional[str] = None,
    ano_atual: int = None,
    ano_anterior: int = None,
    filtro_supervisor: Optional[int] = None,
    filtro_vendedor: Optional[int] = None,
    u: CurrentUser = Depends(get_current_user),
):
    """Drill-down de 1 cliente: mesmo comparativo, granularidade mensal."""
    if u.cargo not in CARGOS_OK:
        raise HTTPException(403, "Acesso negado")

    codfornecs = _codfornecs(codfornec, u)
    ano_atual    = ano_atual    or date.today().year
    ano_anterior = ano_anterior or (ano_atual - 1)

    # Mesma regra de carteira do endpoint geral — se o cliente não pertencer
    # à equipe do vendedor/supervisor, a query simplesmente não retorna nada.
    sup_filtro, vend_filtro = _filtros_carteira(u, filtro_supervisor, filtro_vendedor)
    dt_ini_a, dt_fim_a, dt_ini_b, dt_fim_b = _janelas(ano_atual, ano_anterior)

    try:
        sql_mes, params_mes = build_comparativo_mensal_sql(
            codfornecs, dt_ini_b, dt_fim_a,
            filtro_vendedor=vend_filtro, filtro_supervisor=sup_filtro,
            cod_cliente=cod_cliente)
        mensal_rows = execute_query(sql_mes, params_mes)

        sql_devol, params_devol = build_devolucao_mensal_sql(
            codfornecs, dt_ini_b, dt_fim_a, cod_cliente=cod_cliente)
        devol_rows = execute_query(sql_devol, params_devol)
    except Exception as e:
        raise HTTPException(500, str(e))

    if not mensal_rows:
        raise HTTPException(404, "Cliente sem movimento no período, ou fora da sua carteira.")

    mensal = _pivot_mensal(mensal_rows, devol_rows, ano_atual, ano_anterior)
    valor_atual    = round(sum(m["valor_atual"]    for m in mensal), 2)
    valor_anterior = round(sum(m["valor_anterior"] for m in mensal), 2)

    return {
        "cod_cliente": cod_cliente,
        "ano_atual": ano_atual, "ano_anterior": ano_anterior,
        "resumo": {
            "valor_atual": valor_atual,
            "valor_anterior": valor_anterior,
            "crescimento_pct": round((valor_atual - valor_anterior) / valor_anterior * 100, 1)
                               if valor_anterior > 0 else None,
        },
        "mensal": mensal,
    }
