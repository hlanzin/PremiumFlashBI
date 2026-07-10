"""
Painel de alertas RCA: duplicidade, bonificação sem pedido, erros de
cadastro, pedido abaixo do mínimo, boleto com prazo/plano de pagamento
incorreto, liberado/bloqueado acumulado.

Visibilidade por cargo:
  - vendedor: só os alertas do próprio código Winthor (cod_rca == cod_winthor)
  - supervisor: alertas de toda a equipe (cod_supervisor == cod_winthor)
  - gerencial/admin: todos os alertas

O vendedor confirma "certo" ou "errado". Para BNF SEM PEDIDO, o motivo é
obrigatório ao confirmar (evita bonificação enviada sem justificativa).

POSSÍVEL DUPLICIDADE é tratada à parte: em vez de "cliente teve pedido
duplicado" (que misturava todos os pedidos do cliente no período, mesmo os
sem relação entre si), agrupamos por CLUSTER de pedidos que realmente
compartilham produto repetido (union-find). Se o cliente tem dois grupos de
duplicidade distintos e sem produto em comum entre eles, ele aparece duas
vezes na lista — um alerta por cluster — em vez de um alerta só misturando
pedidos não relacionados.
"""
from typing import Optional, List
from collections import defaultdict
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from database import execute_query
from sql.alertas_sql import build_alertas_sql
from sql.duplicidade_raw_sql import build_duplicidade_raw_sql, build_duplicidade_pedidos_por_numped_sql
from sql.alertas_detalhe_sql import build_duplicidade_itens_sql
from models.alertas import (
    gerar_alerta_id, sincronizar_e_buscar_status, responder_alerta,
    TIPOS_MOTIVO_OBRIGATORIO,
)
from routers.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/alertas", tags=["Alertas RCA"])


class RespostaBody(BaseModel):
    status: str          # "confirmado" | "errado"
    motivo: Optional[str] = None


def compute_duplicidade_clusters(rows: list) -> list:
    """
    rows: [{codcli, codusur, nome, cod_supervisor, numped, codprod}, ...]
    (uma linha por combinação cliente+pedido+produto, sem agregação)

    Agrupa por cliente e, dentro de cada cliente, une (union-find) os
    pedidos que compartilham ao menos um produto repetido. Cada grupo
    conectado com 2+ pedidos vira UM alerta — cliente pode aparecer mais de
    uma vez se tiver clusters de duplicidade independentes.
    """
    por_cliente = defaultdict(list)
    for r in rows:
        por_cliente[r["codcli"]].append(r)

    resultado = []
    for codcli, linhas in por_cliente.items():
        produto_para_pedidos = defaultdict(set)
        pedido_info = {}
        for r in linhas:
            produto_para_pedidos[r["codprod"]].add(r["numped"])
            pedido_info[r["numped"]] = r

        # só produtos que aparecem em 2+ pedidos deste cliente geram conexão
        produtos_repetidos = {p: peds for p, peds in produto_para_pedidos.items() if len(peds) > 1}
        if not produtos_repetidos:
            continue

        # union-find simples sobre os NUMPED conectados por produto em comum
        parent = {}
        def find(x):
            parent.setdefault(x, x)
            while parent[x] != x:
                parent[x] = parent.get(parent[x], parent[x])
                x = parent[x]
            return x
        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for peds in produtos_repetidos.values():
            peds = list(peds)
            for i in range(1, len(peds)):
                union(peds[0], peds[i])

        grupos = defaultdict(set)
        pedidos_envolvidos = set()
        for peds in produtos_repetidos.values():
            pedidos_envolvidos.update(peds)
        for numped in pedidos_envolvidos:
            grupos[find(numped)].add(numped)

        for peds in grupos.values():
            if len(peds) < 2:
                continue
            peds_ord = sorted(peds)
            primeiro = pedido_info[peds_ord[0]]
            resultado.append({
                "cliente": codcli,
                "rca": primeiro["codusur"],
                "nome": primeiro["nome"],
                "cod_supervisor": primeiro["cod_supervisor"],
                "tipo": "POSSÍVEL DUPLICIDADE",
                "status_pedido": None,
                "numped_cluster": peds_ord,
            })
    return resultado


