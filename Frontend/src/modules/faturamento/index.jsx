import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, Search, BarChart3, Users, User, Building2, Shield,
         ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus, Menu, X, FileText } from "lucide-react";
import { C, fmt, fmtPct, pctStyle, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const EQUIPE_CODES = [2, 8, 9];
const GRUPOS = { "PLF": [10040, 10042, 120239] };

const getGrupo = (cod) => {
  for (const [nome, codigos] of Object.entries(GRUPOS))
    if (codigos.includes(Number(cod))) return nome;
  return null;
};

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

const agg = (rows) => {
  const meta   = rows.reduce((s,r) => s+(r.valor_meta_secao  ??0), 0);
  const real   = rows.reduce((s,r) => s+(r.valor_faturado_mes_atual??0), 0);
  const raf    = rows.reduce((s,r) => s+(r.resta_a_fazer     ??0), 0);
  const nec    = rows.reduce((s,r) => s+(r.necessidade_dia   ??0), 0);
  const dia    = rows.reduce((s,r) => s+(r.nao_faturado_hoje ??0), 0);
  const dd     = rows[0]?.dias_uteis_decorridos ?? 0;
  const dm     = rows[0]?.dias_uteis_mes_atual  ?? 0;
  const pct    = meta > 0 ? (real/meta)*100 : null;
  const tend   = meta > 0 && dd > 0 ? ((real/dd)*dm/meta)*100 : null;
  const pctDia = nec  > 0 ? (dia/nec)*100 : null;
  return { meta, real, raf, nec, dia, pct, tend, pctDia };
};

function Th({ label, col, sortCol, sortDir, onSort, align, sticky }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding:"6px 8px", background:C.subHeader, color:"#fff", fontSize:"10px",
      fontWeight:700, textAlign:align??"left", cursor:"pointer", userSelect:"none",
      whiteSpace:"nowrap", border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
      ...(sticky ? { position:"sticky", left:0, zIndex:3 } : {}),
    }}>
      {label}
      {active && (sortDir === "asc"
        ? <ChevronUp size={9} style={{ verticalAlign:"middle" }}/>
        : <ChevronDown size={9} style={{ verticalAlign:"middle" }}/>)}
    </th>
  );
}

function GrupoRow({ nome, rows, showVendedor }) {
  const { meta,real,raf,nec,dia,pct,tend,pctDia } = agg(rows);
  const td = { padding:"5px 8px", background:"#BB2200", color:"#fff",
               fontWeight:700, fontSize:"11px", border:`1px solid ${C.primaryDk}` };
  return (
    <tr>
      <td style={{ ...td, fontStyle:"italic" }} colSpan={showVendedor?3:1}>{nome}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(meta)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(real)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(tend)}>{fmtPct(tend)}</span></td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(raf)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(nec)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(dia)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pctDia)}>{fmtPct(pctDia)}</span></td>
      <td style={{ ...td, textAlign:"center" }}>{arrow(tend)}</td>
    </tr>
  );
}

function DataRow({ row, i, showVendedor, showSecao=true, showNomeVendedor=false, isMobile }) {
  const [hov, setHov] = useState(false);
  const pct    = row.valor_meta_secao > 0 ? ((row.valor_faturado_mes_atual??0)/row.valor_meta_secao)*100 : null;
  const tend   = row.tendencia_pct;
  const pctDia = row.necessidade_dia  > 0 ? (row.nao_faturado_hoje/row.necessidade_dia)*100  : null;
  const bg     = hov ? C.rowHover : i%2===0 ? C.rowEven : C.rowOdd;
  const td     = { padding:"5px 8px", borderBottom:`1px solid #EED0D0`, verticalAlign:"middle", background:bg };
  const stickyTd = isMobile ? { ...td, position:"sticky", left:0, zIndex:2, boxShadow:"2px 0 4px rgba(0,0,0,.08)" } : td;
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {showVendedor && <>
        <td style={{ ...td, textAlign:"center", fontFamily:C.mono, fontWeight:600, color:C.primary, fontSize:"11px" }}>{row.cod_vendedor}</td>
        <td style={{ ...stickyTd, maxWidth:"140px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:"11px" }}>{row.nome_vendedor}</td>
      </>}
      {!showVendedor && showNomeVendedor && (
        <td style={{ ...td, fontWeight:500, fontSize:"11px" }}>{row.nome_vendedor ?? "—"}</td>
      )}
      {showSecao && <td style={{ ...stickyTd, fontWeight:600, paddingLeft: getGrupo(row.cod_secao)?"18px":"8px",
        left: showVendedor && isMobile ? "auto" : 0 }}>{row.secao??"—"}</td>}
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(row.valor_meta_secao)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>{fmt(Math.max(0, row.valor_faturado_mes_atual??0))}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(tend)}>{fmtPct(tend)}</span></td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:(row.resta_a_fazer??0)<=0?C.green:C.red }}>{fmt(row.resta_a_fazer)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(row.necessidade_dia)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary }}>{fmt(row.nao_faturado_hoje)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pctDia)}>{fmtPct(pctDia)}</span></td>
      <td style={{ ...td, textAlign:"center" }}>{arrow(tend)}</td>
    </tr>
  );
}


