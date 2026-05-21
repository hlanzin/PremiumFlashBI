import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, Search, BarChart3, Users, User, Building2, Shield,
         ChevronDown, TrendingUp, TrendingDown, Menu, X, FileText, FileSpreadsheet } from "lucide-react";
import { C, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const EQUIPE_CODES = [2, 8, 9];

// ── Ícones de positivação ─────────────────────────────────────────────────────
const IconSim = () => (
  <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
    width:"26px", height:"26px", borderRadius:"50%",
    background:C.green, boxShadow:"0 2px 5px rgba(22,163,74,.4)" }}>
    <TrendingUp size={13} color="#fff" strokeWidth={2.5}/>
  </div>
);
const IconNao = () => (
  <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
    width:"26px", height:"26px", borderRadius:"50%",
    background:C.red, boxShadow:"0 2px 5px rgba(220,38,38,.4)" }}>
    <TrendingDown size={13} color="#fff" strokeWidth={2.5}/>
  </div>
);

// ── Dropdown ──────────────────────────────────────────────────────────────────
function Dropdown({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position:"relative", display:"inline-block", maxWidth:"280px", width:"100%" }}>
      <select value={value??""} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{ appearance:"none", background:"#fff", border:`1px solid ${C.border}`,
                 borderRadius:"6px", padding:"7px 32px 7px 10px", fontSize:"12px",
                 color:value?C.text:C.textSub, cursor:"pointer", outline:"none", width:"100%" }}>
        <option value="">{placeholder}</option>
        {options.map(o => {
          const key = o.id ?? o.cod;
          return <option key={key} value={key}>{o.nome}</option>;
        })}
      </select>
      <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
        transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
    </div>
  );
}

// ── Linha de vendedor (agrupador) ─────────────────────────────────────────────
function VendedorRow({ nome, rows }) {
  const fat = rows.filter(r => r.pos_faturado).length;
  const nft = rows.filter(r => r.pos_nao_faturado && !r.pos_faturado).length;
  const sem = rows.filter(r => !r.pos_faturado && !r.pos_nao_faturado).length;
  const td  = { padding:"4px 8px", background:C.subHeader, color:"#fff",
                fontSize:"11px", fontWeight:700, borderBottom:`2px solid ${C.primaryDk}` };
  return (
    <tr>
      <td colSpan={2} style={{ ...td, textAlign:"left" }}>{nome}</td>
      <td style={{ ...td, textAlign:"center" }}>{rows.length} clientes</td>
      <td style={{ ...td, textAlign:"center" }}>
        <span style={{ color:"#86EFAC" }}>✔ {fat}</span>
      </td>
      <td style={{ ...td, textAlign:"center" }}>
        <span style={{ color:"#FCD34D" }}>↗ {nft}</span>
      </td>
      <td style={{ ...td, textAlign:"center" }}>
        <span style={{ color:"#FCA5A5" }}>✖ {sem}</span>
      </td>
    </tr>
  );
}

