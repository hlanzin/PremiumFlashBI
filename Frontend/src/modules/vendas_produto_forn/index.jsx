import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, ChevronDown, ShoppingBag } from "lucide-react";
import { C } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const fmtR  = v => (!v || v === 0) ? "—" :
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits:2 })}`;
const fmtN  = v => v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits:3 });

function TH({ label, col, align="left", sortCol, sortDir, onSort }) {
  const active = col && sortCol === col;
  return (
    <th onClick={() => col && onSort(col)}
      style={{ padding:"6px 8px", color:"#fff", fontSize:"10px",
        fontWeight:700, textAlign:align, whiteSpace:"nowrap",
        border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
        cursor: col ? "pointer" : "default", userSelect:"none",
        background: active ? C.primaryDk : C.subHeader }}>
      {label}{active ? (sortDir==="asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

export default function ModuleVendasProduto({ isMobile, token, userInfo = {} }) {
  const headers      = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);
  const cargo        = userInfo.cargo ?? "gerencial";
  const isFornecedor = cargo === "fornecedor";

  const hoje     = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel,      setFornSel]      = useState(null);
  const [mesRef,       setMesRef]       = useState(mesAtual);
  const [dados,        setDados]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [busca,        setBusca]        = useState("");
  const [sortCol,      setSortCol]      = useState("nome_produto");
  const [sortDir,      setSortDir]      = useState("asc");

  useEffect(() => {
    fetch(`${API_BASE}/api/lista-negra/fornecedores`, { headers })
      .then(r => r.json())
      .then(j => {
        let lista = j.dados ?? [];
        if (isFornecedor && userInfo.codfornecs?.length) {
          const meus = new Set(userInfo.codfornecs.map(Number));
          lista = lista.filter(f => meus.has(Number(f.id)));
        }
        setFornecedores(lista);
      })
      .catch(() => {});
  }, [headers, isFornecedor]);

  const handleSort = col => {
    setSortCol(col);
    setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc");
  };

  const fetchData = useCallback(async () => {
    if (!fornSel) return;
    setLoading(true); setError(null);
    try {
      const url = `${API_BASE}/api/vendas-produto?codfornec=${fornSel}&mes_ref=${mesRef}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDados(json.dados ?? []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [headers, fornSel, mesRef]);

  const rows = useMemo(() => {
    let r = [...dados];
    if (busca) {
      const s = busca.toLowerCase();
      r = r.filter(x =>
        (x.nome_produto??"").toLowerCase().includes(s) ||
        (x.nome_cliente??"").toLowerCase().includes(s) ||
        String(x.cod_produto??"").includes(s) ||
        String(x.cod_cliente??"").includes(s) ||
        (x.nome_vendedor??"").toLowerCase().includes(s)
      );
    }
    r.sort((a,b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number") return sortDir==="asc" ? av-bv : bv-av;
      return sortDir==="asc"
        ? String(av).localeCompare(String(bv), "pt-BR", { numeric:true })
        : String(bv).localeCompare(String(av), "pt-BR", { numeric:true });
    });
    return r;
  }, [dados, busca, sortCol, sortDir]);

  const totQtd = rows.reduce((s,r) => s+(r.quantidade??0), 0);
  const totVl  = rows.reduce((s,r) => s+(r.vl_total??0), 0);
  const [ano, mes] = mesRef.split("-");
  const mesLabel   = `${meses[parseInt(mes)-1]}/${ano}`;

  return (<>
    {/* Header */}
    {!isMobile && (
      <div style={{ background:`linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
        padding:"10px 20px", display:"flex", alignItems:"center",
        gap:"12px", borderBottom:`3px solid ${C.gold}` }}>
        <div>
          <div style={{ fontWeight:900, fontSize:"20px", color:"#fff",
            letterSpacing:"0.06em", lineHeight:1 }}>PREMIUM</div>
          <div style={{ fontWeight:700, fontSize:"9px", color:C.gold,
            letterSpacing:"0.14em" }}>DISTRIBUIDORA</div>
        </div>
        <div style={{ color:"#fff", fontWeight:700, fontSize:"14px",
          display:"flex", alignItems:"center", gap:"6px" }}>
          <ShoppingBag size={16} color={C.gold}/> VENDAS POR PRODUTO
        </div>
        {dados.length > 0 && (
          <div style={{ marginLeft:"auto", display:"flex", gap:"20px", fontSize:"11px" }}>
            {[
              ["Linhas",        rows.length,    "#fff"  ],
              ["Qtd. Total",    fmtN(totQtd),   C.amber ],
              [`Faturado ${mesLabel}`, fmtR(totVl), C.gold],
            ].map(([l,v,cor]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ color:"rgba(255,255,255,.65)", fontSize:"10px" }}>{l}</div>
                <div style={{ color:cor, fontWeight:700, fontFamily:C.mono }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Toolbar */}
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
      padding:isMobile?"6px 10px":"8px 16px",
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

      {/* Dropdown fornecedor */}
      <div style={{ position:"relative" }}>
        <select value={fornSel ?? ""} onChange={e => setFornSel(e.target.value || null)}
          style={{ appearance:"none", WebkitAppearance:"none", background:"#fff",
            border:`1px solid ${C.border}`, borderRadius:"6px",
            padding:"7px 32px 7px 10px", fontSize:"12px",
            color: fornSel ? C.text : C.textSub,
            cursor:"pointer", outline:"none", minWidth:"180px" }}>
          <option value="">Selecione fornecedor...</option>
          {fornecedores.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
          transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
      </div>

      {/* Seletor de mês */}
      <div style={{ display:"flex", alignItems:"center", gap:"6px",
        border:`1px solid ${C.border}`, borderRadius:"6px", padding:"5px 10px" }}>
        <span style={{ fontSize:"11px", color:C.textSub, fontWeight:600 }}>Mês</span>
        <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)}
          style={{ border:"none", outline:"none", fontSize:"12px",
            fontFamily:C.mono, color:C.text, cursor:"pointer", background:"transparent" }}/>
      </div>

      {/* Buscar */}
      <button onClick={fetchData} disabled={loading || !fornSel}
        style={{ padding:"7px 14px", background: fornSel ? C.primary : C.border,
          border:"none", color:"#fff", borderRadius:"6px", cursor: fornSel ? "pointer" : "default",
          fontSize:"12px", fontWeight:700, opacity: !fornSel ? 0.5 : 1 }}>
        {loading ? "Carregando..." : "Buscar"}
      </button>

      <button onClick={fetchData} disabled={loading || !fornSel}
        style={{ background:"rgba(0,0,0,.07)", border:`1px solid ${C.border}`,
          padding:"6px 8px", borderRadius:"6px", cursor:"pointer",
          display:"flex", alignItems:"center" }}>
        <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
      </button>

      {/* Busca */}
      <div style={{ display:"flex", alignItems:"center", gap:"6px",
        border:`1px solid ${C.border}`, borderRadius:"6px",
        padding:"5px 10px", background:C.bg, marginLeft:"auto" }}>
        <Search size={12} style={{ color:C.textSub }}/>
        <input placeholder="Buscar produto, cliente, vendedor..."
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border:"none", background:"transparent", fontSize:"12px",
            width: isMobile?"120px":"200px", outline:"none" }}/>
      </div>
    </div>

    {/* Conteúdo */}
    <div style={{ margin:isMobile?"8px":"12px 16px" }}>
      {!fornSel && !loading && (
        <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
          Selecione um fornecedor e clique em Buscar.
        </div>
      )}
      {loading && <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando...</div>}
      {error   && <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>}

      {!loading && !error && dados.length > 0 && (
        <div style={{ background:"#fff", border:`1px solid ${C.border}`,
          borderRadius:"4px", overflow:"hidden",
          boxShadow:"0 1px 6px rgba(170,0,0,.12)" }}>
          <div style={{ overflowX:"auto", overflowY:"auto",
            maxHeight: isMobile?"70vh":"520px",
            WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
              <thead style={{ position:"sticky", top:0, zIndex:2 }}>
                <tr>
                  <TH label="VENDEDOR"      col="nome_vendedor"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="CÓD CLI"       col="cod_cliente"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="CLIENTE"       col="nome_cliente"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="CÓD PROD"      col="cod_produto"    align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="PRODUTO"       col="nome_produto"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="QTD"           col="quantidade"     align="right"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="VL. UNIT."     col="vl_unitario"    align="right"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="VL. TOTAL"     col="vl_total"       align="right"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const bg = i%2===0 ? C.rowEven : C.rowOdd;
                  const td = { padding:"5px 8px", borderBottom:`1px solid #EED0D0`,
                    verticalAlign:"middle", background:bg };
                  return (
                    <tr key={`${row.cod_cliente}-${row.cod_produto}-${i}`}>
                      <td style={{ ...td, maxWidth:"130px", overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:"10px",
                        color:C.textSub }}>
                        {row.nome_vendedor ?? "—"}
                      </td>
                      <td style={{ ...td, textAlign:"center", fontFamily:C.mono,
                        fontWeight:600, color:C.primary, fontSize:"10px" }}>
                        {row.cod_cliente}
                      </td>
                      <td style={{ ...td, maxWidth:"160px", overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:500 }}>
                        {row.nome_cliente}
                      </td>
                      <td style={{ ...td, textAlign:"center", fontFamily:C.mono,
                        fontSize:"10px", color:C.textSub }}>
                        {row.cod_produto}
                      </td>
                      <td style={{ ...td, maxWidth:"200px", overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {row.nome_produto}
                      </td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>
                        {fmtN(row.quantidade)}
                      </td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono,
                        color:C.textSub, fontSize:"10px" }}>
                        {fmtR(row.vl_unitario)}
                      </td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono,
                        fontWeight:700, color:C.primary }}>
                        {fmtR(row.vl_total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ position:"sticky", bottom:0, zIndex:2 }}>
                <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                  <td colSpan={5} style={{ padding:"5px 8px", border:"1px solid #880000",
                    fontSize:"11px" }}>
                    TOTAL — {rows.length} linhas
                  </td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000",
                    textAlign:"right", fontFamily:C.mono }}>{fmtN(totQtd)}</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000" }}>—</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000",
                    textAlign:"right", fontFamily:C.mono }}>{fmtR(totVl)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  </>);
}
