import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ChevronDown, ChevronRight,
         Package, X, Users, User, Shield } from "lucide-react";
import { C, fmtR, fmtN, fmtDt, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import SelectModal from "../../components/SelectModal";
import ModuleHeader from "../../components/ModuleHeader";
import TableCard from "../../components/TableCard";
import DatePicker from "../../components/DatePicker";
import { exportCSV } from "../../utils/exportCSV";

// Apenas as 5 situações usadas, na ordem certa
const POSICAO = {
  B:{ label:"Bloqueado", bg:"#FEE2E2", color:"#991B1B" },
  P:{ label:"Pendente",  bg:"#FEE2E2", color:"#991B1B"  },
  L:{ label:"Liberado",  bg:"#F0FDF4", color:"#166534" },
  M:{ label:"Montado",   bg:"#FEF9C3", color:"#854D0E" },
  F:{ label:"Faturado",  bg:"#DBEAFE", color:"#1E40AF" },
  C:{ label:"Cancelado", bg:"#F3F4F6", color:"#6B7280" },
};

// CSS injetado uma vez para hover sem re-render
const ROW_CSS = `
  .ped-row { cursor:pointer; }
  .ped-row:hover td { background:${C.rowHover} !important; }
`;

function PosicaoBadge({ posicao }) {
  const p = POSICAO[posicao] ?? { label: posicao ?? "—", bg:"#F3F4F6", color:"#374151" };
  return (
    <span style={{ padding:"2px 8px", borderRadius:"10px", fontSize:"10px",
      fontWeight:600, background:p.bg, color:p.color, whiteSpace:"nowrap" }}>
      {p.label}
    </span>
  );
}

// ── Linha de itens expandida ──────────────────────────────────────────────────
function ItensRow({ numped, token, isMobile, showCorte }) {
  const [itens,   setItens]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/pedidos/${numped}/itens`,
      { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { setItens(j.itens ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [numped, token]);

  const tdI = { padding:"4px 8px", borderBottom:`1px solid ${C.border}`,
    fontSize:"11px", color:"#374151", verticalAlign:"middle" };

  if (loading) return (
    <tr><td colSpan={20} style={{ padding:"12px 16px", textAlign:"center",
      color:C.textSub, fontSize:"11px", background:"#F9FAFB" }}>
      Carregando itens...
    </td></tr>
  );

  if (isMobile) return (
    <tr><td colSpan={20} style={{ padding:"8px 12px", background:"#F9FAFB" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
        {itens.map((item,i) => (
          <div key={i} style={{ background:"#fff", border:`1px solid ${C.border}`,
            borderRadius:"6px", padding:"8px 10px" }}>
            <div style={{ fontWeight:600, fontSize:"12px", marginBottom:"3px" }}>
              {item.descricao}
              {item.bonific==="S" && <span style={{ marginLeft:"6px", fontSize:"10px",
                color:C.green, fontWeight:700 }}>BONIF</span>}
            </div>
            <div style={{ fontSize:"11px", color:C.textSub, display:"flex", gap:"12px", flexWrap:"wrap" }}>
              <span>Cód: <b style={{color:C.text}}>{item.codprod}</b></span>
              <span>Qt: <b style={{color:C.text}}>{fmtN(item.qt)} {item.embalagem}</b></span>
              <span>Preço: <b style={{color:C.text}}>{fmtR(item.pvenda)}</b></span>
              <span>Subtotal: <b style={{color:C.primary}}>{fmtR(item.subtotal)}</b></span>
              {showCorte && (item.qt_cortada ?? 0) > 0 && (
                <span>Corte: <b style={{color:C.red}}>{fmtN(item.qt_cortada)} ({fmtR(item.valor_cortado)})</b></span>
              )}
              {showCorte && (item.qt_falta ?? 0) > 0 && (
                <span>Falta: <b style={{color:C.amber}}>{fmtN(item.qt_falta)} ({fmtR(item.valor_falta)})</b></span>
              )}
              {item.perdesc > 0 && <span style={{color:C.red}}>Desc: {item.perdesc?.toFixed(1)}%</span>}
            </div>
            <div style={{ fontSize:"10px", color:C.textSub, marginTop:"2px" }}>{item.fornecedor}</div>
          </div>
        ))}
        {itens.length === 0 && <div style={{ textAlign:"center", color:C.textSub, padding:"8px" }}>Sem itens.</div>}
      </div>
    </td></tr>
  );

  return (
    <tr>
      <td colSpan={20} style={{ padding:"0", background:"#F9FAFB" }}>
        <div style={{ padding:"4px 16px 8px 48px" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
            <thead>
              <tr>
                {["Cód","Produto","Emb.","Fornecedor","Qt","Preço","Subtotal",
                  ...(showCorte ? ["Corte","Falta"] : []),
                  "% Desc","B"].map(h => (
                  <th key={h} style={{ padding:"4px 8px", background:"#E5E7EB", color:"#374151",
                    fontSize:"10px", fontWeight:600,
                    textAlign:h==="Qt"||h==="B"?"center":(h==="Corte"||h==="Falta")?"right":"left",
                    whiteSpace:"nowrap", borderBottom:`1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((item,i) => (
                <tr key={i} style={{ background: i%2===0?"#fff":"#F9FAFB" }}>
                  <td style={{ ...tdI, fontFamily:C.mono, fontSize:"10px" }}>{item.codprod}</td>
                  <td style={{ ...tdI, fontWeight:500, maxWidth:"200px",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {item.descricao}
                  </td>
                  <td style={{ ...tdI, color:C.textSub }}>{item.embalagem}</td>
                  <td style={{ ...tdI, color:C.textSub, maxWidth:"130px",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.fornecedor}</td>
                  <td style={{ ...tdI, textAlign:"center", fontFamily:C.mono }}>{fmtN(item.qt)}</td>
                  <td style={{ ...tdI, textAlign:"right", fontFamily:C.mono }}>{fmtR(item.pvenda)}</td>
                  <td style={{ ...tdI, textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary }}>{fmtR(item.subtotal)}</td>
                  {showCorte && <td style={{ ...tdI, textAlign:"right", fontFamily:C.mono,
                    color: (item.qt_cortada ?? 0) > 0 ? C.red : C.textSub }}>
                    {(item.qt_cortada ?? 0) > 0
                      ? `${fmtN(item.qt_cortada)} (${fmtR(item.valor_cortado)})`
                      : "—"}
                  </td>}
                  {showCorte && <td style={{ ...tdI, textAlign:"right", fontFamily:C.mono,
                    color: (item.qt_falta ?? 0) > 0 ? C.amber : C.textSub }}>
                    {(item.qt_falta ?? 0) > 0
                      ? `${fmtN(item.qt_falta)} (${fmtR(item.valor_falta)})`
                      : "—"}
                  </td>}
                  <td style={{ ...tdI, textAlign:"right", fontFamily:C.mono,
                    color: item.perdesc > 0 ? C.red : C.textSub }}>
                    {item.perdesc > 0 ? `${item.perdesc.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ ...tdI, textAlign:"center" }}>
                    {item.bonific === "S" && <span style={{ color:C.green, fontWeight:700, fontSize:"10px" }}>✓</span>}
                  </td>
                </tr>
              ))}
              {itens.length === 0 && (
                <tr><td colSpan={showCorte?11:9} style={{ padding:"12px", textAlign:"center", color:C.textSub }}>Sem itens.</td></tr>
              )}
            </tbody>
            {itens.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ padding:"4px 8px", fontWeight:700, fontSize:"10px",
                    color:C.text, background:"#E5E7EB" }}>TOTAL ITENS</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", fontWeight:700,
                    fontFamily:C.mono, color:C.primary, background:"#E5E7EB" }}>
                    {fmtR(itens.reduce((s,r)=>s+(r.subtotal??0),0))}
                  </td>
                  {showCorte && <td style={{ padding:"4px 8px", textAlign:"right", fontWeight:700,
                    fontFamily:C.mono, color:C.red, background:"#E5E7EB" }}>
                    {(() => {
                      const tc = itens.reduce((s,r)=>s+(r.valor_cortado??0),0);
                      return tc > 0 ? fmtR(tc) : "—";
                    })()}
                  </td>}
                  {showCorte && <td style={{ padding:"4px 8px", textAlign:"right", fontWeight:700,
                    fontFamily:C.mono, color:C.amber, background:"#E5E7EB" }}>
                    {(() => {
                      const tf = itens.reduce((s,r)=>s+(r.valor_falta??0),0);
                      return tf > 0 ? fmtR(tf) : "—";
                    })()}
                  </td>}
                  <td colSpan={2} style={{ background:"#E5E7EB" }}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </td>
    </tr>
  );
}

// ── Linha de pedido — memoizada para evitar re-render desnecessário ───────────
const PedidoRow = React.memo(function PedidoRow({ ped, i, expandido, onToggle, token, isMobile, showVendedor, showCorte }) {
  const bg = i%2===0 ? C.rowEven : C.rowOdd;
  const td = { padding:"6px 8px", borderBottom:`1px solid #EED0D0`,
    verticalAlign:"middle", background:bg, fontSize:"12px" };

  if (isMobile) return (<>
    <tr className="ped-row" onClick={onToggle}>
      <td style={{ ...td, padding:"8px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
          {expandido
            ? <ChevronDown size={13} color={C.primary}/>
            : <ChevronRight size={13} color={C.textSub}/>}
          <span style={{ fontFamily:C.mono, fontWeight:600, color:C.primary, fontSize:"12px" }}>
            #{ped.numped}
          </span>
          {ped.num_nota && <span style={{ fontFamily:C.mono, fontSize:"11px", color:C.textSub }}>
            NF {ped.num_nota}
          </span>}
          <PosicaoBadge posicao={ped.posicao}/>
          <span style={{ marginLeft:"auto", fontWeight:700, fontFamily:C.mono,
            fontSize:"12px", color:C.primary }}>{fmtR(ped.vl_total)}</span>
        </div>
        <div style={{ fontSize:"11px", color:C.text, fontWeight:500, marginLeft:"19px" }}>
          {ped.fantasia || ped.razao_social}
          <span style={{ color:C.textSub }}> #{ped.codcli}</span>
        </div>
        <div style={{ fontSize:"10px", color:C.textSub, marginLeft:"19px", marginTop:"1px",
          display:"flex", gap:"10px" }}>
          <span>{fmtDt(ped.dt_pedido)}</span>
          {showVendedor && <span>{ped.nome_vendedor}</span>}
          <span>{ped.num_itens} itens</span>
          {showCorte && (ped.perda_total ?? 0) > 0 && (
            <span style={{ color:C.red, fontWeight:600 }}>
              corte/falta {fmtR(ped.perda_total)}
            </span>
          )}
        </div>
      </td>
    </tr>
    {expandido && <ItensRow numped={ped.numped} token={token} isMobile={true} showCorte={showCorte}/>}
  </>);

  return (<>
    <tr className="ped-row" onClick={onToggle}>
      <td style={{ ...td, textAlign:"center", width:"28px" }}>
        {expandido
          ? <ChevronDown size={13} color={C.primary}/>
          : <ChevronRight size={13} color={C.textSub}/>}
      </td>
      <td style={{ ...td, fontFamily:C.mono, fontWeight:600, color:C.primary }}>{ped.numped}</td>
      <td style={{ ...td, fontFamily:C.mono, color:C.textSub }}>{ped.num_nota ?? "—"}</td>
      <td style={{ ...td }}>{fmtDt(ped.dt_pedido)}</td>
      <td style={{ ...td, fontFamily:C.mono, fontSize:"11px" }}>{ped.codcli}</td>
      <td style={{ ...td, maxWidth:"180px", overflow:"hidden",
        textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:500 }}>
        {ped.fantasia || ped.razao_social}
      </td>
      {showVendedor && <td style={{ ...td, fontSize:"11px", color:C.textSub,
        maxWidth:"130px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {ped.nome_vendedor}
      </td>}
      <td style={{ ...td, textAlign:"center" }}><PosicaoBadge posicao={ped.posicao}/></td>
      {showCorte && (
        <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600,
          color: (ped.perda_total ?? 0) > 0 ? C.red : C.textSub }}>
          {(ped.perda_total ?? 0) > 0 ? fmtR(ped.perda_total) : "—"}
        </td>
      )}
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, color:C.textSub }}>
        {fmtR(ped.subtotal_itens)}
      </td>
      <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:600,
        color:C.primary }}>{fmtR(ped.vl_total)}</td>
    </tr>
    {expandido && <ItensRow numped={ped.numped} token={token} isMobile={false} showCorte={showCorte}/>}
  </>);
});

// ── Módulo principal ──────────────────────────────────────────────────────────
export default function ModulePedidos({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;
  const headers = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);

  const hoje = getToday();
  // Estados de input (o que o usuário digita)
  const [dtIniInput, setDtIniInput] = useState(hoje);
  const [dtFimInput, setDtFimInput] = useState(hoje);
  // Estados aplicados (disparam o fetch apenas ao confirmar)
  const [dtIni, setDtIni] = useState(hoje);
  const [dtFim, setDtFim] = useState(hoje);

  const aplicarDatas = () => {
    if (dtIniInput && dtFimInput) {
      setDtIni(dtIniInput);
      setDtFim(dtFimInput);
    }
  };
  const [busca,    setBusca]    = useState("");
  const [pedidos,  setPedidos]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [vendedores, setVendedores] = useState([]);
  const [filtroVend, setFiltroVend] = useState(
    cargo === "vendedor" ? codUser : null
  );
  const [supervisores, setSupervisores] = useState([]);
  const [filtroSup, setFiltroSup] = useState(null);
  // mapa supervisor → vendedores
  const [supVendMap, setSupVendMap] = useState(null);

  // Busca vendedores + supervisores para o filtro
  useEffect(() => {
    if (cargo === "vendedor") return;
    fetch(`${API_BASE}/api/dn`, { headers })
      .then(r => r.json())
      .then(j => {
        const vendMap = new Map();
        const supMap = new Map();
        const vendPorSup = new Map();
        (j.dados ?? []).forEach(r => {
          if (!vendMap.has(r.cod_vendedor))
            vendMap.set(r.cod_vendedor, r.nome_vendedor);
          if (r.cod_supervisor && !supMap.has(r.cod_supervisor))
            supMap.set(r.cod_supervisor, r.nome_supervisor);
          if (r.cod_supervisor) {
            if (!vendPorSup.has(r.cod_supervisor))
              vendPorSup.set(r.cod_supervisor, new Set());
            vendPorSup.get(r.cod_supervisor).add(r.cod_vendedor);
          }
        });
        setVendedores(Array.from(vendMap.entries())
          .map(([cod,nome]) => ({cod,nome}))
          .sort((a,b) => a.nome.localeCompare(b.nome)));
        setSupervisores(Array.from(supMap.entries())
          .map(([cod,nome]) => ({cod,nome}))
          .sort((a,b) => a.nome.localeCompare(b.nome)));
        setSupVendMap(vendPorSup);
      }).catch(() => {});
  }, [headers, cargo]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setExpanded(new Set());
    try {
      const params = new URLSearchParams({ dt_ini: dtIni, dt_fim: dtFim });
      if (filtroVend)             params.set("codusur", filtroVend);
      const busInt = parseInt(busca);
      if (busca && busInt > 9999) params.set("numped", busInt);
      else if (busca && busInt)   params.set("codcli",  busInt);
      const res = await fetch(`${API_BASE}/api/pedidos?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dados = (await res.json()).dados ?? [];
      // perda_total = corte + falta (para a coluna e o sort)
      dados.forEach(p => {
        p.perda_total = (p.valor_cortado ?? 0) + (p.valor_falta ?? 0);
      });
      setPedidos(dados);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [dtIni, dtFim, filtroVend, busca, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [pagina,    setPagina]    = useState(1);
  const PAGE_SIZE = 50;

  const toggleExpand = useCallback(numped =>
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(numped) ? s.delete(numped) : s.add(numped);
      return s;
    })
  , []);

  const [filtroStatus, setFiltroStatus] = useState(new Set());

  const toggleStatus = pos => {
    setPagina(1);
    setFiltroStatus(prev => {
      const s = new Set(prev);
      s.has(pos) ? s.delete(pos) : s.add(pos);
      return s;
    });
  };

  const [sortCol, setSortCol] = useState("dt_pedido");
  const [sortDir, setSortDir] = useState("desc");
  const handleSort = col => {
    setSortCol(col);
    setSortDir(prev => sortCol === col && prev === "desc" ? "asc" : "desc");
    setPagina(1);
  };

  // Filtro local por supervisor + texto + posicao + ordenação
  const rows = useMemo(() => {
    let r = [...pedidos];
    if (filtroSup && supVendMap) {
      const vends = supVendMap.get(filtroSup);
      if (vends) r = r.filter(p => vends.has(p.cod_vendedor));
    }
    if (busca) {
      const s = busca.toLowerCase();
      r = r.filter(p =>
        String(p.numped).includes(busca) ||
        String(p.codcli).includes(busca) ||
        (p.razao_social??"").toLowerCase().includes(s) ||
        (p.fantasia??"").toLowerCase().includes(s)
      );
    }
    if (filtroStatus.size > 0)
      r = r.filter(p => filtroStatus.has(p.posicao));
    r.sort((a,b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number") return sortDir==="asc" ? av-bv : bv-av;
      return sortDir==="asc"
        ? String(av).localeCompare(String(bv), "pt-BR")
        : String(bv).localeCompare(String(av), "pt-BR");
    });
    return r;
  }, [pedidos, busca, filtroStatus, sortCol, sortDir, filtroSup, supVendMap]);

  // Só a página atual — limita o DOM a PAGE_SIZE linhas
  const totalPaginas = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const rowsPagina   = useMemo(() =>
    rows.slice((pagina-1)*PAGE_SIZE, pagina*PAGE_SIZE),
  [rows, pagina]);

  // Reseta página ao mudar filtros ou buscar novos dados
  useEffect(() => { setPagina(1); }, [pedidos, filtroStatus, busca]);

  const showVendedor = cargo !== "vendedor";
  const showCorte    = cargo === "admin" || cargo === "gerencial";
  const totVlTotal   = rows.reduce((s,r) => s+(r.vl_total??0), 0);
  const totPerda     = rows.reduce((s,r) => s+(r.perda_total??0), 0);
  const totSubtotal  = rows.reduce((s,r) => s+(r.subtotal_itens??0), 0);

  // Ranking por vendedor calculado dos dados já carregados
  const ranking = useMemo(() => {
    const map = new Map();
    rows.forEach(p => {
      const key = p.cod_vendedor ?? 0;
      if (!map.has(key)) map.set(key, {
        cod_vendedor: p.cod_vendedor,
        nome_vendedor: p.nome_vendedor ?? "—",
        qtd: 0, vl_total: 0,
      });
      const v = map.get(key);
      v.qtd++;
      v.vl_total += p.vl_total ?? 0;
    });
    return Array.from(map.values())
      .sort((a,b) => b.vl_total - a.vl_total);
  }, [rows]);

  const TH = ({ label, col, align="left", w }) => (
    <th onClick={() => col && handleSort(col)}
      style={{ padding:"6px 8px", color:"#fff", fontSize:"10px", fontWeight:700,
        textAlign:align, whiteSpace:"nowrap", border:`1px solid ${C.primaryDk}`,
        letterSpacing:"0.04em", userSelect:"none",
        cursor: col ? "pointer" : "default",
        background: col && sortCol===col ? C.primaryDk : C.subHeader,
        ...(w ? { width:w } : {}) }}>
      {label}{col && sortCol===col ? (sortDir==="asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (<>
    <style>{ROW_CSS}</style>
    <ModuleHeader icon={Package} title="PEDIDOS DE VENDA" isMobile={isMobile}
      onRefresh={fetchData} loading={loading}
      onExportExcel={rows.length > 0 ? () => {
        const header = ["PEDIDO","DATA","VENDEDOR","CLIENTE","SUPERVISOR","SUBTOTAL","TOTAL","SITUAÇÃO"];
        const dataRows = rowsPagina.map(p => [p.numped, p.dt_pedido, p.nome_vendedor, p.fantasia || p.razao_social, p.nome_supervisor, fmtR(p.subtotal_itens), fmtR(p.vl_total), p.posicao]);
        exportCSV(`Pedidos_${dtIniInput}_${dtFimInput}`, header, dataRows);
      } : undefined}>
      {rows.length > 0 && (
        <div style={{ display:"flex", gap:"16px", fontSize:"12px", color:"rgba(255,255,255,.8)" }}>
          <span><b style={{color:"#fff"}}>{rows.length}</b> pedidos</span>
          {showCorte && totPerda > 0 && <span>Corte/Falta: <b style={{color:"#FCA5A5"}}>{fmtR(totPerda)}</b></span>}
          <span>Total: <b style={{color:C.gold}}>{fmtR(totVlTotal)}</b></span>
        </div>
      )}
    </ModuleHeader>

    {/* Toolbar de filtros */}
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
      padding:isMobile?"8px 10px":"10px 16px",
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

      {/* Datas — só aplica ao clicar Buscar */}
        <DatePicker value={dtIniInput} onChange={setDtIniInput} isMobile={isMobile} />
      <span style={{ fontSize:"11px", color:C.textSub, fontWeight:600 }}>até</span>
      <DatePicker value={dtFimInput} onChange={setDtFimInput} isMobile={isMobile} />
      <button onClick={aplicarDatas}
          style={{ padding:"3px 10px", borderRadius:"4px", fontSize:"11px",
            fontWeight:700, cursor:"pointer", background:C.primary,
            border:"none", color:"#fff", whiteSpace:"nowrap" }}>
          Buscar
        </button>

      {/* Filtro supervisor */}
      {cargo !== "vendedor" && supervisores.length > 0 && (
        <select value={filtroSup??""} onChange={e=>{setFiltroSup(e.target.value?Number(e.target.value):null);setFiltroVend(null)}}
          style={{ appearance:"none", border:`1px solid ${C.border}`, borderRadius:"6px",
            padding:"6px 28px 6px 10px", fontSize:"12px", outline:"none",
            cursor:"pointer", background:"#fff", color:filtroSup?C.text:C.textSub, minWidth:"150px" }}>
          <option value="">Todos supervisores</option>
          {supervisores.map(s => <option key={s.cod} value={s.cod}>{s.nome}</option>)}
        </select>
      )}

      {/* Filtro vendedor */}
      {cargo !== "vendedor" && (
        <div style={{ position:"relative" }}>
          <select value={filtroVend??""} onChange={e=>setFiltroVend(e.target.value?Number(e.target.value):null)}
            style={{ appearance:"none", border:`1px solid ${C.border}`, borderRadius:"6px",
              padding:"6px 28px 6px 10px", fontSize:"12px", outline:"none",
              cursor:"pointer", background:"#fff", color:filtroVend?C.text:C.textSub, minWidth:"170px" }}>
            <option value="">Todos os vendedores</option>
            {vendedores.map(v => <option key={v.cod} value={v.cod}>{v.nome}</option>)}
          </select>
          <ChevronDown size={12} style={{ position:"absolute", right:"8px", top:"50%",
            transform:"translateY(-50%)", pointerEvents:"none", color:C.textSub }}/>
        </div>
      )}

      {/* Busca numped/codcli/nome */}
      <div style={{ display:"flex", alignItems:"center", gap:"6px",
        border:`1px solid ${C.border}`, borderRadius:"6px",
        padding:"5px 10px", background:C.bg, flex: isMobile?"1":"0 0 auto" }}>
        <Search size={12} style={{ color:C.textSub }}/>
        <input
          value={busca} onChange={e=>setBusca(e.target.value)}
          placeholder="Nº pedido, cód. ou nome cliente..."
          style={{ border:"none", background:"transparent", fontSize:"12px",
            width: isMobile?"100%":"220px", outline:"none", color:C.text }}/>
        {busca && <button onClick={()=>setBusca("")}
          style={{ background:"none", border:"none", cursor:"pointer", color:C.textSub, padding:0 }}>
          <X size={12}/>
        </button>}
      </div>

      {/* Filtro por situação — badges clicáveis */}
      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
        {Object.entries(POSICAO).map(([pos, cfg]) => {
          const ativo = filtroStatus.has(pos);
          return (
            <button key={pos} onClick={() => toggleStatus(pos)}
              style={{ padding:"3px 10px", borderRadius:"10px", fontSize:"10px",
                fontWeight:600, cursor:"pointer", border:`1.5px solid ${ativo ? cfg.color : C.border}`,
                background: ativo ? cfg.bg : "#fff",
                color: ativo ? cfg.color : C.textSub,
                transition:"all .12s" }}>
              {cfg.label}
            </button>
          );
        })}
        {filtroStatus.size > 0 && (
          <button onClick={() => setFiltroStatus(new Set())}
            style={{ padding:"3px 8px", borderRadius:"10px", fontSize:"10px",
              fontWeight:600, cursor:"pointer", border:`1.5px solid ${C.red}`,
              background:"#fff", color:C.red }}>
            ✕ limpar
          </button>
        )}
      </div>

      {/* Totais inline */}
      {!isMobile && rows.length > 0 && (
        <div style={{ marginLeft:"auto", display:"flex", gap:"12px",
          fontSize:"11px", color:C.textSub }}>
          <span><b style={{color:C.text}}>{rows.length}</b> pedidos</span>
          {showCorte && totPerda > 0 && <span>Corte/Falta: <b style={{color:C.red}}>{fmtR(totPerda)}</b></span>}
          <span>Subtotal: <b style={{color:C.text}}>{fmtR(totSubtotal)}</b></span>
          <span>Total: <b style={{color:C.primary}}>{fmtR(totVlTotal)}</b></span>
        </div>
      )}
    </div>

    <TableCard>

      {loading && <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
        Carregando pedidos...
      </div>}
      {error && <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>}

      {!loading && !error && (
        <>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch",
          overflowY:"auto", maxHeight: isMobile?"60vh":"420px" }}>
          {isMobile ? (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <tbody>
                {rowsPagina.map((ped,i) => (
                  <PedidoRow key={ped.numped} ped={ped} i={(pagina-1)*PAGE_SIZE+i}
                    expandido={expanded.has(ped.numped)}
                    onToggle={() => toggleExpand(ped.numped)}
                    token={token} isMobile={true} showVendedor={showVendedor} showCorte={showCorte}/>
                ))}
                {rows.length === 0 && (
                  <tr><td style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
                    Nenhum pedido encontrado.
                  </td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
              <thead style={{ position:"sticky", top:0, zIndex:2 }}>
                <tr>
                  <TH label="" w="28px"/>
                  <TH label="PEDIDO"   col="numped"      w="80px"/>
                  <TH label="NOTA"     col="num_nota"    w="70px"/>
                  <TH label="DATA"     col="dt_pedido"   w="90px"/>
                  <TH label="COD. CLI" col="codcli"      w="75px" align="center"/>
                  <TH label="CLIENTE"  col="razao_social"/>
                  {showVendedor && <TH label="VENDEDOR"  col="nome_vendedor" w="140px"/>}
                  <TH label="SITUAÇÃO" col="posicao"     align="center" w="110px"/>
                  {showCorte && <TH label="CORTE/FALTA" col="perda_total" align="right" w="115px"/>}
                  <TH label="SUBTOTAL" col="subtotal_itens" align="right" w="115px"/>
                  <TH label="TOTAL"    col="vl_total"    align="right"  w="120px"/>
                </tr>
              </thead>
              <tbody>
                {rowsPagina.map((ped,i) => (
                  <PedidoRow key={ped.numped} ped={ped} i={(pagina-1)*PAGE_SIZE+i}
                    expandido={expanded.has(ped.numped)}
                    onToggle={() => toggleExpand(ped.numped)}
                    token={token} isMobile={false} showVendedor={showVendedor} showCorte={showCorte}/>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={(showVendedor?10:9)+(showCorte?1:0)} style={{ padding:"48px",
                    textAlign:"center", color:C.textSub }}>
                    Nenhum pedido encontrado.
                  </td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot style={{ position:"sticky", bottom:0, zIndex:2 }}>
                  <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                    <td colSpan={showVendedor?8:7} style={{ padding:"5px 8px",
                      border:"1px solid #880000" }}>
                      TOTAL — {rows.length} pedidos
                    </td>
                    {showCorte && (
                      <td style={{ padding:"5px 8px", border:"1px solid #880000",
                        textAlign:"right", fontFamily:C.mono,
                        color: totPerda > 0 ? "#FCA5A5" : "inherit" }}>
                        {totPerda > 0 ? fmtR(totPerda) : "—"}
                      </td>
                    )}
                    <td style={{ padding:"5px 8px", border:"1px solid #880000",
                      textAlign:"right", fontFamily:C.mono }}>{fmtR(totSubtotal)}</td>
                    <td style={{ padding:"5px 8px", border:"1px solid #880000",
                      textAlign:"right", fontFamily:C.mono }}>{fmtR(totVlTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            gap:"8px", padding:"8px 12px", borderTop:`1px solid ${C.border}`,
            background:"#FAFAFA", fontSize:"12px" }}>
            <button onClick={() => setPagina(p => Math.max(1,p-1))} disabled={pagina===1}
              style={{ padding:"4px 12px", border:`1px solid ${C.border}`, borderRadius:"4px",
                cursor:pagina===1?"not-allowed":"pointer", background:"#fff",
                color:pagina===1?C.textSub:C.text }}>
              ← Anterior
            </button>
            <span style={{ color:C.textSub }}>
              Página <b style={{color:C.text}}>{pagina}</b> de <b style={{color:C.text}}>{totalPaginas}</b>
              &nbsp;·&nbsp; {rows.length} pedidos
            </span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas,p+1))} disabled={pagina===totalPaginas}
              style={{ padding:"4px 12px", border:`1px solid ${C.border}`, borderRadius:"4px",
                cursor:pagina===totalPaginas?"not-allowed":"pointer", background:"#fff",
                color:pagina===totalPaginas?C.textSub:C.text }}>
              Próxima →
            </button>
          </div>
        )}
        </>
      )}
    </TableCard>

    <div style={{ height:"8px" }}/>

    {/* Ranking de vendas do período */}
    {!loading && !error && ranking.length > 0 && (
      <TableCard>

        <div style={{ padding:"8px 14px", background:`linear-gradient(90deg,${C.header},${C.primary})`,
          display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ color:C.gold, fontWeight:700, fontSize:"13px" }}>🏆</span>
          <span style={{ color:"#fff", fontWeight:700, fontSize:"13px" }}>
            Ranking de Vendas
          </span>
          <span style={{ color:"rgba(255,255,255,.65)", fontSize:"11px" }}>
            {dtIni === dtFim ? fmtDt(dtIni) : `${fmtDt(dtIni)} → ${fmtDt(dtFim)}`}
          </span>
          <span style={{ color:"rgba(255,255,255,.65)", fontSize:"11px", marginLeft:"auto" }}>
            {ranking.length} vendedores · {fmtR(totVlTotal)}
          </span>
        </div>

        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr>
                {["#","VENDEDOR","PEDIDOS","VALOR","% PART."].map((h,i) => (
                  <th key={h} style={{ padding:"5px 10px", background:C.subHeader,
                    color:"#fff", fontSize:"10px", fontWeight:700,
                    textAlign: i===0||i===2?"center": i>=3?"right":"left",
                    border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em",
                    whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((v,i) => {
                const pct = totVlTotal > 0 ? v.vl_total/totVlTotal*100 : 0;
                const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
                const bg = i%2===0 ? C.rowEven : C.rowOdd;
                const td = { padding:"6px 10px", borderBottom:`1px solid #EED0D0`,
                  background:bg, verticalAlign:"middle" };
                return (
                  <tr key={v.cod_vendedor}>
                    <td style={{ ...td, textAlign:"center", fontWeight:700,
                      color: i<3?C.primary:C.textSub, fontSize: i<3?"13px":"11px" }}>
                      {medal ?? i+1}
                    </td>
                    <td style={{ ...td, fontWeight: i<3?600:400 }}>
                      {v.nome_vendedor}
                    </td>
                    <td style={{ ...td, textAlign:"center", fontFamily:C.mono,
                      color:C.textSub }}>
                      {v.qtd}
                    </td>
                    <td style={{ ...td, textAlign:"right", fontFamily:C.mono,
                      fontWeight:600, color:C.primary }}>
                      {fmtR(v.vl_total)}
                    </td>
                    <td style={{ ...td, textAlign:"right" }}>
                      <div style={{ display:"flex", alignItems:"center",
                        gap:"6px", justifyContent:"flex-end" }}>
                        <div style={{ width:"60px", height:"6px", borderRadius:"3px",
                          background:"#EED0D0", overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%",
                            background: i===0?C.gold:i===1?"#C0C0C0":i===2?"#CD7F32":C.primary,
                            borderRadius:"3px" }}/>
                        </div>
                        <span style={{ fontFamily:C.mono, fontSize:"11px",
                          color:C.textSub, minWidth:"36px", textAlign:"right" }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TableCard>
    )}
  </>);
}