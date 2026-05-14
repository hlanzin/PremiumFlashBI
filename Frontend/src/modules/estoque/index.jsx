import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { C, fmt, fmtQty, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

function Th({ label, col, sortCol, sortDir, onSort, align }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding:"6px 8px", background:C.subHeader, color:"#fff", fontSize:"10px",
      fontWeight:700, textAlign:align ?? "left", cursor:"pointer",
      userSelect:"none", whiteSpace:"nowrap",
      border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
    }}>
      {label}
      {active && (sortDir === "asc"
        ? <ChevronUp   size={9} style={{ verticalAlign:"middle" }}/>
        : <ChevronDown size={9} style={{ verticalAlign:"middle" }}/>)}
    </th>
  );
}

export default function ModuleEstoque({ isMobile, token }) {
  const [secoes,   setSecoes]   = useState([]);
  const [secaoSel, setSecaoSel] = useState(null);
  const [rows,     setRows]     = useState([]);
  const [summary,  setSummary]  = useState({});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");
  const [sortCol,  setSortCol]  = useState("valor_estoque");
  const [sortDir,  setSortDir]  = useState("desc");
  const hoje = getToday();
  const [dataRef,  setDataRef]  = useState(hoje);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API_BASE}/api/estoque/secoes`, { headers })
      .then(r => r.json())
      .then(j => setSecoes(j.dados ?? []))
      .catch(() => {});
  }, []);

  const fetchEstoque = useCallback(async () => {
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
  }, [secaoSel, dataRef]);

  useEffect(() => { fetchEstoque(); }, [fetchEstoque]);

  const filtered = rows
    .filter(r => (r.descricao ?? "").toLowerCase().includes(search.toLowerCase()) || String(r.codprod ?? "").includes(search))
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const td = (extra = {}) => ({
    padding:"5px 8px", borderBottom:`1px solid ${C.border}`,
    verticalAlign:"middle", fontSize:"11px", ...extra,
  });

  return (
    <>
      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
        padding: isMobile ? "8px 12px" : "10px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexWrap:"wrap", gap:"8px", borderBottom:`3px solid ${C.gold}`,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div>
            <div style={{ fontWeight:900, fontSize:isMobile?"16px":"20px", color:"#fff", letterSpacing:"0.06em" }}>PREMIUM</div>
            <div style={{ fontWeight:700, fontSize:"9px", color:C.gold, letterSpacing:"0.14em" }}>DISTRIBUIDORA</div>
          </div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:isMobile?"12px":"14px" }}>
            ESTOQUE POR SECAO
            {summary.historico && (
              <span style={{ fontWeight:400, fontSize:"11px", color:"rgba(255,255,255,.7)", marginLeft:"8px" }}>
                (historico: {summary.data_ref})
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          {!loading && summary.total_valor > 0 && !isMobile && (
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"rgba(255,220,180,.9)", fontSize:"10px" }}>VALOR TOTAL</div>
              <div style={{ color:"#fff", fontWeight:700, fontSize:"15px", fontFamily:C.mono }}>{fmt(summary.total_valor)}</div>
            </div>
          )}
          <button onClick={fetchEstoque} disabled={loading}
            style={{ background:"rgba(0,0,0,.25)", border:"1px solid rgba(255,255,255,.3)",
                     color:"#fff", padding:"6px 10px", borderRadius:"6px",
                     cursor:"pointer", display:"flex", alignItems:"center", gap:"4px", fontSize:"12px" }}>
            <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
            {!isMobile && " Atualizar"}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        background:"#fff", borderBottom:`2px solid ${C.border}`,
        padding:isMobile?"6px 12px":"8px 20px",
        display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap",
      }}>
        <div style={{ position:"relative", display:"inline-block", minWidth:"220px", flex:isMobile?"1":"none" }}>
          <select value={secaoSel ?? ""}
            onChange={e => setSecaoSel(e.target.value ? Number(e.target.value) : null)}
            style={{ appearance:"none", WebkitAppearance:"none", width:"100%",
                     background:"#fff", border:`1px solid ${C.border}`, borderRadius:"6px",
                     padding:"7px 32px 7px 10px", fontSize:"12px", fontFamily:C.sans,
                     color:secaoSel?C.text:C.textSub, cursor:"pointer", outline:"none" }}>
            <option value="">Selecione uma secao...</option>
            {secoes.map(s => <option key={s.codsec} value={s.codsec}>{s.descricao}</option>)}
          </select>
          <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
                                          transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:C.bg, flex:isMobile?"1":"none" }}>
          <Search size={12} style={{ color:C.textSub }}/>
          <input placeholder="Filtrar produto..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border:"none", background:"transparent", fontSize:"12px",
                     width:isMobile?"auto":"140px", outline:"none", color:C.text, fontFamily:C.sans }}/>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:"#fff", marginLeft:isMobile?"0":"auto" }}>
          <span style={{ fontSize:"11px", color:C.textSub, fontWeight:600 }}>Data</span>
          <input type="date" value={dataRef} max={hoje}
            onChange={e => setDataRef(e.target.value)}
            style={{ border:"none", outline:"none", fontSize:"12px",
                     fontFamily:C.mono, color:C.text, background:"transparent", cursor:"pointer" }}/>
          {dataRef !== hoje && (
            <button onClick={() => setDataRef(hoje)}
              style={{ background:"none", border:"none", color:C.primary,
                       cursor:"pointer", fontSize:"11px", fontWeight:700 }}>
              hoje
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ margin:isMobile?"8px":"12px 16px", background:"#fff",
                    border:`1px solid ${C.border}`, borderRadius:"4px",
                    overflow:"hidden", boxShadow:`0 1px 6px rgba(170,0,0,.1)` }}>
        {loading && (
          <div style={{ padding:"16px" }}>
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ height:"30px", background:C.rowEven, borderRadius:"4px",
                                    marginBottom:"6px", animation:"pulse 1.5s ease-in-out infinite",
                                    animationDelay:(i*.1)+"s" }}/>
            ))}
          </div>
        )}
        {error && <div style={{ padding:"40px", textAlign:"center", color:C.red }}>Erro: {error}</div>}
        {!loading && !error && !secaoSel && (
          <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
            Selecione uma secao acima para visualizar o estoque.
          </div>
        )}
        {!loading && !error && secaoSel && (
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
              <thead>
                <tr>
                  <Th label="CODIGO"     col="codprod"       sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="PRODUTO"    col="descricao"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <Th label="QT/CX"      col="qtunitcx"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="ESTOQUE UN" col="qtestoque"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="ESTOQUE CX" col="qtestoquecx"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="VALOR"      col="valor_estoque" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.codprod}
                    style={{ background:i%2===0?C.rowEven:C.rowOdd }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = i%2===0?C.rowEven:C.rowOdd}>
                    <td style={td({ textAlign:"center", fontFamily:C.mono, color:C.primary, fontWeight:600 })}>{r.codprod}</td>
                    <td style={td({ maxWidth:"280px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" })}>{r.descricao}</td>
                    <td style={td({ textAlign:"right", fontFamily:C.mono })}>{fmtQty(r.qtunitcx)}</td>
                    <td style={td({ textAlign:"right", fontFamily:C.mono, color:(r.qtestoque??0)<=0?C.red:C.text })}>{fmtQty(r.qtestoque)}</td>
                    <td style={td({ textAlign:"right", fontFamily:C.mono })}>{fmtQty(r.qtestoquecx)}</td>
                    <td style={td({ textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary })}>{fmt(r.valor_estoque)}</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    <td colSpan={5} style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }}>
                      {filtered.length} produtos
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                      {fmt(filtered.reduce((s,r) => s+(r.valor_estoque??0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {filtered.length === 0 && (
              <div style={{ padding:"40px", textAlign:"center", color:C.textSub }}>Nenhum produto encontrado.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}