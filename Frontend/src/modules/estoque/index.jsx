import { useState, useEffect } from "react";
import { Search, RefreshCw, ChevronDown, FileSpreadsheet, Package } from "lucide-react";
import { C, fmt, fmtQty, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import SkeletonRows from "../../components/SkeletonRows";
import ModuleHeader from "../../components/ModuleHeader";
import TableCard from "../../components/TableCard";
import { exportCSV } from "../../utils/exportCSV";
import { useSort } from "../../hooks/useSort";

export default function ModuleEstoque({ isMobile, token }) {
  const headers  = useAuthHeaders(token);
  const { sortCol, sortDir, handleSort } = useSort("valor_estoque", "desc");
  const [secoes, setSecoes] = useState([]);
  const [secaoSel, setSecaoSel] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const hoje = getToday();
  const [dataRef, setDataRef] = useState(hoje);

  useEffect(() => {
    fetch(`${API_BASE}/api/estoque/secoes`, { headers })
      .then(r => r.json())
      .then(j => setSecoes(j.dados ?? []))
      .catch(() => {});
  }, []);

  const fetchEstoque = async () => {
    if (!secaoSel) return;
    setLoading(true); setError(null);
    try {
      const params = dataRef !== hoje ? `?data=${dataRef}` : "";
      const res = await fetch(`${API_BASE}/api/estoque/${secaoSel}${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRows(json.dados ?? []);
      setSummary({ total_valor: json.total_valor ?? 0, historico: json.historico ?? false, data_ref: json.data_ref });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEstoque(); }, [secaoSel, dataRef]);

  const filtered = rows
    .filter(r => (r.descricao ?? "").toLowerCase().includes(search.toLowerCase())
      || String(r.codprod ?? "").includes(search))
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "asc"
        ? (av < bv ? -1 : av > bv ? 1 : 0)
        : (av > bv ? -1 : av < bv ? 1 : 0);
    });

  const td = (extra = {}) => ({
    padding: "5px 8px", borderBottom: `1px solid ${C.border}`,
    verticalAlign: "middle", fontSize: "11px", ...extra,
  });

  const exportarExcel = () => {
    if (!filtered.length) return;
    const nomeSecao = secoes.find(s => s.codsec === secaoSel)?.descricao ?? `Secao_${secaoSel}`;
    exportCSV(`Estoque_${nomeSecao.replace(/\s+/g, "_")}_${dataRef}`, [
      "CODIGO", "PRODUTO", "QT/CX", "ESTOQUE UN", "ESTOQUE CX", "PV UN", "PV CX", "VALOR"
    ], filtered.map(r => [
      r.codprod, `"${(r.descricao ?? "").replace(/"/g, '""')}"`,
      r.qtunitcx ?? "", r.qtestoque ?? "", r.qtestoquecx ?? "",
      String(r.pvenda ?? "").replace(".", ","),
      String(r.pvenda_cx ?? "").replace(".", ","),
      String(r.valor_estoque ?? "").replace(".", ","),
    ]));
  };

  return (
    <>
      <ModuleHeader icon={Package} title="ESTOQUE POR SECAO"
        subtitle={summary.historico ? `historico: ${summary.data_ref}` : null}
        isMobile={isMobile}>
        {!loading && summary.total_valor > 0 && !isMobile && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "rgba(255,220,180,.9)", fontSize: "10px" }}>VALOR TOTAL</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px", fontFamily: C.mono }}>
              {fmt(summary.total_valor)}
            </div>
          </div>
        )}
        <button onClick={fetchEstoque} disabled={loading}
          style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.3)",
                   color: "#fff", padding: "6px 10px", borderRadius: "6px",
                   cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {!isMobile && " Atualizar"}
        </button>
      </ModuleHeader>

      <div style={{
        background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", display: "inline-block", minWidth: "220px", flex: isMobile ? "1" : "none" }}>
          <select value={secaoSel ?? ""}
            onChange={e => setSecaoSel(e.target.value ? Number(e.target.value) : null)}
            style={{ appearance: "none", WebkitAppearance: "none", width: "100%",
                     background: "#fff", border: `1px solid ${C.border}`, borderRadius: "6px",
                     padding: "7px 32px 7px 10px", fontSize: "12px", fontFamily: C.sans,
                     color: secaoSel ? C.text : C.textSub, cursor: "pointer", outline: "none" }}>
            <option value="">Selecione uma secao...</option>
            {secoes.map(s => <option key={s.codsec} value={s.codsec}>{s.descricao}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: "8px", top: "50%",
                                          transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px",
                      border: `1px solid ${C.border}`, borderRadius: "6px",
                      padding: "5px 10px", background: C.bg, flex: isMobile ? "1" : "none" }}>
          <Search size={12} style={{ color: C.textSub }} />
          <input placeholder="Filtrar produto..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px",
                     width: isMobile ? "auto" : "140px", outline: "none", color: C.text, fontFamily: C.sans }} />
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "5px 10px", background: "#fff", marginLeft: isMobile ? "0" : "auto",
        }}>
          <span style={{ fontSize: "11px", color: C.textSub, fontWeight: 600 }}>Data</span>
          <input type="date" value={dataRef} max={hoje}
            onChange={e => setDataRef(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: "12px",
                     fontFamily: C.mono, color: C.text, background: "transparent", cursor: "pointer" }} />
          {dataRef !== hoje && (
            <button onClick={() => setDataRef(hoje)}
              style={{ background: "none", border: "none", color: C.primary,
                       cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
              hoje
            </button>
          )}
          {filtered.length > 0 && (
            <button onClick={exportarExcel}
              style={{ display: "flex", alignItems: "center", gap: "5px",
                background: "#1D6F42", border: "none", color: "#fff",
                padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                fontSize: "11px", fontWeight: 700, marginLeft: "8px" }}>
              <FileSpreadsheet size={13} /> Exportar
            </button>
          )}
        </div>
      </div>

      <TableCard isMobile={isMobile}>
        {loading && <SkeletonRows count={6} height={30} />}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && !error && !secaoSel && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Selecione uma secao acima para visualizar o estoque.
          </div>
        )}
        {!loading && !error && secaoSel && (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr>
                  <Th label="CODIGO" col="codprod" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                  <Th label="PRODUTO" col="descricao" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="QT/CX" col="qtunitcx" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="ESTOQUE UN" col="qtestoque" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="ESTOQUE CX" col="qtestoquecx" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="PV UN" col="pvenda" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="PV CX" col="pvenda_cx" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="VALOR" col="valor_estoque" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.codprod}
                    style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.rowEven : C.rowOdd}>
                    <td style={td({ textAlign: "center", fontFamily: C.mono, color: C.primary, fontWeight: 600 })}>{r.codprod}</td>
                    <td style={td({ maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>{r.descricao}</td>
                    <td style={td({ textAlign: "right", fontFamily: C.mono })}>{fmtQty(r.qtunitcx)}</td>
                    <td style={td({ textAlign: "right", fontFamily: C.mono, color: (r.qtestoque ?? 0) <= 0 ? C.red : C.text })}>{fmtQty(r.qtestoque)}</td>
                    <td style={td({ textAlign: "right", fontFamily: C.mono })}>{fmtQty(r.qtestoquecx)}</td>
                    <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.textSub })}>{fmt(r.pvenda)}</td>
                    <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.textSub })}>{fmt(r.pvenda_cx)}</td>
                    <td style={td({ textAlign: "right", fontFamily: C.mono, fontWeight: 600, color: C.primary })}>{fmt(r.valor_estoque)}</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                    <td colSpan={7} style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }}>
                      {filtered.length} produtos
                    </td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>
                      {fmt(filtered.reduce((s, r) => s + (r.valor_estoque ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: C.textSub }}>Nenhum produto encontrado.</div>
            )}
          </div>
        )}
      </TableCard>
    </>
  );
}
