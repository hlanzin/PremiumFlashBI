import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, ChevronDown, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
import { C, fmt, fmtPct, pctStyle, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const arrow = (p) => {
  if (p == null) return <span style={{ color:"#ccc" }}>—</span>;
  const [bg, shadow, Icon] =
    p >= 100 ? [C.green, "rgba(22,163,74,.5)",  TrendingUp  ] :
    p >= 90  ? [C.amber, "rgba(217,119,6,.5)",  Minus       ] :
               [C.red,   "rgba(220,38,38,.5)",  TrendingDown];
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:"26px", height:"26px", borderRadius:"50%",
      background:bg, boxShadow:`0 2px 5px ${shadow}`,
    }}>
      <Icon size={13} color="#fff" strokeWidth={2.5}/>
    </div>
  );
};

// Medalhas para top 3
const medal = (pos) => {
  if (pos === 1) return { bg:"#FFD700", color:"#7A5800", label:"1°" };
  if (pos === 2) return { bg:"#C0C0C0", color:"#555",   label:"2°" };
  if (pos === 3) return { bg:"#CD7F32", color:"#fff",   label:"3°" };
  return null;
};

function Dropdown({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position:"relative", display:"inline-block", minWidth:"240px" }}>
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

export default function ModuleRanking({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;

  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [supervisores, setSupervisores] = useState([]);
  const [supSel,     setSupSel]     = useState(
    cargo === "supervisor" ? codUser : null
  );
  const hoje = getToday();
  const [dataRef, setDataRef] = useState(hoje);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Carrega lista de supervisores para gerencial
  useEffect(() => {
    if (cargo !== "gerencial") return;
    fetch(`${API_BASE}/api/faturamento/supervisores`, { headers })
      .then(r => r.json())
      .then(j => setSupervisores((j.dados ?? []).map(s => ({ cod: s.cod_supervisor, nome: s.nome_supervisor }))))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${API_BASE}/api/faturamento/ranking`;
      if (supSel) url += `/${supSel}`;
      url += `?data=${dataRef}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()).dados ?? []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [supSel, dataRef, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [sortCol, setSortCol] = useState("tendencia_pct");
  const [sortDir, setSortDir] = useState("desc");

  const sortedRows = useMemo(() => {
    const enriched = rows.map(r => ({
      ...r,
      pct_ating: r.valor_meta_secao > 0
        ? (r.valor_faturado_mes_atual / r.valor_meta_secao) * 100 : null,
      pct_dia: r.necessidade_dia > 0
        ? (r.nao_faturado_hoje / r.necessidade_dia) * 100 : null,
    }));
    if (!sortCol) return enriched;
    return enriched.sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [rows, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const tot = {
    meta: rows.reduce((s,r) => s+(r.valor_meta_secao??0), 0),
    real: rows.reduce((s,r) => s+(r.valor_faturado_mes_atual??0), 0),
    raf:  rows.reduce((s,r) => s+(r.resta_a_fazer??0), 0),
    nec:  rows.reduce((s,r) => s+(r.necessidade_dia??0), 0),
    dia:  rows.reduce((s,r) => s+(r.nao_faturado_hoje??0), 0),
  };
  const totPct    = tot.meta > 0 ? (tot.real / tot.meta) * 100 : 0;
  const totTend   = rows.length > 0 && rows[0].dias_uteis_decorridos > 0
    ? ((tot.real / rows[0].dias_uteis_decorridos) * rows[0].dias_uteis_mes_atual / tot.meta) * 100 : 0;
  const totPctDia = tot.nec > 0 ? (tot.dia / tot.nec) * 100 : null;

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

    const badge = (p) => {
      if (p == null) return "—";
      const bg = p >= 100 ? "#16a34a" : p >= 90 ? "#d97706" : "#dc2626";
      return `<span style="background:${bg};color:#fff;border-radius:3px;padding:1px 6px;font-weight:600;font-size:10px">${p.toFixed(1)}%</span>`;
    };
    const icon = (p) => {
      if (p == null) return `<span style="color:#ccc">—</span>`;
      const [bg, char] = p >= 100 ? ["#16a34a","▲"] : p >= 90 ? ["#d97706","●"] : ["#dc2626","▼"];
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${bg};color:#fff;font-weight:700;font-size:11px">${char}</span>`;
    };
    const medalHtml = (pos) => {
      if (pos === 1) return `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#FFD700;color:#7A5800;font-weight:900;font-size:11px;box-shadow:0 2px 6px #FFD70088">1°</span>`;
      if (pos === 2) return `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#C0C0C0;color:#555;font-weight:900;font-size:11px">2°</span>`;
      if (pos === 3) return `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#CD7F32;color:#fff;font-weight:900;font-size:11px">3°</span>`;
      return `<span style="font-weight:600;color:#475569;font-size:12px">${pos}°</span>`;
    };

    const H  = `background:#CC0000;color:#fff;padding:6px 8px;font-size:10px;font-weight:700;letter-spacing:.04em;border:1px solid #990000;white-space:nowrap;`;
    const TD = (i, m, extra="") => `background:${m?`linear-gradient(90deg,${m.bg}22 0%,${i%2===0?"#FFF8F8":"#fff"} 80%)`:(i%2===0?"#FFF8F8":"#fff")};padding:6px 8px;border-bottom:1px solid #EED0D0;${extra}`;
    const TF = `background:#AA0000;color:#fff;padding:6px 8px;border:1px solid #880000;font-weight:700;`;

    let html = `<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:'Segoe UI',Arial,sans-serif;">`;
    html += `<thead><tr>
      <th style="${H}text-align:center">POS</th>
      <th style="${H}">VENDEDOR</th>
      ${cargo === "gerencial" ? `<th style="${H}">SUPERVISOR</th>` : ""}
      <th style="${H}text-align:right">OBJETIVO</th>
      <th style="${H}text-align:right">REALIZADO</th>
      <th style="${H}text-align:center">% ATING</th>
      <th style="${H}text-align:center">% TEND.</th>
      <th style="${H}text-align:right">R.A.F</th>
      <th style="${H}text-align:right">NECESS/DIA</th>
      <th style="${H}text-align:right">REALIZ/DIA</th>
      <th style="${H}text-align:center">% DIA</th>
      <th style="${H}text-align:center">STATUS</th>
    </tr></thead><tbody>`;

    rows.forEach((row, i) => {
      const pos    = i + 1;
      const m      = medal(pos);
      const pct    = row.valor_meta_secao > 0 ? (row.valor_faturado_mes_atual / row.valor_meta_secao) * 100 : null;
      const tend   = row.tendencia_pct;
      const pctDia = row.necessidade_dia  > 0 ? (row.nao_faturado_hoje / row.necessidade_dia) * 100 : null;
      const rafCol = (row.resta_a_fazer ?? 0) <= 0 ? "#16a34a" : "#dc2626";
      html += `<tr>
        <td style="${TD(i,m,"text-align:center")}">${medalHtml(pos)}</td>
        <td style="${TD(i,m,"font-weight:600")}">${row.nome_vendedor}<div style="font-size:10px;color:#475569;font-family:monospace">#${row.cod_vendedor}</div></td>
        ${cargo === "gerencial" ? `<td style="${TD(i,m,"font-size:11px;color:#475569")}">${row.nome_supervisor}</td>` : ""}
        <td style="${TD(i,m,"text-align:right;font-family:monospace")}">${fmt(row.valor_meta_secao)}</td>
        <td style="${TD(i,m,"text-align:right;font-family:monospace;font-weight:600")}">${fmt(row.valor_faturado_mes_atual)}</td>
        <td style="${TD(i,m,"text-align:center")}">${badge(pct)}</td>
        <td style="${TD(i,m,"text-align:center")}">${badge(tend)}</td>
        <td style="${TD(i,m,`text-align:right;font-family:monospace;color:${rafCol}`)}">${fmt(row.resta_a_fazer)}</td>
        <td style="${TD(i,m,"text-align:right;font-family:monospace")}">${fmt(row.necessidade_dia)}</td>
        <td style="${TD(i,m,"text-align:right;font-family:monospace;font-weight:600;color:#CC0000")}">${fmt(row.nao_faturado_hoje)}</td>
        <td style="${TD(i,m,"text-align:center")}">${badge(pctDia)}</td>
        <td style="${TD(i,m,"text-align:center")}">${icon(tend)}</td>
      </tr>`;
    });

    html += `</tbody><tfoot><tr>
      <td style="${TF}text-align:center">—</td>
      <td style="${TF}">TOTAL (${rows.length} vendedores)</td>
      ${cargo === "gerencial" ? `<td style="${TF}"></td>` : ""}
      <td style="${TF}text-align:right;font-family:monospace">${fmt(tot.meta)}</td>
      <td style="${TF}text-align:right;font-family:monospace">${fmt(tot.real)}</td>
      <td style="${TF}text-align:center">${badge(totPct)}</td>
      <td style="${TF}text-align:center">${badge(totTend)}</td>
      <td style="${TF}text-align:right;font-family:monospace">${fmt(tot.raf)}</td>
      <td style="${TF}text-align:right;font-family:monospace">${fmt(tot.nec)}</td>
      <td style="${TF}text-align:right;font-family:monospace">${fmt(tot.dia)}</td>
      <td style="${TF}text-align:center">${badge(totPctDia)}</td>
      <td style="${TF}text-align:center">${icon(totPct)}</td>
    </tr></tfoot></table>`;

    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:1200px;background:#fff;";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    try {
      const canvas = await window.html2canvas(wrap, {
        scale:2, useCORS:true, backgroundColor:"#fff", logging:false, width:1200,
      });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
      doc.setFillColor(170,0,0); doc.rect(0,0,297,18,"F");
      doc.setFont("helvetica","bold");
      doc.setFontSize(13); doc.setTextColor(200,150,12);
      doc.text("PREMIUM DISTRIBUIDORA", 10, 8);
      doc.setFontSize(8); doc.setTextColor(255,220,180);
      doc.text(`RANKING DE VENDEDORES — ${dataRef}`, 10, 14);
      const margin=8, availW=297-margin*2, availH=210-22;
      const imgW=canvas.width/2, imgH=canvas.height/2;
      const ratio=Math.min(availW/imgW, availH/imgH);
      const finalW=imgW*ratio, finalH=imgH*ratio;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", (297-finalW)/2, 20, finalW, finalH);
      doc.save(`Ranking_${dataRef}.pdf`);
    } finally {
      document.body.removeChild(wrap);
    }
  };

  const TH = ({ label, align, col }) => {
    const active = col && sortCol === col;
    const arrow  = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
    return (
      <th onClick={col ? () => handleSort(col) : undefined}
        style={{ padding:"6px 8px", color:"#fff", fontSize:"10px",
                 fontWeight:700, textAlign:align??"left", whiteSpace:"nowrap",
                 border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
                 cursor:col?"pointer":"default", userSelect:"none",
                 background: active ? C.primaryDk : C.subHeader }}>
        {label}{arrow}
      </th>
    );
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
              RANKING DE VENDEDORES
            </div>
            {!isMobile && rows.length > 0 && (
              <div style={{ color:"rgba(255,220,180,.9)", fontSize:"11px", marginTop:"2px" }}>
                Meta: <b style={{color:"#fff"}}>{fmt(tot.meta)}</b>
                &nbsp;·&nbsp; Realizado: <b style={{color:"#fff"}}>{fmt(tot.real)}</b>
                &nbsp;·&nbsp; <span style={pctStyle(totPct)}>{fmtPct(totPct)}</span>
                {dataRef !== hoje && <span style={{color:C.goldLight}}>&nbsp;·&nbsp; {dataRef}</span>}
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

      {/* Filtros */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:isMobile?"6px 12px":"8px 20px",
                    display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

        {/* Gerencial pode filtrar por supervisor */}
        {cargo === "gerencial" && (
          <Dropdown
            value={supSel} onChange={setSupSel}
            options={supervisores}
            placeholder="Todas as equipes"
          />
        )}

        {/* Data */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:"#fff",
                      marginLeft: cargo === "gerencial" ? "0" : "auto" }}>
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
      </div>

      {/* Tabela */}
      <div style={{ margin:isMobile?"8px":"12px 16px", background:"#fff",
                    border:`1px solid ${C.border}`, borderRadius:"4px",
                    overflow:"hidden", boxShadow:`0 1px 6px rgba(170,0,0,.12)` }}>
        {loading && (
          <div style={{ padding:"16px" }}>
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ height:"36px", background:C.rowEven, borderRadius:"4px",
                                    marginBottom:"6px", animation:"pulse 1.5s ease-in-out infinite",
                                    animationDelay:(i*.1)+"s" }}/>
            ))}
          </div>
        )}
        {error && (
          <div style={{ padding:"40px", textAlign:"center" }}>
            <p style={{ color:C.red, fontWeight:600, marginBottom:"6px" }}>Erro ao carregar</p>
            <p style={{ color:C.textSub, fontSize:"11px", fontFamily:C.mono }}>{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:isMobile?"11px":"12px" }}>
              <thead>
                <tr>
                  <TH label="POS"        align="center"/>
                  <TH label="VENDEDOR"/>
                  {cargo === "gerencial" && <TH label="SUPERVISOR"/>}
                  <TH label="OBJETIVO"   align="right"  col="valor_meta_secao"/>
                  <TH label="REALIZADO"  align="right"  col="valor_faturado_mes_atual"/>
                  <TH label="% ATING"    align="center" col="pct_ating"/>
                  <TH label="% TEND."    align="center" col="tendencia_pct"/>
                  <TH label="R.A.F"      align="right"  col="resta_a_fazer"/>
                  <TH label="NECESS/DIA" align="right"  col="necessidade_dia"/>
                  <TH label="REALIZ/DIA" align="right"  col="nao_faturado_hoje"/>
                  <TH label="% DIA"      align="center" col="pct_dia"/>
                  <TH label="STATUS"     align="center"/>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => {
                  const pos    = i + 1;
                  const m      = medal(pos);
                  const pct    = row.valor_meta_secao > 0 ? (row.valor_faturado_mes_atual / row.valor_meta_secao) * 100 : null;
                  const tend   = row.tendencia_pct;
                  const pctDia = row.necessidade_dia > 0 ? (row.nao_faturado_hoje / row.necessidade_dia) * 100 : null;
                  const rafCol = (row.resta_a_fazer ?? 0) <= 0 ? C.green : C.red;

                  // Linha destacada para top 3
                  const rowBg = m
                    ? `linear-gradient(90deg,${m.bg}22 0%,${i%2===0?C.rowEven:C.rowOdd} 80%)`
                    : i%2===0 ? C.rowEven : C.rowOdd;

                  const td = (extra = {}) => ({
                    padding:"7px 8px",
                    borderBottom:`1px solid ${C.border}`,
                    verticalAlign:"middle",
                    background:"transparent",
                    ...extra,
                  });

                  return (
                    <tr key={row.cod_vendedor} style={{ background:rowBg }}>
                      {/* Posição */}
                      <td style={td({ textAlign:"center", width:"48px" })}>
                        {m ? (
                          <span style={{
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            width:"28px", height:"28px", borderRadius:"50%",
                            background:m.bg, color:m.color,
                            fontWeight:900, fontSize:"12px",
                            boxShadow:`0 2px 6px ${m.bg}88`,
                          }}>{m.label}</span>
                        ) : (
                          <span style={{ fontWeight:600, color:C.textSub, fontSize:"12px" }}>{pos}°</span>
                        )}
                      </td>

                      {/* Vendedor */}
                      <td style={td({ fontWeight:600 })}>
                        <div style={{ fontSize:"12px" }}>{row.nome_vendedor}</div>
                        <div style={{ fontSize:"10px", color:C.textSub, fontFamily:C.mono }}>#{row.cod_vendedor}</div>
                      </td>

                      {cargo === "gerencial" && (
                        <td style={td({ fontSize:"11px", color:C.textSub })}>{row.nome_supervisor}</td>
                      )}

                      <td style={td({ textAlign:"right", fontFamily:C.mono })}>{fmt(row.valor_meta_secao)}</td>
                      <td style={td({ textAlign:"right", fontFamily:C.mono, fontWeight:600 })}>{fmt(row.valor_faturado_mes_atual)}</td>
                      <td style={td({ textAlign:"center" })}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
                      <td style={td({ textAlign:"center" })}><span style={pctStyle(tend)}>{fmtPct(tend)}</span></td>
                      <td style={td({ textAlign:"right", fontFamily:C.mono, color:rafCol })}>{fmt(row.resta_a_fazer)}</td>
                      <td style={td({ textAlign:"right", fontFamily:C.mono })}>{fmt(row.necessidade_dia)}</td>
                      <td style={td({ textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary })}>{fmt(row.nao_faturado_hoje)}</td>
                      <td style={td({ textAlign:"center" })}><span style={pctStyle(pctDia)}>{fmtPct(pctDia)}</span></td>
                      <td style={td({ textAlign:"center" })}>{arrow(tend)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>—</td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}` }}>
                      TOTAL ({rows.length} vendedores)
                    </td>
                    {cargo === "gerencial" && <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}` }}/>}
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmt(tot.meta)}</td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmt(tot.real)}</td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}><span style={pctStyle(totPct)}>{fmtPct(totPct)}</span></td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}><span style={pctStyle(totTend)}>{fmtPct(totTend)}</span></td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmt(tot.raf)}</td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmt(tot.nec)}</td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>{fmt(tot.dia)}</td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}><span style={pctStyle(totPctDia)}>{fmtPct(totPctDia)}</span></td>
                    <td style={{ padding:"7px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>{arrow(totTend)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {rows.length === 0 && !loading && (
              <div style={{ padding:"40px", textAlign:"center", color:C.textSub }}>
                Nenhum dado encontrado.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botão PDF flutuante */}
      {rows.length > 0 && (
        <div style={{ position:"fixed", bottom:"24px", right:"24px", zIndex:1000 }}>
          <button onClick={exportToPDF}
            style={{
              display:"flex", alignItems:"center", gap:"8px",
              background:C.primary, border:"none", color:"#fff",
              padding:"10px 18px", borderRadius:"8px", cursor:"pointer",
              fontSize:"13px", fontFamily:C.sans, fontWeight:700,
              boxShadow:`0 4px 14px rgba(170,0,0,.45)`,
            }}>
            <FileText size={16}/> Exportar PDF
          </button>
        </div>
      )}
    </>
  );
}