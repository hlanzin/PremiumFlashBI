import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, ChevronDown, ChevronRight, Settings, Eye,
         Plus, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { C, fmtPct, pctStyle, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const fmtQtd = (v, u) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})} ${u==="CX"?"cx":"un"}`;

const arrow = (p) => {
  if (p==null) return <span style={{color:"#ccc"}}>—</span>;
  const [bg,sh,Icon] = p>=100?[C.green,"rgba(22,163,74,.5)",TrendingUp]
    :p>=90?[C.amber,"rgba(217,119,6,.5)",Minus]
    :[C.red,"rgba(220,38,38,.5)",TrendingDown];
  return <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
    width:"24px",height:"24px",borderRadius:"50%",background:bg,boxShadow:`0 2px 4px ${sh}`}}>
    <Icon size={12} color="#fff" strokeWidth={2.5}/></div>;
};

const semanaAtualIni = () => {
  const d=new Date(), day=d.getDay();
  d.setDate(d.getDate()-day);
  return d.toISOString().split("T")[0];
};

// ── VendedorRow expansível ────────────────────────────────────────────────────
function VendedorRow({v, unidade, isExpanded, onToggle}) {
  const pct=v.pct_ating;
  const td=(ex={})=>({padding:"7px 8px",borderBottom:`1px solid ${C.border}`,
    verticalAlign:"middle",background:"#fff",...ex});
  return (<>
    <tr onClick={onToggle} style={{cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.background=C.rowHover}
        onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
      <td style={td({width:"32px",textAlign:"center"})}>
        {isExpanded?<ChevronDown size={14} color={C.textSub}/>:<ChevronRight size={14} color={C.textSub}/>}
      </td>
      <td style={td({fontWeight:700})}>
        {v.nome_vendedor}
        <span style={{fontSize:"10px",color:C.textSub,fontFamily:C.mono,marginLeft:"6px"}}>#{v.cod_vendedor}</span>
      </td>
      <td style={td({textAlign:"right",fontFamily:C.mono})}>
        {v.meta>0?fmtQtd(v.meta,unidade):<span style={{color:C.textSub}}>—</span>}
      </td>
      <td style={td({textAlign:"right",fontFamily:C.mono,fontWeight:600})}>{fmtQtd(v.qt_realizado,unidade)}</td>
      <td style={td({textAlign:"center"})}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={td({textAlign:"right",fontFamily:C.mono,fontWeight:600,color:C.primary})}>{fmtQtd(v.qt_dia,unidade)}</td>
      <td style={td({textAlign:"center"})}>{arrow(pct)}</td>
    </tr>
    {isExpanded && v.produtos.map(p=>(
      <tr key={p.codprod} style={{background:"#FFFAF0"}}>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`,
          paddingLeft:"24px",fontSize:"11px",color:C.textSub}}>
          <span style={{fontFamily:C.mono,marginRight:"6px",color:C.primary}}>#{p.codprod}</span>
          {p.descricao}
        </td>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`,
          textAlign:"right",fontFamily:C.mono,fontSize:"11px"}}>{fmtQtd(p.qt_realizado,unidade)}</td>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`,
          textAlign:"right",fontFamily:C.mono,fontSize:"11px"}}>{fmtQtd(p.qt_dia,unidade)}</td>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
      </tr>
    ))}
  </>);
}

// ── Tabela de acompanhamento (reutilizada em todos os layouts) ─────────────────
function TabelaAcompanhamento({grupos, unidade, loading, error, cargo}) {
  const [expanded, setExpanded] = useState({});
  const TH=({label,align})=>(
    <th style={{padding:"6px 8px",background:C.subHeader,color:"#fff",fontSize:"10px",
      fontWeight:700,textAlign:align??"left",whiteSpace:"nowrap",
      border:`1px solid ${C.primaryDk}`,letterSpacing:"0.04em"}}>{label}</th>
  );
  const allVends = grupos.flatMap(g=>g.vendedores??[]);
  if (loading) return <div style={{padding:"24px",textAlign:"center",color:C.textSub,fontSize:"12px"}}>
    Carregando...</div>;
  if (error)   return <div style={{padding:"24px",textAlign:"center",color:C.red,fontSize:"12px"}}>{error}</div>;
  if (!allVends.length) return <div style={{padding:"32px",textAlign:"center",color:C.textSub,fontSize:"12px"}}>
    Nenhum dado.</div>;
  return (
    <>{grupos.map(grupo=>{
      const vends=grupo.vendedores??[];
      const nomeSup=vends[0]?.nome_supervisor??`Supervisor #${grupo.cod_supervisor}`;
      const totM=vends.reduce((s,v)=>s+(v.meta??0),0);
      const totR=vends.reduce((s,v)=>s+(v.qt_realizado??0),0);
      const totD=vends.reduce((s,v)=>s+(v.qt_dia??0),0);
      const totP=totM>0?(totR/totM)*100:null;
      return (
        <div key={grupo.cod_supervisor} style={{marginBottom:"8px"}}>
          {grupos.length>1&&<div style={{padding:"5px 10px",background:"#f4f4f4",
            borderBottom:`1px solid ${C.border}`,fontSize:"11px",fontWeight:700,color:C.text}}>
            {nomeSup}
          </div>}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr>
                <TH label=""/><TH label="VENDEDOR"/>
                <TH label="META"        align="right"/>
                <TH label="REALIZADO"   align="right"/>
                <TH label="% ATING"     align="center"/>
                <TH label="REALIZ. DIA" align="right"/>
                <TH label="STATUS"      align="center"/>
              </tr></thead>
              <tbody>
                {vends.map(v=>{
                  const key=`${grupo.cod_supervisor}_${v.cod_vendedor}`;
                  return <VendedorRow key={key} v={v} unidade={unidade}
                    isExpanded={!!expanded[key]}
                    onToggle={()=>setExpanded(ex=>({...ex,[key]:!ex[key]}))}/>;
                })}
              </tbody>
              {vends.length>0&&(
                <tfoot>
                  <tr style={{background:C.total,color:C.totalTxt,fontWeight:700}}>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`}}/>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`}}>
                      TOTAL ({vends.length})
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"right",fontFamily:C.mono}}>
                      {fmtQtd(totM,unidade)}
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"right",fontFamily:C.mono}}>
                      {fmtQtd(totR,unidade)}
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"center"}}>
                      <span style={pctStyle(totP)}>{fmtPct(totP)}</span>
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"right",fontFamily:C.mono}}>
                      {fmtQtd(totD,unidade)}
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"center"}}>
                      {arrow(totP)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      );
    })}</>
  );
}

