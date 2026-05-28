# Flash BI — Documentação de Arquitetura

> **Propósito deste documento:** descrever com precisão suficiente para que uma IA (ou desenvolvedor) consiga replicar, adaptar ou estender o sistema Flash BI para qualquer distribuidora que utilize o ERP Winthor (Oracle). Este é o sistema base. Todas as instâncias futuras derivam daqui.

---

## 1. Visão Geral

O **Flash BI** é um sistema de Business Intelligence construído sobre o ERP **Winthor** da TOTVS, que roda sobre um banco **Oracle**. Ele expõe uma API REST (FastAPI) que executa SQLs analíticos diretamente no Oracle do Winthor e serve um frontend React.

```
Winthor (Oracle)
      ↓  SQL direto
FastAPI Backend  ←→  SQLite (usuários/auth local)
      ↓  REST/JSON
React Frontend (Vite)
      ↓
Usuário (navegador / PWA)
```

**Instância de referência (Premium Distribuidora):**
- Frontend: `https://flash.premiumvc.com.br`
- Backend:  `https://api-flash.premiumvc.com.br`
- Filial Winthor: `'3'`
- Deploy: Windows Server, Cloudflare Tunnel + NSSM

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Banco de dados principal | Oracle (Winthor ERP) via `oracledb` (thick mode) |
| Auth / usuários | SQLite (`flashbi_users.db`) |
| Backend | Python 3.12 + FastAPI + Uvicorn |
| Frontend | React 18 + Vite + CSS-in-JS inline |
| Deploy | Windows Server + NSSM + Cloudflare Tunnel |
| Auth tokens | JWT HS256 (implementação própria sem dependência externa) |

---

## 3. Estrutura de Arquivos

### Backend

```
Backend/
├── main.py                    # FastAPI app, registra todos os routers
├── config.py                  # Variáveis de ambiente (DB, FILIAL, SECRET_KEY)
├── database.py                # execute_query(sql, params) → lista de dicts
├── manage_users.py            # CLI para criar/editar usuários no SQLite
├── flashbi_users.db           # Banco SQLite de usuários
├── .env                       # Variáveis secretas (não versionar)
├── models/
│   ├── usuarios.py            # CRUD SQLite de usuários
│   ├── bateu_levou.py         # Modelos Pydantic do bateu levou
│   └── chamados.py            # Modelos Pydantic de chamados
├── routers/
│   ├── auth.py                # POST /auth/login, GET /auth/me
│   ├── faturamento.py         # GET /api/faturamento/*
│   ├── dist_numerica.py       # GET /api/dn/*
│   ├── bateu_levou.py         # GET /api/bateu-levou/*
│   ├── lista_negra.py         # GET /api/lista-negra/*
│   ├── troca.py               # GET /api/troca
│   ├── pedidos.py             # GET /api/pedidos, GET /api/pedidos/{id}/itens
│   ├── estoque.py             # GET /api/estoque/*
│   ├── chamados.py            # CRUD /api/chamados (SQLite)
│   └── admin.py               # GET/POST /api/admin/*
└── sql/
    ├── faturamento_sql.py     # SQL da rotina 1464 (8 CTEs)
    ├── dist_numerica_sql.py   # SQL de distribuição numérica
    ├── bateu_levou_sql.py     # SQL de metas e realizações
    ├── lista_negra_sql.py     # SQL de clientes sem compra
    ├── troca_sql.py           # SQL de PLF/Troca/Flex
    ├── pedidos_sql.py         # SQL de pedidos (rotina 335)
    └── estoque_sql.py         # SQL de posição de estoque
```

### Frontend

```
Frontend/src/
├── main.jsx
├── App.jsx                    # Roteamento de módulos por cargo
├── theme.js                   # Constantes de cores, fontes, helpers
├── auth/
│   └── Login.jsx
└── modules/
    ├── faturamento/index.jsx
    ├── ranking/index.jsx
    ├── dist_numerica/index.jsx
    ├── bateu_levou/index.jsx
    ├── lista_negra/index.jsx
    ├── troca/index.jsx
    ├── pedidos/index.jsx
    ├── estoque/index.jsx
    ├── chamados/index.jsx
    └── admin/index.jsx
```

---

## 4. Configuração (config.py / .env)

```python
# config.py lê do .env com fallbacks
DB_CONFIG = {
    "lib_dir": "C:\\InstantClient2",   # Oracle Instant Client
    "host":    "192.168.38.250",        # IP do servidor Winthor
    "port":    1521,
    "service": "WINT",                  # Service name Oracle
    "user":    "PONTUAL",
    "password": "PONTUAL",
}
FILIAL             = "3"               # Código da filial no Winthor
SECRET_KEY         = "..."             # Chave JWT (compartilhada com Auth Central futuro)
TOKEN_EXPIRE_HOURS = 720               # 30 dias
```

