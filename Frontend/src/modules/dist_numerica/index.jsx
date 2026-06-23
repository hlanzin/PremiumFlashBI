import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, BarChart3, Users, User, Building2, Shield,
         ChevronDown, TrendingUp, TrendingDown, Minus, Menu, X } from "lucide-react";
import { C, fmtPct, pctStyle, fmtN, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import Dropdown from "../../components/Dropdown";
import { arrow } from "../../components/ArrowBadge";
import SkeletonRows from "../../components/SkeletonRows";

const EQUIPE_CODES = [2, 8, 9];

function buildDNBySupervisor(rows, colDimNome) {
  const grupos = [];
  const map = new Map();
  rows.forEach(row => {
    const key = row.cod_supervisor ?? "—";
    if (!map.has(key)) {
      map.set(key, { cod:key, nome:row.nome_supervisor??`#${key}`, rows:[] });
      grupos.push(map.get(key));
    }
    map.get(key).rows.push(row);
  });

  const totStyle = {
    padding:"5px 8px", background:"#1B4332", color:"#fff",
    fontWeight:700, fontFamily:C.mono, textAlign:"right",
    borderBottom:"2px solid #081C15", fontSize:"12px",
  };

  return grupos.map(g => {
    const meta = g.rows.reduce((s,r)=>s+(r.qt_cli_meta??0),0);
    const mes  = g.rows.reduce((s,r)=>s+(r.qt_cli_mes??0),0);
    const sem  = g.rows.reduce((s,r)=>s+(r.qt_cli_nao_fat_semana??0),0);
    const hoj  = g.rows.reduce((s,r)=>s+(r.qt_cli_nao_fat_hoje??0),0);
    const tot2 = mes + sem;
    const pct  = meta>0 ? (tot2/meta)*100 : null;
    return (
      <React.Fragment key={g.cod}>
        {g.rows.map((row,i) => (
          <DataRow key={`${row.cod_vendedor}-${row.dim_id}-${i}`}
            row={row} i={i} showVendedor={true} colDimNome={colDimNome}/>
        ))}
        <tr>
          <td style={{...totStyle, textAlign:"center"}}>{g.cod}</td>
          <td style={{...totStyle, textAlign:"left"}}>{g.nome}</td>
          <td style={{...totStyle, textAlign:"left", fontSize:"10px", opacity:.8}}>SUBTOTAL</td>
          <td style={{...totStyle}}>{fmtN(meta)}</td>
          <td style={{...totStyle}}>{fmtN(mes)}</td>
          <td style={{...totStyle}}>{fmtN(sem)}</td>
          <td style={{...totStyle}}>{fmtN(tot2)}</td>
          <td style={{...totStyle, textAlign:"center"}}>
            <span style={{color: pct==null?"#fff": pct>=90?"#86EFAC":pct>=70?"#FCD34D":"#FCA5A5"}}>
              {pct!=null?`${pct.toFixed(0)}%`:"—"}
            </span>
          </td>
          <td style={{...totStyle}}>{fmtN(hoj)}</td>
          <td style={{...totStyle}}/>
        </tr>
      </React.Fragment>
    );
  });
}

function DataRow({ row, i, showVendedor, colDimNome }) {
  const [hov, setHov] = useState(false);
  const total = (row.qt_cli_mes??0) + (row.qt_cli_nao_fat_semana??0);
  const pct = row.qt_cli_meta > 0 ? (total / row.qt_cli_meta) * 100 : null;
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
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700, color:C.primary }}>{fmtN(total)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary }}>{fmtN(row.qt_cli_nao_fat_hoje)}</td>
      <td style={{ ...td, textAlign:"center" }}>{arrow(pct)}</td>
    </tr>
  );
}

