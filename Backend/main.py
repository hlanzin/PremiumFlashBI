from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, faturamento, estoque, dist_numerica, bateu_levou, admin, chamados, lista_negra, troca, pedidos, conta_corrente, clientes_fornecedor, vendas_produto_forn, campanha_fini, sugestao_pedido, incentivos, alertas, ranking_clientes, comparativo_clientes

@asynccontextmanager
async def lifespan(app: FastAPI):
    from models.exclusoes import create_tables as _ct_excl
    _ct_excl()
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
app.include_router(conta_corrente.router)
app.include_router(clientes_fornecedor.router)
app.include_router(vendas_produto_forn.router)
app.include_router(campanha_fini.router)
app.include_router(sugestao_pedido.router)
app.include_router(incentivos.router)
app.include_router(alertas.router)
app.include_router(ranking_clientes.router)
app.include_router(comparativo_clientes.router)

@app.get("/", tags=["Status"])
def root():
    return {"status": "ok", "versao": "1.3.0"}