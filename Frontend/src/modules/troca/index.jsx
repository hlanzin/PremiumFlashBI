import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, Users, User, Building2, Shield,
         ChevronDown, Menu, X, FileText, Banknote } from "lucide-react";
import { C, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const fmtR = v => v == null ? "—" :
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits:2 })}`;

const pctTroca = v => {
  if (v == null) return { label:"—", style:{ color:C.textSub } };
  if (v >= 2) return { label:`${v.toFixed(1)}%`, style:{ color:"#fff", background:C.red,   borderRadius:"3px", padding:"1px 5px", fontWeight:600 } };
  return          { label:`${v.toFixed(1)}%`, style:{ color:"#fff", background:C.green, borderRadius:"3px", padding:"1px 5px", fontWeight:600 } };
};

const pctFlexTroca = v => {
  if (v == null) return { label:"—", style:{ color:C.textSub } };
  const val = Math.max(0, v);
  if (val > 2) return { label:`${val.toFixed(1)}%`, style:{ color:"#fff", background:C.red,   borderRadius:"3px", padding:"1px 5px", fontWeight:600 } };
  return         { label:`${val.toFixed(1)}%`, style:{ color:"#fff", background:C.green, borderRadius:"3px", padding:"1px 5px", fontWeight:600 } };
};

function TH({ label, col, align="right", sortCol, sortDir, onSort }) {
  const active = col && sortCol === col;
  return (
    <th onClick={() => col && onSort && onSort(col)}
      style={{ padding:"6px 8px", color:"#fff", fontSize:"10px",
        fontWeight:700, textAlign:align, whiteSpace:"nowrap",
        border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
        cursor: col && onSort ? "pointer" : "default", userSelect:"none",
        background: active ? C.primaryDk : C.subHeader }}>
      {label}{active ? (sortDir==="asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

// ── Linha de dados ────────────────────────────────────────────────────────────
function DataRow({ row, i, showVendedor }) {
  const [hov, setHov] = useState(false);
  const bg  = hov ? C.rowHover : i%2===0 ? C.rowEven : C.rowOdd;
  const td  = { padding:"5px 8px", borderBottom:`1px solid #EED0D0`, verticalAlign:"middle", background:bg };
  const pt  = pctTroca(row.pct_troca);
  const pft = pctFlexTroca(row.pct_flex_troca);
  return (
    <tr onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      {showVendedor && <>
        <td style={{ ...td, textAlign:"center", fontFamily:C.mono, fontWeight:600, color:C.primary, fontSize:"11px" }}>{row.cod_vendedor}</td>
        <td style={{ ...td, fontSize:"11px", maxWidth:"160px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.nome_vendedor}</td>
      </>}
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>{fmtR(row.plf_total)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.red, fontWeight:600 }}>{fmtR(row.troca)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pt.style}>{pt.label}</span></td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.amber }}>{fmtR(row.flex_total)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pft.style}>{pft.label}</span></td>
    </tr>
  );
}