// ── Card de equipe para DN ────────────────────────────────────────────────────
function EquipeDNCard({ supervisor, dataRef, agrupamento, token, colDimNome, isMobile, consolidado,
                        filtroRcas = new Set(), filtroDims = new Set() }) {
  const [data,   setData]   = useState([]);
  const [loading,setLoading]= useState(true);
  const [error,  setError]  = useState(null);
  const [aberto, setAberto] = useState(true);
  const [sortCol,setSortCol]= useState(colDimNome);
  const [sortDir,setSortDir]= useState("asc");
  const headers = useAuthHeaders(token);

  useEffect(() => {
    setLoading(true);
    const url = `${API_BASE}/api/dn/equipe/${supervisor.cod}?data=${dataRef}&agrupamento=${agrupamento}`;
    fetch(url, { headers })
      .then(r => r.json())
      .then(j => { setData(j.dados ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [supervisor.cod, dataRef, agrupamento, headers]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    let r = [...data];
    if (filtroRcas.size > 0) r = r.filter(x => filtroRcas.has(x.cod_vendedor));
    if (filtroDims.size > 0) r = r.filter(x => filtroDims.has(x.dim_id));
    return r.sort((a,b) => {
      let av=a[sortCol]??0, bv=b[sortCol]??0;
      if (typeof av==="string"){av=av.toLowerCase();bv=bv.toLowerCase();}
      return sortDir==="asc"?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);
    });
  }, [data, filtroRcas, filtroDims, sortCol, sortDir]);

  const rowsConsolidadas = useMemo(() => {
    const map = new Map();
    data.forEach(r => {
      const key = r.cod_vendedor ?? "—";
      if (!map.has(key)) map.set(key, {
        cod_vendedor: r.cod_vendedor, nome_vendedor: r.nome_vendedor,
        qt_cli_meta:0, qt_cli_mes:0, qt_cli_nao_fat_semana:0, qt_cli_nao_fat_hoje:0,
      });
      const v = map.get(key);
      v.qt_cli_meta            += r.qt_cli_meta            ?? 0;
      v.qt_cli_mes             += r.qt_cli_mes             ?? 0;
      v.qt_cli_nao_fat_semana  += r.qt_cli_nao_fat_semana  ?? 0;
      v.qt_cli_nao_fat_hoje    += r.qt_cli_nao_fat_hoje    ?? 0;
    });
    return Array.from(map.values())
      .sort((a,b) => (a.nome_vendedor??"").localeCompare(b.nome_vendedor??""));
  }, [data]);

  const displayRows = consolidado ? rowsConsolidadas : sorted;

  const tot = {
    meta:   displayRows.reduce((s,r)=>s+(r.qt_cli_meta??0),0),
    mes:    displayRows.reduce((s,r)=>s+(r.qt_cli_mes??0),0),
    semana: displayRows.reduce((s,r)=>s+(r.qt_cli_nao_fat_semana??0),0),
    dia:    displayRows.reduce((s,r)=>s+(r.qt_cli_nao_fat_hoje??0),0),
  };
  const totReal = tot.mes + tot.semana;
  const totPct = tot.meta > 0 ? (totReal / tot.meta) * 100 : 0;

  return (
    <div style={{ margin:"12px 16px", background:"#fff",
      border:`1px solid ${C.border}`, borderRadius:"6px",
      boxShadow:"0 1px 6px rgba(170,0,0,.1)", overflow:"hidden" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px 14px", background:`linear-gradient(90deg,${C.header},${C.primary})`,
        cursor:"pointer" }} onClick={() => setAberto(v=>!v)}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <Shield size={14} color={C.gold}/>
          <span style={{ color:"#fff", fontWeight:700, fontSize:"13px" }}>{supervisor.nome}</span>
          {!loading && (
            <span style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>
              {consolidado ? `${rowsConsolidadas.length} vendedores` : `${data.length} linhas`}
            </span>
          )}
          {!loading && tot.meta > 0 && (
            <span style={{ fontSize:"11px", fontWeight:700, marginLeft:"8px", color:pctStyle(totPct).color??"#fff" }}>
              {fmtPct(totPct)} · {fmtN(tot.mes)}/{fmtN(tot.meta)}
            </span>
          )}
        </div>
        <ChevronDown size={14} color="#fff"
          style={{ transform:aberto?"rotate(180deg)":"none", transition:"transform .2s" }}/>
      </div>

      {aberto && (
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          {loading && <div style={{ padding:"20px", textAlign:"center", color:C.textSub, fontSize:"12px" }}>Carregando...</div>}
          {error   && <div style={{ padding:"20px", textAlign:"center", color:C.red, fontSize:"12px" }}>{error}</div>}
          {!loading && !error && (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
              <thead>
                <tr>
                  <Th label="RCA"         col="cod_vendedor"          sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="NOME"        col="nome_vendedor"         sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  {!consolidado && <Th label={agrupamento==="secao"?"SEÇÃO":"FORNECEDOR"} col={colDimNome} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>}
                  <Th label="META"        col="qt_cli_meta"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="FAT. MES"    col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="DN NOVA"   col="qt_cli_nao_fat_semana" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="TOTAL"       col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="% ATING"     col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="REALIZ. DIA" col="qt_cli_nao_fat_hoje"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="STATUS"      col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row,i) => {
                  const td = { padding:"5px 8px", borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?C.rowEven:C.rowOdd, verticalAlign:"middle" };
                  const rowTot = (row.qt_cli_mes??0)+(row.qt_cli_nao_fat_semana??0);
                  const pct = row.qt_cli_meta>0?(rowTot/row.qt_cli_meta)*100:null;
                  return (
                    <tr key={`${row.cod_vendedor}-${row.dim_id??i}-${i}`}>
                      <td style={{ ...td, textAlign:"center", fontFamily:C.mono,
                        fontWeight:600, color:C.primary, fontSize:"11px" }}>{row.cod_vendedor}</td>
                      <td style={{ ...td, fontSize:"11px" }}>{row.nome_vendedor}</td>
                      {!consolidado && <td style={td}>{row[colDimNome]}</td>}
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtN(row.qt_cli_meta)}</td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>{fmtN(row.qt_cli_mes)}</td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtN(row.qt_cli_nao_fat_semana)}</td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700, color:C.primary }}>{fmtN(rowTot)}</td>
                      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
                      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtN(row.qt_cli_nao_fat_hoje)}</td>
                      <td style={{ ...td, textAlign:"center" }}>{arrow(pct)}</td>
                    </tr>
                  );
                })}
                {displayRows.length === 0 && (
                  <tr><td colSpan={consolidado?9:10} style={{ padding:"24px", textAlign:"center", color:C.textSub }}>Nenhum dado.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                  <td colSpan={consolidado?2:3} style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}` }}>TOTAL</td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.meta)}</td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.mes)}</td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.semana)}</td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono, fontWeight:700 }}>{fmtN(totReal)}</td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmtN(tot.dia)}</td>
                  <td style={{ padding:"5px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>{arrow(totPct)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const MODES = [
  { id:"gerencial",     label:"Gerencial",     Icon:BarChart3 },
  { id:"todas_equipes", label:"Todas Equipes", Icon:Users     },
  { id:"equipe",        label:"Equipe",        Icon:Shield    },
  { id:"todos",         label:"Vendedores",    Icon:Users     },
  { id:"vendedor",      label:"Vendedor",      Icon:User      },
  { id:"supervisor",    label:"Supervisor",    Icon:Building2 },
];

export default function ModuleDistNumerica({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;

  const MODES_VISIVEIS = MODES.filter(m => {
    if (cargo === "gerencial" || cargo === "admin") return true;
    if (cargo === "fornecedor") return ["gerencial","todas_equipes","equipe","todos","vendedor","supervisor"].includes(m.id);
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
  const [agrupamento, setAgrupamento] = useState("fornecedor");
  const [data,       setData]       = useState([]);
  const [totaisDist, setTotaisDist] = useState({});
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
      const json = await res.json();
      setData(json.dados ?? []);
      setTotaisDist(json.totais_distintos ?? {});
      setSortCol(agrupamento === "secao" ? "nome_secao" : "nome_fornecedor");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [mode, activeCode, dataRef, agrupamento, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Estados de filtro — ANTES do useMemo de rows
  const [consolidado,   setConsolidado]   = useState(false);
  const [showFiltros,   setShowFiltros]   = useState(false);
  const [filtroRcas,    setFiltroRcas]    = useState(new Set());
  const [filtroDims,    setFiltroDims]    = useState(new Set());
  const [buscaRca,      setBuscaRca]      = useState("");
  const [buscaDim,      setBuscaDim]      = useState("");

  const rows = useMemo(() => {
    let r = [...data];
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(row =>
        (row[colDimNome]??"").toLowerCase().includes(s) ||
        (row.nome_secao??"").toLowerCase().includes(s)  ||
        (row.nome_fornecedor??"").toLowerCase().includes(s) ||
        (row.descricao??"").toLowerCase().includes(s));
    }
    // filtroRcas só faz sentido em modos com vendedor
    if (filtroRcas.size > 0 && mode !== "gerencial")
      r = r.filter(row => filtroRcas.has(row.cod_vendedor));
    if (filtroDims.size > 0)
      r = r.filter(row => filtroDims.has(row.dim_id));
    r.sort((a,b) => {
      let av=a[sortCol]??0, bv=b[sortCol]??0;
      if (typeof av==="string"){av=av.toLowerCase();bv=bv.toLowerCase();}
      return sortDir==="asc"?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);
    });
    return r;
  }, [data, search, sortCol, sortDir, colDimNome, filtroRcas, filtroDims, mode]);

  const tot = {
    meta:   rows.reduce((s,r)=>s+(r.qt_cli_meta??0),0),
    mes:    rows.reduce((s,r)=>s+(r.qt_cli_mes??0),0),
    semana: rows.reduce((s,r)=>s+(r.qt_cli_nao_fat_semana??0),0),
    dia:    rows.reduce((s,r)=>s+(r.qt_cli_nao_fat_hoje??0),0),
  };
  const totReal = tot.mes + tot.semana;
  const totPct  = tot.meta > 0 ? (totReal / tot.meta) * 100 : 0;

  const handleSort = col => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortCol(col);setSortDir("asc");} };
  const changeMode = id  => { setMode(id); setActiveCode(null); setSearch(""); setTabsOpen(false); };

  const dimsDisponiveis = useMemo(() => {
    const map = new Map();
    todosData.forEach(r => {
      if (r.dim_id && !map.has(r.dim_id))
        map.set(r.dim_id, r[colDimNome] ?? `#${r.dim_id}`);
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a,b) => a.nome.localeCompare(b.nome));
  }, [todosData, colDimNome]);

  const toggleRca = cod => setFiltroRcas(prev => { const s=new Set(prev); s.has(cod)?s.delete(cod):s.add(cod); return s; });
  const toggleDim = id  => setFiltroDims(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  const limparFiltros = () => { setFiltroRcas(new Set()); setFiltroDims(new Set()); };
  const totalFiltros = filtroRcas.size + filtroDims.size;

  const showVendedor = mode==="todos"||mode==="equipe";
  const needsSelect  = ["vendedor","equipe","supervisor"].includes(mode);
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
        display:isMobile?"none":"flex", alignItems:"center", justifyContent:"space-between",
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
            <div style={{ color:"rgba(255,220,180,.9)", fontSize:"11px", marginTop:"2px" }}>
              Meta: <b style={{color:"#fff"}}>{fmtN(tot.meta)}</b>
              &nbsp;·&nbsp; Fat. Mês: <b style={{color:"#fff"}}>{fmtN(tot.mes)}</b>
              &nbsp;·&nbsp; Cart: <b style={{color:"#fff"}}>{fmtN(tot.semana)}</b>
              &nbsp;·&nbsp; Total: <b style={{color:"#fff"}}>{fmtN(totReal)}</b>
              &nbsp;·&nbsp; <span style={pctStyle(totPct)}>{fmtPct(totPct)}</span>
              {dataRef !== hoje && <span style={{color:C.goldLight}}>&nbsp;·&nbsp; Data: {dataRef}</span>}
            </div>
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
          <span>Total: <b style={{color:C.text}}>{fmtN(totReal)}</b></span>
          <span style={{marginLeft:"auto"}}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></span>
        </div>
      )}

      {/* Barra de filtros */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:isMobile?"6px 12px":"8px 20px",
                    display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

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

        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:C.bg }}>
          <Search size={12} style={{ color:C.textSub }}/>
          <input placeholder="Filtrar..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ border:"none", background:"transparent", fontSize:"12px",
                     width:"120px", outline:"none", color:C.text, fontFamily:C.sans }}/>
        </div>

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

        {cargo !== "vendedor" && mode !== "todas_equipes" && (
          <div style={{ position:"relative", marginLeft:"auto" }}>
            <button onClick={() => setShowFiltros(v=>!v)}
              style={{ padding:"5px 12px", borderRadius:"6px",
                border:`1.5px solid ${totalFiltros>0?C.primary:C.border}`,
                fontSize:"12px", fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", gap:"6px",
                background: totalFiltros>0 ? C.primary : "#fff",
                color: totalFiltros>0 ? "#fff" : C.text }}>
              ⚙ Filtros {totalFiltros>0 && `(${totalFiltros})`}
            </button>
            {showFiltros && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0,
                background:"#fff", border:`1px solid ${C.border}`, borderRadius:"8px",
                boxShadow:"0 6px 20px rgba(0,0,0,.15)", zIndex:200,
                width: isMobile?"calc(100vw - 32px)":"560px",
                maxHeight:"420px", overflow:"hidden", display:"flex", flexDirection:"column" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 14px", borderBottom:`1px solid ${C.border}`, background:"#FAFAFA" }}>
                  <span style={{ fontWeight:700, fontSize:"12px" }}>Filtros Avançados</span>
                  <div style={{ display:"flex", gap:"8px" }}>
                    {totalFiltros>0 && <button onClick={limparFiltros}
                      style={{ fontSize:"11px", color:C.red, background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>
                      Limpar tudo</button>}
                    <button onClick={() => setShowFiltros(false)}
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:"16px", color:C.textSub }}>×</button>
                  </div>
                </div>
                <div style={{ display:"flex", overflow:"hidden", flex:1 }}>
                  <div style={{ flex:1, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }}>
                    <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, fontSize:"11px", fontWeight:700, color:C.textSub, background:"#FAFAFA" }}>
                      VENDEDOR {filtroRcas.size>0 && <span style={{ color:C.primary }}>({filtroRcas.size})</span>}
                    </div>
                    <div style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>
                      <input value={buscaRca} onChange={e=>setBuscaRca(e.target.value)} placeholder="Buscar RCA..."
                        style={{ width:"100%", padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px", fontSize:"11px", outline:"none" }}/>
                    </div>
                    <div style={{ overflowY:"auto", maxHeight:"250px" }}>
                      {vendedores.filter(v=>(v.nome??"").toLowerCase().includes(buscaRca.toLowerCase())).map(v=>(
                        <label key={v.cod} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 12px",
                          cursor:"pointer", background:filtroRcas.has(v.cod)?"#FFF0F0":"transparent", borderBottom:`1px solid #F5F5F5` }}>
                          <input type="checkbox" checked={filtroRcas.has(v.cod)} onChange={()=>toggleRca(v.cod)} style={{ accentColor:C.primary }}/>
                          <span style={{ fontSize:"11px" }}>{v.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
                    <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, fontSize:"11px", fontWeight:700, color:C.textSub, background:"#FAFAFA" }}>
                      {agrupamento==="secao"?"SEÇÃO":"FORNECEDOR"} {filtroDims.size>0 && <span style={{ color:C.primary }}>({filtroDims.size})</span>}
                    </div>
                    <div style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>
                      <input value={buscaDim} onChange={e=>setBuscaDim(e.target.value)} placeholder="Buscar..."
                        style={{ width:"100%", padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px", fontSize:"11px", outline:"none" }}/>
                    </div>
                    <div style={{ overflowY:"auto", maxHeight:"250px" }}>
                      {dimsDisponiveis.filter(d=>(d.nome??"").toLowerCase().includes(buscaDim.toLowerCase())).map(d=>(
                        <label key={d.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 12px",
                          cursor:"pointer", background:filtroDims.has(d.id)?"#FFF0F0":"transparent", borderBottom:`1px solid #F5F5F5` }}>
                          <input type="checkbox" checked={filtroDims.has(d.id)} onChange={()=>toggleDim(d.id)} style={{ accentColor:C.primary }}/>
                          <span style={{ fontSize:"11px" }}>{d.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modo Todas Equipes */}
      {mode === "todas_equipes" && (
        <div style={{ paddingBottom:"16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 16px 0", flexWrap:"wrap" }}>
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowFiltros(v=>!v)}
                style={{ padding:"5px 14px", borderRadius:"6px", border:`1.5px solid ${C.border}`,
                  fontSize:"12px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:"6px",
                  background: totalFiltros>0 ? C.primary : "#fff", color: totalFiltros>0 ? "#fff" : C.text }}>
                ⚙ Filtros {totalFiltros>0 && `(${totalFiltros})`}
              </button>
              {showFiltros && (
                <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, background:"#fff",
                  border:`1px solid ${C.border}`, borderRadius:"8px", boxShadow:"0 6px 20px rgba(0,0,0,.15)",
                  zIndex:200, width:isMobile?"calc(100vw - 32px)":"560px", maxHeight:"420px",
                  overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"10px 14px", borderBottom:`1px solid ${C.border}`, background:"#FAFAFA" }}>
                    <span style={{ fontWeight:700, fontSize:"12px", color:C.text }}>Filtros Avançados</span>
                    <div style={{ display:"flex", gap:"8px" }}>
                      {totalFiltros>0 && <button onClick={limparFiltros}
                        style={{ fontSize:"11px", color:C.red, background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>Limpar tudo</button>}
                      <button onClick={() => setShowFiltros(false)}
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:"16px", color:C.textSub, lineHeight:1 }}>×</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", overflow:"hidden", flex:1 }}>
                    <div style={{ flex:1, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }}>
                      <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, fontSize:"11px", fontWeight:700, color:C.textSub, background:"#FAFAFA" }}>
                        VENDEDOR {filtroRcas.size>0 && <span style={{ color:C.primary }}>({filtroRcas.size})</span>}
                      </div>
                      <div style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>
                        <input value={buscaRca} onChange={e=>setBuscaRca(e.target.value)} placeholder="Buscar RCA..."
                          style={{ width:"100%", padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px", fontSize:"11px", outline:"none" }}/>
                      </div>
                      <div style={{ overflowY:"auto", maxHeight:"250px" }}>
                        {vendedores.filter(v=>(v.nome??"").toLowerCase().includes(buscaRca.toLowerCase())).map(v=>(
                          <label key={v.cod} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 12px",
                            cursor:"pointer", background:filtroRcas.has(v.cod)?"#FFF0F0":"transparent", borderBottom:`1px solid #F5F5F5` }}>
                            <input type="checkbox" checked={filtroRcas.has(v.cod)} onChange={()=>toggleRca(v.cod)} style={{ accentColor:C.primary }}/>
                            <span style={{ fontSize:"11px", color:C.text }}>{v.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
                      <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, fontSize:"11px", fontWeight:700, color:C.textSub, background:"#FAFAFA" }}>
                        {agrupamento==="secao"?"SEÇÃO":"FORNECEDOR"} {filtroDims.size>0 && <span style={{ color:C.primary }}>({filtroDims.size})</span>}
                      </div>
                      <div style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>
                        <input value={buscaDim} onChange={e=>setBuscaDim(e.target.value)}
                          placeholder={`Buscar ${agrupamento==="secao"?"seção":"fornecedor"}...`}
                          style={{ width:"100%", padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px", fontSize:"11px", outline:"none" }}/>
                      </div>
                      <div style={{ overflowY:"auto", maxHeight:"250px" }}>
                        {dimsDisponiveis.filter(d=>(d.nome??"").toLowerCase().includes(buscaDim.toLowerCase())).map(d=>(
                          <label key={d.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 12px",
                            cursor:"pointer", background:filtroDims.has(d.id)?"#FFF0F0":"transparent", borderBottom:`1px solid #F5F5F5` }}>
                            <input type="checkbox" checked={filtroDims.has(d.id)} onChange={()=>toggleDim(d.id)} style={{ accentColor:C.primary }}/>
                            <span style={{ fontSize:"11px", color:C.text }}>{d.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setConsolidado(v => !v)}
              style={{ padding:"5px 14px", borderRadius:"6px", border:`1.5px solid ${C.primary}`,
                fontSize:"12px", fontWeight:700, cursor:"pointer",
                background: consolidado ? C.primary : "#fff", color: consolidado ? "#fff" : C.primary }}>
              {consolidado ? "▦ Detalhado" : "▤ Consolidar"}
            </button>
            {totalFiltros > 0 && (
              <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                {Array.from(filtroRcas).map(cod => {
                  const nome = vendedores.find(v=>v.cod===cod)?.nome ?? `RCA #${cod}`;
                  return (
                    <span key={cod} onClick={() => toggleRca(cod)}
                      style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"12px",
                        background:C.primary, color:"#fff", cursor:"pointer",
                        display:"inline-flex", alignItems:"center", gap:"4px" }}>
                      {nome.split(" ")[0]} ×
                    </span>
                  );
                })}
                {Array.from(filtroDims).map(id => {
                  const nome = dimsDisponiveis.find(d=>d.id===id)?.nome ?? `#${id}`;
                  return (
                    <span key={id} onClick={() => toggleDim(id)}
                      style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"12px",
                        background:"#1D6F42", color:"#fff", cursor:"pointer",
                        display:"inline-flex", alignItems:"center", gap:"4px" }}>
                      {nome.split(" ").slice(0,2).join(" ")} ×
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {supervisores.length === 0 && (
            <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando equipes...</div>
          )}
          {supervisores.map(sup => (
            <EquipeDNCard key={`${sup.cod}-${agrupamento}`} supervisor={sup} dataRef={dataRef}
              agrupamento={agrupamento} token={token} colDimNome={colDimNome}
              isMobile={isMobile} consolidado={consolidado}
              filtroRcas={filtroRcas} filtroDims={filtroDims}/>
          ))}
        </div>
      )}

      {/* Tabela principal */}
      {mode !== "todas_equipes" && (
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
                    <th colSpan={8} style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"center", border:`1px solid ${C.primaryDk}` }}>INDICADORES</th>
                  </tr>
                )}
                <tr>
                  {showVendedor && <>
                    <Th label="RCA"             col="cod_vendedor"          sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                    <Th label="NOME"            col="nome_vendedor"         sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  </>}
                  <Th label={agrupamento === "secao" ? "SEÇÃO" : "FORNECEDOR"}
                      col={colDimNome}               sortCol={sortCol} sortDir={sortDir} onSort={handleSort}/>
                  <Th label="META"               col="qt_cli_meta"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="FAT. MES"           col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="DN NOVA"          col="qt_cli_nao_fat_semana" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="TOTAL"              col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="% ATING"            col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="REALIZ. DIA"        col="qt_cli_nao_fat_hoje"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="STATUS"             col="qt_cli_mes"            sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                </tr>
              </thead>
              <tbody>
                {(mode==="supervisor" && !activeCode)
                  ? buildDNBySupervisor(rows, colDimNome)
                  : rows.map((row,i) => (
                    <DataRow key={`${row.cod_vendedor ?? "ger"}-${row.dim_id ?? i}-${i}`}
                      row={row} i={i} showVendedor={showVendedor} colDimNome={colDimNome}/>
                  ))
                }
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    {showVendedor && <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }} colSpan={2}>{rows.length} linhas</td>}
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }}>
                      TOTAL
                      {mode === "gerencial" && (
                        <span style={{ fontSize:"9px", fontWeight:400, marginLeft:"4px", opacity:.7 }}>
                          clientes únicos
                        </span>
                      )}
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                      {fmtN(mode === "gerencial" ? (totaisDist.qt_total_meta ?? tot.meta) : tot.meta)}
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>
                      {fmtN(mode === "gerencial" ? (totaisDist.qt_total_mes ?? tot.mes) : tot.mes)}
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                      {fmtN(mode === "gerencial" ? (totaisDist.qt_total_semana ?? tot.semana) : tot.semana)}
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono, fontWeight:700 }}>
                      {fmtN(mode === "gerencial"
                        ? (totaisDist.qt_total_mes ?? tot.mes) + (totaisDist.qt_total_semana ?? tot.semana)
                        : totReal)}
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>
                      <span style={pctStyle(totPct)}>{fmtPct(totPct)}</span>
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                      {fmtN(mode === "gerencial" ? (totaisDist.qt_total_hoje ?? tot.dia) : tot.dia)}
                    </td>
                    <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>{arrow(totPct)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {rows.length === 0 && <div style={{ padding:"40px", textAlign:"center", color:C.textSub }}>Nenhum dado encontrado.</div>}
          </div>
        )}
      </div>
      )}
    </>
  );
}