// ── Linha de supervisor ───────────────────────────────────────────────────────
function SupervisorRow({ nome, rows }) {
  const fat = rows.filter(r => r.pos_faturado).length;
  const nft = rows.filter(r => r.pos_nao_faturado && !r.pos_faturado).length;
  const sem = rows.filter(r => !r.pos_faturado && !r.pos_nao_faturado).length;
  return (
    <tr>
      <td colSpan={6} style={{ padding:"3px 10px", background:"#F0F2F5",
        borderTop:`2px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
        fontSize:"11px", fontWeight:700, color:"#374151" }}>
        {nome}
        <span style={{ fontWeight:400, marginLeft:"12px", color:C.textSub }}>
          {rows.length} clientes ·{" "}
          <span style={{ color:C.green }}>✔ {fat} fat.</span>{" "}
          <span style={{ color:C.amber }}>↗ {nft} cart.</span>{" "}
          <span style={{ color:C.red }}>✖ {sem} sem compra</span>
        </span>
      </td>
    </tr>
  );
}

// ── Linha do cliente ──────────────────────────────────────────────────────────
function ClienteRow({ row, i, showVendedor, showSupervisor, showMudancaBase }) {
  const [hov, setHov] = useState(false);
  const bg = hov ? C.rowHover : i%2===0 ? C.rowEven : C.rowOdd;
  const td = { padding:"5px 8px", borderBottom:`1px solid ${C.border}`,
               verticalAlign:"middle", background:bg };
  const mudou = showMudancaBase && row.mudanca_base === 1;
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <td style={{ ...td, textAlign:"center", fontFamily:C.mono, fontWeight:600,
        color:C.primary, fontSize:"11px" }}>{row.cod_cliente}</td>
      <td style={{ ...td, maxWidth:"200px", overflow:"hidden",
        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        <div style={{ fontWeight:500, display:"flex", alignItems:"center", gap:"6px" }}>
          {row.nome_fantasia || row.razao_social}
          {mudou && (
            <span style={{ fontSize:"9px", fontWeight:700, padding:"1px 5px",
              borderRadius:"4px", background:"#FFF3CD", color:"#92400E",
              border:"1px solid #FCD34D", whiteSpace:"nowrap", flexShrink:0 }}>
              MUDANÇA DE BASE
            </span>
          )}
        </div>
        {row.nome_fantasia && <div style={{ fontSize:"10px", color:C.textSub }}>{row.razao_social}</div>}
        {mudou && (
          <div style={{ fontSize:"10px", color:"#92400E" }}>
            Base atual: {row.nome_vendedor_original ?? `#${row.cod_vendedor_original}`}
          </div>
        )}
      </td>
      {showVendedor && <td style={{ ...td, fontSize:"11px", color:C.textSub }}>{row.nome_vendedor ?? "—"}</td>}
      {showSupervisor && <td style={{ ...td, fontSize:"11px", color:C.textSub }}>{row.cod_supervisor ?? "—"}</td>}
      <td style={{ ...td, textAlign:"center", fontFamily:"monospace", fontSize:"11px" }}>
        {row.dt_ultima_compra
          ? String(row.dt_ultima_compra).split("T")[0].split("-").reverse().join("/")
          : "—"}
      </td>
      <td style={{ ...td, textAlign:"right", fontFamily:"monospace", fontSize:"11px" }}>
        {row.vl_ultima_compra != null
          ? `R$ ${Number(row.vl_ultima_compra).toLocaleString("pt-BR",{minimumFractionDigits:2})}`
          : "—"}
      </td>
      <td style={{ ...td, textAlign:"center" }}>
        {row.pos_faturado ? <IconSim/> : <IconNao/>}
      </td>
      <td style={{ ...td, textAlign:"center" }}>
        {row.pos_nao_faturado ? <IconSim/> : <IconNao/>}
      </td>
    </tr>
  );
}

// ── Monta o corpo da tabela agrupado ──────────────────────────────────────────
function buildRows(rows, mode, showVendedor) {
  if (!rows.length) return null;

  // Modo todos/equipe: agrupa por vendedor
  if (mode === "todos" || mode === "equipe") {
    const grupos = [];
    const map = new Map();
    rows.forEach(r => {
      const key = r.cod_vendedor ?? "—";
      if (!map.has(key)) { map.set(key, { nome:r.nome_vendedor??`#${key}`, rows:[] }); grupos.push(key); }
      map.get(key).rows.push(r);
    });
    let idx = 0;
    return grupos.flatMap(key => {
      const g = map.get(key);
      return [
        <VendedorRow key={`sup-${key}`} nome={g.nome} rows={g.rows}/>,
        ...g.rows.map(r => <ClienteRow key={r.cod_cliente} row={r} i={idx++}
          showVendedor={false} showSupervisor={false}/>)
      ];
    });
  }

  // Modo gerencial: agrupa por supervisor
  if (mode === "gerencial") {
    const grupos = [];
    const map = new Map();
    rows.forEach(r => {
      const key = r.cod_supervisor ?? "—";
      if (!map.has(key)) { map.set(key, { rows:[] }); grupos.push(key); }
      map.get(key).rows.push(r);
    });
    let idx = 0;
    return grupos.flatMap(key => {
      const g = map.get(key);
      const nome = g.rows[0]?.nome_supervisor ?? `Supervisor #${key}`;
      return [
        <SupervisorRow key={`sup-${key}`} nome={nome} rows={g.rows}/>,
        ...g.rows.map(r => <ClienteRow key={r.cod_cliente} row={r} i={idx++}
          showVendedor={true} showSupervisor={false}/>)
      ];
    });
  }

  // Demais modos: sem agrupamento
  return rows.map((r, i) => <ClienteRow key={r.cod_cliente} row={r} i={i}
    showVendedor={showVendedor} showSupervisor={false}
    showMudancaBase={mode === "vendedor"}/>);
}