**Ao replicar para outra distribuidora:** só muda `DB_CONFIG`, `FILIAL`, e `SECRET_KEY`.

---

## 5. Banco de Dados Oracle (Winthor)

### Tabelas principais usadas

| Tabela | Uso |
|--------|-----|
| `PCNFSAID` | Notas fiscais de saída |
| `PCMOV` | Movimentações de estoque/venda |
| `PCMOVCOMPLE` | Complemento de movimentação (VLSUBTOTITEM) |
| `PCPRODUT` | Cadastro de produtos |
| `PCUSUARI` | Cadastro de vendedores (RCA) |
| `PCSUPERV` | Cadastro de supervisores |
| `PCSECAO` | Seções de produtos |
| `PCCLIENT` | Cadastro de clientes |
| `PCCIDADE` | Cadastro de cidades |
| `PCPEDC` / `PCPEDI` | Cabeçalho e itens de pedidos |
| `PCNFENT` / `PCESTCOM` | Notas de entrada / estorno |
| `PCDATAS` | Calendário de dias úteis |
| `PCFORNEC` | Cadastro de fornecedores |
| `PCPRACA` | Praças de entrega |

### Convenções Oracle importantes

- **Joins ANSI obrigatórios** dentro de cada CTE — nunca misturar `(+)` com `INNER JOIN` no mesmo bloco (causa `ORA-25156`)
- `TRUNC(date,'DAY')` = último domingo (início da semana Oracle)
- `TRUNC(date,'MM')` = primeiro dia do mês
- `LAST_DAY(date)` = último dia do mês
- Filial sempre filtrada como `CODFILIAL IN ('{FILIAL}')` (string)

---

## 6. Sistema de Autenticação

### Banco SQLite (`flashbi_users.db`)

```sql
-- Tabelas principais
usuarios           (id, username, password_hash, nome, cargo, cod_winthor, ativo)
fornecedor_secoes  (user_id, codsec)       -- seções liberadas para fornecedor
fornecedor_codfornec (user_id, codfornec)  -- fornecedores liberados
bl_campanhas       (id, nome, agrupamento, dim_id, data_ini, data_fim, ativo)
bl_supervisor_produtos (campanha_id, codfornec, lista_codprods)
bl_metas           (campanha_id, codusur, meta_valor)
chamados           (id, tipo, descricao, status, criado_em, ...)
```

### Cargos e Permissões

| Cargo | Acesso |
|-------|--------|
| `admin` | Tudo + debug SQL + gestão de usuários |
| `gerencial` | Todos os módulos, visão agregada |
| `supervisor` | Módulos da própria equipe |
| `vendedor` | Apenas os próprios dados |
| `fornecedor` | DN, Lista Negra, Bateu Levou filtrados por `codfornec` |

### JWT (implementação própria HS256)

O token carrega:
```json
{
  "sub": "username",
  "cargo": "fornecedor",
  "cod": 147,
  "secoes": [10040, 10042],
  "codfornecs": [1225, 588],
  "exp": 1234567890
}
```

`SECRET_KEY` é a única chave usada. **Ao criar um Auth Central multi-distribuidora, o mesmo `SECRET_KEY` deve estar no `.env` de cada API** — o token emitido pelo Auth Central será aceito por todas as APIs sem consulta externa.

### `CurrentUser` (injetado via `Depends`)

```python
class CurrentUser:
    username:    str
    cargo:       str
    cod_winthor: Optional[int]   # CODUSUR do vendedor/supervisor
    secoes:      List[int]       # CODSECs (filtro faturamento/fornecedor)
    codfornecs:  List[int]       # CODFORNECs (filtro DN/lista negra/troca)
    # Properties: is_admin, is_gerencial, is_supervisor, is_vendedor, is_fornecedor
```

---

## 7. Módulos — Endpoints e SQL

### 7.1 Faturamento (`/api/faturamento`)

Baseado na **rotina 1464** do Winthor. 8 CTEs com cálculo complexo de valor (VLSUBTOTITEM quando disponível, senão DECODE de CONDVENDA/PUNIT/PUNITCONT + IPI + ST + frete).

**Endpoints:**
```
GET /api/faturamento?modo=gerencial|vendedor|equipe|supervisor|todos&data=YYYY-MM-DD&cod=N
GET /api/faturamento/ranking?data=YYYY-MM-DD&supervisor=N
```

