import json, hmac, hashlib, base64
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from config import SECRET_KEY, TOKEN_EXPIRE_HOURS
from models.usuarios import autenticar, create_tables

create_tables()

router   = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    username:     str
    nome:         str
    cargo:        str
    cod_winthor:  Optional[int]
    secoes:       List[int]       # CODSECs para filtro no Faturamento
    codfornecs:   List[int]       # CODFORNECs para filtro na Dist. Numerica


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _sign(payload: dict) -> str:
    header = _b64url(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    body   = _b64url(json.dumps(payload).encode())
    sig    = _b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def _verify(token: str) -> Optional[dict]:
    try:
        header, body, sig = token.split(".")
        expected = _b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < datetime.utcnow().timestamp():
            return None
        return payload
    except Exception:
        return None


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    user = autenticar(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario ou senha invalidos.")
    payload = {
        "sub":        user["username"],
        "cargo":      user["cargo"],
        "cod":        user["cod_winthor"],
        "secoes":     user["secoes"],
        "codfornecs": user["codfornecs"],
        "exp":        (datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)).timestamp(),
    }
    return TokenResponse(
        access_token = _sign(payload),
        username     = user["username"],
        nome         = user["nome"] or user["username"],
        cargo        = user["cargo"],
        cod_winthor  = user["cod_winthor"],
        secoes       = user["secoes"],
        codfornecs   = user["codfornecs"],
    )


@router.get("/me")
def me(u: "CurrentUser" = Depends(lambda c=Depends(HTTPBearer()): _get_user(c))):
    return {
        "username": u.username, "cargo": u.cargo,
        "cod_winthor": u.cod_winthor,
        "secoes": u.secoes, "codfornecs": u.codfornecs,
    }


class CurrentUser:
    def __init__(self, payload: dict):
        self.username:    str           = payload["sub"]
        self.cargo:       str           = payload["cargo"]
        self.cod_winthor: Optional[int] = payload.get("cod")
        self.secoes:      List[int]     = payload.get("secoes", [])
        self.codfornecs:  List[int]     = payload.get("codfornecs", [])

    @property
    def is_admin(self)      -> bool: return self.cargo == "admin"
    @property
    def is_gerencial(self)  -> bool: return self.cargo in ("gerencial", "admin")
    @property
    def is_supervisor(self) -> bool: return self.cargo == "supervisor"
    @property
    def is_vendedor(self)   -> bool: return self.cargo == "vendedor"
    @property
    def is_fornecedor(self) -> bool: return self.cargo == "fornecedor"


def _get_user(credentials: HTTPAuthorizationCredentials) -> CurrentUser:
    payload = _verify(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalido ou expirado.")
    return CurrentUser(payload)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    return _get_user(credentials)