import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ShoppingBag, FileSpreadsheet } from "lucide-react";
import { C, fmtR, fmtN } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import Dropdown from "../../components/Dropdown";
import ModuleHeader from "../../components/ModuleHeader";
import TableCard from "../../components/TableCard";
import { exportCSV } from "../../utils/exportCSV";
import { useSort } from "../../hooks/useSort";

export default function ModuleVendasProduto({ isMobile, token, userInfo = {} }) {
  const headers      = useAuthHeaders(token);
  const cargo        = userInfo.cargo ?? "gerencial";
  const isFornecedor = cargo === "fornecedor";
  const { sortCol, sortDir, handleSort } = useSort("nome_produto", "asc");

  const hoje     = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel, setFornSel] = useState(null);
  const [mesRef, setMesRef] = useState(mesAtual);
  const [semanaSel, setSemanaSel] = useState(null);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busca, setBusca] = useState("");

  const fmtD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  const semanas = useMemo(() => {
    const [y, m] = mesRef.split("-").map(Number);
    const primeiroDia = new Date(y, m - 1, 1);
    const ultimoDia   = new Date(y, m, 0);
    const ini = new Date(primeiroDia);
    ini.setDate(ini.getDate() - ini.getDay());
    const out = [];
    let cursor = new Date(ini), n = 1;
    while (cursor <= ultimoDia) {
      const dom = new Date(cursor);
      const sab = new Date(cursor);
      sab.setDate(sab.getDate() + 6);
      const sabFim = new Date(Math.min(sab.getTime(), ultimoDia.getTime()));
      out.push({
        id: n,
        label: `${n}ª Sem (${String(dom.getDate()).padStart(2,"0")}/${String(dom.getMonth()+1).padStart(2,"0")} - ${String(sabFim.getDate()).padStart(2,"0")}/${String(sabFim.getMonth()+1).padStart(2,"0")})`,
        dt_ini: fmtD(dom),
        dt_fim: fmtD(sabFim),
      });
      cursor.setDate(cursor.getDate() + 7);
      n++;
    }
    return out;
  }, [mesRef]);

  useEffect(() => {
    fetch(`${API_BASE}/api/lista-negra/fornecedores`, { headers })
      .then(r => r.json())
      .then(j => {
        const lista = (j.dados ?? []).map(f => ({ cod: f.id, nome: f.nome }));
        setFornecedores(lista);
        if (isFornecedor && lista.length > 0) setFornSel(lista[0].cod);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!fornSel) return;
    setLoading(true); setError(null);
    let url = `${API_BASE}/api/vendas-produto?codfornec=${fornSel}&mes_ref=${mesRef}`;
    if (semanaSel) {
      url += `&dt_ini=${semanaSel.dt_ini}&dt_fim=${semanaSel.dt_fim}`;
    }
    fetch(url, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => {
        const mapped = (j.dados ?? []).map(r => ({
          ...r,
          razao_social: r.nome_cliente,
          codprod: r.cod_produto,
          preco_unit: r.vl_unitario,
          total: r.vl_total,
        }));
        setDados(mapped);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fornSel, mesRef, semanaSel]);

  const colunas = [
    { label: "VENDEDOR", col: "nome_vendedor" },
    { label: "CLIENTE", col: "razao_social" },
    { label: "COD", col: "codprod" },
    { label: "PRODUTO", col: "nome_produto" },
    { label: "QTDE", col: "quantidade" },
    { label: "PRECO UN", col: "preco_unit" },
    { label: "TOTAL", col: "total" },
  ];

  const rows = useMemo(() => {
    let r = [...dados];
    if (busca) {
      const s = busca.toLowerCase();
      r = r.filter(row =>
        (row.nome_produto ?? "").toLowerCase().includes(s) ||
        (row.razao_social ?? "").toLowerCase().includes(s) ||
        (row.nome_vendedor ?? "").toLowerCase().includes(s));
    }
    r.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "pt-BR")
        : String(bv).localeCompare(String(av), "pt-BR");
    });
    return r;
  }, [dados, busca, sortCol, sortDir]);

  const total = useMemo(() => ({
    qtd: rows.reduce((s, r) => s + (r.quantidade ?? 0), 0),
    val: rows.reduce((s, r) => s + (r.total ?? 0), 0),
  }), [rows]);

  const exportarExcel = () => {
    if (!rows.length) return;
    const nomeForn = fornecedores.find(f => f.cod === fornSel)?.nome ?? `Forn_${fornSel}`;
    exportCSV(`Vendas_${nomeForn.replace(/\s+/g, "_")}_${mesRef}`, [
      "VENDEDOR", "CLIENTE", "COD_PRODUTO", "PRODUTO", "QTDE", "PRECO_UN", "TOTAL"
    ], rows.map(r => [
      `"${(r.nome_vendedor ?? "").replace(/"/g, '""')}"`,
      `"${(r.razao_social ?? "").replace(/"/g, '""')}"`,
      r.codprod ?? "",
      `"${(r.nome_produto ?? "").replace(/"/g, '""')}"`,
      String((r.quantidade ?? 0).toFixed(2)).replace(".", ","),
      String((r.preco_unit ?? 0).toFixed(2)).replace(".", ","),
      String((r.total ?? 0).toFixed(2)).replace(".", ","),
    ]));
  };

  const meses_opcoes = Array.from({length: 12}, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return { id: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
             nome: `${meses[d.getMonth()]}/${d.getFullYear()}` };
  });

  return (
    <>
      <ModuleHeader icon={ShoppingBag} title="VENDAS POR PRODUTO" isMobile={isMobile} />

      <div style={{
        background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <Dropdown value={fornSel} onChange={setFornSel} options={fornecedores}
          placeholder="Selecione fornecedor..." labelKey="nome" valueKey="cod" />

        <div style={{ position: "relative" }}>
          <select value={mesRef} onChange={e => { setMesRef(e.target.value); setSemanaSel(null); }}
            style={{ appearance: "none", border: `1px solid ${C.border}`, borderRadius: "6px",
                     padding: "6px 28px 6px 10px", fontSize: "12px", outline: "none",
                     cursor: "pointer", background: "#fff", color: C.text, minWidth: "140px" }}>
            {meses_opcoes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%",
                                          transform: "translateY(-50%)", pointerEvents: "none", color: C.textSub }} />
        </div>

        {semanas.length > 1 && (
          <div style={{ position: "relative" }}>
            <select value={semanaSel ? semanaSel.id : ""} onChange={e => {
              const s = semanas.find(w => w.id === Number(e.target.value));
              setSemanaSel(s ?? null);
            }}
              style={{ appearance: "none", border: `1px solid ${C.border}`, borderRadius: "6px",
                       padding: "6px 28px 6px 10px", fontSize: "12px", outline: "none",
                       cursor: "pointer", background: "#fff", color: semanaSel ? C.text : C.textSub, minWidth: "220px" }}>
              <option value="">Mês inteiro</option>
              {semanas.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%",
                                            transform: "translateY(-50%)", pointerEvents: "none", color: C.textSub }} />
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "5px 10px", background: C.bg, flex: isMobile ? "1" : "none", marginLeft: isMobile ? "0" : "auto",
        }}>
          <Search size={12} style={{ color: C.textSub }} />
          <input placeholder="Filtrar..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px",
                     width: isMobile ? "auto" : "120px", outline: "none", color: C.text, fontFamily: C.sans }} />
        </div>

        {rows.length > 0 && (
          <button onClick={exportarExcel}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: "#1D6F42", border: "none",
                     color: "#fff", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
            <FileSpreadsheet size={13} /> Exportar
          </button>
        )}
      </div>

      <TableCard isMobile={isMobile}>
        {!fornSel && !loading && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Selecione um fornecedor para visualizar as vendas.
          </div>
        )}
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Carregando...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {fornSel && !loading && !error && (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "10px" : "11px" }}>
              <thead>
                <tr>
                  {colunas.map(c => (
                    <Th key={c.col} label={c.label} col={c.col} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
                      align={c.col === "quantidade" || c.col === "preco_unit" || c.col === "total" ? "right" : "left"} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.cod_vendedor}-${r.codprod}-${i}`}
                    style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.rowEven : C.rowOdd}>
                    <td style={{ padding: "5px 8px", fontSize: "11px" }}>{r.nome_vendedor}</td>
                    <td style={{ padding: "5px 8px", fontSize: "11px" }}>{r.razao_social}</td>
                    <td style={{ padding: "5px 8px", fontFamily: C.mono, fontSize: "10px", color: C.primary, fontWeight: 600 }}>{r.codprod}</td>
                    <td style={{ padding: "5px 8px", fontSize: "11px" }}>{r.nome_produto}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmtN(r.quantidade)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmtR(r.preco_unit)}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, fontWeight: 700, color: C.primary }}>{fmtR(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }}>{rows.length} registros</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmtN(total.qtd)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }}></td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmtR(total.val)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </TableCard>
    </>
  );
}