function SupervisorTotalRow({ row, i }) {
  const pct    = (row.valor_meta_secao??0) > 0
    ? ((row.valor_faturado_mes_atual??0)/row.valor_meta_secao)*100 : null;
  const tend   = row.tendencia_pct;
  const pctDia = (row.necessidade_dia??0) > 0
    ? (row.nao_faturado_hoje/row.necessidade_dia)*100 : null;
  const bg = i%2===0 ? C.rowEven : C.rowOdd;
  const td = { padding:"6px 10px", borderBottom:`1px solid #EED0D0`,
               verticalAlign:"middle", background:bg };
  return (
    <tr>
      <td style={{ ...td, fontWeight:700, fontSize:"12px", color:C.primary }}>
        {row.nome_supervisor ?? "—"}
      </td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(row.valor_meta_secao)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600 }}>{fmt(Math.max(0, row.valor_faturado_mes_atual??0))}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(tend)}>{fmtPct(tend)}</span></td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:(row.resta_a_fazer??0)<=0?C.green:C.red }}>{fmt(row.resta_a_fazer)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmt(row.necessidade_dia)}</td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary }}>{fmt(row.nao_faturado_hoje)}</td>
      <td style={{ ...td, textAlign:"center" }}><span style={pctStyle(pctDia)}>{fmtPct(pctDia)}</span></td>
      <td style={{ ...td, textAlign:"center" }}>{arrow(tend)}</td>
    </tr>
  );
}