// ── Card por equipe (modo Todas Equipes) ──────────────────────────────────────
function EquipeTrocaCard({ supervisor, rows, isMobile }) {
  const [aberto, setAberto] = useState(true);
  const supRows = rows.filter(r => r.cod_supervisor === supervisor.cod);
  if (!supRows.length) return null;

  const tot = { plf_fat:0, plf_cart:0, plf_total:0, troca:0, flex:0, flex_cart:0, flex_total:0 };
  supRows.forEach(r => {
    tot.plf_fat   += r.plf_fat    ?? 0;
    tot.plf_cart  += r.plf_cart   ?? 0;
    tot.plf_total += r.plf_total  ?? 0;
    tot.troca     += r.troca      ?? 0;
    tot.flex      += r.flex       ?? 0;
    tot.flex_cart += r.flex_cart  ?? 0;
    tot.flex_total+= r.flex_total ?? 0;
  });
  const totPct = tot.plf_total > 0 ? tot.troca/tot.plf_total*100 : null;
  const totPft = tot.plf_total > 0 ? Math.max(0, (tot.troca-tot.flex_total)/tot.plf_total*100) : null;
  const pt  = pctTroca(totPct);
  const pft = pctFlexTroca(totPft);

  return (
    <div style={{ margin:"12px 16px", background:"#fff",
      border:`1px solid ${C.border}`, borderRadius:"6px",
      boxShadow:"0 1px 6px rgba(170,0,0,.1)", overflow:"hidden" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px 14px", background:`linear-gradient(90deg,${C.header},${C.primary})`,
        cursor:"pointer" }} onClick={()=>setAberto(v=>!v)}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <Shield size={14} color={C.gold}/>
          <span style={{ color:"#fff", fontWeight:700, fontSize:"13px" }}>{supervisor.nome}</span>
          <span style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>{supRows.length} vendedores</span>
          <span style={{ fontSize:"11px", color:"rgba(255,255,255,.8)", marginLeft:"8px" }}>
            PLF: {fmtR(tot.plf_total)} · Troca: {fmtR(tot.troca)}
          </span>
          <span style={{ marginLeft:"4px" }}><span style={pt.style}>{pt.label}</span></span>
        </div>
        <ChevronDown size={14} color="#fff"
          style={{ transform:aberto?"rotate(180deg)":"none", transition:"transform .2s" }}/>
      </div>

      {aberto && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
            <thead>
              <tr>
                <TH label="RCA"         align="center"/>
                <TH label="VENDEDOR"    align="left"/>
                <TH label="PLF TOTAL"/>
                <TH label="TROCA"/>
                <TH label="% TROCA"     align="center"/>
                <TH label="FLEX"/>
                <TH label="% TROCA - FLEX" align="center"/>
              </tr>
            </thead>
            <tbody>
              {supRows.map((r,i) => <DataRow key={r.cod_vendedor??i} row={r} i={i} showVendedor={true}/>)}
            </tbody>
            <tfoot>
              <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                <td colSpan={2} style={{ padding:"5px 8px", border:"1px solid #880000" }}>TOTAL</td>
                <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmtR(tot.plf_total)}</td>
                <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmtR(tot.troca)}</td>
                <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pt.style}>{pt.label}</span></td>
                <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmtR(tot.flex_total)}</td>
                <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pft.style}>{pft.label}</span></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const MODES = [
  { id:"todas_equipes", label:"Todas Equipes", Icon:Users     },
  { id:"equipe",        label:"Equipe",        Icon:Shield    },
  { id:"todos",         label:"Vendedores",    Icon:Users     },
  { id:"vendedor",      label:"Vendedor",      Icon:User      },
  { id:"supervisor",    label:"Supervisor",    Icon:Building2 },
];