// ── Cabeçalho da tabela ───────────────────────────────────────────────────────
function THead({ mode, sortCol, sortDir, onSort }) {
  const showVendedor = mode === "gerencial";
  const TH = ({ label, col, align="left" }) => {
    const active = sortCol === col;
    return (
      <th onClick={() => col && onSort(col)}
        style={{ padding:"6px 8px", background:C.subHeader, color:"#fff", fontSize:"10px",
                 fontWeight:700, textAlign:align, whiteSpace:"nowrap",
                 border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
                 cursor:col?"pointer":"default", userSelect:"none",
                 background: active ? C.primaryDk : C.subHeader }}>
        {label}{active ? (sortDir==="desc"?" ↓":" ↑") : ""}
      </th>
    );
  };
  return (
    <thead>
      <tr>
        <TH label="CÓD"           col="cod_cliente"   align="center"/>
        <TH label="CLIENTE"        col="razao_social"/>
        {showVendedor && <TH label="VENDEDOR" col="nome_vendedor"/>}
        <TH label="ÚLT. COMPRA"   align="center"/>
      <TH label="VL. ÚLT."      align="right"/>
      <TH label="POS. FATURADO"  align="center"/>
        <TH label="POS. NÃO FAT."  align="center"/>
      </tr>
    </thead>
  );
}

// ── MODOS ─────────────────────────────────────────────────────────────────────
const MODES = [
  { id:"gerencial",  label:"Gerencial",  Icon:BarChart3 },
  { id:"equipe",     label:"Equipe",     Icon:Shield    },
  { id:"todos",      label:"Vendedores", Icon:Users     },
  { id:"vendedor",   label:"Vendedor",   Icon:User      },
  { id:"supervisor", label:"Supervisor", Icon:Building2 },
];

