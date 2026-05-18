"""
Endpoints do módulo de Chamados de Freezer.

POST /api/chamados          — abre chamado (vendedor/supervisor/admin)
GET  /api/chamados          — lista chamados (filtrado por cargo)
GET  /api/chamados/{id}     — detalhe
PUT  /api/chamados/{id}     — atualiza status / OS / obs (admin/gerencial)
GET  /api/chamados/cliente/{cod} — busca dados do cliente no Oracle
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from routers.auth import get_current_user, CurrentUser
from models.chamados import (
    create_chamados_tables, criar_chamado, listar_chamados,
    get_chamado, atualizar_chamado,
)
from database import get_connection

create_chamados_tables()

router = APIRouter(prefix="/api/chamados", tags=["Chamados"])

STATUS_VALIDOS = ["Aberto","Em andamento","Aguardando peça","Concluído","Cancelado"]


# ── Busca cliente Oracle ───────────────────────────────────────────────────────
@router.get("/cliente/{cod}")
def get_cliente(cod: int, u: CurrentUser = Depends(get_current_user)):
    try:
        sql = """
            SELECT
                pcclient.codcli        AS codigo,
                pcclient.cliente       AS razao_social,
                pcclient.fantasia      AS nome_fantasia,
                pcclient.cgcent        AS cpf_cnpj,
                pcclient.enderent      AS endereco,
                pcclient.numeroent     AS numero,
                pcclient.bairroent     AS bairro,
                c.nomecidade           AS cidade,
                pcclient.cepent        AS cep,
                pcclient.codusur1      AS cod_rca
            FROM pcclient
            JOIN pccidade c ON c.codcidade = pcclient.codcidade
            WHERE pcclient.codcli = :cod
        """
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(sql, {"cod": cod})
            cols = [c[0].lower() for c in cur.description]
            row  = cur.fetchone()
            if not row:
                raise HTTPException(404, "Cliente não encontrado.")
            return dict(zip(cols, row))
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Abrir chamado ─────────────────────────────────────────────────────────────
class AbrirChamadoBody(BaseModel):
    fornecedor:   str            # 'metalfrio' | 'fricon'
    cod_cliente:  int
    nome_cliente: Optional[str] = None
    cnpj:         Optional[str] = None
    endereco:     Optional[str] = None
    numero:       Optional[str] = None
    bairro:       Optional[str] = None
    cidade:       Optional[str] = None
    cep:          Optional[str] = None
    rg_freezer:   str
    modelo:       Optional[str] = "VF50A"
    voltagem:     Optional[str] = "220"
    rca_nome:     Optional[str] = None
    rca_fone:     Optional[str] = None
    defeito:      Optional[str] = None
    horario:      Optional[str] = None
    ponto_ref:    Optional[str] = None


@router.post("")
def post_chamado(body: AbrirChamadoBody, bg: BackgroundTasks,
                 u: CurrentUser = Depends(get_current_user)):
    if body.fornecedor not in ("metalfrio", "fricon"):
        raise HTTPException(400, "fornecedor deve ser 'metalfrio' ou 'fricon'.")
    if body.fornecedor == "fricon" and not body.defeito:
        raise HTTPException(400, "Fricon requer defeito, horario e ponto_ref.")

    dados = body.model_dump()
    dados["cod_vendedor"]  = u.cod_winthor  # pode ser None para admin/gerencial
    dados["nome_vendedor"] = u.username

    # Envia em background para não travar o response
    numero_reg = None

    def _enviar():
        from services.chamados_service import enviar_metalfrio, enviar_fricon
        try:
            if body.fornecedor == "metalfrio":
                nr = enviar_metalfrio(dados)
            else:
                nr = enviar_fricon(dados)
            atualizar_chamado(cid, numero_chamado=nr)
        except Exception as e:
            atualizar_chamado(cid, obs_interna=f"Erro envio: {e}", status="Erro envio")

    cid = criar_chamado(**dados)
    bg.add_task(_enviar)

    return {"id": cid, "ok": True, "msg": "Chamado registrado. Envio em processamento."}


# ── Listar chamados ───────────────────────────────────────────────────────────
@router.get("")
def get_chamados(fornecedor: Optional[str] = None,
                 status:     Optional[str] = None,
                 u: CurrentUser = Depends(get_current_user)):
    # Vendedor vê só os próprios; supervisor/gerencial/admin vê todos
    cod_v = u.cod_winthor if u.is_vendedor else None
    return {"dados": listar_chamados(
        cod_vendedor=cod_v, fornecedor=fornecedor, status=status)}


# ── Detalhe ────────────────────────────────────────────────────────────────────
@router.get("/{cid}")
def get_chamado_detalhe(cid: int, u: CurrentUser = Depends(get_current_user)):
    c = get_chamado(cid)
    if not c: raise HTTPException(404, "Chamado não encontrado.")
    if u.is_vendedor and c["cod_vendedor"] != u.cod_winthor:
        raise HTTPException(403, "Acesso negado.")
    return c


# ── Atualizar status / OS ─────────────────────────────────────────────────────
class AtualizarBody(BaseModel):
    status:         Optional[str] = None
    numero_os:      Optional[str] = None
    numero_chamado: Optional[str] = None
    obs_interna:    Optional[str] = None


@router.put("/{cid}")
def put_chamado(cid: int, body: AtualizarBody,
                u: CurrentUser = Depends(get_current_user)):
    if u.is_vendedor:
        raise HTTPException(403, "Vendedor não pode alterar chamados.")
    if body.status and body.status not in STATUS_VALIDOS:
        raise HTTPException(400, f"Status inválido. Use: {STATUS_VALIDOS}")
    c = get_chamado(cid)
    if not c: raise HTTPException(404, "Não encontrado.")
    atualizar_chamado(cid, **body.model_dump(exclude_none=True))
    return {"ok": True}