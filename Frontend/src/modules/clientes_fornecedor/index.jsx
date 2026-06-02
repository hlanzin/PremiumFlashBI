import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, ChevronDown, Users } from "lucide-react";
import { C } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const fmtR = v => (!v || v === 0) ? "—" :
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits:2 })}`;

const fmtDt = v => {
  if (!v) return "—";
  const s = String(v).split("T")[0];
  const [y,m,d] = s.split("-");
  return `${d}/${m}/${y}`;
};

// Gera labels dos 6 meses (m0=atual, m5=5 meses atrás)
function getMesLabels() {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const hoje  = new Date();
  return Array.from({length:6}, (_,i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  }); // [0]=atual .. [5]=5 meses atrás
}

function TH({ label, col, align="left", sortCol, sortDir, onSort }) {
  const active = col && sortCol === col;
  return (
    <th onClick={() => col && onSort && onSort(col)}
      style={{ padding:"6px 8px", color:"#fff", fontSize:"10px",
        fontWeight:700, textAlign:align, whiteSpace:"nowrap",
        border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
        cursor: col ? "pointer" : "default", userSelect:"none",
        background: active ? C.primaryDk : C.subHeader }}>
      {label}{active ? (sortDir==="asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

export default function ModuleClientesFornecedor({ isMobile, token, userInfo = {} }) {
  const headers      = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);
  const cargo        = userInfo.cargo ?? "gerencial";
  const isFornecedor = cargo === "fornecedor";
  const mesLabels    = useMemo(() => getMesLabels(), []);

  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel,      setFornSel]      = useState(null);
  const [dados,        setDados]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [busca,        setBusca]        = useState("");
  const [sortCol,      setSortCol]      = useState("razao_social");
  const [sortDir,      setSortDir]      = useState("asc");

  // Carrega dropdown — admin/gerencial vê tudo, fornecedor vê só os seus
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
      const url = `${API_BASE}/api/clientes-fornecedor?codfornec=${fornSel}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDados(json.dados ?? []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [headers, fornSel]);


  const rows = useMemo(() => {
    let r = [...dados];
    if (busca) {
      const s = busca.toLowerCase();
      r = r.filter(x =>
        (x.razao_social??"").toLowerCase().includes(s) ||
        (x.nome_fantasia??"").toLowerCase().includes(s) ||
        String(x.cod_cliente??"").includes(s) ||
        (x.nome_vendedor??"").toLowerCase().includes(s) ||
        (x.nome_cidade??"").toLowerCase().includes(s)
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

  const totVl   = [0,1,2,3,4,5].map(i => rows.reduce((s,r) => s+(r[`m${i}`]??0), 0));
  const comMes  = rows.filter(r => (r.m0 ?? 0) > 0).length;
  const semMes  = rows.filter(r => (r.m0 ?? 0) === 0).length;

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
          <Users size={16} color={C.gold}/> CLIENTES POR FORNECEDOR
        </div>
        {dados.length > 0 && (
          <div style={{ marginLeft:"auto", display:"flex", gap:"20px", fontSize:"11px" }}>
            {[
              ["Total Clientes", rows.length,      "#fff"   ],
              ["Compraram mês", comMes,             C.green  ],
              ["Sem compra",    semMes,             "#FCA5A5"],
              [mesLabels[0],   fmtR(totVl[0]),      C.gold   ],
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

      {/* Dropdown fornecedor — todos os cargos */}
      <div style={{ position:"relative" }}>
        <select value={fornSel ?? ""} onChange={e => setFornSel(e.target.value || null)}
          style={{ appearance:"none", WebkitAppearance:"none", background:"#fff",
            border:`1px solid ${C.border}`, borderRadius:"6px",
            padding:"7px 32px 7px 10px", fontSize:"12px",
            color: fornSel ? C.text : C.textSub,
            cursor:"pointer", outline:"none", minWidth:"200px" }}>
          <option value="">Selecione fornecedor...</option>
          {fornecedores.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
          transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
      </div>

      {/* Refresh */}
      <button onClick={fetchData} disabled={loading || !fornSel}
        style={{ background:"rgba(0,0,0,.07)", border:`1px solid ${C.border}`,
          padding:"6px 8px", borderRadius:"6px", cursor:"pointer",
          display:"flex", alignItems:"center",
          opacity: !fornSel ? 0.4 : 1 }}>
        <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
      </button>

      {/* Busca */}
      <div style={{ display:"flex", alignItems:"center", gap:"6px",
        border:`1px solid ${C.border}`, borderRadius:"6px",
        padding:"5px 10px", background:C.bg, marginLeft:"auto" }}>
        <Search size={12} style={{ color:C.textSub }}/>
        <input placeholder="Buscar cliente, vendedor, cidade..."
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border:"none", background:"transparent", fontSize:"12px",
            width: isMobile?"140px":"220px", outline:"none",
            color:C.text, fontFamily:C.sans }}/>
      </div>
    </div>

    {/* Conteúdo */}
    <div style={{ margin:isMobile?"8px":"12px 16px" }}>
      {!isFornecedor && !fornSel && !loading && (
        <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
          Selecione um fornecedor para carregar.
        </div>
      )}
      {loading && <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando...</div>}
      {error && <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>}

      {!loading && !error && dados.length > 0 && (
        <div style={{ background:"#fff", border:`1px solid ${C.border}`,
          borderRadius:"4px", overflow:"hidden",
          boxShadow:"0 1px 6px rgba(170,0,0,.12)" }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch",
            overflowY:"auto", maxHeight: isMobile?"70vh":"520px" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
              <thead style={{ position:"sticky", top:0, zIndex:2 }}>
                <tr>
                  <TH label="CÓD"         col="cod_cliente"      align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="CLIENTE"      col="razao_social"                    sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="CIDADE"       col="nome_cidade"                     sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="VENDEDOR"     col="nome_vendedor"                   sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="ÚLT. COMPRA" col="dt_ultima_compra" align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="VL. ÚLT."    col="vl_ultima_compra" align="right"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  {[0,1,2,3,4,5].map(i => (
                    <TH key={i} label={mesLabels[i]} col={`m${i}`} align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const bg = i%2===0 ? C.rowEven : C.rowOdd;
                  const td = { padding:"5px 8px", borderBottom:`1px solid #EED0D0`,
                    verticalAlign:"middle", background:bg };
                  return (
                    <tr key={row.cod_cliente ?? i}>
                      <td style={{ ...td, textAlign:"center", fontFamily:C.mono,
                        fontWeight:600, color:C.primary, fontSize:"10px" }}>
                        {row.cod_cliente}
                      </td>
                      <td style={{ ...td, maxWidth:"180px", overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        <div style={{ fontWeight:500 }}>
                          {row.nome_fantasia || row.razao_social}
                        </div>
                        {row.nome_fantasia && row.nome_fantasia !== row.razao_social && (
                          <div style={{ fontSize:"9px", color:C.textSub }}>{row.razao_social}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontSize:"10px", color:C.textSub, whiteSpace:"nowrap" }}>
                        {row.nome_cidade ?? "—"}
                      </td>
                      <td style={{ ...td, fontSize:"10px", color:C.textSub,
                        maxWidth:"120px", overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {row.nome_vendedor ?? "—"}
                      </td>
                      <td style={{ ...td, textAlign:"center", fontFamily:C.mono, fontSize:"10px" }}>
                        {fmtDt(row.dt_ultima_compra)}
                      </td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono,
                        fontSize:"10px", color:C.textSub }}>
                        {fmtR(row.vl_ultima_compra)}
                      </td>
                      {[0,1,2,3,4,5].map(mi => {
                        const v = row[`m${mi}`] ?? 0;
                        return (
                          <td key={mi} style={{ ...td, textAlign:"right", fontFamily:C.mono,
                            fontWeight: v > 0 ? 700 : 400,
                            color: v > 0 ? (mi === 0 ? C.primary : C.text) : C.textSub }}>
                            {fmtR(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ position:"sticky", bottom:0, zIndex:2 }}>
                <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                  <td colSpan={6} style={{ padding:"5px 8px", border:"1px solid #880000", fontSize:"11px" }}>
                    TOTAL — {rows.length} clientes
                    <span style={{ fontWeight:400, fontSize:"10px", marginLeft:"8px",
                      color:"rgba(255,255,255,.7)" }}>
                      {comMes} compraram · {semMes} sem compra no mês
                    </span>
                  </td>
                  {[0,1,2,3,4,5].map(i => (
                    <td key={i} style={{ padding:"5px 8px", border:"1px solid #880000",
                      textAlign:"right", fontFamily:C.mono, fontSize:"11px" }}>
                      {fmtR(totVl[i])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  </>);
}