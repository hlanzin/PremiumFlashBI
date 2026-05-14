# API de Faturamento – Rotina 1464

API FastAPI que replica a lógica da rotina 1464 do Winthor,
retornando faturamento por vendedor e seção com cálculo de meta dinâmica.

---

## Instalação

```bash
pip install -r requirements.txt
```

---

## Rodar

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Acesse a documentação interativa em: http://localhost:8000/docs

---

## Endpoints

### `GET /api/faturamento`
Retorna todos os vendedores × seções.

**Resposta:**
```json
{
  "total_registros": 320,
  "dados": [
    {
      "cod_vendedor": 140,
      "nome_vendedor": "PMU LEONARDO MARINHO VIANA",
      "cod_supervisor": 8,
      "nome_supervisor": "PMU VILMAR SANTOS TRINDADE JUNIOR",
      "cod_secao": 11007,
      "secao": "FINI DOCES",
      "valor_faturado_secao": 42891.80,
      "valor_meta_secao": 22500.00,
      "dias_uteis_consultados": 42,
      "dias_uteis_mes_atual": 21,
      "dias_uteis_decorridos": 5
    }
  ]
}
```

---

### `GET /api/faturamento/vendedor/{cod_vendedor}`
Retorna todas as seções de um vendedor específico.

**Exemplo:** `/api/faturamento/vendedor/140`

**Resposta:**
```json
{
  "cod_vendedor": 140,
  "nome_vendedor": "PMU LEONARDO MARINHO VIANA",
  "cod_supervisor": 8,
  "nome_supervisor": "PMU VILMAR SANTOS TRINDADE JUNIOR",
  "total_registros": 18,
  "dados": [ ... ]
}
```

---

### `GET /api/faturamento/supervisor/{cod_supervisor}`
Retorna o faturamento consolidado por seção de um supervisor
(soma de todos os seus vendedores).

**Exemplo:** `/api/faturamento/supervisor/8`

**Resposta:**
```json
{
  "cod_supervisor": 8,
  "nome_supervisor": "PMU VILMAR SANTOS TRINDADE JUNIOR",
  "total_faturado": 994573.79,
  "total_meta": 520000.00,
  "total_registros": 22,
  "dados": [ ... ]
}
```

---

## Lógica de meta

```
META = ((faturado / dias_uteis_consultados) * dias_uteis_mes_atual) + 5% do faturado
```

- **dias_uteis_consultados**: dias úteis dos 2 meses anteriores (fonte: PCDATAS)
- **dias_uteis_mes_atual**: dias úteis do mês corrente (fonte: PCDATAS)
- **dias_uteis_decorridos**: dias úteis já passados no mês atual (fonte: PCDATAS)

---

## CORS

Por padrão está aberto para `*`. Para produção, edite `allow_origins` no `main.py`:

```python
allow_origins=["http://localhost:3000", "https://seu-dominio.com"]
```