// ── MÓDULO PRINCIPAL ──────────────────────────────────────────────────────────
export default function ModuleListaNegra({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;
  const headers = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);

  const MODES_VISIVEIS = MODES.filter(m => {
    if (cargo === "gerencial" || cargo === "admin") return true;
    if (cargo === "supervisor") return ["equipe","todos","vendedor","supervisor"].includes(m.id);
    if (cargo === "vendedor")   return m.id === "vendedor";
    return false;
  });

  const modoInicial = cargo === "vendedor" ? "vendedor"
    : cargo === "supervisor" ? "equipe" : "gerencial";

  const [mode,       setMode]       = useState(modoInicial);
  const [activeCode, setActiveCode] = useState(
    (cargo === "supervisor" || cargo === "vendedor") ? codUser : null
  );

  // Dimensão
  const [agrupamento,  setAgrupamento]  = useState("fornecedor");
  const [dimId,        setDimId]        = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [secoes,       setSecoes]       = useState([]);

  // Dados
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState("");
  const [dataRef, setDataRef] = useState(getToday());
  const [sortCol, setSortCol] = useState("cod_cliente");
  const [sortDir, setSortDir] = useState("asc");
  const [filtroVendedor, setFiltroVendedor] = useState(null);
  const [apenasNaoComprou, setApenasNaoComprou] = useState(false);

  // Supervisores e vendedores para dropdowns
  const supervisores = useMemo(() => {
    const map = new Map();
    data.forEach(r => {
      if (r.cod_supervisor && !map.has(r.cod_supervisor))
        map.set(r.cod_supervisor, r.nome_supervisor ?? `#${r.cod_supervisor}`);
    });
    return Array.from(map.entries()).map(([cod, nome]) => ({ cod, nome }))
      .sort((a,b) => a.nome.localeCompare(b.nome));
  }, [data]);

  const vendedores = useMemo(() => {
    const map = new Map();
    data.forEach(r => {
      if (r.cod_vendedor && !map.has(r.cod_vendedor))
        map.set(r.cod_vendedor, r.nome_vendedor ?? `#${r.cod_vendedor}`);
    });
    return Array.from(map.entries()).map(([cod, nome]) => ({ cod, nome }))
      .sort((a,b) => a.nome.localeCompare(b.nome));
  }, [data]);

  const equipes = useMemo(() =>
    supervisores.filter(s => EQUIPE_CODES.includes(s.cod)), [supervisores]);

  // Carrega dimensões
  useEffect(() => {
    fetch(`${API_BASE}/api/lista-negra/fornecedores`, { headers })
      .then(r => r.json()).then(j => setFornecedores(j.dados ?? [])).catch(() => {});
    fetch(`${API_BASE}/api/lista-negra/secoes`, { headers })
      .then(r => r.json()).then(j => setSecoes(j.dados ?? [])).catch(() => {});
  }, [headers]);

  const fetchData = useCallback(async () => {
    if (!dimId) return;
    setLoading(true); setError(null);
    try {
      let url;
      if (mode === "vendedor" && activeCode) {
        // Endpoint dedicado: filtra dentro do SQL pelo PCNFSAID.CODUSUR
        url = `${API_BASE}/api/lista-negra/vendedor?agrupamento=${agrupamento}&dim_id=${dimId}&data=${dataRef}&cod_vendedor=${activeCode}`;
      } else {
        url = `${API_BASE}/api/lista-negra?agrupamento=${agrupamento}&dim_id=${dimId}&data=${dataRef}`;
      }
      const j = await fetch(url, { headers }).then(r => r.json());
      setData(j.dados ?? []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [dimId, agrupamento, dataRef, mode, activeCode, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  // Filtra por modo + activeCode + busca
  const rows = useMemo(() => {
    let r = [...data];
    if (mode === "equipe"     && activeCode) r = r.filter(x => x.cod_supervisor === activeCode);
    if (mode === "supervisor" && activeCode) r = r.filter(x => x.cod_supervisor === activeCode);
    // modo "vendedor": dados já vêm filtrados pelo servidor via /vendedor — não filtra aqui
    if (mode === "gerencial"  && filtroVendedor) r = r.filter(x => x.cod_vendedor === filtroVendedor);
    if (apenasNaoComprou) r = r.filter(x => !x.pos_faturado && !x.pos_nao_faturado);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(x =>
        (x.razao_social??"").toLowerCase().includes(s) ||
        (x.nome_fantasia??"").toLowerCase().includes(s) ||
        String(x.cod_cliente??"").includes(s)
      );
    }
    r.sort((a,b) => {
      const av = a[sortCol]??"", bv = b[sortCol]??"";
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "pt-BR", { numeric:true })
        : String(bv).localeCompare(String(av), "pt-BR", { numeric:true });
    });
    return r;
  }, [data, mode, activeCode, filtroVendedor, apenasNaoComprou, search, sortCol, sortDir]);

  // Totais
  const totFat = rows.filter(r => r.pos_faturado).length;
  const totNft = rows.filter(r => r.pos_nao_faturado && !r.pos_faturado).length;
  const totSem = rows.filter(r => !r.pos_faturado && !r.pos_nao_faturado).length;

  const needsSelect  = ["vendedor","equipe","supervisor"].includes(mode);
  const noData       = needsSelect && !activeCode;
  const showVendedor = ["gerencial","todos","equipe"].includes(mode);
  const [showMenu, setShowMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const tableRef = useRef(null);

  // Label do modo atual para nome do arquivo
  const nomeModo = MODES.find(m => m.id === mode)?.label ?? mode;
  const nomeDim  = agrupamento === "fornecedor"
    ? (fornecedores.find(f => f.id === dimId)?.nome ?? dimId)
    : (secoes.find(s => s.id === dimId)?.nome ?? dimId);

  const exportToPDF = async () => {
    if (!tableRef.current) return;
    setShowExportMenu(false);
    const { jsPDF } = window.jspdf;
    const canvas = await window.html2canvas(tableRef.current, {
      scale:2, useCORS:true, backgroundColor:"#fff", logging:false,
    });
    const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
    doc.setFillColor(170,0,0); doc.rect(0,0,297,18,"F");
    doc.setFont("helvetica","bold");
    doc.setFontSize(13); doc.setTextColor(200,150,12);
    doc.text("PREMIUM DISTRIBUIDORA", 10, 8);
    doc.setFontSize(8); doc.setTextColor(255,220,180);
    doc.text(`LISTA NEGRA — ${nomeModo} — ${nomeDim} — ${dataRef}`, 10, 14);
    const margin=8, availW=297-margin*2, availH=210-22;
    const imgW=canvas.width/2, imgH=canvas.height/2;
    const ratio=Math.min(availW/imgW, availH/imgH);
    const finalW=imgW*ratio, finalH=imgH*ratio;
    const x=(297-finalW)/2;
    doc.addImage(canvas.toDataURL("image/png"),"PNG",x,20,finalW,finalH);
    doc.save(`ListaNegra_${nomeModo}_${nomeDim}_${dataRef}.pdf`);
  };

  const exportToExcel = () => {
    if (!rows.length) return;
    setShowExportMenu(false);
    const cols = ["cod_cliente","razao_social","nome_fantasia","nome_vendedor",
                  "cod_supervisor","dt_ultima_compra","vl_ultima_compra",
                  "pos_faturado","pos_nao_faturado","mudanca_base"];
    const headers = ["CÓD","RAZÃO SOCIAL","FANTASIA","VENDEDOR",
                     "SUPERVISOR","ÚLT. COMPRA","VL. ÚLT.",
                     "FATURADO","CARTEIRA","MUDANÇA BASE"];
    let csv = headers.join(";") + "\n";
    rows.forEach(r => {
      csv += cols.map(c => {
        const v = r[c];
        if (c === "dt_ultima_compra" && v)
          return String(v).split("T")[0].split("-").reverse().join("/");
        if (c === "vl_ultima_compra" && v != null)
          return Number(v).toFixed(2).replace(".",",");
        if (c === "pos_faturado" || c === "pos_nao_faturado" || c === "mudanca_base")
          return v ? "SIM" : "NÃO";
        return `"${String(v ?? "").replace(/"/g,'""')}"`;
      }).join(";") + "\n";
    });
    const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ListaNegra_${nomeModo}_${nomeDim}_${dataRef}.csv`;
    a.click();
  };

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
        <div style={{ color:"#fff", fontWeight:700, fontSize:"14px" }}>LISTA NEGRA</div>

        {/* Botão exportar */}
        {rows.length > 0 && (
          <div style={{ marginLeft:"auto", position:"relative" }}>
            <button onClick={() => setShowExportMenu(v => !v)}
              style={{ display:"flex", alignItems:"center", gap:"5px",
                background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)",
                color:"#fff", padding:"6px 12px", borderRadius:"6px",
                cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              <FileText size={13}/> Exportar <ChevronDown size={11}/>
            </button>
            {showExportMenu && (
              <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)",
                background:"#fff", border:`1px solid ${C.border}`, borderRadius:"6px",
                boxShadow:"0 4px 12px rgba(0,0,0,.15)", zIndex:100, minWidth:"160px",
                overflow:"hidden" }}>
                <button onClick={exportToPDF}
                  style={{ display:"flex", alignItems:"center", gap:"8px", width:"100%",
                    padding:"9px 14px", border:"none", borderBottom:`1px solid ${C.border}`,
                    background:"#fff", cursor:"pointer", fontSize:"12px", textAlign:"left" }}>
                  <FileText size={13} color={C.primary}/> Exportar PDF
                </button>
                <button onClick={exportToExcel}
                  style={{ display:"flex", alignItems:"center", gap:"8px", width:"100%",
                    padding:"9px 14px", border:"none",
                    background:"#fff", cursor:"pointer", fontSize:"12px", textAlign:"left" }}>
                  <FileSpreadsheet size={13} color="#1D6F42"/> Exportar Excel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )}

    {/* Toolbar */}
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
      padding: isMobile?"6px 10px":"8px 16px",
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

      {/* Toggle Fornecedor / Seção */}
      <div style={{ display:"flex", border:`1px solid ${C.border}`,
        borderRadius:"6px", overflow:"hidden", flexShrink:0 }}>
        {[["fornecedor","Fornecedor"],["secao","Seção"]].map(([id,label]) => (
          <button key={id} onClick={() => { setAgrupamento(id); setDimId(null); setData([]); }}
            style={{ padding:"6px 12px", border:"none", cursor:"pointer", fontSize:"12px",
              background:agrupamento===id?C.primary:"#fff",
              color:agrupamento===id?"#fff":C.text,
              fontWeight:agrupamento===id?700:400 }}>{label}</button>
        ))}
      </div>

      {/* Dropdown dimensão */}
      {agrupamento === "fornecedor"
        ? <Dropdown value={dimId} onChange={setDimId} options={fornecedores} placeholder="Selecione fornecedor..."/>
        : <Dropdown value={dimId} onChange={setDimId} options={secoes}       placeholder="Selecione seção..."/>}

      {/* Data */}
      <input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)}
        style={{ padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                 fontSize:"12px", outline:"none", fontFamily:"monospace" }}/>

      {/* Refresh */}
      <button onClick={fetchData} disabled={loading||!dimId}
        style={{ background:"rgba(0,0,0,.07)", border:`1px solid ${C.border}`,
          padding:"6px 8px", borderRadius:"6px", cursor:"pointer",
          display:"flex", alignItems:"center", opacity:!dimId?0.5:1 }}>
        <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
      </button>

      {/* Modos — mobile: menu hamburguer */}
      {isMobile ? (<>
        <button onClick={() => setShowMenu(v => !v)}
          style={{ marginLeft:"auto", background:C.primary, border:"none", color:"#fff",
            padding:"6px 10px", borderRadius:"6px", cursor:"pointer" }}>
          {showMenu ? <X size={16}/> : <Menu size={16}/>}
        </button>
        {showMenu && (
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0,
            background:"rgba(0,0,0,.4)", zIndex:200 }} onClick={() => setShowMenu(false)}>
            <div style={{ position:"absolute", right:0, top:0, bottom:0, width:"220px",
              background:"#fff", padding:"16px", display:"flex", flexDirection:"column", gap:"8px" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight:700, color:C.primary, marginBottom:"8px" }}>Modo</div>
              {MODES_VISIVEIS.map(m => (
                <button key={m.id} onClick={() => { setMode(m.id); setShowMenu(false); }}
                  style={{ display:"flex", alignItems:"center", gap:"8px",
                    padding:"10px 14px", borderRadius:"8px", border:"none", cursor:"pointer",
                    background:mode===m.id?C.primary:"#f5f5f5",
                    color:mode===m.id?"#fff":C.text, fontWeight:mode===m.id?700:400 }}>
                  <m.Icon size={15}/> {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </>) : (
        <div style={{ marginLeft:"auto", display:"flex", border:`1px solid ${C.border}`,
          borderRadius:"6px", overflow:"hidden" }}>
          {MODES_VISIVEIS.map((m, idx) => (
            <button key={m.id} onClick={() => { setMode(m.id); setActiveCode(null); }}
              style={{ display:"flex", alignItems:"center", gap:"5px",
                padding:"6px 10px", border:"none", cursor:"pointer", fontSize:"11px",
                background:mode===m.id?C.primary:"#fff",
                color:mode===m.id?"#fff":C.text, fontWeight:mode===m.id?700:400,
                borderRight:idx<MODES_VISIVEIS.length-1?`1px solid ${C.border}`:"none" }}>
              <m.Icon size={12}/> {m.label}
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Sub-toolbar: seletor modo + busca */}
    <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`,
      padding: isMobile?"6px 10px":"6px 16px",
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

      {mode==="equipe"     && <Dropdown value={activeCode} onChange={setActiveCode} options={equipes}      placeholder="Selecione equipe..."/>}
      {mode==="supervisor" && <Dropdown value={activeCode} onChange={setActiveCode} options={supervisores} placeholder="Selecione supervisor..."/>}
      {mode==="vendedor"   && <Dropdown value={activeCode} onChange={setActiveCode} options={vendedores}   placeholder="Selecione vendedor..."/>}

      {/* Filtro: só sem compra */}
      <button onClick={() => setApenasNaoComprou(v => !v)}
        style={{ padding:"6px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"12px",
                 fontWeight:apenasNaoComprou?700:400, border:`1.5px solid ${C.red}`,
                 background:apenasNaoComprou?C.red:"#fff",
                 color:apenasNaoComprou?"#fff":C.red, flexShrink:0 }}>
        ✖ Só sem compra
      </button>

      {/* Totais */}
      {rows.length > 0 && (
        <div style={{ display:"flex", gap:"12px", fontSize:"11px", flexWrap:"wrap" }}>
          <span style={{ color:C.text }}><b>{rows.length}</b> clientes</span>
          <span style={{ color:C.green }}><b>{totFat}</b> faturados</span>
          <span style={{ color:C.amber }}><b>{totNft}</b> só carteira</span>
          <span style={{ color:C.red, fontWeight:600 }}><b>{totSem}</b> sem compra ⚠️</span>
        </div>
      )}

      {/* Busca */}
      <div style={{ position:"relative", marginLeft:"auto" }}>
        <Search size={12} style={{ position:"absolute", left:"8px", top:"50%",
          transform:"translateY(-50%)", color:C.textSub }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          style={{ padding:"6px 8px 6px 26px", border:`1px solid ${C.border}`,
            borderRadius:"6px", fontSize:"12px", outline:"none",
            width: isMobile?"130px":"180px" }}/>
      </div>
    </div>

    {/* Conteúdo */}
    <div ref={tableRef} style={{ overflowX:"auto", padding: isMobile?"0":"0 0 8px 0" }}>
      {!dimId && (
        <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
          Selecione um fornecedor ou seção para carregar a lista.
        </div>
      )}
      {dimId && loading && (
        <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando...</div>
      )}
      {dimId && error && (
        <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>
      )}
      {dimId && noData && !loading && (
        <div style={{ padding:"32px", textAlign:"center", color:C.textSub }}>
          Selecione um {mode === "vendedor" ? "vendedor" : mode === "supervisor" ? "supervisor" : "equipe"}.
        </div>
      )}
      {dimId && !loading && !error && !noData && (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
          <THead mode={mode} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
          <tbody>
            {buildRows(rows, mode, showVendedor)}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding:"32px", textAlign:"center",
                color:C.textSub }}>Nenhum cliente encontrado.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  </>);
}