// ── Hook de dados de uma campanha ─────────────────────────────────────────────
function useCampanhaDados(campanha, token, filtroSup) {
  const [grupos,  setGrupos]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const hoje = getToday();
  const maxData = campanha.semana_fim < hoje ? campanha.semana_fim : hoje;
  const [dataRef, setDataRef] = useState(maxData);
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);

  // Reseta a data para o dia final da campanha sempre que a campanha mudar
  useEffect(()=>{ setDataRef(maxData); }, [campanha.id]);

  const fetch_ = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      let url=`${API_BASE}/api/bl/campanhas/${campanha.id}/dados?data=${dataRef}`;
      if (filtroSup) url+=`&filtro_supervisor=${filtroSup}`;
      const res=await fetch(url,{headers});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGrupos((await res.json()).dados??[]);
    } catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[campanha.id,dataRef,filtroSup,headers]);

  useEffect(()=>{fetch_();},[fetch_]);
  return {grupos,loading,error,dataRef,setDataRef,maxData,refetch:fetch_};
}

// ── Acompanhamento (layout compartilhado) ─────────────────────────────────────
function Acompanhamento({campanha, token, cargo, isMobile, filtroSup}) {
  const hoje = getToday();
  const {grupos,loading,error,dataRef,setDataRef,maxData,refetch} =
    useCampanhaDados(campanha, token, filtroSup);
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
  const [supFiltro,setSupFiltro]=useState(filtroSup??null);

  return (<>
    <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,
      padding:"6px 12px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>

      {(cargo==="gerencial"||cargo==="fornecedor"||cargo==="admin")&&grupos.length>1&&(
        <div style={{position:"relative"}}>
          <select value={supFiltro??""} onChange={e=>setSupFiltro(e.target.value?Number(e.target.value):null)}
            style={{appearance:"none",border:`1px solid ${C.border}`,borderRadius:"6px",
              padding:"5px 24px 5px 8px",fontSize:"11px",cursor:"pointer",outline:"none"}}>
            <option value="">Todos supervisores</option>
            {grupos.map(g=><option key={g.cod_supervisor} value={g.cod_supervisor}>
              {g.vendedores?.[0]?.nome_supervisor??`#${g.cod_supervisor}`}
            </option>)}
          </select>
          <ChevronDown size={11} style={{position:"absolute",right:"6px",top:"50%",
            transform:"translateY(-50%)",color:C.textSub,pointerEvents:"none"}}/>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:"5px",border:`1px solid ${C.border}`,
        borderRadius:"6px",padding:"4px 8px",marginLeft:"auto"}}>
        <span style={{fontSize:"10px",color:C.textSub,fontWeight:600}}>Data</span>
        <input type="date" value={dataRef}
          min={campanha.semana_ini} max={maxData}
          onChange={e=>setDataRef(e.target.value)}
          style={{border:"none",outline:"none",fontSize:"11px",fontFamily:C.mono,
            color:C.text,background:"transparent",cursor:"pointer"}}/>
      </div>
      <button onClick={refetch} disabled={loading}
        style={{background:"rgba(0,0,0,.07)",border:`1px solid ${C.border}`,
          padding:"5px 8px",borderRadius:"6px",cursor:"pointer",display:"flex",alignItems:"center"}}>
        <RefreshCw size={12} style={{animation:loading?"spin 1s linear infinite":"none"}}/>
      </button>
    </div>

    <div style={{margin:"8px 12px"}}>
      <TabelaAcompanhamento
        grupos={supFiltro?grupos.filter(g=>g.cod_supervisor===supFiltro):grupos}
        unidade={campanha.unidade} loading={loading} error={error} cargo={cargo}/>
    </div>
  </>);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO (sem mudanças estruturais)
// ─────────────────────────────────────────────────────────────────────────────
function Configuracao({campanha, token, isMobile}) {
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`,"Content-Type":"application/json"}),[token]);
  const [todosVendData,setTodosVendData]=useState([]);
  const [supervisores, setSupervisores] =useState([]);
  const [supSel,       setSupSel]       =useState(null);
  const [todosProdutos,setTodosProdutos]=useState([]);
  const [habilitados,  setHabilitados]  =useState(new Set());
  const [vendedores,   setVendedores]   =useState([]);
  const [metas,        setMetas]        =useState({});
  const [loadingSup,   setLoadingSup]   =useState(false);
  const [salvando,     setSalvando]     =useState(false);
  const [msg,          setMsg]          =useState("");
  const [searchProd,   setSearchProd]   =useState("");

  useEffect(()=>{
    Promise.all([
      fetch(`${API_BASE}/api/bl/produtos/buscar?codsec=${campanha.codsec}`,{headers}).then(r=>r.json()),
      fetch(`${API_BASE}/api/faturamento`,{headers}).then(r=>r.json()),
    ]).then(([jProd,jFat])=>{
      setTodosProdutos(jProd.dados??[]);
      const rows=jFat.dados??[];
      setTodosVendData(rows);
      const supMap=new Map();
      rows.forEach(r=>{if(r.cod_supervisor&&!supMap.has(r.cod_supervisor))supMap.set(r.cod_supervisor,r.nome_supervisor);});
      setSupervisores(Array.from(supMap.entries()).map(([cod_supervisor,nome_supervisor])=>({cod_supervisor,nome_supervisor}))
        .sort((a,b)=>a.nome_supervisor.localeCompare(b.nome_supervisor)));
    }).catch(()=>{});
  },[campanha.id]);

  useEffect(()=>{
    if(!supSel) return;
    setLoadingSup(true);
    const vendMap=new Map();
    todosVendData.forEach(r=>{if(r.cod_supervisor===supSel&&r.cod_vendedor&&!vendMap.has(r.cod_vendedor))vendMap.set(r.cod_vendedor,r.nome_vendedor);});
    setVendedores(Array.from(vendMap.entries()).map(([cod_vendedor,nome_vendedor])=>({cod_vendedor,nome_vendedor}))
      .sort((a,b)=>a.nome_vendedor.localeCompare(b.nome_vendedor)));
    Promise.all([
      fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/produtos`,{headers}).then(r=>r.json()),
      fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`,{headers}).then(r=>r.json()),
    ]).then(([jProd,jMetas])=>{
      setHabilitados(new Set((jProd.dados??[]).map(p=>p.codprod)));
      const m={};(jMetas.dados??[]).forEach(x=>{m[x.cod_vendedor]=x.meta;});setMetas(m);
    }).catch(()=>{}).finally(()=>setLoadingSup(false));
  },[supSel,campanha.id,todosVendData]);

  const prodFiltrados=useMemo(()=>{
    if(!searchProd.trim()) return todosProdutos;
    const s=searchProd.toLowerCase();
    return todosProdutos.filter(p=>p.descricao?.toLowerCase().includes(s)||String(p.codprod).includes(s));
  },[todosProdutos,searchProd]);

  const todosChecked=prodFiltrados.length>0&&prodFiltrados.every(p=>habilitados.has(p.codprod));
  const toggleTodos=()=>{const cods=prodFiltrados.map(p=>p.codprod);
    setHabilitados(prev=>{const next=new Set(prev);cods.forEach(c=>todosChecked?next.delete(c):next.add(c));return next;});};

  const salvar=async()=>{
    if(!supSel) return;
    setSalvando(true);setMsg("");
    try {
      const prodMap=Object.fromEntries(todosProdutos.map(p=>[p.codprod,p.descricao]));
      await Promise.all([
        fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/produtos`,{
          method:"PUT",headers,body:JSON.stringify({cod_supervisor:supSel,codprods:[...habilitados],prod_map:prodMap}),}),
        fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`,{
          method:"PUT",headers,body:JSON.stringify({cod_supervisor:supSel,
            metas:Object.entries(metas).map(([k,v])=>({cod_vendedor:Number(k),meta:Number(v)||0}))}),}),
      ]);
      setMsg(`Salvo! ${habilitados.size} produto(s).`);setTimeout(()=>setMsg(""),3000);
    } catch {setMsg("Erro ao salvar.");}
    finally {setSalvando(false);}
  };

  const unLabel=campanha.unidade==="CX"?"cx":"un";
  const TH=({l,w})=><th style={{padding:"6px 8px",background:"#BB2200",color:"#fff",
    fontSize:"10px",fontWeight:700,border:`1px solid ${C.primaryDk}`,width:w??"auto",textAlign:"center"}}>{l}</th>;

  return (<div style={{padding:"16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
      <span style={{fontSize:"12px",fontWeight:600,color:C.text}}>Configurar supervisor:</span>
      <div style={{position:"relative",minWidth:"240px"}}>
        <select value={supSel??""} onChange={e=>setSupSel(e.target.value?Number(e.target.value):null)}
          style={{appearance:"none",border:`1px solid ${C.border}`,borderRadius:"6px",
            padding:"7px 28px 7px 10px",fontSize:"12px",color:supSel?C.text:C.textSub,
            cursor:"pointer",outline:"none",width:"100%"}}>
          <option value="">Selecione um supervisor...</option>
          {supervisores.map(s=><option key={s.cod_supervisor} value={s.cod_supervisor}>{s.nome_supervisor}</option>)}
        </select>
        <ChevronDown size={13} style={{position:"absolute",right:"8px",top:"50%",
          transform:"translateY(-50%)",color:C.textSub,pointerEvents:"none"}}/>
      </div>
    </div>
    {!supSel&&<div style={{padding:"32px",textAlign:"center",color:C.textSub}}>Selecione um supervisor.</div>}
    {supSel&&loadingSup&&<div style={{padding:"32px",textAlign:"center",color:C.textSub}}>Carregando...</div>}
    {supSel&&!loadingSup&&(<>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"280px 1fr",gap:"16px",alignItems:"start"}}>
        <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:C.subHeader,color:"#fff",fontWeight:700,fontSize:"12px"}}>
            META POR VENDEDOR <span style={{fontSize:"10px",fontWeight:400,opacity:.75}}>({unLabel})</span>
          </div>
          <div style={{maxHeight:"400px",overflowY:"auto"}}>
            {vendedores.map((v,i)=>(
              <div key={v.cod_vendedor} style={{display:"flex",alignItems:"center",gap:"10px",
                padding:"8px 12px",background:i%2===0?C.rowEven:C.rowOdd,borderBottom:`1px solid ${C.border}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"12px",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.nome_vendedor}</div>
                  <div style={{fontSize:"10px",color:C.textSub,fontFamily:C.mono}}>#{v.cod_vendedor}</div>
                </div>
                <input type="number" min="0" step="0.5" value={metas[v.cod_vendedor]??""} placeholder="0"
                  onChange={e=>setMetas(m=>({...m,[v.cod_vendedor]:e.target.value}))}
                  style={{width:"72px",padding:"5px 8px",textAlign:"right",border:`1px solid ${C.border}`,
                    borderRadius:"4px",fontSize:"12px",fontFamily:C.mono,outline:"none",flexShrink:0}}/>
                <span style={{fontSize:"10px",color:C.textSub,width:"18px",flexShrink:0}}>{unLabel}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:C.subHeader,color:"#fff",display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontWeight:700,fontSize:"12px"}}>PRODUTOS ELEGÍVEIS</span>
            <span style={{fontSize:"10px",opacity:.75}}>{habilitados.size} de {todosProdutos.length}</span>
            <input placeholder="Filtrar..." value={searchProd} onChange={e=>setSearchProd(e.target.value)}
              style={{marginLeft:"auto",padding:"4px 8px",borderRadius:"4px",border:"none",outline:"none",fontSize:"11px",width:"120px"}}/>
          </div>
          <div style={{maxHeight:"400px",overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead style={{position:"sticky",top:0}}>
                <tr>
                  <TH l={<input type="checkbox" checked={todosChecked} onChange={toggleTodos}
                    style={{cursor:"pointer",width:"14px",height:"14px"}}/>} w="40px"/>
                  <TH l="CÓDIGO" w="80px"/><TH l="PRODUTO"/><TH l="UN/CX" w="60px"/>
                </tr>
              </thead>
              <tbody>
                {prodFiltrados.map((p,i)=>{const on=habilitados.has(p.codprod); return (
                  <tr key={p.codprod} onClick={()=>setHabilitados(prev=>{const next=new Set(prev);on?next.delete(p.codprod):next.add(p.codprod);return next;})}
                    style={{cursor:"pointer",opacity:on?1:0.6,background:on?(i%2===0?"#F0FFF4":"#E8FFF0"):(i%2===0?C.rowEven:C.rowOdd)}}>
                    <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.border}`,textAlign:"center"}}>
                      <input type="checkbox" checked={on} readOnly style={{cursor:"pointer",width:"14px",height:"14px"}}/></td>
                    <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.border}`,textAlign:"center",fontFamily:C.mono,color:C.primary,fontWeight:600,fontSize:"11px"}}>{p.codprod}</td>
                    <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.border}`,fontWeight:on?600:400}}>{p.descricao}</td>
                    <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.border}`,textAlign:"center",color:C.textSub,fontSize:"11px"}}>{p.qtunitcx??"—"}</td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{marginTop:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
        <button onClick={salvar} disabled={salvando}
          style={{background:C.primary,border:"none",color:"#fff",padding:"10px 28px",
            borderRadius:"6px",cursor:"pointer",fontSize:"13px",fontWeight:700}}>
          {salvando?"Salvando...":"Salvar"}
        </button>
        {msg&&<span style={{fontSize:"12px",fontWeight:600,color:msg.includes("Erro")?C.red:C.green}}>{msg}</span>}
      </div>
    </>)}
  </div>);
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER padrão do módulo
// ─────────────────────────────────────────────────────────────────────────────
function ModuleHeader({isMobile, titulo}) {
  if (isMobile) return null;
  return (
    <div style={{background:`linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
      padding:isMobile?"8px 12px":"10px 20px",display:"flex",alignItems:"center",
      gap:"12px",borderBottom:`3px solid ${C.gold}`}}>
      <div>
        <div style={{fontWeight:900,fontSize:isMobile?"16px":"20px",color:"#fff",letterSpacing:"0.06em",lineHeight:1}}>PREMIUM</div>
        <div style={{fontWeight:700,fontSize:"9px",color:C.gold,letterSpacing:"0.14em"}}>DISTRIBUIDORA</div>
      </div>
      <div style={{color:"#fff",fontWeight:700,fontSize:isMobile?"12px":"14px"}}>{titulo}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW VENDEDOR — todas as campanhas da semana vigente, layout simples
// ─────────────────────────────────────────────────────────────────────────────
function CampanhaVendedor({campanha, token}) {
  const {grupos, loading, error, dataRef, setDataRef, maxData, refetch} =
    useCampanhaDados(campanha, token, null);

  return (
    <div style={{ background:"#fff", border:`1px solid ${C.border}`,
                  borderRadius:"8px", overflow:"hidden", marginBottom:"16px",
                  boxShadow:`0 1px 6px rgba(0,0,0,.07)` }}>
      {/* Cabeçalho da campanha */}
      <div style={{ background:`linear-gradient(135deg,${C.header},${C.primary})`,
                    padding:"10px 14px", display:"flex", alignItems:"center",
                    justifyContent:"space-between", flexWrap:"wrap", gap:"8px" }}>
        <div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:"13px" }}>{campanha.nome}</div>
          <div style={{ color:"rgba(255,255,255,.7)", fontSize:"10px", marginTop:"2px" }}>
            {campanha.semana_ini} → {campanha.semana_fim} · {campanha.unidade}
          </div>
        </div>
        <button onClick={refetch} disabled={loading}
          style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff",
                   padding:"5px 8px", borderRadius:"5px", cursor:"pointer",
                   display:"flex", alignItems:"center" }}>
          <RefreshCw size={12} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
        </button>
      </div>

      {/* Tabela */}
      <TabelaAcompanhamento grupos={grupos} unidade={campanha.unidade}
        loading={loading} error={error} cargo="vendedor"/>
    </div>
  );
}

function VendedorView({token, userInfo, isMobile}) {
  const [campanhas, setCampanhas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);

  useEffect(()=>{
    const hoje = getToday();
    fetch(`${API_BASE}/api/bl/campanhas`,{headers})
      .then(r=>r.json())
      .then(j=>{
        // Mostra campanhas onde hoje está dentro do período (semana_ini <= hoje <= semana_fim)
        const lista = (j.dados??[]).filter(c =>
          c.semana_ini <= hoje && c.semana_fim >= hoje
        );
        setCampanhas(lista);
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[headers]);

  return (<>
    <ModuleHeader isMobile={isMobile} titulo="BATEU LEVOU"/>
    <div style={{ padding:"12px 16px" }}>
      {loading && (
        <div style={{ textAlign:"center", padding:"48px", color:C.textSub }}>
          Carregando campanhas...
        </div>
      )}
      {!loading && campanhas.length === 0 && (
        <div style={{ textAlign:"center", padding:"48px", color:C.textSub }}>
          Nenhuma campanha ativa esta semana.
        </div>
      )}
      {!loading && campanhas.map(c=>(
        <CampanhaVendedor key={c.id} campanha={c} token={token}/>
      ))}
    </div>
  </>);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW FORNECEDOR — painel lateral com lista de campanhas
// ─────────────────────────────────────────────────────────────────────────────
function FornecedorView({token, userInfo, isMobile}) {
  const [campanhas,    setCampanhas]    = useState([]);
  const [campanhaSel,  setCampanhaSel]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [aba,          setAba]          = useState("acompanhar");
  const [busca,        setBusca]        = useState("");
  const [showNova,     setShowNova]     = useState(false);
  const [showPanel,    setShowPanel]    = useState(!isMobile);
  const [editCamp,     setEditCamp]     = useState(null);
  const [editForm,     setEditForm]     = useState({});
  const [salvandoCamp, setSalvandoCamp] = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [novaNome,     setNovaNome]     = useState("");
  const [novaCodsec,   setNovaCodsec]   = useState("");
  const [novaUnidade,  setNovaUnidade]  = useState("UN");
  const [novaIni,      setNovaIni]      = useState("");
  const [novaFim,      setNovaFim]      = useState("");
  const [criando,      setCriando]      = useState(false);

  const headers = useMemo(()=>({Authorization:`Bearer ${token}`,"Content-Type":"application/json"}),[token]);
  const hoje = getToday();

  const loadCampanhas = useCallback(async()=>{
    setLoading(true);
    try {
      const j=await fetch(`${API_BASE}/api/bl/campanhas`,{headers}).then(r=>r.json());
      const lista=j.dados??[];
      setCampanhas(lista);
      if(!campanhaSel&&lista.length>0) setCampanhaSel(lista[0]);
    } finally {setLoading(false);}
  },[headers]);

  useEffect(()=>{loadCampanhas();},[loadCampanhas]);

  // Agrupa por semana
  const grupos = useMemo(()=>{
    const filtradas = busca.trim()
      ? campanhas.filter(c=>c.nome.toLowerCase().includes(busca.toLowerCase()))
      : campanhas;
    const map = new Map();
    filtradas.forEach(c=>{
      const key=c.semana_ini;
      if(!map.has(key)) map.set(key,[]);
      map.get(key).push(c);
    });
    return Array.from(map.entries())
      .sort(([a],[b])=>b.localeCompare(a)) // mais recente primeiro
      .map(([semana,lista])=>({semana,lista}));
  },[campanhas,busca]);

  const salvarEdicao=async()=>{
    if(!editCamp) return;
    setSalvandoCamp(true);
    try {
      await fetch(`${API_BASE}/api/bl/campanhas/${editCamp.id}`,{
        method:"PUT",headers,
        body:JSON.stringify({nome:editForm.nome||editCamp.nome,
          semana_ini:editForm.semana_ini||editCamp.semana_ini,
          semana_fim:editForm.semana_fim||editCamp.semana_fim}),
      });
      setEditCamp(null);setEditForm({});loadCampanhas();
    } finally {setSalvandoCamp(false);}
  };

  const deletar=async()=>{
    if(!campanhaSel) return;
    await fetch(`${API_BASE}/api/bl/campanhas/${campanhaSel.id}`,{method:"DELETE",headers});
    setConfirmDel(false);setCampanhaSel(null);loadCampanhas();
  };

  const criarCampanha=async()=>{
    if(!novaNome||!novaCodsec||!novaIni||!novaFim) return;
    setCriando(true);
    try {
      await fetch(`${API_BASE}/api/bl/campanhas`,{method:"POST",headers,
        body:JSON.stringify({nome:novaNome,codsec:Number(novaCodsec),
          unidade:novaUnidade,semana_ini:novaIni,semana_fim:novaFim})});
      setShowNova(false);setNovaNome("");setNovaCodsec("");setNovaIni("");setNovaFim("");
      loadCampanhas();
    } finally {setCriando(false);}
  };

  const encerrada = campanhaSel && campanhaSel.semana_fim < hoje;

  return (<>
    <ModuleHeader isMobile={isMobile} titulo="BATEU LEVOU"/>

    {/* ── MOBILE: lista em tela cheia → detalhe em tela cheia ── */}
    {isMobile ? (
      <>
        {/* Tela da lista */}
        {(!campanhaSel || showPanel) && (
          <div style={{display:"flex",flexDirection:"column",overflow:"hidden",height:"calc(100dvh - 56px)"}}>
            <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:"8px",background:"#fff"}}>
              <div style={{position:"relative",flex:1}}>
                <Search size={12} style={{position:"absolute",left:"8px",top:"50%",transform:"translateY(-50%)",color:C.textSub}}/>
                <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar campanha..."
                  style={{width:"100%",padding:"9px 8px 9px 28px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
              </div>
              <button onClick={()=>setShowNova(v=>!v)}
                style={{background:showNova?C.primaryDk:C.primary,border:"none",color:"#fff",
                  padding:"9px 14px",borderRadius:"8px",cursor:"pointer",flexShrink:0}}>
                <Plus size={16}/>
              </button>
            </div>

            {showNova&&(
              <div style={{padding:"12px",borderBottom:`1px solid ${C.border}`,background:"#fff"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:C.primary,marginBottom:"10px"}}>Nova campanha</div>
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  <input value={novaNome} onChange={e=>setNovaNome(e.target.value)} placeholder="Nome da campanha"
                    style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                  <div style={{display:"flex",gap:"8px"}}>
                    <input value={novaCodsec} onChange={e=>setNovaCodsec(e.target.value)} placeholder="CODSEC" type="number"
                      style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                    <select value={novaUnidade} onChange={e=>setNovaUnidade(e.target.value)}
                      style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}>
                      <option value="UN">UN</option><option value="CX">CX</option>
                    </select>
                  </div>
                  <div style={{display:"flex",gap:"8px"}}>
                    <input type="date" value={novaIni} onChange={e=>setNovaIni(e.target.value)}
                      style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                    <input type="date" value={novaFim} onChange={e=>setNovaFim(e.target.value)}
                      style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                  </div>
                  <button onClick={criarCampanha} disabled={criando}
                    style={{background:C.green,border:"none",color:"#fff",padding:"10px",
                      borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:700}}>
                    {criando?"Criando...":"Criar campanha"}
                  </button>
                </div>
              </div>
            )}

            <div style={{flex:1,overflowY:"auto",background:"#F8F9FA"}}>
              {loading&&<div style={{padding:"40px",textAlign:"center",color:C.textSub}}>Carregando...</div>}
              {!loading&&grupos.map(({semana,lista})=>{
                const ativa=lista.some(c=>c.semana_fim>=hoje);
                return (
                  <div key={semana}>
                    <div style={{padding:"8px 14px",background:ativa?"#EDFFF5":"#F0F0F0",
                      borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:"11px",fontWeight:700,color:ativa?C.green:C.textSub}}>{semana}</span>
                      <span style={{background:ativa?C.green:C.textSub,color:"#fff",borderRadius:"10px",padding:"2px 8px",fontSize:"10px",fontWeight:600}}>
                        {ativa?"ATIVA":"ENCERRADA"}
                      </span>
                    </div>
                    {lista.map(c=>(
                      <div key={c.id} onClick={()=>{setCampanhaSel(c);setShowPanel(false);setEditCamp(null);setConfirmDel(false);}}
                        style={{padding:"14px",borderBottom:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",
                          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:"14px",color:C.text}}>{c.nome}</div>
                          <div style={{fontSize:"11px",color:C.textSub,marginTop:"3px"}}>{c.semana_ini} → {c.semana_fim} · {c.unidade}</div>
                        </div>
                        <ChevronRight size={18} color={C.textSub}/>
                      </div>
                    ))}
                  </div>
                );
              })}
              {!loading&&grupos.length===0&&(
                <div style={{padding:"48px",textAlign:"center",color:C.textSub}}>
                  {busca?"Nenhuma campanha encontrada.":"Nenhuma campanha criada ainda."}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tela de detalhe */}
        {campanhaSel && !showPanel && (
          <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 56px)",overflow:"hidden"}}>
            {/* Topbar */}
            <div style={{padding:"10px 12px",background:"#fff",borderBottom:`2px solid ${C.border}`,
              display:"flex",alignItems:"center",gap:"8px"}}>
              <button onClick={()=>setShowPanel(true)}
                style={{background:"#F0F0F0",border:"none",padding:"8px 12px",borderRadius:"8px",
                  cursor:"pointer",fontSize:"13px",color:C.text,flexShrink:0}}>
                ‹ Voltar
              </button>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{campanhaSel.nome}</div>
                <div style={{fontSize:"10px",color:C.textSub}}>{campanhaSel.semana_ini} → {campanhaSel.semana_fim} · {campanhaSel.unidade}
                  {encerrada&&<span style={{marginLeft:"6px",color:C.red,fontStyle:"italic"}}>encerrada</span>}
                </div>
              </div>
              <button onClick={()=>{setEditCamp(campanhaSel);setEditForm({nome:campanhaSel.nome,semana_ini:campanhaSel.semana_ini,semana_fim:campanhaSel.semana_fim});setConfirmDel(false);}}
                style={{background:"#EBF5FF",border:"1px solid #BFDBFE",color:"#2563EB",padding:"8px 10px",borderRadius:"8px",cursor:"pointer"}}>✏️</button>
              {!confirmDel?(<button onClick={()=>setConfirmDel(true)}
                  style={{background:"#FFF0F0",border:`1px solid ${C.red}40`,color:C.red,padding:"8px 10px",borderRadius:"8px",cursor:"pointer"}}>🗑️</button>
              ):(<div style={{display:"flex",gap:"6px"}}>
                  <button onClick={deletar} style={{background:C.red,border:"none",color:"#fff",padding:"8px 14px",borderRadius:"8px",cursor:"pointer",fontWeight:700,fontSize:"12px"}}>Sim</button>
                  <button onClick={()=>setConfirmDel(false)} style={{background:"#fff",border:`1px solid ${C.border}`,padding:"8px 12px",borderRadius:"8px",cursor:"pointer",fontSize:"12px"}}>Não</button>
                </div>)}
            </div>

            {editCamp&&(
              <div style={{padding:"12px",background:"#EBF5FF",borderBottom:"1px solid #BFDBFE",display:"flex",flexDirection:"column",gap:"8px"}}>
                <input value={editForm.nome??""} onChange={e=>setEditForm(f=>({...f,nome:e.target.value}))} placeholder="Nome"
                  style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                <div style={{display:"flex",gap:"8px"}}>
                  <input type="date" value={editForm.semana_ini??""} onChange={e=>setEditForm(f=>({...f,semana_ini:e.target.value}))}
                    style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                  <input type="date" value={editForm.semana_fim??""} onChange={e=>setEditForm(f=>({...f,semana_fim:e.target.value}))}
                    style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}/>
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={salvarEdicao} disabled={salvandoCamp}
                    style={{flex:1,background:"#2563EB",border:"none",color:"#fff",padding:"10px",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:700}}>
                    {salvandoCamp?"Salvando...":"Salvar"}</button>
                  <button onClick={()=>{setEditCamp(null);setEditForm({});}}
                    style={{background:"#fff",border:`1px solid ${C.border}`,padding:"10px 16px",borderRadius:"8px",cursor:"pointer",fontSize:"13px"}}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{display:"flex",borderBottom:`2px solid ${C.border}`,background:"#fff"}}>
              {[["acompanhar","Acompanhar",Eye],["configurar","Configurar",Settings]].map(([id,label,Icon])=>(
                <button key={id} onClick={()=>setAba(id)}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                    padding:"11px",border:"none",cursor:"pointer",fontSize:"13px",
                    background:aba===id?C.primary:"#fff",color:aba===id?"#fff":C.text,
                    fontWeight:aba===id?700:400}}>
                  <Icon size={14}/> {label}
                </button>
              ))}
            </div>

            <div style={{flex:1,overflowY:"auto"}}>
              {aba==="acompanhar"
                ?<Acompanhamento campanha={campanhaSel} token={token} cargo="fornecedor" isMobile={true}/>
                :<Configuracao   campanha={campanhaSel} token={token} isMobile={true}/>}
            </div>
          </div>
        )}
      </>
    ) : (

    /* ── DESKTOP: dois painéis ── */
    <div style={{display:"flex",height:"calc(100vh - 90px)",overflow:"hidden"}}>
      <div style={{width:"260px",flexShrink:0,borderRight:`2px solid ${C.border}`,background:"#FAFAFA",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"10px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:"6px"}}>
          <div style={{position:"relative",flex:1}}>
            <Search size={12} style={{position:"absolute",left:"8px",top:"50%",transform:"translateY(-50%)",color:C.textSub}}/>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar campanha..."
              style={{width:"100%",padding:"6px 8px 6px 26px",border:`1px solid ${C.border}`,borderRadius:"6px",fontSize:"11px",outline:"none"}}/>
          </div>
          <button onClick={()=>setShowNova(v=>!v)}
            style={{background:showNova?C.primaryDk:C.primary,border:"none",color:"#fff",padding:"6px 10px",borderRadius:"6px",cursor:"pointer"}}>
            <Plus size={13}/>
          </button>
        </div>

        {showNova&&(
          <div style={{padding:"10px",borderBottom:`1px solid ${C.border}`,background:"#fff"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.primary,marginBottom:"8px"}}>Nova campanha</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              <input value={novaNome} onChange={e=>setNovaNome(e.target.value)} placeholder="Nome"
                style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}/>
              <div style={{display:"flex",gap:"6px"}}>
                <input value={novaCodsec} onChange={e=>setNovaCodsec(e.target.value)} placeholder="CODSEC" type="number"
                  style={{flex:1,padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}/>
                <select value={novaUnidade} onChange={e=>setNovaUnidade(e.target.value)}
                  style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}>
                  <option value="UN">UN</option><option value="CX">CX</option>
                </select>
              </div>
              <input type="date" value={novaIni} onChange={e=>setNovaIni(e.target.value)}
                style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}/>
              <input type="date" value={novaFim} onChange={e=>setNovaFim(e.target.value)}
                style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}/>
              <button onClick={criarCampanha} disabled={criando}
                style={{background:C.green,border:"none",color:"#fff",padding:"6px",borderRadius:"4px",cursor:"pointer",fontSize:"11px",fontWeight:700}}>
                {criando?"Criando...":"Criar campanha"}
              </button>
            </div>
          </div>
        )}

        <div style={{flex:1,overflowY:"auto"}}>
          {loading&&<div style={{padding:"20px",textAlign:"center",color:C.textSub,fontSize:"11px"}}>Carregando...</div>}
          {!loading&&grupos.map(({semana,lista})=>{
            const ativa=lista.some(c=>c.semana_fim>=hoje);
            return (
              <div key={semana}>
                <div style={{padding:"5px 10px",background:ativa?"#F0FFF4":"#F5F5F5",borderBottom:`1px solid ${C.border}`,
                  fontSize:"10px",fontWeight:700,color:ativa?C.green:C.textSub,letterSpacing:"0.04em",
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>{semana}</span>
                  <span style={{background:ativa?C.green:C.textSub,color:"#fff",borderRadius:"10px",padding:"1px 6px",fontSize:"9px"}}>
                    {ativa?"ATIVA":"ENCERRADA"}
                  </span>
                </div>
                {lista.map(c=>(
                  <div key={c.id} onClick={()=>{setCampanhaSel(c);setEditCamp(null);setConfirmDel(false);}}
                    style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",fontSize:"11px",
                      background:campanhaSel?.id===c.id?`${C.primary}15`:"transparent",
                      borderLeft:campanhaSel?.id===c.id?`3px solid ${C.primary}`:"3px solid transparent"}}>
                    <div style={{fontWeight:campanhaSel?.id===c.id?700:500,color:campanhaSel?.id===c.id?C.primary:C.text}}>{c.nome}</div>
                    <div style={{fontSize:"10px",color:C.textSub,marginTop:"2px"}}>{c.semana_ini} → {c.semana_fim} · {c.unidade}</div>
                  </div>
                ))}
              </div>
            );
          })}
          {!loading&&grupos.length===0&&(
            <div style={{padding:"24px",textAlign:"center",color:C.textSub,fontSize:"11px"}}>
              {busca?"Nenhuma campanha encontrada.":"Nenhuma campanha criada ainda."}
            </div>
          )}
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {!campanhaSel?(<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.textSub}}>Selecione uma campanha ao lado.</div>):(
          <>
            <div style={{padding:"8px 12px",borderBottom:`2px solid ${C.border}`,background:"#fff",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{campanhaSel.nome}</div>
                <div style={{fontSize:"10px",color:C.textSub}}>{campanhaSel.semana_ini} → {campanhaSel.semana_fim} · {campanhaSel.unidade}
                  {encerrada&&<span style={{marginLeft:"8px",color:C.red,fontStyle:"italic"}}>encerrada</span>}
                </div>
              </div>
              <button onClick={()=>{setEditCamp(campanhaSel);setEditForm({nome:campanhaSel.nome,semana_ini:campanhaSel.semana_ini,semana_fim:campanhaSel.semana_fim});setConfirmDel(false);}}
                style={{background:"#EBF5FF",border:"1px solid #BFDBFE",color:"#2563EB",padding:"5px 8px",borderRadius:"5px",cursor:"pointer",fontSize:"11px"}}>✏️</button>
              {!confirmDel?(<button onClick={()=>setConfirmDel(true)} style={{background:"#FFF0F0",border:`1px solid ${C.red}40`,color:C.red,padding:"5px 8px",borderRadius:"5px",cursor:"pointer",fontSize:"11px"}}>🗑️</button>):(
                <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
                  <span style={{fontSize:"10px",color:C.red,fontWeight:600}}>Excluir?</span>
                  <button onClick={deletar} style={{background:C.red,border:"none",color:"#fff",padding:"4px 10px",borderRadius:"4px",cursor:"pointer",fontSize:"11px",fontWeight:700}}>Sim</button>
                  <button onClick={()=>setConfirmDel(false)} style={{background:"#fff",border:`1px solid ${C.border}`,padding:"4px 8px",borderRadius:"4px",cursor:"pointer",fontSize:"11px"}}>Não</button>
                </div>
              )}
              <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:"6px",overflow:"hidden"}}>
                {[["acompanhar","Acompanhar",Eye],["configurar","Configurar",Settings]].map(([id,label,Icon])=>(
                  <button key={id} onClick={()=>setAba(id)}
                    style={{display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",border:"none",cursor:"pointer",fontSize:"11px",
                      background:aba===id?C.primary:"#fff",color:aba===id?"#fff":C.text,fontWeight:aba===id?700:400,
                      borderRight:id==="acompanhar"?`1px solid ${C.border}`:"none"}}>
                    <Icon size={12}/> {label}
                  </button>
                ))}
              </div>
            </div>
            {editCamp&&(
              <div style={{padding:"10px 12px",background:"#EBF5FF",borderBottom:"1px solid #BFDBFE",display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"flex-end"}}>
                <input value={editForm.nome??""} onChange={e=>setEditForm(f=>({...f,nome:e.target.value}))} placeholder="Nome"
                  style={{padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"11px",outline:"none",flex:2,minWidth:"140px"}}/>
                <input type="date" value={editForm.semana_ini??""} onChange={e=>setEditForm(f=>({...f,semana_ini:e.target.value}))}
                  style={{padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"11px",outline:"none"}}/>
                <input type="date" value={editForm.semana_fim??""} onChange={e=>setEditForm(f=>({...f,semana_fim:e.target.value}))}
                  style={{padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:"5px",fontSize:"11px",outline:"none"}}/>
                <button onClick={salvarEdicao} disabled={salvandoCamp}
                  style={{background:"#2563EB",border:"none",color:"#fff",padding:"6px 14px",borderRadius:"5px",cursor:"pointer",fontSize:"11px",fontWeight:700}}>
                  {salvandoCamp?"Salvando...":"Salvar"}</button>
                <button onClick={()=>{setEditCamp(null);setEditForm({});}}
                  style={{background:"#fff",border:`1px solid ${C.border}`,padding:"6px 10px",borderRadius:"5px",cursor:"pointer",fontSize:"11px"}}>Cancelar</button>
              </div>
            )}
            <div style={{flex:1,overflowY:"auto"}}>
              {aba==="acompanhar"
                ?<Acompanhamento campanha={campanhaSel} token={token} cargo="fornecedor" isMobile={false}/>
                :<Configuracao   campanha={campanhaSel} token={token} isMobile={false}/>}
            </div>
          </>
        )}
      </div>
    </div>
    )}
  </>);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW PADRÃO — gerencial, supervisor, admin (dropdown)
// ─────────────────────────────────────────────────────────────────────────────
function ViewPadrao({cargo, token, userInfo, isMobile}) {
  const [campanhas,    setCampanhas]    = useState([]);
  const [campanhaSel,  setCampanhaSel]  = useState(null);
  const [aba,          setAba]          = useState("acompanhar");
  const [loadingCamp,  setLoadingCamp]  = useState(false);
  const [editCamp,     setEditCamp]     = useState(null);
  const [editForm,     setEditForm]     = useState({});
  const [salvandoCamp, setSalvandoCamp] = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);

  const headers=useMemo(()=>({Authorization:`Bearer ${token}`,"Content-Type":"application/json"}),[token]);

  const loadCampanhas=useCallback(async()=>{
    setLoadingCamp(true);
    try {
      const j=await fetch(`${API_BASE}/api/bl/campanhas`,{headers}).then(r=>r.json());
      const lista=j.dados??[];
      setCampanhas(lista);
      if(!campanhaSel&&lista.length>0) setCampanhaSel(lista[0]);
    } finally {setLoadingCamp(false);}
  },[headers]);

  useEffect(()=>{loadCampanhas();},[loadCampanhas]);

  const salvarEdicao=async()=>{
    if(!editCamp) return;
    setSalvandoCamp(true);
    try {
      await fetch(`${API_BASE}/api/bl/campanhas/${editCamp.id}`,{method:"PUT",headers,
        body:JSON.stringify({nome:editForm.nome||editCamp.nome,
          semana_ini:editForm.semana_ini||editCamp.semana_ini,
          semana_fim:editForm.semana_fim||editCamp.semana_fim})});
      setEditCamp(null);setEditForm({});loadCampanhas();
    } finally {setSalvandoCamp(false);}
  };

  const deletar=async()=>{
    if(!campanhaSel) return;
    await fetch(`${API_BASE}/api/bl/campanhas/${campanhaSel.id}`,{method:"DELETE",headers});
    setConfirmDel(false);setCampanhaSel(null);loadCampanhas();
  };

  return (<>
    <ModuleHeader isMobile={isMobile}
      titulo={`BATEU LEVOU${campanhaSel?" — "+campanhaSel.nome:""}`}/>

    <div style={{background:"#fff",borderBottom:`2px solid ${C.border}`,
      padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>

      <div style={{position:"relative",minWidth:"260px"}}>
        <select value={campanhaSel?.id??""} onChange={e=>{
          const c=campanhas.find(x=>x.id===Number(e.target.value));
          setCampanhaSel(c||null);setEditCamp(null);setConfirmDel(false);}}
          style={{appearance:"none",border:`1px solid ${C.border}`,borderRadius:"6px",
            padding:"7px 28px 7px 10px",fontSize:"12px",color:C.text,
            cursor:"pointer",outline:"none",width:"100%"}}>
          {loadingCamp?<option>Carregando...</option>
            :campanhas.map(c=><option key={c.id} value={c.id}>
              {c.nome} ({c.semana_ini} → {c.semana_fim}) · {c.unidade}
            </option>)}
        </select>
        <ChevronDown size={13} style={{position:"absolute",right:"8px",top:"50%",
          transform:"translateY(-50%)",color:C.textSub,pointerEvents:"none"}}/>
      </div>

      {campanhaSel&&cargo==="admin"&&(<>
        <button onClick={()=>{setEditCamp(campanhaSel);
          setEditForm({nome:campanhaSel.nome,semana_ini:campanhaSel.semana_ini,semana_fim:campanhaSel.semana_fim});
          setConfirmDel(false);}}
          style={{background:"#EBF5FF",border:"1px solid #BFDBFE",color:"#2563EB",
            padding:"6px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"12px"}}>✏️</button>
        {!confirmDel?(<button onClick={()=>setConfirmDel(true)}
            style={{background:"#FFF0F0",border:`1px solid ${C.red}40`,color:C.red,
              padding:"6px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"12px"}}>🗑️</button>
        ):(<div style={{display:"flex",gap:"6px",alignItems:"center"}}>
            <span style={{fontSize:"11px",color:C.red,fontWeight:600}}>Excluir?</span>
            <button onClick={deletar} style={{background:C.red,border:"none",color:"#fff",
              padding:"5px 12px",borderRadius:"6px",cursor:"pointer",fontSize:"11px",fontWeight:700}}>Sim</button>
            <button onClick={()=>setConfirmDel(false)} style={{background:"#fff",
              border:`1px solid ${C.border}`,padding:"5px 10px",borderRadius:"6px",cursor:"pointer",fontSize:"11px"}}>Não</button>
          </div>)}
      </>)}

      <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:"6px",overflow:"hidden"}}>
        <button onClick={()=>setAba("acompanhar")}
          style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",border:"none",
            cursor:"pointer",fontSize:"12px",background:aba==="acompanhar"?C.primary:"#fff",
            color:aba==="acompanhar"?"#fff":C.text,fontWeight:aba==="acompanhar"?700:400,
            borderRight:`1px solid ${C.border}`}}>
          <Eye size={13}/> Acompanhar
        </button>
        {cargo==="admin"&&(
          <button onClick={()=>setAba("configurar")}
            style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",border:"none",
              cursor:"pointer",fontSize:"12px",background:aba==="configurar"?C.primary:"#fff",
              color:aba==="configurar"?"#fff":C.text,fontWeight:aba==="configurar"?700:400}}>
            <Settings size={13}/> Configurar
          </button>
        )}
      </div>
    </div>

    {editCamp&&(
      <div style={{margin:"10px 16px",padding:"12px",background:"#EBF5FF",
        border:"1px solid #BFDBFE",borderRadius:"8px",display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"flex-end"}}>
        <input value={editForm.nome??""} onChange={e=>setEditForm(f=>({...f,nome:e.target.value}))}
          placeholder="Nome" style={{padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:"6px",
            fontSize:"12px",outline:"none",flex:2,minWidth:"180px"}}/>
        <input type="date" value={editForm.semana_ini??""} onChange={e=>setEditForm(f=>({...f,semana_ini:e.target.value}))}
          style={{padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:"6px",fontSize:"12px",outline:"none"}}/>
        <input type="date" value={editForm.semana_fim??""} onChange={e=>setEditForm(f=>({...f,semana_fim:e.target.value}))}
          style={{padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:"6px",fontSize:"12px",outline:"none"}}/>
        <button onClick={salvarEdicao} disabled={salvandoCamp}
          style={{background:"#2563EB",border:"none",color:"#fff",padding:"7px 18px",
            borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
          {salvandoCamp?"Salvando...":"Salvar"}</button>
        <button onClick={()=>{setEditCamp(null);setEditForm({});}}
          style={{background:"#fff",border:`1px solid ${C.border}`,padding:"7px 12px",
            borderRadius:"6px",cursor:"pointer",fontSize:"12px"}}>Cancelar</button>
      </div>
    )}

    {campanhaSel?(
      aba==="acompanhar"
        ?<Acompanhamento campanha={campanhaSel} token={token} cargo={cargo} isMobile={isMobile}/>
        :<Configuracao   campanha={campanhaSel} token={token} isMobile={isMobile}/>
    ):(
      <div style={{padding:"48px",textAlign:"center",color:C.textSub}}>
        {loadingCamp?"Carregando...":"Nenhuma campanha."}
      </div>
    )}
  </>);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL — roteia por cargo
// ─────────────────────────────────────────────────────────────────────────────
export default function ModuleBateuLevou({isMobile, token, userInfo={}}) {
  const cargo = userInfo.cargo ?? "gerencial";

  if (cargo === "vendedor")
    return <VendedorView  token={token} userInfo={userInfo} isMobile={isMobile}/>;

  if (cargo === "fornecedor")
    return <FornecedorView token={token} userInfo={userInfo} isMobile={isMobile}/>;

  return <ViewPadrao cargo={cargo} token={token} userInfo={userInfo} isMobile={isMobile}/>;
}