**CTEs:**
- `PARAMS` — datas calculadas (DT_INI, DT_FIM, DT_MES_INI, DT_HOJE, DT_SEMANA_INI, DT_ONTEM, dias úteis)
- `VENDAS` — faturamento histórico (2 meses atrás) para cálculo da meta
- `DEVOLUCOES` — devoluções do mesmo período
- `VENDAS_MES` — faturamento do mês atual
- `DEVOLUCOES_MES` — devoluções do mês atual
- `NAO_FATURADO_SEMANA` — carteira de pedidos (último domingo → ontem)
- `NAO_FATURADO_HOJE` — carteira de pedidos de hoje
- `FATURADO_HOJE` — NFs emitidas hoje

**Cálculo da carteira (`NAO_FATURADO_SEMANA`):**
```python
dias_ate_dom = (dr_date.weekday() + 1) % 7
ultimo_dom   = dr_date - timedelta(days=dias_ate_dom)
nf_ini = max(inicio_mes, ultimo_dom)   # ← último domingo, NÃO 2 domingos atrás
nf_fim = dr_date - timedelta(days=1)   # ontem
```

**Colunas retornadas** (todas em `R$`):
`valor_faturado_secao`, `valor_meta_secao`, `faturado_mes_puro`, `nao_faturado_semana`, `valor_faturado_mes_atual`, `resta_a_fazer`, `necessidade_dia`, `nao_faturado_hoje`, `faturado_hoje`, `realizado_dia`, `tendencia_pct`, `dias_uteis_*`

---

### 7.2 Distribuição Numérica (`/api/dn`)

Conta clientes distintos por vendedor × fornecedor (ou seção).

**Endpoints:**
```
GET /api/dn?data=YYYY-MM-DD&agrupamento=fornecedor|secao
GET /api/dn/gerencial
GET /api/dn/equipe/{cod_supervisor}
GET /api/dn/vendedor/{cod_vendedor}
GET /api/dn/supervisor/{cod_supervisor}
```

**CTEs:** `PARAMS`, `QT_CLI_META` (histórico 2 meses), `QT_CLI_MES` (mês atual), `NAO_FAT_SEMANA` (carteira), `NAO_FAT_HOJE` (hoje), `FAT_HOJE`

**Colunas:** `cod_vendedor`, `nome_vendedor`, `cod_supervisor`, `nome_supervisor`, `dim_id`, `nome_fornecedor|nome_secao`, `nome_cidade`, `qt_cli_meta`, `qt_cli_mes`, `qt_cli_nao_fat_semana`, `qt_cli_nao_fat_hoje`

**Acesso fornecedor:** filtra automaticamente pelos `codfornecs` do token.

---

### 7.3 Lista Negra (`/api/lista-negra`)

Clientes que estão na base do vendedor mas não compraram no período.

**Endpoints:**
```
GET /api/lista-negra/fornecedores          # lista fornecedores disponíveis
GET /api/lista-negra/secoes               # lista seções disponíveis
GET /api/lista-negra?agrupamento=&dim_id=&data=
GET /api/lista-negra/vendedor?agrupamento=&dim_id=&data=&cod_vendedor=
```

**Colunas:** `cod_cliente`, `razao_social`, `nome_fantasia`, `nome_cidade`, `cod_vendedor`, `nome_vendedor`, `cod_supervisor`, `dt_ultima_compra`, `vl_ultima_compra`, `pos_faturado`, `pos_nao_faturado`, `mudanca_base`

---

### 7.4 Troca (`/api/troca`)

Calcula PLF (Produto Líder de Fornecedor), valor de troca e flex para PMU.

**Endpoint:**
```
GET /api/troca?data=YYYY-MM-DD
```

**CTEs:**
- `PLF_FAT` — faturamento das seções PLF (`10040,10042,120239`) no mês, **CONDVENDA=1**, cálculo idêntico à rotina 1464
- `PLF_DEVOL` — devoluções PLF no mês (mesmo cálculo de DEVOLUCOES_MES)
- `PLF_CART` — carteira PLF de domingo até hoje, `CONDVENDA IN (1,2,3,7,9,14,15,17,18,19,98)`
- `TROCA` — pedidos `CONDVENDA IN (5,11)` no mês
- `FLEX` — verba abaixo da tabela dos fornecedores PMU (`FORNECS: 1658,588,1727,...`) via `(ptabela-punit)*qt`

**Fórmulas:**
```
plf_fat    = VL_PLF_FAT - VL_PLF_DEVOL
plf_total  = plf_fat + plf_cart
pct_troca  = troca / plf_fat * 100
pct_flex_troca = (troca - flex) / plf_fat * 100
```

