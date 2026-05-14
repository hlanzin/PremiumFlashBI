"""
Endpoints de administração — apenas cargo 'admin'.

Usuários:
  GET    /api/admin/usuarios
  POST   /api/admin/usuarios
  PUT    /api/admin/usuarios/{id}
  PUT    /api/admin/usuarios/{id}/senha
  GET    /api/admin/usuarios/{id}/secoes
  POST   /api/admin/usuarios/{id}/secoes
  DELETE /api/admin/usuarios/{id}/secoes/{codsec}
  GET    /api/admin/usuarios/{id}/codfornecs
  POST   /api/admin/usuarios/{id}/codfornecs
  DELETE /api/admin/usuarios/{id}/codfornecs/{codfornec}

Campanhas BL:
  GET    /api/admin/campanhas    (todas)
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routers.auth import get_current_user, CurrentUser
from models.usuarios import (
    get_db, listar_usuarios, criar_usuario, alterar_senha,
    adicionar_secao_fornecedor, remover_secao_fornecedor,
    adicionar_codfornec, remover_codfornec, CARGOS_VALIDOS,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

def _only_admin(u: CurrentUser):
    if not u.is_admin:
        raise HTTPException(403, "Acesso restrito ao cargo admin.")


# ── Usuários ──────────────────────────────────────────────────────────────────
@router.get("/usuarios")
def get_usuarios(u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    return {"dados": listar_usuarios()}


class UsuarioCreate(BaseModel):
    username:    str
    senha:       str
    nome:        str
    cargo:       str
    cod_winthor: Optional[int] = None

class UsuarioUpdate(BaseModel):
    nome:        Optional[str] = None
    cargo:       Optional[str] = None
    cod_winthor: Optional[int] = None
    ativo:       Optional[int] = None

class SenhaUpdate(BaseModel):
    nova_senha: str


@router.post("/usuarios")
def post_usuario(body: UsuarioCreate, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    if body.cargo not in CARGOS_VALIDOS:
        raise HTTPException(400, f"Cargo inválido: {body.cargo}")
    try:
        uid = criar_usuario(body.username, body.senha, body.nome, body.cargo, body.cod_winthor)
        return {"id": uid, "ok": True}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.put("/usuarios/{uid}")
def put_usuario(uid: int, body: UsuarioUpdate, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    parts, params = [], []
    if body.nome        is not None: parts.append("nome=?");        params.append(body.nome)
    if body.cargo       is not None:
        if body.cargo not in CARGOS_VALIDOS:
            raise HTTPException(400, f"Cargo inválido: {body.cargo}")
        parts.append("cargo=?"); params.append(body.cargo)
    if body.cod_winthor is not None: parts.append("cod_winthor=?"); params.append(body.cod_winthor)
    if body.ativo       is not None: parts.append("ativo=?");       params.append(body.ativo)
    if not parts: return {"ok": True}
    params.append(uid)
    with get_db() as conn:
        conn.execute(f"UPDATE usuarios SET {','.join(parts)} WHERE id=?", params)
    return {"ok": True}


@router.put("/usuarios/{uid}/senha")
def put_senha(uid: int, body: SenhaUpdate, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    with get_db() as conn:
        row = conn.execute("SELECT username FROM usuarios WHERE id=?", (uid,)).fetchone()
    if not row: raise HTTPException(404, "Usuário não encontrado.")
    alterar_senha(row["username"], body.nova_senha)
    return {"ok": True}


# ── Seções (Faturamento) ──────────────────────────────────────────────────────
@router.get("/usuarios/{uid}/secoes")
def get_secoes(uid: int, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    with get_db() as conn:
        rows = conn.execute("SELECT codsec FROM fornecedor_secoes WHERE usuario_id=? ORDER BY codsec", (uid,)).fetchall()
    return {"dados": [r["codsec"] for r in rows]}

class SecaoBody(BaseModel):
    codsec: int

@router.post("/usuarios/{uid}/secoes")
def post_secao(uid: int, body: SecaoBody, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u); adicionar_secao_fornecedor(uid, body.codsec); return {"ok": True}

@router.delete("/usuarios/{uid}/secoes/{codsec}")
def del_secao(uid: int, codsec: int, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u); remover_secao_fornecedor(uid, codsec); return {"ok": True}


# ── CODFORNECs (Dist. Numérica) ───────────────────────────────────────────────
@router.get("/usuarios/{uid}/codfornecs")
def get_codfornecs(uid: int, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    with get_db() as conn:
        rows = conn.execute("SELECT codfornec FROM fornecedor_codfornec WHERE usuario_id=? ORDER BY codfornec", (uid,)).fetchall()
    return {"dados": [r["codfornec"] for r in rows]}

class CodfornecBody(BaseModel):
    codfornec: int

@router.post("/usuarios/{uid}/codfornecs")
def post_codfornec(uid: int, body: CodfornecBody, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u); adicionar_codfornec(uid, body.codfornec); return {"ok": True}

@router.delete("/usuarios/{uid}/codfornecs/{codfornec}")
def del_codfornec(uid: int, codfornec: int, u: CurrentUser = Depends(get_current_user)):
    _only_admin(u); remover_codfornec(uid, codfornec); return {"ok": True}


# ── Todas as campanhas BL ─────────────────────────────────────────────────────
@router.get("/campanhas")
def get_all_campanhas(u: CurrentUser = Depends(get_current_user)):
    _only_admin(u)
    from models.bateu_levou import listar_campanhas
    return {"dados": listar_campanhas()}