function buildTableRowsBySupervisor(rows) {
  // Agrupa por supervisor mantendo a ordem
  const grupos = [];
  const map = new Map();
  rows.forEach(row => {
    const key = row.cod_supervisor ?? "—";
    if (!map.has(key)) {
      const g = { cod: key, nome: row.nome_supervisor ?? `#${key}`, rows: [] };
      map.set(key, g);
      grupos.push(g);
    }
    map.get(key).rows.push(row);
  });
  const tStyle = { padding:"5px 8px", border:"1px solid #880000",
    background:"#AA0000", color:"#fff", fontFamily:C.mono, textAlign:"right", fontWeight:700, fontSize:"11px" };

  return grupos.map(g => {
    const meta = g.rows.reduce((s,r)=>s+(r.valor_meta_secao??0),0);
    const real = g.rows.reduce((s,r)=>s+(r.valor_faturado_mes_atual??0),0);
    const raf  = g.rows.reduce((s,r)=>s+(r.resta_a_fazer??0),0);
    const nec  = g.rows.reduce((s,r)=>s+(r.necessidade_dia??0),0);
    const dia  = g.rows.reduce((s,r)=>s+(r.nao_faturado_hoje??0),0);
    const pct  = meta>0?(real/meta)*100:null;
    const pctD = nec>0?(dia/nec)*100:null;
    return (
      <React.Fragment key={g.cod}>
        <tr>
          <td colSpan={99} style={{ padding:"3px 10px", background:"#F0F2F5",
            borderTop:`2px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
            fontSize:"11px", fontWeight:700, color:C.textSub, letterSpacing:"0.03em" }}>
            {g.nome}
            <span style={{ fontWeight:400, marginLeft:"8px", color:C.textSub }}>
              ({g.rows.length} vendedores)
            </span>
          </td>
        </tr>
        {g.rows.map((row, idx) => (
          <DataRow key={(row.cod_vendedor??"")+row.cod_secao+idx}
            row={row} i={idx} showVendedor={true} isMobile={false}/>
        ))}
        <tr>
          <td colSpan={2} style={{...tStyle, textAlign:"left"}}>TOTAL {g.nome.split(" ")[0]}</td>
          <td style={tStyle}>{fmt(meta)}</td>
          <td style={tStyle}>{fmt(real)}</td>
          <td style={{...tStyle, textAlign:"center"}}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
          <td style={{...tStyle, textAlign:"center"}}>{fmtPct(g.rows.reduce((s,r)=>s+(r.tendencia_pct??0),0)/Math.max(g.rows.length,1))}</td>
          <td style={tStyle}>{fmt(raf)}</td>
          <td style={tStyle}>{fmt(nec)}</td>
          <td style={tStyle}>{fmt(dia)}</td>
          <td style={{...tStyle, textAlign:"center"}}><span style={pctStyle(pctD)}>{fmtPct(pctD)}</span></td>
          <td style={{...tStyle, textAlign:"center"}}/>
        </tr>
      </React.Fragment>
    );
  });
}

function buildTableRows(rows, showVendedor, isMobile) {
  const result = []; let idx = 0; const vistos = new Set();
  rows.forEach(row => {
    const g = getGrupo(row.cod_secao);
    if (g && !vistos.has(g)) {
      vistos.add(g);
      result.push(<GrupoRow key={"g_"+g} nome={g}
        rows={rows.filter(r => getGrupo(r.cod_secao) === g)} showVendedor={showVendedor}/>);
    }
    result.push(<DataRow key={(row.cod_vendedor??"")+row.cod_secao+idx}
      row={row} i={idx} showVendedor={showVendedor} isMobile={isMobile}/>);
    idx++;
  });
  return result;
}

function Gauge({ label, pct }) {
  const r = 24, circ = 2*Math.PI*r;
  const color = pct >= 100 ? "#4ade80" : pct >= 80 ? C.goldLight : "#f87171";
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:"9px", color:C.goldLight, marginBottom:"2px", letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ position:"relative", width:"56px", height:"56px" }}>
        <svg width="56" height="56" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke="#880000" strokeWidth="5"/>
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={circ-(Math.min(pct,100)/100)*circ}
            style={{ transition:"stroke-dashoffset 0.5s ease" }}/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:"11px", fontWeight:700, color:"#fff" }}>
          {pct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function Dropdown({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position:"relative", display:"inline-block", width:"100%", maxWidth:"280px" }}>
      <select value={value??""} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{ appearance:"none", WebkitAppearance:"none", background:"#fff",
                 border:`1px solid ${C.border}`, borderRadius:"6px",
                 padding:"7px 32px 7px 10px", fontSize:"12px", fontFamily:C.sans,
                 color: value ? C.text : C.textSub, cursor:"pointer", outline:"none", width:"100%" }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.cod} value={o.cod}>{o.nome}</option>)}
      </select>
      <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
                                      transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
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

// ── Card de equipe (para modo Todas Equipes) ──────────────────────────────────
function EquipeCard({ supervisor, dataRef, token, sortCol, sortDir, onSort, isMobile, consolidado }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [aberto,  setAberto]  = useState(true);
  const headers = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/faturamento/equipe/${supervisor.cod}?data=${dataRef}`, { headers })
      .then(r => r.json())
      .then(j => { setData(j.dados ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [supervisor.cod, dataRef, headers]);

  // Agrupa por vendedor (consolidado)
  const rowsConsolidadas = useMemo(() => {
    const map = new Map();
    data.forEach(r => {
      const key = r.cod_vendedor ?? "—";
      if (!map.has(key)) {
        map.set(key, {
          cod_vendedor: r.cod_vendedor,
          nome_vendedor: r.nome_vendedor,
          valor_meta_secao: 0, valor_faturado_mes_atual: 0,
          resta_a_fazer: 0, necessidade_dia: 0, nao_faturado_hoje: 0,
          dias_uteis_decorridos: r.dias_uteis_decorridos,
          dias_uteis_mes_atual: r.dias_uteis_mes_atual,
          _tend_num: 0, _tend_count: 0,
        });
      }
      const v = map.get(key);
      v.valor_meta_secao        += r.valor_meta_secao        ?? 0;
      v.valor_faturado_mes_atual += r.valor_faturado_mes_atual??0;
      v.resta_a_fazer            += r.resta_a_fazer            ?? 0;
      v.necessidade_dia          += r.necessidade_dia          ?? 0;
      v.nao_faturado_hoje        += r.nao_faturado_hoje        ?? 0;
      if (r.tendencia_pct != null) { v._tend_num += r.tendencia_pct; v._tend_count++; }
    });
    return Array.from(map.values()).map(v => ({
      ...v,
      tendencia_pct: v._tend_count > 0 ? v._tend_num / v._tend_count : null,
    })).sort((a,b) => (a.nome_vendedor??"").localeCompare(b.nome_vendedor??""));
  }, [data]);

  const displayRows = consolidado ? rowsConsolidadas : data;

  const tot = {
    meta: displayRows.reduce((s,r) => s+(r.valor_meta_secao??0), 0),
    real: displayRows.reduce((s,r) => s+(r.valor_faturado_mes_atual??0), 0),
    raf:  displayRows.reduce((s,r) => s+(r.resta_a_fazer??0), 0),
    nec:  displayRows.reduce((s,r) => s+(r.necessidade_dia??0), 0),
    dia:  displayRows.reduce((s,r) => s+(r.nao_faturado_hoje??0), 0),
  };
  const dias_dec  = displayRows[0]?.dias_uteis_decorridos ?? 0;
  const dias_mes  = displayRows[0]?.dias_uteis_mes_atual  ?? 0;
  const totPct    = tot.meta>0 ? (tot.real/tot.meta)*100 : 0;
  const totTend   = tot.meta>0 && dias_dec>0 ? ((tot.real/dias_dec)*dias_mes/tot.meta)*100 : 0;
  const totPctDia = tot.nec>0 ? (tot.dia/tot.nec)*100 : null;

  return (
    <div style={{ margin:"12px 16px", background:"#fff",
      border:`1px solid ${C.border}`, borderRadius:"6px",
      boxShadow:"0 1px 6px rgba(170,0,0,.1)", overflow:"hidden" }}>

      {/* Cabeçalho do card */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px 14px", background:`linear-gradient(90deg,${C.header},${C.primary})` }}>
        <div onClick={() => setAberto(v => !v)}
          style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer", flex:1 }}>
          <Shield size={14} color={C.gold}/>
          <span style={{ color:"#fff", fontWeight:700, fontSize:"13px" }}>
            {supervisor.nome}
          </span>
          {!loading && (
            <span style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>
              {consolidado ? `${rowsConsolidadas.length} vendedores` : `${data.length} linhas`}
            </span>
          )}
          {!loading && tot.meta > 0 && (
            <span style={{ fontSize:"11px", color:pctStyle(totPct).color ?? "#fff", fontWeight:700, marginLeft:"8px" }}>
              {fmtPct(totPct)} ating. · {fmt(tot.real)} / {fmt(tot.meta)}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <ChevronDown size={14} color="#fff" onClick={() => setAberto(v => !v)}
            style={{ cursor:"pointer", transform:aberto?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}/>
        </div>
      </div>

      {/* Tabela */}
      {aberto && (
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          {loading && (
            <div style={{ padding:"20px", textAlign:"center", color:C.textSub, fontSize:"12px" }}>
              Carregando...
            </div>
          )}
          {error && (
            <div style={{ padding:"20px", textAlign:"center", color:C.red, fontSize:"12px" }}>
              {error}
            </div>
          )}
          {!loading && !error && (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
              <thead>
                <tr>
                  {!consolidado && <Th label="RCA"   col="cod_vendedor"  sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center"/>}
                  <Th label="VENDEDOR"    col="nome_vendedor"           sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
                  {!consolidado && <Th label="FAMILIA" col="secao"       sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>}
                  <Th label="OBJETIVO"   col="valor_meta_secao"         sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                  <Th label="REALIZADO"  col="valor_faturado_mes_atual" sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                  <Th label="% ATING"    col="tendencia_pct"            sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center"/>
                  <Th label="% TEND."    col="tendencia_pct"            sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center"/>
                  <Th label="R.A.F"      col="resta_a_fazer"            sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                  <Th label="NECESS/DIA" col="necessidade_dia"          sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                  <Th label="REALIZ/DIA" col="nao_faturado_hoje"        sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                  <Th label="% DIA"      col="nao_faturado_hoje"        sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center"/>
                  <Th label="STATUS"     col="tendencia_pct"            sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center"/>
                </tr>
              </thead>
              <tbody>
                {consolidado
                  ? rowsConsolidadas.map((row, i) => (
                      <DataRow key={row.cod_vendedor??i} row={row} i={i}
                        showVendedor={false} showNomeVendedor={true} showSecao={false} isMobile={isMobile}/>
                    ))
                  : data.map((row, i) => (
                      <DataRow key={(row.cod_vendedor??"")+"-"+(row.cod_secao??"")+i}
                        row={row} i={i} showVendedor={true} showSecao={true} isMobile={isMobile}/>
                    ))
                }
              </tbody>
              <tfoot>
                <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                  {!consolidado && <td style={{ padding:"5px 8px", border:"1px solid #880000" }}/>}
                  <td colSpan={!consolidado ? 2 : 1} style={{ padding:"5px 8px", border:"1px solid #880000" }}>TOTAL</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.meta)}</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.real)}</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pctStyle(totTend)}>{fmtPct(totTend)}</span></td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.raf)}</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.nec)}</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.dia)}</td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pctStyle(totPctDia)}>{fmtPct(totPctDia)}</span></td>
                  <td style={{ padding:"5px 8px", border:"1px solid #880000", textAlign:"center" }}>{arrow(totTend)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModuleFaturamento({ isMobile, token, userInfo = {} }) {
  const cargo = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;
  const isAdmin = cargo === "admin";

  // Abas visíveis por cargo
  const MODES_VISIVEIS = MODES.filter(m => {
    if (cargo === "gerencial" || cargo === "admin") return true;
    if (cargo === "fornecedor") return true;
    if (cargo === "supervisor") return ["equipe","todos","vendedor","supervisor"].includes(m.id);
    if (cargo === "vendedor")   return m.id === "vendedor";
    return false;
  });

  const modoInicial = cargo === "fornecedor" ? "gerencial"
    : cargo === "vendedor"   ? "vendedor"
    : cargo === "supervisor" ? "equipe"
    : "gerencial";

  const [mode,        setMode]        = useState(modoInicial);
  const [activeCode,  setActiveCode]  = useState(
    // Supervisor e vendedor começam já com o próprio código selecionado
    (cargo === "supervisor" || cargo === "vendedor") ? codUser : null
  );
  const [data,        setData]        = useState([]);
  const [summary,     setSummary]     = useState({});
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [showDebug,   setShowDebug]   = useState(false);
  const [sortCol,     setSortCol]     = useState("secao");
  const [sortDir,     setSortDir]     = useState("asc");
  const [search,      setSearch]      = useState("");
  const [todosData,   setTodosData]   = useState([]);
  const [tabsOpen,    setTabsOpen]    = useState(false);
  const hoje = getToday();
  const [dataRef,     setDataRef]     = useState(hoje);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Carrega dados para dropdowns
  useEffect(() => {
    fetch(`${API_BASE}/api/faturamento`, { headers })
      .then(r => r.json())
      .then(j => setTodosData(j.dados ?? []))
      .catch(() => {});
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

  const equipes = useMemo(() =>
    supervisores.filter(s => EQUIPE_CODES.includes(s.cod)), [supervisores]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${API_BASE}/api/faturamento`;
      if (mode === "gerencial")               url += "/gerencial";
      if (mode === "equipe"     && activeCode) url += `/equipe/${activeCode}`;
      if (mode === "vendedor"   && activeCode) url += `/vendedor/${activeCode}`;
      if (mode === "supervisor" && activeCode)  url += `/supervisor/${activeCode}`;
      url += `?data=${dataRef}`;
      const res  = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} — API offline?`);
      const json = await res.json();
      const rows = json.dados ?? [];
      setData(rows);
      setSummary({
        nome:           json.nome_vendedor ?? json.nome_supervisor ?? null,
        dias_consulta:  rows[0]?.dias_uteis_consultados ?? 0,
        dias_mes:       rows[0]?.dias_uteis_mes_atual   ?? 0,
        dias_decorridos:rows[0]?.dias_uteis_decorridos  ?? 0,
      });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [mode, activeCode, dataRef, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rows = useMemo(() => {
    let r = [...data];
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(row =>
        (row.secao??"").toLowerCase().includes(s) ||
        (row.nome_secao??"").toLowerCase().includes(s) ||
        (row.descricao??"").toLowerCase().includes(s) ||
        (row.nome_supervisor??"").toLowerCase().includes(s) ||
        String(row.cod_secao??"").includes(s));
    }
    const grupoOrder = Object.keys(GRUPOS);
    const gIdx = cod => { const g=getGrupo(cod); if(!g) return 9999; const i=grupoOrder.indexOf(g); return i===-1?9999:i; };
    r.sort((a,b) => {
      const ga=gIdx(a.cod_secao), gb=gIdx(b.cod_secao);
      if (ga !== gb) return ga-gb;
      let av=a[sortCol], bv=b[sortCol];
      if (typeof av === "string") { av=av.toLowerCase(); bv=bv.toLowerCase(); }
      return sortDir==="asc" ? (av<bv?-1:av>bv?1:0) : (av>bv?-1:av<bv?1:0);
    });
    return r;
  }, [data, search, sortCol, sortDir]);

  const tot = {
    meta: rows.reduce((s,r) => s+(r.valor_meta_secao  ??0), 0),
    real: rows.reduce((s,r) => s+(r.valor_faturado_mes_atual??0), 0),
    raf:  rows.reduce((s,r) => s+(r.resta_a_fazer     ??0), 0),
    nec:  rows.reduce((s,r) => s+(r.necessidade_dia   ??0), 0),
    dia:  rows.reduce((s,r) => s+(r.nao_faturado_hoje ??0), 0),
  };
  const totPct    = tot.meta>0 ? (tot.real/tot.meta)*100 : 0;
  const totTend   = tot.meta>0 && summary.dias_decorridos>0 ? ((tot.real/summary.dias_decorridos)*summary.dias_mes/tot.meta)*100 : 0;
  const totPctDia = tot.nec>0  ? (tot.dia/tot.nec)*100   : null;

  const handleSort  = col => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortCol(col);setSortDir("asc");} };
  const changeMode  = id  => { setMode(id); setActiveCode(null); setSearch(""); setTabsOpen(false); };
  const [consolidado, setConsolidado] = useState(false);
  const showVendedor = mode === "todos" || mode === "equipe";
  const needsSelect  = ["vendedor","equipe","supervisor"].includes(mode);
  const noData       = needsSelect && !activeCode;
  const nomeAtivo    = () => {
    if (mode==="vendedor") return vendedores.find(v=>v.cod===activeCode)?.nome;
    if (mode==="supervisor"||mode==="equipe") return supervisores.find(s=>s.cod===activeCode)?.nome;
    return null;
  };

  // PDF export
  const tableRef = useRef(null);

  const exportToPDF = async () => {
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

    const nomeModo = MODES.find(m => m.id === mode)?.label ?? mode;

    // ── Helpers de renderização ──────────────────────────────────────────────
    const badge = (p) => {
      if (p == null) return "—";
      const bg = p >= 100 ? "#16a34a" : p >= 90 ? "#d97706" : "#dc2626";
      return `<span style="background:${bg};color:#fff;border-radius:3px;padding:1px 6px;font-weight:600;font-size:10px">${p.toFixed(1)}%</span>`;
    };

    const icon = (p) => {
      if (p == null) return `<span style="color:#ccc">—</span>`;
      const [bg, char] = p >= 100
        ? ["#16a34a", "▲"]
        : p >= 90
          ? ["#d97706", "●"]
          : ["#dc2626", "▼"];
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${bg};color:#fff;font-weight:700;font-size:11px">${char}</span>`;
    };

    const H  = `background:#CC0000;color:#fff;padding:6px 8px;font-size:10px;font-weight:700;letter-spacing:.04em;border:1px solid #990000;white-space:nowrap;`;
    const TD = (i, extra = "") => `background:${i%2===0?"#FFF8F8":"#fff"};padding:5px 8px;border-bottom:1px solid #EED0D0;${extra}`;
    const TF = `background:#AA0000;color:#fff;padding:6px 8px;border:1px solid #880000;font-weight:700;`;

    // ── Monta tabela HTML ────────────────────────────────────────────────────
    let html = `<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:'Segoe UI',Arial,sans-serif;">`;

    // Cabeçalho de grupo
    if (showVendedor) {
      html += `<tr>
        <th colspan="2" style="${H}text-align:left">VENDEDOR</th>
        <th colspan="10" style="${H}text-align:center">INDICADORES</th>
      </tr>`;
    }

    // Cabeçalho de colunas
    html += "<tr>";
    if (showVendedor) {
      html += `<th style="${H}text-align:center">RCA</th>`;
      html += `<th style="${H}">NOME</th>`;
    }
    ["FAMILIA","OBJETIVO","REALIZADO","% ATING","% TEND.","R.A.F","NECESS/DIA","REALIZ/DIA","% DIA","STATUS"].forEach((l, j) => {
      const al = j === 0 ? "left" : [1,2,5,6,7,8].includes(j) ? "right" : "center";
      html += `<th style="${H}text-align:${al}">${l}</th>`;
    });
    html += "</tr>";

    // Linhas de dados
    rows.forEach((row, i) => {
      const pct    = row.valor_meta_secao > 0 ? ((row.valor_faturado_mes_atual??0) / row.valor_meta_secao) * 100 : null;
      const tend   = row.tendencia_pct;
      const pctDia = row.necessidade_dia  > 0 ? (row.nao_faturado_hoje / row.necessidade_dia)  * 100 : null;
      const rafCol = (row.resta_a_fazer ?? 0) <= 0 ? "#16a34a" : "#dc2626";

      html += "<tr>";
      if (showVendedor) {
        html += `<td style="${TD(i,"text-align:center;font-family:monospace;font-weight:600;color:#CC0000")}">${row.cod_vendedor}</td>`;
        html += `<td style="${TD(i,"max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}">${row.nome_vendedor}</td>`;
      }
      html += `<td style="${TD(i,"font-weight:600")}">${row.secao ?? "—"}</td>`;
      html += `<td style="${TD(i,"text-align:right;font-family:monospace")}">${fmt(row.valor_meta_secao)}</td>`;
      html += `<td style="${TD(i,"text-align:right;font-family:monospace;font-weight:600")}">${fmt(Math.max(0, row.valor_faturado_mes_atual??0))}</td>`;
      html += `<td style="${TD(i,"text-align:center")}">${badge(pct)}</td>`;
      html += `<td style="${TD(i,"text-align:center")}">${badge(tend)}</td>`;
      html += `<td style="${TD(i,`text-align:right;font-family:monospace;color:${rafCol}`)}">${fmt(row.resta_a_fazer)}</td>`;
      html += `<td style="${TD(i,"text-align:right;font-family:monospace")}">${fmt(row.necessidade_dia)}</td>`;
      html += `<td style="${TD(i,"text-align:right;font-family:monospace;font-weight:600;color:#CC0000")}">${fmt(row.nao_faturado_hoje)}</td>`;
      html += `<td style="${TD(i,"text-align:center")}">${badge(pctDia)}</td>`;
      html += `<td style="${TD(i,"text-align:center")}">${icon(tend)}</td>`;
      html += "</tr>";
    });

    // Rodapé totais
    const totPct  = tot.meta > 0 ? (tot.real / tot.meta) * 100 : 0;
    const totTend = tot.meta > 0 && summary.dias_decorridos > 0
      ? ((tot.real / summary.dias_decorridos) * summary.dias_mes / tot.meta) * 100 : null;
    const totPctDia = tot.nec > 0 ? (tot.dia / tot.nec) * 100 : null;

    html += "<tfoot><tr>";
    if (showVendedor) html += `<td colspan="2" style="${TF}">${rows.length} vendedores</td>`;
    html += `<td style="${TF}">TOTAL</td>`;
    html += `<td style="${TF}text-align:right;font-family:monospace">${fmt(tot.meta)}</td>`;
    html += `<td style="${TF}text-align:right;font-family:monospace">${fmt(tot.real)}</td>`;
    html += `<td style="${TF}text-align:center">${badge(totPct)}</td>`;
    html += `<td style="${TF}text-align:center">${badge(totTend)}</td>`;
    html += `<td style="${TF}text-align:right;font-family:monospace">${fmt(tot.raf)}</td>`;
    html += `<td style="${TF}text-align:right;font-family:monospace">${fmt(tot.nec)}</td>`;
    html += `<td style="${TF}text-align:right;font-family:monospace">${fmt(tot.dia)}</td>`;
    html += `<td style="${TF}text-align:center">${badge(totPctDia)}</td>`;
    html += `<td style="${TF}text-align:center">${icon(totPct)}</td>`;
    html += "</tr></tfoot></table>";

    // ── Renderiza off-screen com largura fixa (sem overflow) ─────────────────
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:1200px;background:#fff;padding:0;";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    try {
      const canvas = await window.html2canvas(wrap, {
        scale: 2, useCORS: true, backgroundColor: "#fff",
        logging: false, width: 1200,
      });

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });

      // Cabeçalho Premium
      doc.setFillColor(170,0,0); doc.rect(0,0,297,18,"F");
      doc.setFont("helvetica","bold");
      doc.setFontSize(13); doc.setTextColor(200,150,12);
      doc.text("PREMIUM DISTRIBUIDORA", 10, 8);
      doc.setFontSize(8); doc.setTextColor(255,220,180);
      doc.text(`FATURAMENTO SELL OUT — ${nomeModo} — ${dataRef}`, 10, 14);

      // Imagem centralizada
      const margin = 8;
      const availW = 297 - margin * 2;
      const availH = 210 - 22;
      const imgW   = canvas.width  / 2;
      const imgH   = canvas.height / 2;
      const ratio  = Math.min(availW / imgW, availH / imgH);
      const finalW = imgW * ratio;
      const finalH = imgH * ratio;
      const x = (297 - finalW) / 2;

      doc.addImage(canvas.toDataURL("image/png"), "PNG", x, 20, finalW, finalH);
      doc.save(`Faturamento_${nomeModo}_${dataRef}.pdf`);
    } finally {
      document.body.removeChild(wrap);
    }
  };

  return (
    <>
      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#AA0000,#CC0000 60%,#AA0000)",
        padding: isMobile?"8px 12px":"10px 20px",
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
              FATURAMENTO SELL OUT
              {nomeAtivo() && <span style={{ fontWeight:400, fontSize:"11px", color:"rgba(255,255,255,.8)", marginLeft:"6px" }}>— {nomeAtivo()}</span>}
            </div>
            <div style={{ color:"rgba(255,220,180,.9)", fontSize:"11px", marginTop:"2px" }}>
              Dias consultados: <b style={{color:"#fff"}}>{summary.dias_consulta}</b>
              &nbsp;·&nbsp; Decorridos: <b style={{color:"#fff"}}>{summary.dias_decorridos}</b>
              &nbsp;·&nbsp; Mes: <b style={{color:"#fff"}}>{summary.dias_mes}</b>
              {dataRef !== hoje && <span style={{color:C.goldLight}}>&nbsp;·&nbsp; Data: {dataRef}</span>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:isMobile?"8px":"14px", alignItems:"center" }}>
          {!loading && data.length>0 && !isMobile && (
            <><Gauge label="% REAL" pct={totPct}/><Gauge label="% TEND." pct={totTend}/></>
          )}
          <button onClick={fetchData} disabled={loading}
            style={{ background:"rgba(0,0,0,.25)", border:"1px solid rgba(255,255,255,.3)",
                     color:"#fff", padding:isMobile?"6px":"7px 12px", borderRadius:"6px",
                     cursor:"pointer", display:"flex", alignItems:"center", gap:"4px", fontSize:"12px" }}>
            <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
            {!isMobile && " Atualizar"}
          </button>
          {isAdmin && (
            <button onClick={() => setShowDebug(v=>!v)}
              style={{ padding:"5px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:700,
                cursor:"pointer", border:`1.5px solid ${showDebug?"#7C3AED":"rgba(255,255,255,.4)"}`,
                background: showDebug?"#7C3AED":"rgba(255,255,255,.15)",
                color:"#fff" }}>
              🔬 Debug SQL
            </button>
          )}
          {rows.length > 0 && (
            <button onClick={exportToPDF}
              style={{ display:"flex", alignItems:"center", gap:"5px",
                background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)",
                color:"#fff", padding:isMobile?"6px":"6px 12px", borderRadius:"6px",
                cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              <FileText size={13}/> {!isMobile && "Exportar PDF"}
            </button>
          )}
        </div>
      </div>

      {/* Indicadores mobile */}
      {isMobile && data.length>0 && !loading && (
        <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`,
                      padding:"6px 12px", display:"flex", gap:"12px",
                      fontSize:"11px", color:C.textSub, overflowX:"auto" }}>
          <span>Dias: <b style={{color:C.text}}>{summary.dias_consulta}</b></span>
          <span>Decorridos: <b style={{color:C.text}}>{summary.dias_decorridos}</b></span>
          <span>Mes: <b style={{color:C.text}}>{summary.dias_mes}</b></span>
          <span style={{marginLeft:"auto",display:"flex",gap:"8px"}}>
            <span>Real: <span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></span>
            <span>Tend: <span style={pctStyle(totTend)}>{fmtPct(totTend)}</span></span>
          </span>
        </div>
      )}

      {/* Barra de filtros */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:isMobile?"6px 12px":"8px 20px",
                    display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

        {/* Mobile: hamburguer */}
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

        {/* Dropdown mobile de modos */}
        {isMobile && tabsOpen && (
          <div style={{ width:"100%", background:"#fff", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
            {MODES_VISIVEIS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => changeMode(id)}
                style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px",
                         width:"100%", border:"none", borderBottom:`1px solid ${C.border}`,
                         background:mode===id?"#FFF0F0":"#fff", color:mode===id?C.primary:C.text,
                         fontWeight:mode===id?700:400, cursor:"pointer", fontFamily:C.sans, fontSize:"13px" }}>
                <Icon size={15}/>{label}
              </button>
            ))}
          </div>
        )}

        {mode==="equipe"     && <Dropdown value={activeCode} onChange={setActiveCode} options={equipes}     placeholder="Selecione uma equipe..."/>}
        {mode==="vendedor"   && <Dropdown value={activeCode} onChange={setActiveCode} options={vendedores}  placeholder="Selecione um vendedor..."/>}
        {mode==="supervisor" && <Dropdown value={activeCode} onChange={setActiveCode} options={supervisores} placeholder="Selecione um supervisor..."/>}

        {/* Busca */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px",
                        border:`1px solid ${C.border}`, borderRadius:"6px",
                        padding:"5px 10px", background:C.bg }}>
            <Search size={12} style={{ color:C.textSub }}/>
            <input placeholder="Filtrar..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{ border:"none", background:"transparent", fontSize:"12px",
                       width:"120px", outline:"none", color:C.text, fontFamily:C.sans }}/>
          </div>

        {/* Seletor de data */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:"#fff",
                      marginLeft: isMobile?"0":"auto" }}>
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

        {/* Busca mobile */}
        {isMobile && !tabsOpen && (
          <input placeholder="Filtrar..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:"6px",
                     padding:"7px 10px", fontSize:"12px", outline:"none",
                     color:C.text, fontFamily:C.sans, background:C.bg }}/>
        )}
      </div>

      {/* Modo Todas Equipes — um card por supervisor */}
      {mode === "todas_equipes" && (
        <div style={{ paddingBottom:"16px" }}>
          {/* Botão global consolidar */}
          <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 16px 0" }}>
            <button onClick={() => setConsolidado(v => !v)}
              style={{ padding:"5px 14px", borderRadius:"6px", border:`1.5px solid ${C.primary}`,
                fontSize:"12px", fontWeight:700, cursor:"pointer",
                background: consolidado ? C.primary : "#fff",
                color: consolidado ? "#fff" : C.primary }}>
              {consolidado ? "▦ Detalhado" : "▤ Consolidar"}
            </button>
          </div>
          {supervisores.length === 0 && (
            <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
              Carregando equipes...
            </div>
          )}
          {supervisores.map(sup => (
            <EquipeCard key={sup.cod} supervisor={sup} dataRef={dataRef}
              token={token} sortCol={sortCol} sortDir={sortDir}
              onSort={handleSort} isMobile={isMobile} consolidado={consolidado}/>
          ))}
        </div>
      )}

      {/* Tabela principal (outros modos) */}
      {mode !== "todas_equipes" && (
      <div ref={tableRef} style={{ margin:isMobile?"8px":"12px 16px", background:"#fff",
                    border:`1px solid ${C.border}`, borderRadius:"4px",
                    overflow:"hidden", boxShadow:"0 1px 6px rgba(170,0,0,.12)" }}>
        {loading && (
          <div style={{ padding:"16px" }}>
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ height:"30px", background:"#F0DADA", borderRadius:"4px",
                                    marginBottom:"6px", animation:"pulse 1.5s ease-in-out infinite",
                                    animationDelay:(i*.1)+"s" }}/>
            ))}
          </div>
        )}
        {error && (
          <div style={{ padding:"40px", textAlign:"center" }}>
            <p style={{ color:C.red, fontWeight:600, marginBottom:"6px" }}>Erro ao carregar dados</p>
            <p style={{ color:C.textSub, fontSize:"11px", fontFamily:C.mono, marginBottom:"14px" }}>{error}</p>
            <button onClick={fetchData}
              style={{ background:C.primary, border:"none", color:"#fff", padding:"7px 14px",
                       borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
              <RefreshCw size={12} style={{ verticalAlign:"middle", marginRight:"4px" }}/>
              Tentar novamente
            </button>
          </div>
        )}
        {!loading && !error && noData && (
          <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
            {mode==="equipe"?"Selecione uma equipe acima.":mode==="vendedor"?"Selecione um vendedor acima.":"Selecione um supervisor acima."}
          </div>
        )}
        {!loading && !error && !noData && (
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
              <thead>
                {mode === "supervisor" && !activeCode ? (
                  <tr>
                    <th style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"left", border:`1px solid ${C.primaryDk}` }}>SUPERVISOR</th>
                    <th colSpan={10} style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"center", border:`1px solid ${C.primaryDk}` }}>INDICADORES (EQUIPE)</th>
                  </tr>
                ) : null}
                {showVendedor && (
                  <tr>
                    <th colSpan={2} style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"left", border:`1px solid ${C.primaryDk}` }}>VENDEDOR</th>
                    <th colSpan={10} style={{ background:C.header, color:"#fff", padding:"4px 8px", fontSize:"10px", fontWeight:700, textAlign:"center", border:`1px solid ${C.primaryDk}` }}>INDICADORES</th>
                  </tr>
                )}
                <tr>
                  {showVendedor && <>
                    <Th label="RCA"       col="cod_vendedor"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                    <Th label="NOME"      col="nome_vendedor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} sticky={isMobile}/>
                  </>}
                  <Th label="FAMILIA"    col="secao"              sortCol={sortCol} sortDir={sortDir} onSort={handleSort} sticky={isMobile && !showVendedor}/>
                  <Th label="OBJETIVO"   col="valor_meta_secao"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="REALIZADO"  col="valor_faturado_mes_atual"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="% ATING"    col="tendencia_pct"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="% TEND."    col="tendencia_pct"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="R.A.F"      col="resta_a_fazer"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="NECESS/DIA" col="necessidade_dia"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="REALIZ/DIA" col="nao_faturado_hoje"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right"/>
                  <Th label="% DIA"      col="nao_faturado_hoje"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                  <Th label="STATUS"     col="tendencia_pct"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center"/>
                </tr>
              </thead>
              <tbody>{mode === "supervisor" && !activeCode
                ? rows.map((row,i) => <SupervisorTotalRow key={row.cod_supervisor??i} row={row} i={i}/>)
                : buildTableRows(rows, showVendedor, isMobile)}</tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    {showVendedor && <td style={{ padding:"6px 8px", border:"1px solid #880000" }} colSpan={2}>{rows.length} vendedores</td>}
                    <td style={{ padding:"6px 8px", border:"1px solid #880000" }}>TOTAL</td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.meta)}</td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.real)}</td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pctStyle(totTend)}>{fmtPct(totTend)}</span></td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.raf)}</td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.nec)}</td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"right", fontFamily:C.mono }}>{fmt(tot.dia)}</td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"center" }}><span style={pctStyle(totPctDia)}>{fmtPct(totPctDia)}</span></td>
                    <td style={{ padding:"6px 8px", border:"1px solid #880000", textAlign:"center" }}>{arrow(totTend)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {rows.length === 0 && <div style={{ padding:"40px", textAlign:"center", color:C.textSub }}>Nenhum dado encontrado.</div>}
          </div>
        )}
      </div>
      )}


    {/* Tabela debug — só admin */}
    {isAdmin && showDebug && rows.length > 0 && (
      <div style={{ margin:"0 16px 16px", background:"#fff", border:"1.5px solid #7C3AED",
        borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 6px rgba(124,58,237,.15)" }}>
        <div style={{ padding:"8px 14px", background:"#7C3AED", color:"#fff",
          fontWeight:700, fontSize:"12px" }}>
          🔬 Debug SQL — colunas intermediárias (admin)
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
            <thead>
              <tr>
                {["VENDEDOR","SEÇÃO",
                  "FAT.HIST.(meta base)","META CALC.",
                  "FAT.MÊS PURO","CART.SEMANA","FAT.MÊS ATUAL",
                  "RESTA","NECESS/DIA",
                  "FAT.HOJE","NÃO FAT.HOJE","REALIZ.DIA",
                  "% TEND.","DU CONSULT.","DU MÊS","DU DECORR."].map(h => (
                  <th key={h} style={{ padding:"4px 7px", background:"#EDE9FE", color:"#4C1D95",
                    fontSize:"10px", fontWeight:700, whiteSpace:"nowrap",
                    border:"1px solid #C4B5FD",
                    textAlign: ["VENDEDOR","SEÇÃO"].includes(h) ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i) => {
                const fmtV = v => v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
                const fmtN = v => v == null ? "—" : Number(v).toLocaleString("pt-BR");
                const bg = i%2===0 ? "#FAF5FF" : "#fff";
                const td = { padding:"4px 7px", border:"1px solid #E9D5FF", background:bg };
                return (
                  <tr key={`${r.cod_vendedor}-${r.cod_secao??i}`}>
                    <td style={{ ...td, fontWeight:500, whiteSpace:"nowrap" }}>{r.nome_vendedor}</td>
                    <td style={{ ...td, whiteSpace:"nowrap" }}>{r.secao ?? r.familia ?? "—"}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtV(r.valor_faturado_secao)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700 }}>{fmtV(r.valor_meta_secao)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtV(r.faturado_mes_puro)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtV(r.nao_faturado_semana)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700, color:"#7C3AED" }}>{fmtV(Math.max(0, r.valor_faturado_mes_atual??0))}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color: (r.resta_a_fazer??0)<0 ? C.green : C.red }}>{fmtV(r.resta_a_fazer)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtV(r.necessidade_dia)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.green }}>{fmtV(r.faturado_hoje)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtV(r.nao_faturado_hoje)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700 }}>{fmtV(r.realizado_dia)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color: (r.tendencia_pct??0)>=100?C.green:(r.tendencia_pct??0)>=90?C.amber:C.red }}>
                      {r.tendencia_pct != null ? `${Number(r.tendencia_pct).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.textSub }}>{fmtN(r.dias_uteis_consultados)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.textSub }}>{fmtN(r.dias_uteis_mes_atual)}</td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.textSub }}>{fmtN(r.dias_uteis_decorridos)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

    </>
  );
}