**Thresholds frontend:** `pct_troca ≥ 2%` → vermelho; `pct_flex_troca > 2%` → vermelho

**Colunas debug** (visíveis só para `admin`): `dbg_plf_fat_bruto`, `dbg_plf_devol`, `dbg_plf_cart`, `dbg_troca_bruta`, `dbg_flex_bruta`

---

### 7.5 Pedidos (`/api/pedidos`)

Baseado na rotina 335 do Winthor. Filtrado para vendedores `NOME LIKE 'PMU%'`.

**Endpoints:**
```
GET /api/pedidos?dt_ini=&dt_fim=&codusur=&codcli=&numped=
GET /api/pedidos/{numped}/itens
```

**Colunas:** `numped`, `dt_pedido`, `codcli`, `razao_social`, `fantasia`, `posicao`, `vl_total`, `cod_vendedor`, `nome_vendedor`, `cod_supervisor`, `nome_supervisor`, `dt_faturamento`, `dt_cancelamento`, `condvenda`, `num_itens`, `num_nota`

**Situações (POSICAO):** `B`=Bloqueado, `L`=Liberado, `M`=Montado, `F`=Faturado, `C`=Cancelado

---

### 7.6 Bateu Levou (`/api/bateu-levou`)

Sistema de metas por produto/fornecedor para vendedores.

**Endpoints:**
```
GET /api/bateu-levou/campanhas
GET /api/bateu-levou/resultado?campanha_id=&codusur=
```

As metas ficam no SQLite (`bl_metas`, `bl_campanhas`, `bl_supervisor_produtos`), os realizados são consultados no Oracle.

---

### 7.7 Outros Módulos

| Módulo | Endpoint base | Fonte |
|--------|--------------|-------|
| Estoque | `/api/estoque` | Oracle (PCEST, PCPRODUT) |
| Ranking | `/api/faturamento/ranking` | Oracle (mesmo SQL do faturamento) |
| Chamados Freezer | `/api/chamados` | SQLite |
| Admin | `/api/admin` | SQLite (gestão de usuários) |

---

## 8. Frontend — Padrões e Theme

### theme.js — Paleta de Cores

```js
C = {
  primary:   "#AA0000",   // vermelho Premium
  header:    "#7A0000",
  primaryDk: "#880000",
  subHeader: "#8B0000",
  gold:      "#C8960C",
  green:     "#16A34A",
  red:       "#DC2626",
  amber:     "#D97706",
  // rows, borders, fonts...
  mono:      "'Courier New', monospace",
  sans:      "'Inter', system-ui, sans-serif",
}
```

**Ao criar white-label para outra distribuidora:** só muda `primary`, `header`, e o logo.

### App.jsx — Fluxo de Autenticação

```
1. Verifica localStorage para token existente
2. Se válido → carrega módulos visíveis para o cargo
3. Se inválido/ausente → exibe Login.jsx
4. POST /auth/login → token JWT
5. Token salvo em localStorage
6. userInfo (cargo, cod_winthor, secoes, codfornecs) propagado para todos os módulos
```

### Módulos — Props Padrão

Todos os módulos recebem:
```jsx
<Modulo isMobile={bool} token={string} userInfo={object} />
// userInfo: { cargo, cod_winthor, secoes, codfornecs, username, nome }
```

### Controle de Acesso no Frontend

O `cargo` do `userInfo` determina:
- Quais abas de modo aparecem (gerencial/todas_equipes/equipe/todos/vendedor/supervisor)
- Se o dropdown de seleção de vendedor/equipe aparece
- Se o botão 🔬 Debug SQL aparece (só `admin`)
- O valor inicial carregado (supervisor e vendedor começam já filtrados pelo próprio `cod_winthor`)

---

## 9. Deploy (Windows Server)

### Infraestrutura

```
Windows Server
├── Oracle Instant Client (C:\InstantClient2)
├── Backend
│   ├── Python venv
│   ├── Uvicorn porta 8000
│   └── NSSM → serviço Windows "FlashBI-Backend"
├── Frontend
│   ├── Vite dev server porta 5173 (ou build estático)
│   └── NSSM → serviço Windows "FlashBI-Frontend"
└── Cloudflare Tunnel
    ├── flash.premiumvc.com.br → localhost:5173
    └── api-flash.premiumvc.com.br → localhost:8000
```

### Comandos NSSM

```batch
nssm install FlashBI-Backend "C:\...\python.exe" "-m uvicorn main:app --host 0.0.0.0 --port 8000"
nssm install FlashBI-Frontend "C:\...\node.exe" "node_modules\.bin\vite --host --port 5173"
```

