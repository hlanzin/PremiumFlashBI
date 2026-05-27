from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, faturamento, estoque, dist_numerica, bateu_levou, admin, chamados, lista_negra, troca, pedidos

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Flash BI API v1.3.0 iniciada")
    yield

app = FastAPI(title="Flash BI API", version="1.3.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(faturamento.router)
app.include_router(estoque.router)
app.include_router(dist_numerica.router)
app.include_router(bateu_levou.router)
app.include_router(admin.router)
app.include_router(chamados.router)
app.include_router(lista_negra.router)
app.include_router(troca.router)
app.include_router(pedidos.router)

@app.get("/", tags=["Status"])
def root():
    return {"status": "ok", "versao": "1.3.0"}