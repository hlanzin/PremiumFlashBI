import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from "react";
import { ChevronDown, ChevronRight, Settings, Eye,
         Plus, TrendingUp as BLIcon, Search } from "lucide-react";
import { C, fmtPct, pctStyle, fmtN, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import TableCard from "../../components/TableCard";
import SelectModal from "../../components/SelectModal";
import ModuleHeader from "../../components/ModuleHeader";
import { arrow } from "../../components/ArrowBadge";
import SkeletonRows from "../../components/SkeletonRows";
import DatePicker from "../../components/DatePicker";
import { exportCSV } from "../../utils/exportCSV";

const fmtQtd = (v, u) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})} ${u==="CX"?"cx":"un"}`;

// Positivação conta CLIENTES, não caixas/unidades — número inteiro, sem sufixo
const fmtClientes = (v) => v == null ? "—" : Number(v).toLocaleString("pt-BR");

const semanaAtualIni = () => {
  const d=new Date(), day=d.getDay();
  d.setDate(d.getDate()-day);
  return d.toISOString().split("T")[0];
};

// ── VendedorRow expansível ────────────────────────────────────────────────────
function VendedorRow({v, unidade, tipo, isExpanded, onToggle, zebra}) {
  const pct=v.pct_ating;
  const isPositivacao = tipo === "positivacao";
  const detalhe = isPositivacao ? (v.clientes ?? []) : (v.produtos ?? []);
  const temDetalhe = detalhe.length > 0;
  const fmt = (n) => isPositivacao ? fmtClientes(n) : fmtQtd(n, unidade);
  const bgBase = zebra ? (C.rowEven ?? "#fff") : (C.rowOdd ?? "#FAFAFA");
  const td=(ex={})=>({padding:"7px 8px",borderBottom:`1px solid ${C.border}`,
    verticalAlign:"middle",background:bgBase,...ex});
  return (<>
    <tr onClick={temDetalhe?onToggle:undefined} style={{cursor:temDetalhe?"pointer":"default"}}
        onMouseEnter={e=>e.currentTarget.style.background=C.rowHover}
        onMouseLeave={e=>e.currentTarget.style.background=bgBase}>
      <td style={td({width:"32px",textAlign:"center"})}>
        {temDetalhe && (isExpanded?<ChevronDown size={14} color={C.textSub}/>:<ChevronRight size={14} color={C.textSub}/>)}
      </td>
      <td style={td({fontWeight:700})}>
        {v.nome_vendedor}
        <span style={{fontSize:"10px",color:C.textSub,fontFamily:C.mono,marginLeft:"6px"}}>#{v.cod_vendedor}</span>
      </td>
      <td style={td({textAlign:"right",fontFamily:C.mono})}>
        {v.meta>0?fmt(v.meta):<span style={{color:C.textSub}}>—</span>}
      </td>
      <td style={td({textAlign:"right",fontFamily:C.mono,fontWeight:600})}>{fmt(v.qt_realizado)}</td>
      <td style={td({textAlign:"center"})}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
      <td style={td({textAlign:"right",fontFamily:C.mono,fontWeight:600,color:C.primary})}>{fmt(v.qt_dia)}</td>
      <td style={td({textAlign:"center"})}>{arrow(pct)}</td>
    </tr>
    {isExpanded && isPositivacao && detalhe.map(cli=>(
      <tr key={cli.cod_cliente} style={{background:"#FFFAF0"}}>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`,
          paddingLeft:"24px",fontSize:"11px",color:C.textSub}}>
          <span style={{fontFamily:C.mono,marginRight:"6px",color:C.primary}}>#{cli.cod_cliente}</span>
          {cli.razao_social}
          {cli.eh_novo && (
            <span style={{marginLeft:"6px",background:"#DBEAFE",color:"#1D4ED8",fontSize:"9px",
              fontWeight:700,padding:"1px 6px",borderRadius:"8px"}}>NOVO</span>
          )}
        </td>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`,
          textAlign:"center",fontFamily:C.mono,fontSize:"11px",color:"#16A34A",fontWeight:700}}>
          {cli.positivou_realizado ? "✓" : ""}
        </td>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`,
          textAlign:"center",fontFamily:C.mono,fontSize:"11px",color:C.primary,fontWeight:700}}>
          {cli.positivou_hoje ? "✓ hoje" : ""}
        </td>
        <td style={{padding:"5px 8px",borderBottom:`1px dashed ${C.border}`}}/>
      </tr>
    ))}
    {isExpanded && !isPositivacao && detalhe.map(p=>(
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
function TabelaAcompanhamento({grupos, unidade, tipo, loading, error, cargo}) {
  const isPositivacao = tipo === "positivacao";
  const [expanded, setExpanded] = useState({});
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  const onSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // % atingimento é calculado (não é campo direto do vendedor)
  const valorCol = (v, col) => {
    if (col === "pct") return (v.meta ?? 0) > 0 ? (v.qt_realizado ?? 0) / v.meta * 100 : -1;
    return v[col];
  };
  const COLS_TEXTO = new Set(["nome_vendedor"]);
  const ordenar = (vends) => {
    if (!sortCol) return vends;
    const arr = [...vends];
    arr.sort((a, b) => {
      let av = valorCol(a, sortCol), bv = valorCol(b, sortCol);
      const an = av == null || av === "", bn = bv == null || bv === "";
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      if (!COLS_TEXTO.has(sortCol)) {
        const na = typeof av === "number" ? av : Number(av);
        const nb = typeof bv === "number" ? bv : Number(bv);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "pt-BR")
        : String(bv).localeCompare(String(av), "pt-BR");
    });
    return arr;
  };

  const allVends = grupos.flatMap(g=>g.vendedores??[]);
  if (loading) return <div style={{padding:"24px",textAlign:"center",color:C.textSub,fontSize:"12px"}}>
    Carregando...</div>;
  if (error)   return <div style={{padding:"24px",textAlign:"center",color:C.red,fontSize:"12px"}}>{error}</div>;
  if (!allVends.length) return <div style={{padding:"32px",textAlign:"center",color:C.textSub,fontSize:"12px"}}>
    Nenhum dado.</div>;
  return (
    <>{grupos.map(grupo=>{
      const vends=ordenar(grupo.vendedores??[]);
      const nomeSup=vends[0]?.nome_supervisor??`Supervisor #${grupo.cod_supervisor}`;
      const totM=vends.reduce((s,v)=>s+(v.meta??0),0);
      const totR=vends.reduce((s,v)=>s+(v.qt_realizado??0),0);
      const totD=vends.reduce((s,v)=>s+(v.qt_dia??0),0);
      const totP=totM>0?(totR/totM)*100:null;
      return (
        <TableCard key={grupo.cod_supervisor} style={{margin:"0 0 12px 0"}}>
          {grupos.length>1&&<div style={{padding:"7px 12px",background:"#f4f4f4",
            borderBottom:`1px solid ${C.border}`,fontSize:"11px",fontWeight:700,color:C.text}}>
            {nomeSup}
          </div>}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr>
                <Th label="" />
                <Th label="VENDEDOR"    col="nome_vendedor"  sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
                <Th label="META"        col="meta"           sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                <Th label={isPositivacao?"POSITIVADOS":"REALIZADO"} col="qt_realizado"   sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                <Th label="% ATING"     col="pct"            sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="center"/>
                <Th label={isPositivacao?"POSITIVOU HOJE":"REALIZ. DIA"} col="qt_dia"          sortCol={sortCol} sortDir={sortDir} onSort={onSort} align="right"/>
                <Th label="STATUS"      align="center"/>
              </tr></thead>
              <tbody>
                {vends.map((v,i)=>{
                  const key=`${grupo.cod_supervisor}_${v.cod_vendedor}`;
                  return <VendedorRow key={key} v={v} unidade={unidade} tipo={tipo}
                    isExpanded={!!expanded[key]} zebra={i%2===0}
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
                      {isPositivacao?fmtClientes(totM):fmtQtd(totM,unidade)}
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"right",fontFamily:C.mono}}>
                      {isPositivacao?fmtClientes(totR):fmtQtd(totR,unidade)}
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"center"}}>
                      <span style={pctStyle(totP)}>{fmtPct(totP)}</span>
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"right",fontFamily:C.mono}}>
                      {isPositivacao?fmtClientes(totD):fmtQtd(totD,unidade)}
                    </td>
                    <td style={{padding:"6px 8px",border:`1px solid ${C.primaryDk}`,textAlign:"center"}}>
                      {arrow(totP)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TableCard>
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

  // ID da requisição em curso — evita que uma resposta ANTIGA (de uma troca
  // rápida entre campanhas/datas) chegue fora de ordem e sobrescreva os
  // dados corretos da requisição mais recente. Só a última busca disparada
  // tem permissão de atualizar o estado quando sua resposta chega.
  const requestIdRef = useRef(0);

  const fetch_ = useCallback(async()=>{
    const meuId = ++requestIdRef.current;
    setLoading(true); setError(null);
    try {
      let url=`${API_BASE}/api/bl/campanhas/${campanha.id}/dados?data=${dataRef}`;
      if (filtroSup) url+=`&filtro_supervisor=${filtroSup}`;
      const res=await fetch(url,{headers});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (meuId === requestIdRef.current) setGrupos(json.dados??[]);
    } catch(e){
      if (meuId === requestIdRef.current) setError(e.message);
    } finally {
      if (meuId === requestIdRef.current) setLoading(false);
    }
  },[campanha.id,dataRef,filtroSup,headers]);

  useEffect(()=>{fetch_();},[fetch_]);
  return {grupos,loading,error,dataRef,setDataRef,maxData,refetch:fetch_};
}

// ── Acompanhamento (layout compartilhado) ─────────────────────────────────────
const Acompanhamento = forwardRef(({campanha, token, cargo, isMobile, filtroSup}, ref) => {
  const hoje = getToday();
  const {grupos,loading,error,dataRef,setDataRef,maxData,refetch} =
    useCampanhaDados(campanha, token, filtroSup);
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
  const [supFiltro,setSupFiltro]=useState(filtroSup??null);

  useImperativeHandle(ref, () => ({ refetch, grupos, unidade: campanha.unidade, dataRef, loading }), [refetch, grupos, campanha.unidade, dataRef, loading]);

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

      <DatePicker value={dataRef} onChange={setDataRef} min={campanha.semana_ini} max={maxData} isMobile={isMobile} />
    </div>

    <div style={{margin:"8px 12px"}}>
      <TabelaAcompanhamento
        grupos={supFiltro?grupos.filter(g=>g.cod_supervisor===supFiltro):grupos}
        unidade={campanha.unidade} tipo={campanha.tipo} loading={loading} error={error} cargo={cargo}/>
    </div>
  </>);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO (sem mudanças estruturais)
// ─────────────────────────────────────────────────────────────────────────────
function Configuracao({campanha, token, isMobile}) {
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`,"Content-Type":"application/json"}),[token]);
  const [todosVendData,setTodosVendData]=useState([]);
  // ID da requisição em curso — mesma proteção contra resposta fora de
  // ordem usada no useCampanhaDados, aplicada aqui à troca de supervisor.
  const supRequestIdRef = useRef(0);
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

  // Verdadeiro quando esta campanha precisa da tela de "produtos
  // habilitados": tipo='produto' sempre, ou tipo='positivacao' só quando
  // o modo escolhido foi 'produto' (não 'cliente').
  const usaProdutos = campanha.tipo === "produto" || campanha.positivacao_modo === "produto";

  useEffect(()=>{
    // Reseta a seleção ao trocar de campanha — evita ficar com supervisor/
    // produtos/metas da campanha ANTERIOR "grudados" na tela por um instante
    setSupSel(null); setHabilitados(new Set()); setMetas({}); setVendedores([]);

    // Positivação modo='cliente' NÃO usa lista de produtos — o critério é
    // o fornecedor inteiro. tipo='produto' ou positivação modo='produto'
    // buscam por codsec/codfornec respectivamente.
    if (usaProdutos) {
      const param = campanha.tipo === "positivacao"
        ? `codfornec=${campanha.codfornec}`
        : `codsec=${campanha.codsec}`;
      fetch(`${API_BASE}/api/bl/produtos/buscar?${param}`,{headers}).then(r=>r.json())
        .then(jProd=>setTodosProdutos(jProd.dados??[]))
        .catch(e=>{console.error("Erro ao buscar produtos:",e); setTodosProdutos([]);});
    } else {
      setTodosProdutos([]);
    }

    fetch(`${API_BASE}/api/faturamento`,{headers}).then(r=>r.json())
      .then(jFat=>{
        const rows=jFat.dados??[];
        setTodosVendData(rows);
        const supMap=new Map();
        rows.forEach(r=>{if(r.cod_supervisor&&!supMap.has(r.cod_supervisor))supMap.set(r.cod_supervisor,r.nome_supervisor);});
        setSupervisores(Array.from(supMap.entries()).map(([cod_supervisor,nome_supervisor])=>({cod_supervisor,nome_supervisor}))
          .sort((a,b)=>a.nome_supervisor.localeCompare(b.nome_supervisor)));
      })
      .catch(e=>{console.error("Erro ao buscar supervisores:",e); setSupervisores([]);});
  },[campanha.id]);

  useEffect(()=>{
    if(!supSel) return;
    const meuId = ++supRequestIdRef.current;
    setLoadingSup(true);
    const vendMap=new Map();
    todosVendData.forEach(r=>{if(r.cod_supervisor===supSel&&r.cod_vendedor&&!vendMap.has(r.cod_vendedor))vendMap.set(r.cod_vendedor,r.nome_vendedor);});
    setVendedores(Array.from(vendMap.entries()).map(([cod_vendedor,nome_vendedor])=>({cod_vendedor,nome_vendedor}))
      .sort((a,b)=>a.nome_vendedor.localeCompare(b.nome_vendedor)));
    const buscas = usaProdutos
      ? [fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/produtos`,{headers}).then(r=>r.json()),
         fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`,{headers}).then(r=>r.json())]
      : [Promise.resolve({dados:[]}), fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`,{headers}).then(r=>r.json())];
    Promise.all(buscas).then(([jProd,jMetas])=>{
      if (meuId !== supRequestIdRef.current) return; // resposta antiga, descarta
      setHabilitados(new Set((jProd.dados??[]).map(p=>p.codprod)));
      const m={};(jMetas.dados??[]).forEach(x=>{m[x.cod_vendedor]=x.meta;});setMetas(m);
    }).catch(()=>{}).finally(()=>{ if (meuId === supRequestIdRef.current) setLoadingSup(false); });
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
      const chamadas=[
        fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/metas`,{
          method:"PUT",headers,body:JSON.stringify({cod_supervisor:supSel,
            metas:Object.entries(metas).map(([k,v])=>({cod_vendedor:Number(k),meta:Number(v)||0}))}),}),
      ];
      if (usaProdutos) {
        const prodMap=Object.fromEntries(todosProdutos.map(p=>[p.codprod,p.descricao]));
        chamadas.push(fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/produtos`,{
          method:"PUT",headers,body:JSON.stringify({cod_supervisor:supSel,codprods:[...habilitados],prod_map:prodMap}),}));
      }
      await Promise.all(chamadas);
      setMsg(usaProdutos ? `Salvo! ${habilitados.size} produto(s).` : "Metas salvas!");
      setTimeout(()=>setMsg(""),3000);
    } catch {setMsg("Erro ao salvar.");}
    finally {setSalvando(false);}
  };

  // Só para campanhas tipo='positivacao': sugere a meta de cada vendedor
  // como o tamanho da lista negra dele. Preenche os campos — ainda editáveis
  // e ainda é preciso clicar em "Salvar" para gravar de fato. Não sobrescreve
  // metas que o usuário já tenha ajustado manualmente, a menos que confirme.
  const [preenchendoAuto, setPreenchendoAuto] = useState(false);
  const preencherMetaAutomatica = async () => {
    if (!supSel) return;
    setPreenchendoAuto(true); setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/bl/campanhas/${campanha.id}/supervisor/${supSel}/meta-sugerida`, {headers});
      const j = await r.json();
      const sugestoes = j.dados ?? [];
      setMetas(prev => {
        const novo = {...prev};
        sugestoes.forEach(s => { novo[s.cod_vendedor] = String(s.meta_sugerida); });
        return novo;
      });
      setMsg(`${sugestoes.length} meta(s) sugerida(s) — revise e clique em Salvar.`);
      setTimeout(()=>setMsg(""),4000);
    } catch { setMsg("Erro ao buscar meta sugerida."); }
    finally { setPreenchendoAuto(false); }
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
      <div style={{display:"grid",gridTemplateColumns:(isMobile||!usaProdutos)?"1fr":"280px 1fr",gap:"16px",alignItems:"start"}}>
        <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",background:C.subHeader,color:"#fff",fontWeight:700,fontSize:"12px"}}>
            META POR VENDEDOR {usaProdutos && <span style={{fontSize:"10px",fontWeight:400,opacity:.75}}>({unLabel})</span>}
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
                {usaProdutos && <span style={{fontSize:"10px",color:C.textSub,width:"18px",flexShrink:0}}>{unLabel}</span>}
              </div>
            ))}
            {vendedores.length===0 && (
              <div style={{padding:"20px",textAlign:"center",fontSize:"11px",color:C.textSub}}>
                Nenhum vendedor deste supervisor.
              </div>
            )}
          </div>
        </div>
        {!usaProdutos ? (
          <div style={{background:"#FFF9E6",border:`1px solid ${C.gold ?? "#E5C97A"}`,borderRadius:"8px",
            padding:"14px",fontSize:"12px",color:C.text,gridColumn:isMobile?undefined:"1 / -1"}}>
            💡 <b>Positivação de cliente não usa lista de produtos.</b> Qualquer
            compra do cliente (de qualquer produto do fornecedor da campanha)
            conta como positivação — o critério é só o cliente ter saído da
            lista negra comprando de novo. Defina a meta de cada vendedor (ou
            use "Preencher meta automaticamente" abaixo) e clique em Salvar.
          </div>
        ) : (
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
        )}
      </div>
      <div style={{marginTop:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
        <button onClick={salvar} disabled={salvando}
          style={{background:C.primary,border:"none",color:"#fff",padding:"10px 28px",
            borderRadius:"6px",cursor:"pointer",fontSize:"13px",fontWeight:700}}>
          {salvando?"Salvando...":"Salvar"}
        </button>
        {campanha.tipo==="positivacao" && (
          <button onClick={preencherMetaAutomatica} disabled={preenchendoAuto || !supSel}
            title="Sugere a meta de cada vendedor = tamanho da lista negra dele"
            style={{background:"#fff",border:`1px solid ${C.primary}`,color:C.primary,padding:"10px 20px",
              borderRadius:"6px",cursor:"pointer",fontSize:"13px",fontWeight:700,
              opacity:(preenchendoAuto || !supSel)?0.5:1}}>
            {preenchendoAuto?"Calculando...":"Preencher meta automaticamente"}
          </button>
        )}
        {msg&&<span style={{fontSize:"12px",fontWeight:600,color:msg.includes("Erro")?C.red:C.green}}>{msg}</span>}
      </div>
    </>)}
  </div>);
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
            {campanha.semana_ini} → {campanha.semana_fim}
            {campanha.tipo!=="positivacao" && ` · ${campanha.unidade}`}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <TabelaAcompanhamento grupos={grupos} unidade={campanha.unidade} tipo={campanha.tipo}
        loading={loading} error={error} cargo="vendedor"/>
    </div>
  );
}

function VendedorView({token, userInfo, isMobile}) {
  const [campanhas, setCampanhas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);

  const fetchCampanhas = useCallback(() => {
    const hoje = getToday();
    setLoading(true);
    fetch(`${API_BASE}/api/bl/campanhas`,{headers})
      .then(r=>r.json())
      .then(j=>{
        const lista = (j.dados??[]).filter(c =>
          c.semana_ini <= hoje && c.semana_fim >= hoje
        );
        setCampanhas(lista);
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [headers]);

  useEffect(()=>{ fetchCampanhas(); },[fetchCampanhas]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    fetchCampanhas();
  }, [fetchCampanhas]);

  const handleExportExcel = useCallback(() => {
    const header = ["Campanha", "Início", "Fim", "Unidade"];
    const dataRows = campanhas.map(c => [c.nome, c.semana_ini, c.semana_fim, c.unidade]);
    exportCSV(`BateuLevou_${getToday()}`, header, dataRows);
  }, [campanhas]);

  return (<>
    <ModuleHeader icon={BLIcon} title="BATEU LEVOU" isMobile={isMobile}
      onRefresh={handleRefresh} loading={loading} onExportExcel={handleExportExcel}/>
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
        <CampanhaVendedor key={`${c.id}_${refreshKey}`} campanha={c} token={token}/>
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
  const [novaTipo,     setNovaTipo]     = useState("produto");   // 'produto' | 'positivacao'
  const [novaModo,     setNovaModo]     = useState("cliente");   // 'cliente' | 'produto' (só quando novaTipo='positivacao')
  const [novaCodsec,   setNovaCodsec]   = useState("");
  const [novaCodfornec,setNovaCodfornec]= useState("");
  const [novaUnidade,  setNovaUnidade]  = useState("UN");
  const [novaIni,      setNovaIni]      = useState("");
  const [novaFim,      setNovaFim]      = useState("");

  // Seções e fornecedores COM NOME (mesmo endpoint que já popula a Lista
  // Negra/DN) — usados para os dropdowns de CODSEC/CODFORNEC na criação.
  const [secoesOpts,      setSecoesOpts]      = useState([]);
  const [fornecedoresOpts,setFornecedoresOpts]= useState([]);
  const headersBase = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
  useEffect(() => {
    fetch(`${API_BASE}/api/lista-negra/secoes`,{headers:headersBase}).then(r=>r.json())
      .then(j=>setSecoesOpts(j.dados??[])).catch(()=>{});
    fetch(`${API_BASE}/api/lista-negra/fornecedores`,{headers:headersBase}).then(r=>r.json())
      .then(j=>setFornecedoresOpts(j.dados??[])).catch(()=>{});
  }, [token]);

  // Espelha a lista do backend só para exibir/ocultar a opção "Por
  // Positivação" no formulário — a validação de verdade é sempre no servidor.
  const FORNEC_POSITIVACAO = [1658, 2041];
  const meusFornecPositivacao = (userInfo.codfornecs ?? []).filter(c => FORNEC_POSITIVACAO.includes(c));
  const podePositivacao = meusFornecPositivacao.length > 0;
  // Mesmos códigos autorizados, mas com o NOME (vindo do endpoint da Lista
  // Negra/DN) para preencher o dropdown em vez de mostrar só o número
  const opcoesFornecPositivacao = fornecedoresOpts.filter(f => meusFornecPositivacao.includes(f.id));

  // Auto-seleciona o fornecedor quando só há um autorizado (evita passo extra)
  useEffect(() => {
    if (novaTipo === "positivacao" && meusFornecPositivacao.length === 1) {
      setNovaCodfornec(String(meusFornecPositivacao[0]));
    }
  }, [novaTipo]);
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
    if(!novaNome||!novaIni||!novaFim) return;
    if(novaTipo==="produto" && !novaCodsec) return;
    if(novaTipo==="positivacao" && !novaCodfornec) return;
    setCriando(true);
    try {
      const body = novaTipo==="produto"
        ? {nome:novaNome, tipo:"produto", codsec:Number(novaCodsec),
           unidade:novaUnidade, semana_ini:novaIni, semana_fim:novaFim}
        : {nome:novaNome, tipo:"positivacao", codfornec:Number(novaCodfornec),
           positivacao_modo:novaModo,
           unidade:"UN", semana_ini:novaIni, semana_fim:novaFim};
      await fetch(`${API_BASE}/api/bl/campanhas`,{method:"POST",headers,
        body:JSON.stringify(body)});
      setShowNova(false);setNovaNome("");setNovaTipo("produto");setNovaModo("cliente");
      setNovaCodsec("");setNovaCodfornec("");setNovaIni("");setNovaFim("");
      loadCampanhas();
    } finally {setCriando(false);}
  };

  const encerrada = campanhaSel && campanhaSel.semana_fim < hoje;
  const acRef = useRef(null);

  const handleExportExcel = useCallback(() => {
    const ac = acRef.current;
    if (!ac) return;
    const header = ["Supervisor", "Vendedor", "Código", "Meta", "Realizado", "% Ating.", "Realiz. Dia"];
    const dataRows = ac.grupos.flatMap(g => (g.vendedores ?? []).map(v => [
      g.vendedores?.[0]?.nome_supervisor ?? `#${g.cod_supervisor}`,
      v.nome_vendedor,
      String(v.cod_vendedor),
      String(v.meta ?? ''),
      String(v.qt_realizado ?? ''),
      v.pct_ating != null ? (v.pct_ating * 100).toFixed(2) : '',
      String(v.qt_dia ?? ''),
    ]));
    exportCSV(`BateuLevou_${ac.dataRef}`, header, dataRows);
  }, []);

  return (<>
    <ModuleHeader icon={BLIcon} title="BATEU LEVOU" isMobile={isMobile}
      onRefresh={() => acRef.current?.refetch()}
      onExportExcel={handleExportExcel}/>

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
                  {podePositivacao && (
                    <select value={novaTipo} onChange={e=>setNovaTipo(e.target.value)}
                      style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}>
                      <option value="produto">Por Produto</option>
                      <option value="positivacao">Por Positivação</option>
                    </select>
                  )}
                  {novaTipo==="produto" ? (
                    <div style={{display:"flex",gap:"8px"}}>
                      <select value={novaCodsec} onChange={e=>setNovaCodsec(e.target.value)}
                        style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}>
                        <option value="">Selecione a seção...</option>
                        {secoesOpts.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                      <select value={novaUnidade} onChange={e=>setNovaUnidade(e.target.value)}
                        style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}>
                        <option value="UN">UN</option><option value="CX">CX</option>
                      </select>
                    </div>
                  ) : (
                    <>
                      <select value={novaCodfornec} onChange={e=>setNovaCodfornec(e.target.value)}
                        style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}>
                        <option value="">Selecione o fornecedor...</option>
                        {opcoesFornecPositivacao.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                      <select value={novaModo} onChange={e=>setNovaModo(e.target.value)}
                        style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:"8px",fontSize:"13px",outline:"none"}}>
                        <option value="cliente">Positivação de Cliente (qualquer produto conta)</option>
                        <option value="produto">Positivação de Produto (produtos específicos)</option>
                      </select>
                    </>
                  )}
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
                ?<Acompanhamento ref={acRef} campanha={campanhaSel} token={token} cargo="fornecedor" isMobile={true}/>
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
              {podePositivacao && (
                <select value={novaTipo} onChange={e=>setNovaTipo(e.target.value)}
                  style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}>
                  <option value="produto">Por Produto</option>
                  <option value="positivacao">Por Positivação</option>
                </select>
              )}
              {novaTipo==="produto" ? (
                <div style={{display:"flex",gap:"6px"}}>
                  <select value={novaCodsec} onChange={e=>setNovaCodsec(e.target.value)}
                    style={{flex:1,padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}>
                    <option value="">Selecione a seção...</option>
                    {secoesOpts.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <select value={novaUnidade} onChange={e=>setNovaUnidade(e.target.value)}
                    style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}>
                    <option value="UN">UN</option><option value="CX">CX</option>
                  </select>
                </div>
              ) : (
                <>
                  <select value={novaCodfornec} onChange={e=>setNovaCodfornec(e.target.value)}
                    style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}>
                    <option value="">Selecione o fornecedor...</option>
                    {opcoesFornecPositivacao.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                  <select value={novaModo} onChange={e=>setNovaModo(e.target.value)}
                    style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:"4px",fontSize:"11px",outline:"none"}}>
                    <option value="cliente">Positivação de Cliente</option>
                    <option value="produto">Positivação de Produto</option>
                  </select>
                </>
              )}
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
                ?<Acompanhamento ref={acRef} campanha={campanhaSel} token={token} cargo="fornecedor" isMobile={false}/>
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

  const acRef = useRef(null);

  const handleExportExcel = useCallback(() => {
    const ac = acRef.current;
    if (!ac) return;
    const header = ["Supervisor", "Vendedor", "Código", "Meta", "Realizado", "% Ating.", "Realiz. Dia"];
    const dataRows = ac.grupos.flatMap(g => (g.vendedores ?? []).map(v => [
      g.vendedores?.[0]?.nome_supervisor ?? `#${g.cod_supervisor}`,
      v.nome_vendedor,
      String(v.cod_vendedor),
      String(v.meta ?? ''),
      String(v.qt_realizado ?? ''),
      v.pct_ating != null ? (v.pct_ating * 100).toFixed(2) : '',
      String(v.qt_dia ?? ''),
    ]));
    exportCSV(`BateuLevou_${ac.dataRef}`, header, dataRows);
  }, []);

  return (<>
    <ModuleHeader icon={BLIcon}
      title={"BATEU LEVOU" + (campanhaSel ? " — " + campanhaSel.nome : "")} isMobile={isMobile}
      onRefresh={() => acRef.current?.refetch()}
      onExportExcel={handleExportExcel}/>

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
        ?<Acompanhamento ref={acRef} campanha={campanhaSel} token={token} cargo={cargo} isMobile={isMobile}/>
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