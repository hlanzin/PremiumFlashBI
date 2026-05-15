import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, BarChart3, Users, User, Building2, Shield,
         ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus, Menu, X } from "lucide-react";
import { C, fmtPct, pctStyle, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";
const EQUIPE_CODES = [2, 8, 9];

const fmtN = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));

const arrow = (p) => {
  if (p == null) return <span style={{ color:"#ccc" }}>—</span>;
  const [bg, shadow, Icon] =
    p >= 100 ? [C.green, "rgba(22,163,74,.5)",  TrendingUp  ] :
    p >= 90  ? [C.amber, "rgba(217,119,6,.5)",  Minus       ] :
               [C.red,   "rgba(220,38,38,.5)",  TrendingDown];
  return (
    <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                  width:"26px", height:"26px", borderRadius:"50%",
                  background:bg, boxShadow:`0 2px 5px ${shadow}` }}>
      <Icon size={13} color="#fff" strokeWidth={2.5}/>
    </div>
  );
};

function Th({ label, col, sortCol, sortDir, onSort, align }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding:"6px 8px", background:C.subHeader, color:"#fff", fontSize:"10px",
      fontWeight:700, textAlign:align??"left", cursor:"pointer", userSelect:"none",
      whiteSpace:"nowrap", border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
    }}>
      {label}
      {active && (sortDir === "asc"
        ? <ChevronUp size={9} style={{ verticalAlign:"middle" }}/>
        : <ChevronDown size={9} style={{ verticalAlign:"middle" }}/>)}
    </th>
  );
}

function DataRow({ row, i, showVendedor, colDimNome }) {
  const [hov, setHov] = useState(false);
  const pct = row.qt_cli_meta > 0 ? (row.qt_cli_mes / row.qt_cli_meta) * 100 : null;
  const bg  = hov ? C.rowHover : i % 2 === 0 ? C.rowEven : C.rowOdd;
  const td  = { padding:"5px 8px", borderBottom:`1px solid ${C.border}`, verticalAlign:"middle", background:bg };
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {showVendedor && <>
        <td style={{ ...td, textAlign:"center", fontFamily:C.mono, fontWeight:600, color:C.primary, fontSize:"11px" }}>{row.cod_vendedor}</td>
        <td style={{ ...td, maxWidth:"140px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:"11px" }}>{row.nome_vendedor}</td>
      </>}
      <td style={{ ...td, fontWeight:600 }}>{row[colDimNome] ?? "—"}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtN(row.qt_cli_meta)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>{fmtN(row.qt_cli_mes)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtN(row.qt_cli_nao_fat_semana)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary }}>{fmtN(row.qt_cli_nao_fat_hoje)}</td>
      <td style={{ ...td, textAlign:"center" }}>{arrow(pct)}</td>
    </tr>
  );
}

function Dropdown({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position:"relative", display:"inline-block", width:"100%", maxWidth:"280px" }}>
      <select value={value ?? ""} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{ appearance:"none", WebkitAppearance:"none", background:"#fff",
                 border:`1px solid ${C.border}`, borderRadius:"6px",
                 padding:"7px 32px 7px 10px", fontSize:"12px", fontFamily:C.sans,
                 color:value?C.text:C.textSub, cursor:"pointer", outline:"none", width:"100%" }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.cod} value={o.cod}>{o.nome}</option>)}
      </select>
      <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
                                      transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
    </div>
  );
}

const MODES = [
  { id:"gerencial",  label:"Gerencial",  Icon:BarChart3 },
  { id:"equipe",     label:"Equipe",     Icon:Shield    },
  { id:"todos",      label:"Vendedores", Icon:Users     },
  { id:"vendedor",   label:"Vendedor",   Icon:User      },
  { id:"supervisor", label:"Supervisor", Icon:Building2 },
];

