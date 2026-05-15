import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, ChevronDown, ChevronRight, Settings, Eye,
         Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C, fmtPct, pctStyle, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const fmtQtd = (v, unidade) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${unidade === "CX" ? "cx" : "un"}`;

const arrow = (p) => {
  if (p == null) return <span style={{ color:"#ccc" }}>—</span>;
  const [bg, shadow, Icon] =
    p >= 100 ? [C.green, "rgba(22,163,74,.5)",  TrendingUp  ] :
    p >= 90  ? [C.amber, "rgba(217,119,6,.5)",  Minus       ] :
               [C.red,   "rgba(220,38,38,.5)",  TrendingDown];
  return (
    <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                  width:"24px", height:"24px", borderRadius:"50%",
                  background:bg, boxShadow:`0 2px 4px ${shadow}` }}>
      <Icon size={12} color="#fff" strokeWidth={2.5}/>
    </div>
  );
};

// ── Linha de vendedor expansível ──────────────────────────────────────────────
function VendedorRow({ v, unidade, isExpanded, onToggle }) {
  const pct = v.pct_ating;
  const td  = (extra={}) => ({
    padding:"7px 8px", borderBottom:`1px solid ${C.border}`,
    verticalAlign:"middle", background:"#fff", ...extra,
  });
  return (
    <>
      <tr onClick={onToggle} style={{ cursor:"pointer" }}
          onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
          onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
        <td style={td({ width:"32px", textAlign:"center" })}>
          {isExpanded
            ? <ChevronDown  size={14} color={C.textSub}/>
            : <ChevronRight size={14} color={C.textSub}/>}
        </td>
        <td style={td({ fontWeight:700 })}>
          {v.nome_vendedor}
          <span style={{ fontSize:"10px", color:C.textSub, fontFamily:C.mono, marginLeft:"6px" }}>#{v.cod_vendedor}</span>
        </td>
        <td style={td({ textAlign:"right", fontFamily:C.mono })}>
          {v.meta > 0 ? fmtQtd(v.meta, unidade) : <span style={{color:C.textSub}}>—</span>}
        </td>
        <td style={td({ textAlign:"right", fontFamily:C.mono, fontWeight:600 })}>
          {fmtQtd(v.qt_realizado, unidade)}
        </td>
        <td style={td({ textAlign:"center" })}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
        <td style={td({ textAlign:"right", fontFamily:C.mono, fontWeight:600, color:C.primary })}>
          {fmtQtd(v.qt_dia, unidade)}
        </td>
        <td style={td({ textAlign:"center" })}>{arrow(pct)}</td>
      </tr>
      {isExpanded && v.produtos.map(p => (
        <tr key={p.codprod} style={{ background:"#FFFAF0" }}>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}` }}/>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}`,
                       paddingLeft:"24px", fontSize:"11px", color:C.textSub }}>
            <span style={{ fontFamily:C.mono, marginRight:"6px", color:C.primary }}>#{p.codprod}</span>
            {p.descricao}
          </td>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}` }}/>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}`,
                       textAlign:"right", fontFamily:C.mono, fontSize:"11px" }}>
            {fmtQtd(p.qt_realizado, unidade)}
          </td>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}` }}/>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}`,
                       textAlign:"right", fontFamily:C.mono, fontSize:"11px" }}>
            {fmtQtd(p.qt_dia, unidade)}
          </td>
          <td style={{ padding:"5px 8px", borderBottom:`1px dashed ${C.border}` }}/>
        </tr>
      ))}
    </>
  );
}

// ── Aba Acompanhamento ────────────────────────────────────────────────────────
function Acompanhamento({ campanha, token, cargo, isMobile }) {
  const [grupos,    setGrupos]    = useState([]);   // [{cod_supervisor, vendedores}]
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState({});
  const [supFiltro, setSupFiltro] = useState(null);
  const hoje = getToday();

  // Fornecedor = time machine: max é o fim da semana da campanha (vê a semana completa)
  // Vendedor   = só vigente:   max é hoje, nunca ultrapassa
  // Outros     = min(semana_fim, hoje)
  const maxData = cargo === "fornecedor"
    ? campanha.semana_fim
    : cargo === "vendedor"
      ? hoje
      : (campanha.semana_fim < hoje ? campanha.semana_fim : hoje);

  const defaultData = cargo === "vendedor"
    ? hoje
    : maxData;   // fornecedor abre no último dia da campanha

  const [dataRef, setDataRef] = useState(defaultData);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDados = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${API_BASE}/api/bl/campanhas/${campanha.id}/dados?data=${dataRef}`;
      if (supFiltro) url += `&filtro_supervisor=${supFiltro}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGrupos((await res.json()).dados ?? []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [campanha.id, dataRef, supFiltro, headers]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const unidade = campanha.unidade;
  const allVendedores = grupos.flatMap(g => g.vendedores ?? []);
  const tot = {
    meta: allVendedores.reduce((s,v) => s+(v.meta??0), 0),
    real: allVendedores.reduce((s,v) => s+(v.qt_realizado??0), 0),
    dia:  allVendedores.reduce((s,v) => s+(v.qt_dia??0), 0),
  };
  const totPct = tot.meta > 0 ? (tot.real / tot.meta) * 100 : null;

  const TH = ({ label, align }) => (
    <th style={{ padding:"6px 8px", background:C.subHeader, color:"#fff", fontSize:"10px",
                 fontWeight:700, textAlign:align??"left", whiteSpace:"nowrap",
                 border:`1px solid ${C.primaryDk}`, letterSpacing:"0.04em" }}>{label}</th>
  );

  const gruposFiltrados = supFiltro
    ? grupos.filter(g => g.cod_supervisor === supFiltro)
    : grupos;

  return (
    <>
      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:"8px 16px", display:"flex", alignItems:"center",
                    gap:"8px", flexWrap:"wrap" }}>

        {/* Filtro supervisor (gerencial/fornecedor) */}
        {(cargo === "gerencial" || cargo === "fornecedor") && grupos.length > 1 && (
          <div style={{ position:"relative" }}>
            <select value={supFiltro??""} onChange={e => setSupFiltro(e.target.value ? Number(e.target.value) : null)}
              style={{ appearance:"none", border:`1px solid ${C.border}`, borderRadius:"6px",
                       padding:"6px 28px 6px 10px", fontSize:"12px", fontFamily:C.sans,
                       color:supFiltro?C.text:C.textSub, cursor:"pointer", outline:"none" }}>
              <option value="">Todos supervisores</option>
              {grupos.map(g => (
                <option key={g.cod_supervisor} value={g.cod_supervisor}>
                  {g.vendedores?.[0]?.nome_supervisor ?? `#${g.cod_supervisor}`}
                </option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position:"absolute", right:"8px", top:"50%",
                                            transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
          </div>
        )}

        {/* Data — restrita à semana da campanha */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      border:`1px solid ${C.border}`, borderRadius:"6px",
                      padding:"5px 10px", background:"#fff", marginLeft:"auto" }}>
          <span style={{ fontSize:"11px", color:C.textSub, fontWeight:600 }}>Data</span>
          <input type="date" value={dataRef}
            min={campanha.semana_ini} max={maxData}
            onChange={e => setDataRef(e.target.value)}
            style={{ border:"none", outline:"none", fontSize:"12px",
                     fontFamily:C.mono, color:C.text, background:"transparent", cursor:"pointer" }}/>
          {dataRef !== hoje && hoje <= maxData && (
            <button onClick={() => setDataRef(hoje)}
              style={{ background:"none", border:"none", color:C.primary,
                       cursor:"pointer", fontSize:"11px", fontWeight:700 }}>hoje</button>
          )}
        </div>

        <button onClick={fetchDados} disabled={loading}
          style={{ background:"rgba(0,0,0,.08)", border:`1px solid ${C.border}`,
                   color:C.text, padding:"6px 10px", borderRadius:"6px",
                   cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
          <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ margin:"12px 16px" }}>
        {loading && (
          <div style={{ padding:"16px" }}>
            {[...Array(4)].map((_,i) => (
              <div key={i} style={{ height:"36px", background:C.rowEven, borderRadius:"4px",
                                    marginBottom:"6px", animation:"pulse 1.5s ease-in-out infinite",
                                    animationDelay:(i*.1)+"s" }}/>
            ))}
          </div>
        )}
        {error && <div style={{ padding:"30px", textAlign:"center", color:C.red }}>{error}</div>}

        {!loading && !error && gruposFiltrados.map(grupo => {
          const vends = grupo.vendedores ?? [];
          const nomeSup = vends[0]?.nome_supervisor ?? `Supervisor #${grupo.cod_supervisor}`;
          return (
            <div key={grupo.cod_supervisor} style={{ background:"#fff",
                  border:`1px solid ${C.border}`, borderRadius:"4px",
                  overflow:"hidden", boxShadow:`0 1px 6px rgba(170,0,0,.1)`, marginBottom:"12px" }}>
              {/* Cabeçalho do grupo */}
              <div style={{ padding:"7px 12px", background:"#f8f8f8",
                            borderBottom:`1px solid ${C.border}`,
                            fontSize:"12px", fontWeight:700, color:C.text }}>
                {nomeSup}
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                  <thead>
                    <tr>
                      <TH label=""/>
                      <TH label="VENDEDOR"/>
                      <TH label="META"        align="right"/>
                      <TH label="REALIZADO"   align="right"/>
                      <TH label="% ATING"     align="center"/>
                      <TH label="REALIZ. DIA" align="right"/>
                      <TH label="STATUS"      align="center"/>
                    </tr>
                  </thead>
                  <tbody>
                    {vends.map(v => {
                      const key = `${grupo.cod_supervisor}_${v.cod_vendedor}`;
                      return (
                        <VendedorRow key={key} v={v} unidade={unidade}
                          isExpanded={!!expanded[key]}
                          onToggle={() => setExpanded(ex => ({ ...ex, [key]: !ex[key] }))}/>
                      );
                    })}
                  </tbody>
                  {vends.length > 0 && (
                    <tfoot>
                      <tr style={{ background:C.total, color:C.totalTxt, fontWeight:700 }}>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }}/>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }}>
                          TOTAL ({vends.length})
                        </td>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                          {fmtQtd(vends.reduce((s,v)=>s+(v.meta??0),0), unidade)}
                        </td>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                          {fmtQtd(vends.reduce((s,v)=>s+(v.qt_realizado??0),0), unidade)}
                        </td>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"center" }}>
                          {(() => {
                            const m = vends.reduce((s,v)=>s+(v.meta??0),0);
                            const r = vends.reduce((s,v)=>s+(v.qt_realizado??0),0);
                            const p = m>0?(r/m)*100:null;
                            return <span style={pctStyle(p)}>{fmtPct(p)}</span>;
                          })()}
                        </td>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}`, textAlign:"right", fontFamily:C.mono }}>
                          {fmtQtd(vends.reduce((s,v)=>s+(v.qt_dia??0),0), unidade)}
                        </td>
                        <td style={{ padding:"6px 8px", border:`1px solid ${C.primaryDk}` }}/>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })}

        {!loading && !error && allVendedores.length === 0 && (
          <div style={{ padding:"40px", textAlign:"center", color:C.textSub }}>Nenhum dado.</div>
        )}
      </div>
    </>
  );
}

// ── Aba Configuração (por supervisor) ─────────────────────────────────────────
function Configuracao({ campanha, token, isMobile }) {
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const [todosVendData, setTodosVendData] = useState([]);  // dados brutos do faturamento
  const [supervisores,  setSupervisores]  = useState([]);
  const [supSel,        setSupSel]        = useState(null);
  const [todosProdutos, setTodosProdutos] = useState([]);
  const [habilitados,   setHabilitados]   = useState(new Set());
  const [vendedores,    setVendedores]    = useState([]);
  const [metas,         setMetas]         = useState({});
  const [loadingSup,    setLoadingSup]    = useState(false);
  const [salvando,      setSalvando]      = useState(false);
  const [msg,           setMsg]           = useState("");
  const [searchProd,    setSearchProd]    = useState("");

  // Carrega produtos da seção + dados do faturamento para derivar supervisores/vendedores ativos
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/bl/produtos/buscar?codsec=${campanha.codsec}`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/faturamento`, { headers }).then(r => r.json()),
    ]).then(([jProd, jFat]) => {
      setTodosProdutos(jProd.dados ?? []);

      // Deriva supervisores únicos dos dados reais de venda
      const rows = jFat.dados ?? [];
      setTodosVendData(rows);
      const supMap = new Map();
      rows.forEach(r => {
        if (r.cod_supervisor && !supMap.has(r.cod_supervisor))
          supMap.set(r.cod_supervisor, r.nome_supervisor);
      });
      setSupervisores(
        Array.from(supMap.entries())
          .map(([cod_supervisor, nome_supervisor]) => ({ cod_supervisor, nome_supervisor }))
          .sort((a, b) => a.nome_supervisor.localeCompare(b.nome_supervisor))
      );
    }).catch(() => {});
  }, [campanha.id]);

  // Ao trocar supervisor: extrai vendedores do faturamento + carrega config salva
  useEffect(() => {
    if (!supSel) return;
    setLoadingSup(true);

    // Vendedores do supervisor derivados dos dados reais de venda
    const vendMap = new Map();
    todosVendData.forEach(r => {
      if (r.cod_supervisor === supSel && r.cod_vendedor && !vendMap.has(r.cod_vendedor))
        vendMap.set(r.cod_vendedor, r.nome_vendedor);
    });
    setVendedores(
      Array.from(vendMap.entries())
        .map(([cod_vendedor, nome_vendedor]) => ({ cod_vendedor, nome_vendedor }))
        .sort((a, b) => a.nome_vendedor.localeCompare(b.nome_vendedor))
    );

    // Carrega produtos e metas salvos para este supervisor
    Promise.all([
      fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/produtos`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`,   { headers }).then(r => r.json()),
    ]).then(([jProd, jMetas]) => {
      setHabilitados(new Set((jProd.dados ?? []).map(p => p.codprod)));
      const m = {};
      (jMetas.dados ?? []).forEach(x => { m[x.cod_vendedor] = x.meta; });
      setMetas(m);
    }).catch(() => {}).finally(() => setLoadingSup(false));
  }, [supSel, campanha.id, todosVendData]);

  const prodFiltrados = useMemo(() => {
    if (!searchProd.trim()) return todosProdutos;
    const s = searchProd.toLowerCase();
    return todosProdutos.filter(p =>
      p.descricao?.toLowerCase().includes(s) || String(p.codprod).includes(s));
  }, [todosProdutos, searchProd]);

  const todosChecked = prodFiltrados.length > 0
    && prodFiltrados.every(p => habilitados.has(p.codprod));

  const toggleTodos = () => {
    const cods = prodFiltrados.map(p => p.codprod);
    setHabilitados(prev => {
      const next = new Set(prev);
      cods.forEach(c => todosChecked ? next.delete(c) : next.add(c));
      return next;
    });
  };

  const salvar = async () => {
    if (!supSel) return;
    setSalvando(true); setMsg("");
    try {
      const prodMap = Object.fromEntries(todosProdutos.map(p => [p.codprod, p.descricao]));
      await Promise.all([
        fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/produtos`, {
          method:"PUT", headers,
          body: JSON.stringify({ cod_supervisor:supSel, codprods:[...habilitados], prod_map:prodMap }),
        }),
        fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`, {
          method:"PUT", headers,
          body: JSON.stringify({
            cod_supervisor: supSel,
            metas: Object.entries(metas).map(([k,v]) => ({ cod_vendedor:Number(k), meta:Number(v)||0 })),
          }),
        }),
      ]);
      setMsg(`Salvo! ${habilitados.size} produto(s).`);
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("Erro ao salvar."); }
    finally { setSalvando(false); }
  };

  const unLabel = campanha.unidade === "CX" ? "cx" : "un";
  const TH = ({ l, w }) => (
    <th style={{ padding:"6px 8px", background:"#BB2200", color:"#fff",
                 fontSize:"10px", fontWeight:700, border:`1px solid ${C.primaryDk}`,
                 width:w??"auto", textAlign:"center" }}>{l}</th>
  );

  return (
    <div style={{ padding:"16px" }}>
      {/* Dropdown supervisor */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
        <span style={{ fontSize:"12px", fontWeight:600, color:C.text }}>Configurar supervisor:</span>
        <div style={{ position:"relative", minWidth:"260px" }}>
          <select value={supSel??""} onChange={e => setSupSel(e.target.value ? Number(e.target.value) : null)}
            style={{ appearance:"none", border:`1px solid ${C.border}`, borderRadius:"6px",
                     padding:"7px 28px 7px 10px", fontSize:"12px", fontFamily:C.sans,
                     color:supSel?C.text:C.textSub, cursor:"pointer", outline:"none", width:"100%" }}>
            <option value="">Selecione um supervisor...</option>
            {supervisores.map(s => (
              <option key={s.cod_supervisor} value={s.cod_supervisor}>{s.nome_supervisor}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
                                          transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
        </div>
      </div>

      {!supSel && (
        <div style={{ padding:"32px", textAlign:"center", color:C.textSub }}>
          Selecione um supervisor para configurar produtos e metas.
        </div>
      )}

      {supSel && loadingSup && (
        <div style={{ padding:"32px", textAlign:"center", color:C.textSub }}>Carregando...</div>
      )}

      {supSel && !loadingSup && (
        <>
          <div style={{ display:"grid",
                        gridTemplateColumns: isMobile ? "1fr" : "300px 1fr",
                        gap:"16px", alignItems:"start" }}>

            {/* Metas por vendedor */}
            <div style={{ background:"#fff", border:`1px solid ${C.border}`,
                          borderRadius:"8px", overflow:"hidden" }}>
              <div style={{ padding:"10px 14px", background:C.subHeader, color:"#fff",
                            fontWeight:700, fontSize:"12px" }}>
                META POR VENDEDOR
                <span style={{ fontSize:"10px", fontWeight:400, marginLeft:"6px",
                               color:"rgba(255,255,255,.75)" }}>({unLabel})</span>
              </div>
              <div style={{ maxHeight:"400px", overflowY:"auto" }}>
                {vendedores.length === 0 && (
                  <div style={{ padding:"20px", textAlign:"center", color:C.textSub, fontSize:"12px" }}>
                    Nenhum vendedor encontrado.
                  </div>
                )}
                {vendedores.map((v, i) => (
                  <div key={v.cod_vendedor}
                    style={{ display:"flex", alignItems:"center", gap:"10px",
                             padding:"8px 12px",
                             background: i%2===0 ? C.rowEven : C.rowOdd,
                             borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"12px", fontWeight:600,
                                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {v.nome_vendedor}
                      </div>
                      <div style={{ fontSize:"10px", color:C.textSub, fontFamily:C.mono }}>
                        #{v.cod_vendedor}
                      </div>
                    </div>
                    <input type="number" min="0" step="0.5"
                      value={metas[v.cod_vendedor] ?? ""}
                      placeholder="0"
                      onChange={e => setMetas(m => ({ ...m, [v.cod_vendedor]: e.target.value }))}
                      style={{ width:"72px", padding:"5px 8px", textAlign:"right",
                               border:`1px solid ${C.border}`, borderRadius:"4px",
                               fontSize:"12px", fontFamily:C.mono, outline:"none", flexShrink:0 }}/>
                    <span style={{ fontSize:"10px", color:C.textSub, width:"18px", flexShrink:0 }}>
                      {unLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Produtos elegíveis */}
            <div style={{ background:"#fff", border:`1px solid ${C.border}`,
                          borderRadius:"8px", overflow:"hidden" }}>
              <div style={{ padding:"10px 14px", background:C.subHeader, color:"#fff",
                            display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontWeight:700, fontSize:"12px" }}>PRODUTOS ELEGÍVEIS</span>
                <span style={{ fontSize:"10px", color:"rgba(255,255,255,.75)" }}>
                  {habilitados.size} de {todosProdutos.length}
                </span>
                <input placeholder="Filtrar..." value={searchProd}
                  onChange={e => setSearchProd(e.target.value)}
                  style={{ marginLeft:"auto", padding:"4px 8px", borderRadius:"4px",
                           border:"none", outline:"none", fontSize:"11px", width:"120px" }}/>
              </div>
              <div style={{ maxHeight:"400px", overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                  <thead style={{ position:"sticky", top:0 }}>
                    <tr>
                      <TH l={<input type="checkbox" checked={todosChecked} onChange={toggleTodos}
                               style={{ cursor:"pointer", width:"14px", height:"14px" }}/>} w="40px"/>
                      <TH l="CÓDIGO"  w="80px"/>
                      <TH l="PRODUTO"/>
                      <TH l="UN/CX"   w="60px"/>
                    </tr>
                  </thead>
                  <tbody>
                    {prodFiltrados.map((p, i) => {
                      const on = habilitados.has(p.codprod);
                      return (
                        <tr key={p.codprod}
                          onClick={() => setHabilitados(prev => {
                            const next = new Set(prev);
                            on ? next.delete(p.codprod) : next.add(p.codprod);
                            return next;
                          })}
                          style={{ cursor:"pointer", opacity:on?1:0.6,
                                   background: on ? (i%2===0?"#F0FFF4":"#E8FFF0")
                                                  : (i%2===0?C.rowEven:C.rowOdd) }}>
                          <td style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>
                            <input type="checkbox" checked={on} readOnly
                              style={{ cursor:"pointer", width:"14px", height:"14px" }}/>
                          </td>
                          <td style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}`,
                                       textAlign:"center", fontFamily:C.mono,
                                       color:C.primary, fontWeight:600, fontSize:"11px" }}>
                            {p.codprod}
                          </td>
                          <td style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}`,
                                       fontWeight:on?600:400 }}>
                            {p.descricao}
                          </td>
                          <td style={{ padding:"6px 8px", borderBottom:`1px solid ${C.border}`,
                                       textAlign:"center", color:C.textSub, fontSize:"11px" }}>
                            {p.qtunitcx??"—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {prodFiltrados.length === 0 && (
                  <div style={{ padding:"24px", textAlign:"center", color:C.textSub }}>
                    Nenhum produto.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop:"14px", display:"flex", alignItems:"center", gap:"12px" }}>
            <button onClick={salvar} disabled={salvando}
              style={{ background:C.primary, border:"none", color:"#fff",
                       padding:"10px 28px", borderRadius:"6px", cursor:"pointer",
                       fontSize:"13px", fontWeight:700, fontFamily:C.sans }}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            {msg && (
              <span style={{ fontSize:"12px", fontWeight:600,
                             color:msg.includes("Erro")?C.red:C.green }}>{msg}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────
export default function ModuleBateuLevou({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const [campanhas,   setCampanhas]   = useState([]);
  const [campanhaSel, setCampanhaSel] = useState(null);
  const [aba,         setAba]         = useState("acompanhar");
  const [loadingCamp, setLoadingCamp] = useState(false);
  const [showNova,    setShowNova]    = useState(false);
  const [editCamp,    setEditCamp]    = useState(null);   // campanha sendo editada
  const [editForm,    setEditForm]    = useState({});
  const [salvandoCamp,setSalvandoCamp]= useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [novaNome,    setNovaNome]    = useState("");
  const [novaCodsec,  setNovaCodsec]  = useState("");
  const [novaUnidade, setNovaUnidade] = useState("UN");
  const [novaIni,     setNovaIni]     = useState("");
  const [novaFim,     setNovaFim]     = useState("");
  const [criando,     setCriando]     = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const loadCampanhas = useCallback(async () => {
    setLoadingCamp(true);
    try {
      const res   = await fetch(`${API_BASE}/api/bl/campanhas`, { headers });
      const lista = (await res.json()).dados ?? [];

      // Vendedor só vê campanhas da semana vigente
      let visiveis = lista;
      if (cargo === "vendedor") {
        const semanaAtual = (() => {
          const d = new Date(); const day = d.getDay();
          d.setDate(d.getDate() - day);
          return d.toISOString().split("T")[0];
        })();
        visiveis = lista.filter(c => c.semana_ini === semanaAtual);
      }

      setCampanhas(visiveis);
      if (!campanhaSel && visiveis.length > 0) setCampanhaSel(visiveis[0]);
    } finally { setLoadingCamp(false); }
  }, [headers, cargo]);

  useEffect(() => { loadCampanhas(); }, [loadCampanhas]);

  const salvarEdicaoCamp = async () => {
    if (!editCamp) return;
    setSalvandoCamp(true);
    try {
      await fetch(`${API_BASE}/api/bl/campanhas/${editCamp.id}`, {
        method:"PUT", headers,
        body: JSON.stringify({
          nome:       editForm.nome       || editCamp.nome,
          semana_ini: editForm.semana_ini || editCamp.semana_ini,
          semana_fim: editForm.semana_fim || editCamp.semana_fim,
        }),
      });
      setEditCamp(null); setEditForm({});
      loadCampanhas();
    } finally { setSalvandoCamp(false); }
  };

  const deletarCamp = async () => {
    if (!campanhaSel) return;
    await fetch(`${API_BASE}/api/bl/campanhas/${campanhaSel.id}`, { method:"DELETE", headers });
    setConfirmDel(false); setCampanhaSel(null);
    loadCampanhas();
  };

  const criarCampanha = async () => {
    if (!novaNome || !novaCodsec || !novaIni || !novaFim) return;
    setCriando(true);
    try {
      await fetch(`${API_BASE}/api/bl/campanhas`, {
        method:"POST", headers,
        body: JSON.stringify({ nome:novaNome, codsec:Number(novaCodsec),
                               unidade:novaUnidade, semana_ini:novaIni, semana_fim:novaFim }),
      });
      setShowNova(false);
      setNovaNome(""); setNovaCodsec(""); setNovaIni(""); setNovaFim("");
      loadCampanhas();
    } finally { setCriando(false); }
  };

  const inp = (val, set, props={}) => (
    <input value={val} onChange={e => set(e.target.value)}
      style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
               fontSize:"12px", outline:"none", fontFamily:C.sans, ...props.style }}
      {...props}/>
  );

  return (
    <>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
                    padding:isMobile?"8px 12px":"10px 20px",
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    flexWrap:"wrap", gap:"8px", borderBottom:`3px solid ${C.gold}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div>
            <div style={{ fontWeight:900, fontSize:isMobile?"16px":"20px", color:"#fff",
                          letterSpacing:"0.06em", lineHeight:1 }}>PREMIUM</div>
            <div style={{ fontWeight:700, fontSize:"9px", color:C.gold, letterSpacing:"0.14em" }}>DISTRIBUIDORA</div>
          </div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:isMobile?"12px":"14px" }}>
            BATEU LEVOU
            {campanhaSel && (
              <span style={{ fontWeight:400, fontSize:"11px", color:"rgba(255,255,255,.8)", marginLeft:"8px" }}>
                — {campanhaSel.nome}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Seletor campanha + abas */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:"8px 16px", display:"flex", alignItems:"center",
                    gap:"8px", flexWrap:"wrap" }}>
        <div style={{ position:"relative", minWidth:"260px" }}>
          <select value={campanhaSel?.id??""} onChange={e => {
              const c = campanhas.find(x => x.id === Number(e.target.value));
              setCampanhaSel(c || null); setEditCamp(null); setConfirmDel(false);
            }}
            style={{ appearance:"none", border:`1px solid ${C.border}`, borderRadius:"6px",
                     padding:"7px 28px 7px 10px", fontSize:"12px", fontFamily:C.sans,
                     color:C.text, cursor:"pointer", outline:"none", width:"100%" }}>
            {loadingCamp
              ? <option>Carregando...</option>
              : campanhas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.semana_ini} → {c.semana_fim}) · {c.unidade}
                  </option>
                ))}
          </select>
          <ChevronDown size={13} style={{ position:"absolute", right:"8px", top:"50%",
                                          transform:"translateY(-50%)", color:C.textSub, pointerEvents:"none" }}/>
        </div>

        {/* Botões editar/excluir campanha (fornecedor dono + admin) */}
        {campanhaSel && (cargo === "fornecedor" || cargo === "admin") && (
          <>
            <button onClick={() => {
                setEditCamp(campanhaSel);
                setEditForm({ nome:campanhaSel.nome, semana_ini:campanhaSel.semana_ini, semana_fim:campanhaSel.semana_fim });
                setConfirmDel(false);
              }}
              title="Editar campanha"
              style={{ background:"#EBF5FF", border:"1px solid #BFDBFE", color:"#2563EB",
                       padding:"6px 10px", borderRadius:"6px", cursor:"pointer",
                       display:"flex", alignItems:"center", gap:"4px", fontSize:"12px" }}>
              ✏️
            </button>
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)}
                title="Excluir campanha"
                style={{ background:"#FFF0F0", border:`1px solid ${C.red}40`, color:C.red,
                         padding:"6px 10px", borderRadius:"6px", cursor:"pointer",
                         display:"flex", alignItems:"center", gap:"4px", fontSize:"12px" }}>
                🗑️
              </button>
            ) : (
              <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                <span style={{ fontSize:"11px", color:C.red, fontWeight:600 }}>Excluir "{campanhaSel.nome}"?</span>
                <button onClick={deletarCamp}
                  style={{ background:C.red, border:"none", color:"#fff",
                           padding:"5px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"11px", fontWeight:700 }}>
                  Sim
                </button>
                <button onClick={() => setConfirmDel(false)}
                  style={{ background:"#fff", border:`1px solid ${C.border}`, color:C.text,
                           padding:"5px 10px", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>
                  Não
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ display:"flex", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
          <button onClick={() => setAba("acompanhar")}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"6px 12px",
                     border:"none", cursor:"pointer", fontSize:"12px", fontFamily:C.sans,
                     background:aba==="acompanhar"?C.primary:"#fff",
                     color:aba==="acompanhar"?"#fff":C.text,
                     fontWeight:aba==="acompanhar"?700:400,
                     borderRight:`1px solid ${C.border}` }}>
            <Eye size={13}/> Acompanhar
          </button>
          {(cargo === "fornecedor" || cargo === "gerencial") && (
            <button onClick={() => setAba("configurar")}
              style={{ display:"flex", alignItems:"center", gap:"5px", padding:"6px 12px",
                       border:"none", cursor:"pointer", fontSize:"12px", fontFamily:C.sans,
                       background:aba==="configurar"?C.primary:"#fff",
                       color:aba==="configurar"?"#fff":C.text,
                       fontWeight:aba==="configurar"?700:400 }}>
              <Settings size={13}/> Configurar
            </button>
          )}
        </div>

        {(cargo === "fornecedor" || cargo === "gerencial") && (
          <button onClick={() => setShowNova(v => !v)}
            style={{ display:"flex", alignItems:"center", gap:"5px", marginLeft:"auto",
                     background:showNova?C.primaryDk:C.primary, border:"none", color:"#fff",
                     padding:"6px 12px", borderRadius:"6px", cursor:"pointer",
                     fontSize:"12px", fontFamily:C.sans, fontWeight:700 }}>
            <Plus size={14}/> Nova campanha
          </button>
        )}
      </div>

      {/* Form editar campanha */}
      {editCamp && (
        <div style={{ margin:"12px 16px", padding:"14px", background:"#EBF5FF",
                      border:"1px solid #BFDBFE", borderRadius:"8px" }}>
          <div style={{ fontWeight:700, fontSize:"13px", marginBottom:"10px", color:"#2563EB" }}>
            Editar campanha
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", alignItems:"flex-end" }}>
            <input value={editForm.nome??""} placeholder="Nome"
              onChange={e => setEditForm(f => ({...f, nome:e.target.value}))}
              style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                       fontSize:"12px", outline:"none", minWidth:"200px", flex:2 }}/>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontSize:"11px", color:C.textSub }}>De</span>
              <input type="date" value={editForm.semana_ini??""}
                onChange={e => setEditForm(f => ({...f, semana_ini:e.target.value}))}
                style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                         fontSize:"12px", outline:"none" }}/>
              <span style={{ fontSize:"11px", color:C.textSub }}>até</span>
              <input type="date" value={editForm.semana_fim??""}
                onChange={e => setEditForm(f => ({...f, semana_fim:e.target.value}))}
                style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                         fontSize:"12px", outline:"none" }}/>
            </div>
            <button onClick={salvarEdicaoCamp} disabled={salvandoCamp}
              style={{ background:"#2563EB", border:"none", color:"#fff", padding:"7px 18px",
                       borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              {salvandoCamp ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setEditCamp(null); setEditForm({}); }}
              style={{ background:"#fff", border:`1px solid ${C.border}`, color:C.text,
                       padding:"7px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Form nova campanha */}
      {showNova && (
        <div style={{ margin:"12px 16px", padding:"16px", background:"#fff",
                      border:`1px solid ${C.border}`, borderRadius:"8px" }}>
          <div style={{ fontWeight:700, fontSize:"13px", marginBottom:"12px", color:C.primary }}>
            Nova campanha
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", alignItems:"flex-end" }}>
            {inp(novaNome,    setNovaNome,    { placeholder:"Nome da campanha", style:{minWidth:"200px",flex:2} })}
            {inp(novaCodsec,  setNovaCodsec,  { placeholder:"CODSEC", type:"number", style:{width:"100px"} })}
            <select value={novaUnidade} onChange={e => setNovaUnidade(e.target.value)}
              style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                       fontSize:"12px", outline:"none", fontFamily:C.sans }}>
              <option value="UN">Unidade (UN)</option>
              <option value="CX">Caixa (CX)</option>
            </select>
            {inp(novaIni, setNovaIni, { type:"date", style:{} })}
            {inp(novaFim, setNovaFim, { type:"date", style:{} })}
            <button onClick={criarCampanha} disabled={criando}
              style={{ background:C.green, border:"none", color:"#fff", padding:"7px 16px",
                       borderRadius:"6px", cursor:"pointer", fontSize:"12px",
                       fontFamily:C.sans, fontWeight:700 }}>
              {criando ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {campanhaSel ? (
        aba === "acompanhar"
          ? <Acompanhamento campanha={campanhaSel} token={token} cargo={cargo} isMobile={isMobile}/>
          : <Configuracao   campanha={campanhaSel} token={token} isMobile={isMobile}/>
      ) : (
        <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
          {loadingCamp ? "Carregando..." : "Nenhuma campanha. Crie uma acima."}
        </div>
      )}
    </>
  );
}