### Git Workflow

```
Local: C:\Users\premi\Documents\Projetos\BiPremiumTeste
Remote: Z:\ (mapeado para \\SRV-WINTHOR\...\FlashV!\repo.git)
VM: C:\Users\Administrator\Documents\FlashV!

# Deploy:
git push origin master          # no local
# Na VM:
git pull origin master
# Reiniciar serviços NSSM
```

---

## 10. Auth Central — Arquitetura Multi-Distribuidora

Para um **Portal do Fornecedor** que acessa múltiplas distribuidoras:

### Conceito

```
Portal Fornecedor
      ↓ POST /token (login único)
Auth Central (servidor do fornecedor)
      ↓ JWT com payload rico
      ├── API Premium  (valida com SECRET_KEY compartilhado)
      ├── API Nordeste (valida com SECRET_KEY compartilhado)
      └── API Sul      (valida com SECRET_KEY compartilhado)
```

### Payload JWT do Auth Central

```json
{
  "sub":  "fornecedor@email.com",
  "cargo": "fornecedor",
  "distribuidoras": [
    {
      "id":       "premium",
      "nome":     "Premium Distribuidora",
      "url":      "https://api-flash.premiumvc.com.br",
      "codfornec": [1225, 588]
    },
    {
      "id":       "nordeste",
      "nome":     "Distribuidora Nordeste",
      "url":      "https://api.nordeste.com.br",
      "codfornec": [1225]
    }
  ],
  "exp": 1234567890
}
```

### O que cada API precisa para aceitar o token do Auth Central

**Apenas o mesmo `SECRET_KEY` no `.env`** — o `_verify()` em `auth.py` já valida qualquer JWT assinado com essa chave. Não há consulta ao Auth Central em tempo de execução.

### Módulos disponíveis para fornecedor (já implementados)

- **Distribuição Numérica** — `codfornecs` do token filtra automaticamente
- **Lista Negra** — mesma lógica
- **Troca** — PLF dos produtos do fornecedor
- **Bateu Levou** — campanhas vinculadas ao fornecedor

---

## 11. Replicando para Nova Distribuidora

Lista de verificação mínima:

1. **Clonar o repositório** e criar novo `.env` com as credenciais Oracle da nova distribuidora
2. **Ajustar `FILIAL`** no `.env` (código da filial no Winthor)
3. **Verificar `CODOPER`** — alguns Winthor usam operações diferentes para saída
4. **Verificar `CONDVENDA`** — as condições de venda excluídas podem variar
5. **Ajustar `excl_usur`** — CODUSURs a excluir (internos, transferências) variam por empresa
6. **Ajustar seções PLF** no `troca_sql.py` se necessário (`PLF_SECS`)
7. **Ajustar fornecedores FLEX** no `troca_sql.py` se necessário (`FLEX_FORNECS`)
8. **Trocar cores no theme.js** para o white-label da distribuidora
9. **Trocar logo** no header dos módulos
10. **Criar `flashbi_users.db`** com `manage_users.py` e cadastrar usuários iniciais
11. **Configurar Cloudflare Tunnel** com os domínios da nova distribuidora
12. **Copiar `SECRET_KEY`** para o Auth Central se for fornecedor compartilhado

---

## 12. Notas Técnicas Importantes

### SQL

- O cálculo de valor de venda é **sempre** o CASE/DECODE da rotina 1464 — nunca `PUNIT * QT` simples
- A carteira da semana (`NAO_FATURADO_SEMANA`) vai do **último domingo** até **ontem** — calculado em Python com `(weekday+1)%7`
- JOINs dentro de um CTE devem ser 100% ANSI ou 100% estilo antigo — nunca misturar no mesmo bloco
- Filtro de filial sempre como string: `IN ('{FILIAL}')` — o Winthor armazena CODFILIAL como `VARCHAR2`

### Frontend

- **Sem `localStorage` em Artifacts** — usar state React
- Hover de tabela via CSS class (`.row:hover td`) em vez de `useState` por linha — evita re-render massivo
- `React.memo` em linhas de tabela para evitar re-render ao expandir/colapsar
- Paginação de 50 linhas para tabelas grandes — o DOM nunca renderiza mais que isso
- `useTransition` requer React 18 — evitar se a versão for incerta

### Segurança

- `SECRET_KEY` nunca no código-fonte, sempre no `.env`
- CORS liberado com `allow_origins=["*"]` (adequado para ambiente interno com Cloudflare Tunnel)
- Tokens expiram em 720h (30 dias) — ajustável via `TOKEN_EXPIRE_HOURS`