export default function ModuleDistNumerica({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;

  const MODES_VISIVEIS = MODES.filter(m => {
    if (cargo === "gerencial")  return true;
    if (cargo === "fornecedor") return true;
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
  const [agrupamento, setAgrupamento] = useState("fornecedor"); // "fornecedor" | "secao"
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [sortCol,    setSortCol]    = useState("nome_fornecedor");
  const [sortDir,    setSortDir]    = useState("asc");
  const [search,     setSearch]     = useState("");
  const [todosData,  setTodosData]  = useState([]);
  const [tabsOpen,   setTabsOpen]   = useState(false);
  const hoje = getToday();
  const [dataRef,    setDataRef]    = useState(hoje);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    fetch(`${API_BASE}/api/dn`, { headers })
      .then(r => r.json()).then(j => setTodosData(j.dados ?? [])).catch(() => {});
  }, []);

  const vendedores = useMemo(() => {
    const map = new Map();
    todosData.forEach(r => { if (!map.has(r.cod_vendedor)) map.set(r.cod_vendedor, r.nome_vendedor); });
    return Array.from(map.entries()).map(([cod,nome]) => ({cod,nome})).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [todosData]);

  const supervisores = useMemo(() => {
    const map = new Map();
    todosData.forEach(r => { if (r.cod_supervisor && !map.has(r.cod_supervisor)) map.set(r.cod_supervisor, r.nome_supervisor); });
    return Array.from(map.entries()).map(([cod,nome]) => ({cod,nome})).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [todosData]);

  const equipes = useMemo(() => supervisores.filter(s => EQUIPE_CODES.includes(s.cod)), [supervisores]);

  // coluna dinâmica conforme agrupamento
  const colDimId   = agrupamento === "secao" ? "dim_id"     : "dim_id";
  const colDimNome = agrupamento === "secao" ? "nome_secao" : "nome_fornecedor";

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${API_BASE}/api/dn`;
      if (mode === "gerencial")                url += "/gerencial";
      if (mode === "equipe"     && activeCode) url += `/equipe/${activeCode}`;
      if (mode === "vendedor"   && activeCode) url += `/vendedor/${activeCode}`;
      if (mode === "supervisor" && activeCode) url += `/supervisor/${activeCode}`;
      url += `?data=${dataRef}&agrupamento=${agrupamento}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()).dados ?? []);
      // Resetar coluna de ordenação ao trocar agrupamento
      setSortCol(agrupamento === "secao" ? "nome_secao" : "nome_fornecedor");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [mode, activeCode, dataRef, agrupamento, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = useMemo(() => {
    let r = [...data];
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(row => (row[colDimNome]??"").toLowerCase().includes(s) || (row.nome_vendedor??"").toLowerCase().includes(s));
    }
    r.sort((a,b) => {
      let av=a[sortCol]??0, bv=b[sortCol]??0;
      if (typeof av==="string"){av=av.toLowerCase();bv=bv.toLowerCase();}
      return sortDir==="asc"?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);
    });
    return r;
  }, [data, search, sortCol, sortDir, colDimNome]);

  const tot = {
    meta:   rows.reduce((s,r)=>s+(r.qt_cli_meta??0),0),
    mes:    rows.reduce((s,r)=>s+(r.qt_cli_mes??0),0),
    semana: rows.reduce((s,r)=>s+(r.qt_cli_nao_fat_semana??0),0),
    dia:    rows.reduce((s,r)=>s+(r.qt_cli_nao_fat_hoje??0),0),
  };
  const totPct = tot.meta > 0 ? (tot.mes / tot.meta) * 100 : 0;

  const handleSort = col => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortCol(col);setSortDir("asc");} };
  const changeMode = id  => { setMode(id); setActiveCode(null); setSearch(""); setTabsOpen(false); };
  const showVendedor = mode==="todos"||mode==="equipe";
  const needsSelect  = ["vendedor","supervisor","equipe"].includes(mode);
  const noData       = needsSelect && !activeCode;
  const nomeAtivo    = () => {
    if (mode==="vendedor") return vendedores.find(v=>v.cod===activeCode)?.nome;
    if (mode==="supervisor"||mode==="equipe") return supervisores.find(s=>s.cod===activeCode)?.nome;
    return null;
  };

  return (
    <>
      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
        padding:isMobile?"8px 12px":"10px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexWrap:"wrap", gap:"8px", borderBottom:`3px solid ${C.gold}`,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div>
            <div style={{ fontWeight:900, fontSize:isMobile?"16px":"20px", color:"#fff", letterSpacing:"0.06em", lineHeight:1 }}>PREMIUM</div>
            <div style={{ fontWeight:700, fontSize:"9px", color:C.gold, letterSpacing:"0.14em" }}>DISTRIBUIDORA</div>
          </div>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:isMobile?"12px":"14px" }}>
              DISTRIBUICAO NUMERICA
              {nomeAtivo() && <span style={{ fontWeight:400, fontSize:"11px", color:"rgba(255,255,255,.8)", marginLeft:"6px" }}>— {nomeAtivo()}</span>}
            </div>
            {!isMobile && (
              <div style={{ color:"rgba(255,220,180,.9)", fontSize:"11px", marginTop:"2px" }}>
                Meta: <b style={{color:"#fff"}}>{fmtN(tot.meta)}</b>
                &nbsp;·&nbsp; Faturado Mês: <b style={{color:"#fff"}}>{fmtN(tot.mes)}</b>
                &nbsp;·&nbsp; <span style={pctStyle(totPct)}>{fmtPct(totPct)}</span>
                {dataRef !== hoje && <span style={{color:C.goldLight}}>&nbsp;·&nbsp; Data: {dataRef}</span>}
              </div>
            )}
          </div>
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{ background:"rgba(0,0,0,.25)", border:"1px solid rgba(255,255,255,.3)",
                   color:"#fff", padding:isMobile?"6px":"7px 12px", borderRadius:"6px",
                   cursor:"pointer", display:"flex", alignItems:"center", gap:"4px", fontSize:"12px" }}>
          <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
          {!isMobile && " Atualizar"}
        </button>
      </div>

      {/* Indicadores mobile */}
      {isMobile && data.length>0 && !loading && (
        <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`,
                      padding:"6px 12px", display:"flex", gap:"12px",
                      fontSize:"11px", color:C.textSub, overflowX:"auto" }}>
          <span>Meta: <b style={{color:C.text}}>{fmtN(tot.meta)}</b></span>
          <span>Mes: <b style={{color:C.text}}>{fmtN(tot.mes)}</b></span>
          <span style={{marginLeft:"auto"}}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></span>
        </div>
      )}

      {/* Barra de filtros */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:isMobile?"6px 12px":"8px 20px",
                    display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

        {/* Toggle Fornecedor / Seção */}
        <div style={{ display:"flex", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
          {[["fornecedor","Fornecedor"],["secao","Seção"]].map(([id,label]) => (
            <button key={id} onClick={() => setAgrupamento(id)}
              style={{ padding:"6px 12px", border:"none", cursor:"pointer",
                       fontSize:"12px", fontFamily:C.sans,
                       background:agrupamento===id?C.primary:"#fff",
                       color:agrupamento===id?"#fff":C.text,
                       fontWeight:agrupamento===id?700:400,
                       borderRight:`1px solid ${C.border}` }}>
              {label}
            </button>
          ))}
        </div>

        {isMobile ? (
          <div style={{ display:"flex", alignItems:"center", gap:"8px", width:"100%" }}>
            <button onClick={() => setTabsOpen(o=>!o)}
              style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 12px",
                       background:C.primary, border:"none", color:"#fff", borderRadius:"6px",
                       cursor:"pointer", fontSize:"12px", fontWeight:700, flex:1 }}>
              {tabsOpen?<X size={14}/>:<Menu size={14}/>}
              {MODES_VISIVEIS.find(m=>m.id===mode)?.label}
              <ChevronDown size={12} style={{ marginLeft:"auto" }}/>
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
            {MODES_VISIVEIS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => changeMode(id)}
                style={{ display:"flex", alignItems:"center", gap:"5px", padding:"6px 13px",
                         fontSize:"12px", cursor:"pointer", border:"none", fontFamily:C.sans,
                         background:mode===id?C.primary:"#fff", color:mode===id?"#fff":C.text,
                         fontWeight:mode===id?700:400, borderRight:`1px solid ${C.border}`, transition:"all .15s" }}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
        )}

        {isMobile && tabsOpen && (
          <div style={{ width:"100%", background:"#fff", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
            {MODES_VISIVEIS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => changeMode(id)}
                style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px",
                         width:"100%", border:"none", borderBottom:`1px solid ${C.border}`,
                         background:mode===id?C.rowHover:"#fff", color:mode===id?C.primary:C.text,
                         fontWeight:mode===id?700:400, cursor:"pointer", fontFamily:C.sans, fontSize:"13px" }}>
                <Icon size={15}/>{label}
              </button>
            ))}
          </div>
        )}

        {mode==="equipe"     && <Dropdown value={activeCode} onChange={setActiveCode} options={equipes}     placeholder="Selecione uma equipe..."/>}
        {mode==="vendedor"   && <Dropdown value={activeCode} onChange={setActiveCode} options={vendedores}  placeholder="Selecione um vendedor..."/>}
        {mode==="supervisor" && <Dropdown value={activeCode} onChange={setActiveCode} options={supervisores} placeholder="Selecione um supervisor..."/>}

        {!isMobile && (
          <div style={{ display:"flex", alignItems:"center", gap:"6px",
                        border:`1px solid ${C.border}`, borderRadius:"6px",
                        padding:"5px 10px", background:C.bg }}>
            <Search size={12} style={{ color:C.textSub }}/>
            <input placeholder="Filtrar..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{ border:"none", background:"transparent", fontSize:"12px",
                       width:"120px", outline:"none", color:C.text, fontFamily:C.sans }}/>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:"#fff", marginLeft:isMobile?"0":"auto" }}>
          <span style={{ fontSize:"11px", color:C.textSub, fontWeight:600, whiteSpace:"nowrap" }}>Data</span>
          <input type="date" value={dataRef} max={hoje}
            onChange={e => setDataRef(e.target.value)}
            style={{ border:"none", outline:"none", fontSize:"12px",
                     fontFamily:C.mono, color:C.text, background:"transparent", cursor:"pointer" }}/>
          {dataRef !== hoje && (
            <button onClick={() => setDataRef(hoje)}
              style={{ background:"none", border:"none", color:C.primary,
                       cursor:"pointer", fontSize:"11px", fontWeight:700, padding:"0 2px" }}>
              hoje
            </button>
          )}
        </div>

        {isMobile && !tabsOpen && (
          <input placeholder="Filtrar..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:"6px",
                     padding:"7px 10px", fontSize:"12px", outline:"none",
                     color:C.text, fontFamily:C.sans, background:C.bg }}/>
        )}
      </div>

      {/* Tabela */}
      <div style={{ margin:isMobile?"8px":"12px 16px", background:"#fff",
                    border:`1px solid ${C.border}`, borderRadius:"4px",
                    overflow:"hidden", boxShadow:`0 1px 6px rgba(170,0,0,.12)` }}>
        {loading && (
          <div style={{ padding:"16px" }}>
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ height:"30px", background:C.rowEven, borderRadius:"4px",
                                    marginBottom:"6px", animation:"pulse 1.5s ease-in-out infinite",
                                    animationDelay:(i*.1)+"s" }}/>
            ))}
          </div>
        )}
        {error && (
          <div style={{ padding:"40px", textAlign:"center" }}>
            <p style={{ color:C.red, fontWeight:600, marginBottom:"6px" }}>Erro ao carregar</p>
            <p style={{ color:C.textSub, fontSize:"11px", fontFamily:C.mono, marginBottom:"14px" }}>{error}</p>
            <button onClick={fetchData}
              style={{ background:C.primary, border:"none", color:"#fff", padding:"7px 14px",
                       borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
              Tentar novamente
            </button>
          </div>
        )}
        {!loading && !error && noData && (
          <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
            {mode==="equipe"?"Selecione uma equipe.":mode==="vendedor"?"Selecione um vendedor.":"Selecione um supervisor."}
          </div>
        )}
        {!loading && !error && !noData && (
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
              <thead>
                {showVendedor && (
                  <tr>
                    <th colSpan={2} style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"left", border:`1px solid ${C.primaryDk}` }}>VENDEDOR</th>
                    <th colSpan={7} style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"center", border:`1px solid ${C.primaryDk}` }}>INDICADORES</th>
                  </tr>
                )}
                <tr>
                  {showVendedor && <>
                    <Th label="RCA"          col="cod_vendedor"          sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                    <Th label="NOME"         col="nome_vendedor"         sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  </>}
                  <Th label={agrupamento === "secao" ? "SEÇÃO" : "FORNECEDOR"}
                      col={colDimNome}             sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <Th label="META"           col="qt_cli_meta"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="FAT. MES"       col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="CART. SEMANA"   col="qt_cli_nao_fat_semana" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="% ATING"        col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="REALIZ. DIA"    col="qt_cli_nao_fat_hoje"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="STATUS"         col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                </tr>
              </thead>
              <tbody>
                {rows.map((row,i) => (
                  <DataRow key={`${row.cod_vendedor}-${row.dim_id}-${i}`}
                    row={row} i={i} showVendedor={showVendedor} colDimNome={colDimNome}/>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    {showVendedor && <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }} colSpan={2}>{rows.length} linhas</td>}
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }}>TOTAL</td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.meta)}</td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>{fmtN(tot.mes)}</td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.semana)}</td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.dia)}</td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>{arrow(totPct)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {rows.length === 0 && <div style={{ padding:"40px", textAlign:"center", color:C.textSub }}>Nenhum dado encontrado.</div>}
          </div>
        )}
      </div>
    </>
  );
}