@router.get("")
def listar_alertas(u: CurrentUser = Depends(get_current_user)):
    """Lista os alertas visíveis para o cargo do usuário, já com o status
    (pendente/confirmado/errado) e motivo salvos anteriormente."""
    try:
        raw = execute_query(build_duplicidade_raw_sql())
        duplicidades = compute_duplicidade_clusters(raw)
        outros = execute_query(build_alertas_sql())
    except Exception as e:
        raise HTTPException(500, str(e))

    linhas = duplicidades + outros

    # Calcula o ID estável de cada alerta e sincroniza com o SQLite.
    # Duplicidade usa o CLUSTER de pedidos na chave (não o RCA), para que
    # clusters diferentes do mesmo cliente gerem alertas (e IDs) diferentes.
    for r in linhas:
        if r.get("numped_cluster"):
            chave = "|".join(str(n) for n in r["numped_cluster"])
        else:
            chave = r["rca"]
        r["alerta_id"] = gerar_alerta_id(r["tipo"], r["cliente"], chave)
        r["cod_cliente"] = r["cliente"]
        r["cod_rca"] = r["rca"]
    status_map = sincronizar_e_buscar_status(linhas)

    resultado = []
    for r in linhas:
        st = status_map.get(r["alerta_id"], {})
        resultado.append({
            "alerta_id":       r["alerta_id"],
            "cliente":         r["cliente"],
            "rca":             r["rca"],
            "nome":            r["nome"],
            "cod_supervisor":  r.get("cod_supervisor"),
            "tipo":            r["tipo"],
            "status_pedido":   r.get("status_pedido"),
            "status":          st.get("status", "pendente"),
            "motivo":          st.get("motivo"),
            "respondido_por":  st.get("respondido_por"),
            "respondido_em":   st.get("respondido_em"),
            "motivo_obrigatorio": r["tipo"] in TIPOS_MOTIVO_OBRIGATORIO,
        })

    # Filtro de visibilidade por cargo
    if u.is_vendedor:
        resultado = [a for a in resultado if a["rca"] == u.cod_winthor]
    elif u.is_supervisor:
        resultado = [a for a in resultado
                     if a["rca"] == u.cod_winthor or a["cod_supervisor"] == u.cod_winthor]
    # admin/gerencial: vê tudo, sem filtro

    # Pendentes primeiro, depois por tipo/cliente
    resultado.sort(key=lambda a: (a["status"] != "pendente", a["tipo"], a["cliente"]))

    pendentes = sum(1 for a in resultado if a["status"] == "pendente")
    return {"total": len(resultado), "pendentes": pendentes, "dados": resultado}


@router.post("/{alerta_id}/responder")
def responder(alerta_id: str, body: RespostaBody,
              u: CurrentUser = Depends(get_current_user)):
    """Vendedor confirma ('confirmado') ou reprova ('errado') o alerta,
    com motivo opcional (obrigatório para BNF SEM PEDIDO ao confirmar)."""
    if body.status not in ("confirmado", "errado", "pendente"):
        raise HTTPException(400, "status deve ser 'confirmado', 'errado' ou 'pendente'")
    try:
        responder_alerta(alerta_id, body.status, body.motivo,
                          respondido_por=str(u.cod_winthor or "?"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.get("/duplicidade/{alerta_id}")
def duplicidade_completa(alerta_id: str, u: CurrentUser = Depends(get_current_user)):
    """
    Pedidos do CLUSTER de duplicidade (não todos os pedidos do cliente no
    período — só os que realmente compartilham produto repetido entre si),
    já com os itens aninhados e marcação de produto repetido. Recalcula os
    clusters e localiza o que corresponde a este alerta_id."""
    try:
        raw = execute_query(build_duplicidade_raw_sql())
    except Exception as e:
        raise HTTPException(500, str(e))

    clusters = compute_duplicidade_clusters(raw)
    alvo = None
    for c in clusters:
        chave = "|".join(str(n) for n in c["numped_cluster"])
        cid = gerar_alerta_id(c["tipo"], c["cliente"], chave)
        if cid == alerta_id:
            alvo = c
            break

    if alvo is None:
        raise HTTPException(404, "Duplicidade não encontrada — pode já ter sido resolvida ou o "
                                  "pedido mudou de status desde a última atualização da lista.")

    numped_ids = alvo["numped_cluster"]
    numped_list_sql = ",".join(str(n) for n in numped_ids)

    sql_ped = build_duplicidade_pedidos_por_numped_sql().format(numped_list=numped_list_sql)
    sql_itens = build_duplicidade_itens_sql().format(numped_list=numped_list_sql)
    try:
        pedidos = execute_query(sql_ped)
        itens = execute_query(sql_itens)
    except Exception as e:
        raise HTTPException(500, str(e))

    itens_por_pedido = {}
    for it in itens:
        itens_por_pedido.setdefault(it["numped"], []).append({
            "cod_produto": it["codprod"],
            "descricao": it["descricao"],
            "qt": it["qt"],
            "vltotal": it["vltotal"],
            "repetido": (it.get("qt_pedidos_com_produto") or 0) > 1,
        })

    for p in pedidos:
        p["itens"] = itens_por_pedido.get(p["numped"], [])

    return {"cod_cliente": alvo["cliente"], "pedidos": pedidos}