export default function ModuleTroca({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;
  const isAdmin = cargo === "admin";
  const headers = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);
  const [showDebug, setShowDebug] = useState(false);

  const MODES_VIS = MODES.filter(m => {
    if (cargo === "gerencial" || cargo === "admin") return true;
    if (cargo === "supervisor") return ["equipe","todos","vendedor","supervisor"].includes(m.id);
    if (cargo === "vendedor")   return m.id === "vendedor";
    return false;
  });

  const modoInicial = cargo === "vendedor" ? "vendedor"
    : cargo === "supervisor" ? "equipe" : "todas_equipes";

  const [mode,       setMode]       = useState(modoInicial);
  const [activeCode, setActiveCode] = useState((cargo==="supervisor"||cargo==="vendedor") ? codUser : null);
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [dataRef,    setDataRef]    = useState(getToday());
  const [showMenu,   setShowMenu]   = useState(false);
  const tableRef = useRef(null);

  const supervisores = useMemo(() => {
    const map = new Map();
    data.forEach(r => { if (r.cod_supervisor && !map.has(r.cod_supervisor)) map.set(r.cod_supervisor, r.nome_supervisor ?? `#${r.cod_supervisor}`); });
    return Array.from(map.entries()).map(([cod,nome]) => ({cod,nome})).sort((a,b)=>a.nome.localeCompare(b.nome));
  }, [data]);

  const vendedores = useMemo(() => {
    const map = new Map();
    data.forEach(r => { if (r.cod_vendedor && !map.has(r.cod_vendedor)) map.set(r.cod_vendedor, r.nome_vendedor ?? `#${r.cod_vendedor}`); });
    return Array.from(map.entries()).map(([cod,nome]) => ({cod,nome})).sort((a,b)=>a.nome.localeCompare(b.nome));
  }, [data]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/troca?data=${dataRef}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()).dados ?? []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [dataRef, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Rows filtradas para modos não-todas_equipes
  const [sortCol, setSortCol] = useState("nome_vendedor");
  const [sortDir, setSortDir] = useState("asc");
  const handleSort = col => {
    setSortCol(col);
    setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc");
  };

  const rows = useMemo(() => {
    let r = [...data];
    if (mode === "equipe"     && activeCode) r = r.filter(x => x.cod_supervisor === activeCode);
    if (mode === "supervisor" && activeCode) r = r.filter(x => x.cod_supervisor === activeCode);
    if (mode === "vendedor"   && activeCode) r = r.filter(x => x.cod_vendedor   === activeCode);
    r.sort((a,b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number") return sortDir==="asc" ? av-bv : bv-av;
      return sortDir==="asc"
        ? String(av).localeCompare(String(bv),"pt-BR")
        : String(bv).localeCompare(String(av),"pt-BR");
    });
    return r;
  }, [data, mode, activeCode, sortCol, sortDir]);

  const tot = { plf_fat:0, plf_cart:0, plf_total:0, troca:0, flex:0, flex_cart:0, flex_total:0 };
  rows.forEach(r => {
    tot.plf_fat   += r.plf_fat    ?? 0;
    tot.plf_cart  += r.plf_cart   ?? 0;
    tot.plf_total += r.plf_total  ?? 0;
    tot.troca     += r.troca      ?? 0;
    tot.flex      += r.flex       ?? 0;
    tot.flex_cart += r.flex_cart  ?? 0;
    tot.flex_total+= r.flex_total ?? 0;
  });
  const totPct = tot.plf_total > 0 ? tot.troca/tot.plf_total*100 : null;
  const totPft = tot.plf_total > 0 ? Math.max(0, (tot.troca-tot.flex_total)/tot.plf_total*100) : null;
  const totPt  = pctTroca(totPct);
  const totPftS= pctFlexTroca(totPft);

  const showVendedor = mode !== "vendedor";
  const needsSelect  = ["equipe","supervisor","vendedor"].includes(mode);
  const noData       = needsSelect && !activeCode;

  const Dropdown = ({ value, onChange, options, placeholder }) => (
    <div style={{ position:"relative" }}>
      <select value={value??""} onChange={e=>onChange(e.target.value?Number(e.target.value):null)}
        style={{ appearance:"none", border:`1px solid ${C.border}`, borderRadius:"6px",
          padding:"6px 28px 6px 10px", fontSize:"12px", outline:"none",
          cursor:"pointer", background:"#fff", color:value?C.text:C.textSub, minWidth:"180px" }}>
        <option value="">{placeholder}</option>
        {options.map(o=><option key={o.cod??o.id} value={o.cod??o.id}>{o.nome}</option>)}
      </select>
      <ChevronDown size={12} style={{ position:"absolute", right:"8px", top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:C.textSub }}/>
    </div>
  );

  const exportToPDF = async () => {
    if (!tableRef.current) return;
    const { jsPDF } = window.jspdf;
    const canvas = await window.html2canvas(tableRef.current, { scale:2, useCORS:true, backgroundColor:"#fff" });
    const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
    doc.setFillColor(170,0,0); doc.rect(0,0,297,18,"F");
    doc.setFont("helvetica","bold");
    doc.setFontSize(13); doc.setTextColor(200,150,12); doc.text("PREMIUM DISTRIBUIDORA",10,8);
    doc.setFontSize(8); doc.setTextColor(255,220,180); doc.text(`TROCA — ${dataRef}`,10,14);
    const margin=8, availW=297-margin*2, availH=210-22;
    const ratio=Math.min(availW/(canvas.width/2),availH/(canvas.height/2));
    const fw=(canvas.width/2)*ratio, fh=(canvas.height/2)*ratio;
    doc.addImage(canvas.toDataURL("image/png"),"PNG",(297-fw)/2,20,fw,fh);
    doc.save(`Troca_${dataRef}.pdf`);
  };

  return (<>
    {/* Header */}
    {!isMobile && (
      <div style={{ background:`linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
        padding:"10px 20px", display:"flex", alignItems:"center",
        gap:"12px", borderBottom:`3px solid ${C.gold}` }}>
        <div>
          <div style={{ fontWeight:900, fontSize:"20px", color:"#fff", letterSpacing:"0.06em", lineHeight:1 }}>PREMIUM</div>
          <div style={{ fontWeight:700, fontSize:"9px", color:C.gold, letterSpacing:"0.14em" }}>DISTRIBUIDORA</div>
        </div>
        <div style={{ color:"#fff", fontWeight:700, fontSize:"14px", display:"flex", alignItems:"center", gap:"6px" }}>
          <Banknote size={16} color={C.gold}/> TROCA
        </div>
        {rows.length > 0 && mode !== "todas_equipes" && (
          <button onClick={exportToPDF}
            style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"5px",
              background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)",
              color:"#fff", padding:"6px 12px", borderRadius:"6px", cursor:"pointer",
              fontSize:"12px", fontWeight:700 }}>
            <FileText size={13}/> Exportar PDF
          </button>
        )}
      </div>
    )}

    {/* Toolbar */}
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
      padding:isMobile?"6px 10px":"8px 16px",
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
      <input type="date" value={dataRef} onChange={e=>setDataRef(e.target.value)}
        style={{ padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                 fontSize:"12px", outline:"none", fontFamily:"monospace" }}/>
      <button onClick={fetchData} disabled={loading}
        style={{ background:"rgba(0,0,0,.07)", border:`1px solid ${C.border}`,
          padding:"6px 8px", borderRadius:"6px", cursor:"pointer", display:"flex", alignItems:"center" }}>
        <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
      </button>

      {isAdmin && (
        <button onClick={() => setShowDebug(v=>!v)}
          style={{ padding:"5px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:700,
            cursor:"pointer", border:`1.5px solid ${showDebug?"#7C3AED":"#CBD5E1"}`,
            background: showDebug?"#7C3AED":"#fff",
            color: showDebug?"#fff":"#64748b" }}>
          🔬 Debug SQL
        </button>
      )}

      {isMobile ? (<>
        <button onClick={()=>setShowMenu(v=>!v)}
          style={{ marginLeft:"auto", background:C.primary, border:"none", color:"#fff",
            padding:"6px 10px", borderRadius:"6px", cursor:"pointer" }}>
          {showMenu ? <X size={16}/> : <Menu size={16}/>}
        </button>
        {showMenu && (
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,.4)", zIndex:200 }}
            onClick={()=>setShowMenu(false)}>
            <div style={{ position:"absolute", right:0, top:0, bottom:0, width:"220px",
              background:"#fff", padding:"16px", display:"flex", flexDirection:"column", gap:"8px" }}
              onClick={e=>e.stopPropagation()}>
              <div style={{ fontWeight:700, color:C.primary, marginBottom:"8px" }}>Modo</div>
              {MODES_VIS.map(m => (
                <button key={m.id} onClick={()=>{setMode(m.id);setActiveCode(null);setShowMenu(false);}}
                  style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px",
                    borderRadius:"8px", border:"none", cursor:"pointer",
                    background:mode===m.id?C.primary:"#f5f5f5",
                    color:mode===m.id?"#fff":C.text, fontWeight:mode===m.id?700:400 }}>
                  <m.Icon size={15}/> {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </>) : (
        <div style={{ marginLeft:"auto", display:"flex", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
          {MODES_VIS.map((m,idx) => (
            <button key={m.id} onClick={()=>{setMode(m.id);setActiveCode(null);}}
              style={{ display:"flex", alignItems:"center", gap:"5px",
                padding:"6px 10px", border:"none", cursor:"pointer", fontSize:"11px",
                background:mode===m.id?C.primary:"#fff",
                color:mode===m.id?"#fff":C.text, fontWeight:mode===m.id?700:400,
                borderRight:idx<MODES_VIS.length-1?`1px solid ${C.border}`:"none" }}>
              <m.Icon size={12}/> {m.label}
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Sub-toolbar */}
    {mode !== "todas_equipes" && (
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`,
        padding:isMobile?"6px 10px":"6px 16px",
        display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
        {mode==="equipe"     && <Dropdown value={activeCode} onChange={setActiveCode} options={supervisores} placeholder="Selecione equipe..."/>}
        {mode==="supervisor" && <Dropdown value={activeCode} onChange={setActiveCode} options={supervisores} placeholder="Selecione supervisor..."/>}
        {mode==="vendedor"   && <Dropdown value={activeCode} onChange={setActiveCode} options={vendedores}   placeholder="Selecione vendedor..."/>}
        {rows.length > 0 && (
          <div style={{ display:"flex", gap:"12px", fontSize:"11px", flexWrap:"wrap" }}>
            <span><b>{rows.length}</b> vendedores</span>
            <span>PLF: <b style={{color:C.primary}}>{fmtR(tot.plf_total)}</b></span>
            <span>Troca: <b style={{color:C.red}}>{fmtR(tot.troca)}</b></span>
            <span>% Troca: <b><span style={totPt.style}>{totPt.label}</span></b></span>
            <span>Flex: <b style={{color:C.amber}}>{fmtR(tot.flex_total)}</b></span>
          </div>
        )}
      </div>
    )}

    {/* Modo Todas Equipes */}
    {mode === "todas_equipes" && (
      <div style={{ paddingBottom:"16px" }}>
        {loading && <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando...</div>}
        {error   && <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>}
        {!loading && !error && supervisores.map(sup => (
          <EquipeTrocaCard key={sup.cod} supervisor={sup} rows={data} isMobile={isMobile}/>
        ))}
      </div>
    )}

    {/* Tabela principal (outros modos) */}
    {mode !== "todas_equipes" && (
      <div ref={tableRef} style={{ margin:isMobile?"8px":"12px 16px", background:"#fff",
        border:`1px solid ${C.border}`, borderRadius:"4px",
        overflow:"hidden", boxShadow:"0 1px 6px rgba(170,0,0,.12)" }}>
        {loading && <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando...</div>}
        {error   && <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>}
        {noData  && !loading && <div style={{ padding:"32px", textAlign:"center", color:C.textSub }}>Selecione um {mode==="vendedor"?"vendedor":"supervisor"}.</div>}
        {!loading && !error && !noData && (
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
              <thead>
                <tr>
                  {showVendedor && <><TH label="RCA"  col="cod_vendedor"  align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/><TH label="VENDEDOR" col="nome_vendedor" align="left" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/></>}
                  <TH label="PLF TOTAL"      col="plf_total"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="TROCA"          col="troca"          sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="% TROCA"        col="pct_troca"      align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="FLEX"           col="flex"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <TH label="% TROCA - FLEX" col="pct_flex_troca" align="center" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i) => <DataRow key={r.cod_vendedor??i} row={r} i={i} showVendedor={showVendedor}/>)}
                {rows.length === 0 && (
                  <tr><td colSpan={showVendedor?7:5} style={{ padding:"32px", textAlign:"center", color:C.textSub }}>
                    Nenhum dado encontrado.
                  </td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    {showVendedor && <td colSpan={2} style={{ padding:"5px 8px", border:"1px solid #880000" }}>TOTAL</td>}
                    {!showVendedor && <td style={{ padding:"5px 8px", border:"1px solid #880000" }}>TOTAL</td>}
                    <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmtR(tot.plf_total)}</td>
                    <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmtR(tot.troca)}</td>
                    <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={totPt.style}>{totPt.label}</span></td>
                    <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmtR(tot.flex_total)}</td>
                    <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={totPftS.style}>{totPftS.label}</span></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    )}

    {/* Tabela debug — só admin */}
    {isAdmin && showDebug && rows.length > 0 && (
      <div style={{ margin:"0 16px 16px", background:"#fff", border:"1.5px solid #7C3AED",
        borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 6px rgba(124,58,237,.15)" }}>
        <div style={{ padding:"8px 14px", background:"#7C3AED", color:"#fff",
          fontWeight:700, fontSize:"12px", display:"flex", alignItems:"center", gap:"8px" }}>
          🔬 Debug SQL — valores intermediários (visível apenas para admin)
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
            <thead>
              <tr>
                {["VENDEDOR","PLF FAT BRUTO","PLF DEVOL","PLF FAT LÍQ","PLF CART","PLF TOTAL",
                  "TROCA","FLEX FAT","FLEX SEMANA","FLEX TOTAL","% TROCA","% TROCA-FLEX"].map(h => (
                  <th key={h} style={{ padding:"5px 8px", background:"#EDE9FE", color:"#4C1D95",
                    fontSize:"10px", fontWeight:700, whiteSpace:"nowrap",
                    border:"1px solid #C4B5FD", textAlign: h==="VENDEDOR"?"left":"right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i) => {
                const pt  = pctTroca(r.pct_troca);
                const pft = pctFlexTroca(r.pct_flex_troca);
                return (
                  <tr key={r.cod_vendedor??i} style={{ background:i%2===0?"#FAF5FF":"#fff" }}>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", fontWeight:500 }}>{r.nome_vendedor}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono }}>{fmtR(r.dbg_plf_fat_bruto)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, color:"#DC2626" }}>{fmtR(r.dbg_plf_devol)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, fontWeight:700 }}>{fmtR(r.plf_fat)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono }}>{fmtR(r.dbg_plf_cart)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, fontWeight:700, color:"#7C3AED" }}>{fmtR(r.plf_total)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, color:C.red }}>{fmtR(r.dbg_troca_bruta)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, color:C.amber }}>{fmtR(r.flex)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, color:C.amber }}>{fmtR(r.flex_cart)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"right", fontFamily:C.mono, fontWeight:700, color:C.amber }}>{fmtR(r.flex_total)}</td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"center" }}><span style={pt.style}>{pt.label}</span></td>
                    <td style={{ padding:"4px 8px", border:"1px solid #E9D5FF", textAlign:"center" }}><span style={pft.style}>{pft.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>);
}