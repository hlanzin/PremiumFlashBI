import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Plus, ChevronDown, ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { C, getToday, fmtDt as fmtDtTheme } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Dropdown from "../../components/Dropdown";
import ModuleHeader from "../../components/ModuleHeader";

const STATUS_CORES = {
  "Aberto":           { bg:"#EFF6FF", color:"#2563EB", border:"#BFDBFE" },
  "Em andamento":     { bg:"#FFF7ED", color:"#EA580C", border:"#FED7AA" },
  "Aguardando peça":  { bg:"#FFF9EB", color:"#D97706", border:"#FDE68A" },
  "Concluído":        { bg:"#F0FFF4", color:"#16A34A", border:"#BBF7D0" },
  "Cancelado":        { bg:"#F8F8F8", color:"#6B7280", border:"#E5E7EB" },
  "Erro envio":       { bg:"#FFF0F0", color:"#DC2626", border:"#FECACA" },
};
const STATUS_LISTA = ["Aberto","Em andamento","Aguardando peça","Concluído","Cancelado"];

const badge = (status) => {
  const s = STATUS_CORES[status] ?? STATUS_CORES["Aberto"];
  return (
    <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`,
                   borderRadius:"4px", padding:"2px 8px", fontSize:"10px", fontWeight:700 }}>
      {status}
    </span>
  );
};

const fmt_dt_hora = (dt) => {
  if (!dt) return "—";
  const [d, t] = dt.split(" ");
  return `${fmtDtTheme(d)} ${t?.slice(0,5) ?? ""}`;
};

// ── Estilo padrão de campo ────────────────────────────────────────────────────
const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1.5px solid ${C.border}`,
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
  fontFamily: "inherit",
  background: "#fff",
  color: C.text,
  boxSizing: "border-box",
  transition: "border-color .15s",
};

const Field = ({ label, required, children }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
    <label style={{ fontSize:"11px", fontWeight:700, color:C.textSub, letterSpacing:"0.04em" }}>
      {label}{required && <span style={{ color:C.red, marginLeft:"2px" }}>*</span>}
    </label>
    {children}
  </div>
);

// ── Formulário de abertura ────────────────────────────────────────────────────
function FormAbertura({ token, onSucesso, isMobile }) {
  const headers = useMemo(()=>({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }),[token]);

  const [forn,     setForn]     = useState("");
  const [codCli,   setCodCli]   = useState("");
  const [cliente,  setCliente]  = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [rg,       setRg]       = useState("");
  const [rcaNome,  setRcaNome]  = useState("");
  const [rcaFone,  setRcaFone]  = useState("");
  const [defeito,  setDefeito]  = useState("");
  const [horario,  setHorario]  = useState("");
  const [pontoRef, setPontoRef] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg,      setMsg]      = useState("");
  const [erro,     setErro]     = useState("");

  const onFocus = e => e.target.style.borderColor = C.primary;
  const onBlur  = e => e.target.style.borderColor = C.border;

  const buscarCliente = async () => {
    if (!codCli) return;
    setBuscando(true); setCliente(null); setErro("");
    try {
      const res = await fetch(`${API_BASE}/api/chamados/cliente/${codCli}`, { headers });
      if (!res.ok) throw new Error("Cliente não encontrado.");
      setCliente(await res.json());
    } catch(e) { setErro(e.message); }
    finally { setBuscando(false); }
  };

  const limpar = () => {
    setForn(""); setCodCli(""); setCliente(null);
    setRg(""); setRcaNome(""); setRcaFone("");
    setDefeito(""); setHorario(""); setPontoRef("");
    setMsg(""); setErro("");
  };

  const enviar = async () => {
    if (!forn || !rg || !cliente) { setErro("Preencha todos os campos obrigatórios."); return; }
    if (forn === "fricon" && (!defeito || !horario || !pontoRef)) {
      setErro("Fricon requer defeito, horário e ponto de referência."); return;
    }
    setEnviando(true); setErro("");
    try {
      const body = {
        fornecedor: forn, cod_cliente: Number(codCli),
        nome_cliente: cliente.nome_fantasia || cliente.razao_social,
        cnpj: cliente.cpf_cnpj, endereco: cliente.endereco,
        numero: cliente.numero, bairro: cliente.bairro,
        cidade: cliente.cidade, cep: cliente.cep,
        rg_freezer: rg,
        rca_nome: rcaNome || undefined,
        rca_fone: rcaFone || undefined,
        defeito, horario, ponto_ref: pontoRef,
      };
      const res = await fetch(`${API_BASE}/api/chamados`, {
        method:"POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) { const j=await res.json(); throw new Error(j.detail??res.statusText); }
      setMsg("Chamado aberto! O envio ocorre em background.");
      setTimeout(() => { limpar(); onSucesso(); }, 2000);
    } catch(e) { setErro(e.message); }
    finally { setEnviando(false); }
  };

  return (
    <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:"12px",
                  padding: isMobile ? "16px" : "20px", marginBottom:"16px" }}>
      <div style={{ fontWeight:700, fontSize:"14px", color:C.primary,
                    marginBottom:"16px", display:"flex", alignItems:"center", gap:"8px" }}>
        Abrir Chamado
      </div>

      {/* Fornecedor */}
      <Field label="FORNECEDOR" required>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
          {[["metalfrio","🧊 Metal Frio"],["fricon","❄️ Fricon"]].map(([id,label])=>(
            <button key={id} onClick={()=>setForn(id)}
              style={{ padding:"12px", border:`2px solid ${forn===id?C.primary:C.border}`,
                       borderRadius:"8px", cursor:"pointer", fontSize:"13px",
                       fontWeight:forn===id?700:400,
                       background:forn===id?`${C.primary}12`:"#fff",
                       color:forn===id?C.primary:C.text,
                       transition:"all .15s" }}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ height:"14px" }}/>

      {/* Código do cliente */}
      <Field label="CÓDIGO DO CLIENTE" required>
        <div style={{ display:"flex", gap:"8px" }}>
          <input value={codCli} onChange={e=>setCodCli(e.target.value)}
            type="number" placeholder="Ex: 16512"
            onFocus={onFocus} onBlur={onBlur}
            onKeyDown={e=>e.key==="Enter"&&buscarCliente()}
            style={{ ...fieldStyle, flex:1 }}/>
          <button onClick={buscarCliente} disabled={buscando||!codCli}
            style={{ padding:"10px 16px", background:codCli?C.primary:"#ccc",
                     border:"none", color:"#fff", borderRadius:"8px",
                     cursor:codCli?"pointer":"default",
                     fontSize:"13px", fontWeight:600, flexShrink:0,
                     transition:"background .15s" }}>
            {buscando ? "..." : "Buscar"}
          </button>
        </div>

        {cliente && (
          <div style={{ padding:"10px 14px", background:"#F0FFF4",
                        border:"1.5px solid #BBF7D0", borderRadius:"8px",
                        fontSize:"12px", lineHeight:1.7 }}>
            <div style={{ fontWeight:700, fontSize:"13px", color:C.text }}>
              {cliente.nome_fantasia || cliente.razao_social}
            </div>
            <div style={{ color:C.textSub }}>
              CNPJ: {cliente.cpf_cnpj}<br/>
              {cliente.endereco}, {cliente.numero} — {cliente.bairro}<br/>
              {cliente.cidade} · CEP: {cliente.cep}
            </div>
          </div>
        )}
      </Field>

      <div style={{ height:"14px" }}/>

      {/* RG do freezer */}
      <Field label="RG DO FREEZER" required>
        <input value={rg} onChange={e=>setRg(e.target.value)}
          placeholder="Ex: 8241554044148-2"
          onFocus={onFocus} onBlur={onBlur}
          style={fieldStyle}/>
      </Field>

      <div style={{ height:"14px" }}/>

      {/* Nome e Telefone do RCA */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:"12px" }}>
        <Field label="SEU NOME">
          <input value={rcaNome} onChange={e=>setRcaNome(e.target.value)}
            placeholder="Ex: João Silva"
            onFocus={onFocus} onBlur={onBlur}
            style={fieldStyle}/>
        </Field>
        <Field label="SEU TELEFONE">
          <input value={rcaFone} onChange={e=>setRcaFone(e.target.value)}
            placeholder="Ex: 77 99999-9999"
            onFocus={onFocus} onBlur={onBlur}
            style={fieldStyle}/>
        </Field>
      </div>

      {/* Campos Fricon */}
      {forn === "fricon" && (<>
        <div style={{ height:"14px" }}/>
        <Field label="DEFEITO" required>
          <textarea value={defeito} onChange={e=>setDefeito(e.target.value)}
            placeholder="Descreva o defeito do equipamento..."
            rows={3} onFocus={onFocus} onBlur={onBlur}
            style={{ ...fieldStyle, resize:"vertical", lineHeight:1.5 }}/>
        </Field>
        <div style={{ height:"14px" }}/>
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:"12px" }}>
          <Field label="HORÁRIO DE ATENDIMENTO" required>
            <input value={horario} onChange={e=>setHorario(e.target.value)}
              placeholder="Ex: 08h-17h"
              onFocus={onFocus} onBlur={onBlur}
              style={fieldStyle}/>
          </Field>
          <Field label="PONTO DE REFERÊNCIA" required>
            <input value={pontoRef} onChange={e=>setPontoRef(e.target.value)}
              placeholder="Ex: Próximo ao banco..."
              onFocus={onFocus} onBlur={onBlur}
              style={fieldStyle}/>
          </Field>
        </div>
      </>)}

      <div style={{ height:"16px" }}/>

      {erro && (
        <div style={{ background:"#FFF0F0", border:"1.5px solid #FECACA", borderRadius:"8px",
                      padding:"10px 14px", color:C.red, fontSize:"12px", marginBottom:"12px" }}>
          {erro}
        </div>
      )}
      {msg && (
        <div style={{ background:"#F0FFF4", border:"1.5px solid #BBF7D0", borderRadius:"8px",
                      padding:"10px 14px", color:"#16A34A", fontSize:"12px", marginBottom:"12px" }}>
          {msg}
        </div>
      )}

      <div style={{ display:"flex", gap:"10px" }}>
        <button onClick={enviar} disabled={enviando}
          style={{ flex:1, background:enviando?"#aaa":C.primary, border:"none", color:"#fff",
                   padding:"12px", borderRadius:"8px", cursor:enviando?"default":"pointer",
                   fontSize:"14px", fontWeight:700, transition:"background .15s" }}>
          {enviando ? "Enviando..." : "Abrir Chamado"}
        </button>
        <button onClick={limpar}
          style={{ padding:"12px 18px", background:"#fff", border:`1.5px solid ${C.border}`,
                   color:C.text, borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
          Limpar
        </button>
      </div>
    </div>
  );
}

// ── Card de chamado ───────────────────────────────────────────────────────────
function ChamadoCard({ c, token, cargo, onUpdate, isMobile }) {
  const headers = useMemo(()=>({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }),[token]);
  const [aberto,    setAberto]    = useState(false);
  const [editando,  setEditando]  = useState(false);
  const [confirmDel,setConfirmDel]= useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [novoStatus,setNovoStatus]= useState(c.status);
  const [os,        setOs]        = useState(c.numero_os??"");
  const [numCham,   setNumCham]   = useState(c.numero_chamado??"");
  const [obs,       setObs]       = useState(c.obs_interna??"");
  const [salvando,  setSalvando]  = useState(false);

  const canEdit = cargo === "admin" || cargo === "gerencial";
  const onFocus = e => e.target.style.borderColor = C.primary;
  const onBlur  = e => e.target.style.borderColor = C.border;

  const salvar = async () => {
    setSalvando(true);
    try {
      await fetch(`${API_BASE}/api/chamados/${c.id}`, {
        method:"PUT", headers,
        body: JSON.stringify({ status:novoStatus, numero_os:os||null,
                               numero_chamado:numCham||null, obs_interna:obs||null }),
      });
      setEditando(false); onUpdate();
    } finally { setSalvando(false); }
  };

  const excluir = async () => {
    setExcluindo(true);
    try {
      await fetch(`${API_BASE}/api/chamados/${c.id}`, { method:"DELETE", headers });
      onUpdate();
    } finally { setExcluindo(false); setConfirmDel(false); }
  };

  const fornLabel = c.fornecedor === "metalfrio" ? "Metal Frio" : "Fricon";
  const fornColor = c.fornecedor === "metalfrio" ? "#2563EB"    : "#EA580C";

  return (
    <div style={{ background:"#fff", border:`1.5px solid ${C.border}`,
                  borderRadius:"10px", overflow:"hidden", marginBottom:"10px",
                  boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>

      {/* Cabeçalho */}
      <div onClick={()=>setAberto(v=>!v)} style={{ cursor:"pointer",
        padding: isMobile ? "10px 12px" : "10px 14px",
        display:"flex", alignItems:"center", gap:"10px",
        borderBottom: aberto ? `1px solid ${C.border}` : "none" }}>
        {aberto
          ? <ChevronDown  size={15} color={C.textSub} style={{ flexShrink:0 }}/>
          : <ChevronRight size={15} color={C.textSub} style={{ flexShrink:0 }}/>}

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:"13px", color:C.text,
                           overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {c.nome_cliente || `Cliente #${c.cod_cliente}`}
            </span>
            <span style={{ fontSize:"10px", fontWeight:700, color:fornColor,
                           background:`${fornColor}18`, borderRadius:"4px",
                           padding:"1px 7px", flexShrink:0, whiteSpace:"nowrap" }}>
              {fornLabel}
            </span>
            {badge(c.status)}
          </div>
          <div style={{ fontSize:"11px", color:C.textSub, marginTop:"3px",
                        display:"flex", gap:"10px", flexWrap:"wrap" }}>
            <span>RG: <b>{c.rg_freezer}</b></span>
            {c.numero_os     && <span style={{ color:C.green,  fontWeight:700 }}>OS: {c.numero_os}</span>}
            {c.numero_chamado && <span style={{ color:C.primary }}>Nº: {c.numero_chamado}</span>}
            <span style={{ marginLeft:"auto" }}>{fmt_dt_hora(c.criado_em)}</span>
          </div>
        </div>
      </div>

      {/* Detalhe */}
      {aberto && (
        <div style={{ padding: isMobile ? "12px" : "14px 16px" }}>

          {/* Grid de informações */}
          <div style={{ display:"grid",
                        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
                        gap:"10px", marginBottom:"14px" }}>
            {[
              ["Cliente",    c.cod_cliente],
              ["CNPJ",       c.cnpj],
              ["Endereço",   [c.endereco, c.numero].filter(Boolean).join(", ")],
              ["Bairro",     c.bairro],
              ["Cidade",     c.cidade],
              ["CEP",        c.cep],
              ["Modelo",     c.modelo],
              ["Voltagem",   c.voltagem],
              ["Vendedor",   c.nome_vendedor],
              ["Contato",    c.rca_nome],
              ["Telefone",   c.rca_fone],
              ["Defeito",    c.defeito],
              ["Horário",    c.horario],
              ["Ref.",       c.ponto_ref],
            ].filter(([,v])=>v).map(([label,val])=>(
              <div key={label} style={{ background:C.rowEven, borderRadius:"6px",
                                        padding:"7px 10px" }}>
                <div style={{ fontSize:"9px", color:C.textSub, fontWeight:700,
                              letterSpacing:"0.05em", marginBottom:"2px" }}>{label}</div>
                <div style={{ fontSize:"12px", color:C.text, wordBreak:"break-word" }}>{val}</div>
              </div>
            ))}
          </div>

          {c.obs_interna && !editando && (
            <div style={{ background:"#FFFBF0", border:"1.5px solid #FDE68A",
                          borderRadius:"8px", padding:"9px 12px",
                          fontSize:"12px", marginBottom:"12px" }}>
              <span style={{ fontWeight:700, color:C.amber }}>Obs: </span>{c.obs_interna}
            </div>
          )}

          {/* Ações admin */}
          {canEdit && !editando && (
            <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
              <button onClick={()=>setEditando(true)}
                style={{ background:"#EBF5FF", border:"1.5px solid #BFDBFE", color:"#2563EB",
                         padding:"8px 14px", borderRadius:"8px", cursor:"pointer",
                         fontSize:"12px", fontWeight:600 }}>
                Editar status / OS
              </button>
              {!confirmDel ? (
                <button onClick={()=>setConfirmDel(true)}
                  style={{ background:"#FFF0F0", border:`1.5px solid ${C.red}50`, color:C.red,
                           padding:"8px 14px", borderRadius:"8px", cursor:"pointer", fontSize:"12px" }}>
                  Remover
                </button>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ fontSize:"12px", color:C.red, fontWeight:600 }}>
                    Confirmar remoção?
                  </span>
                  <button onClick={excluir} disabled={excluindo}
                    style={{ background:C.red, border:"none", color:"#fff",
                             padding:"8px 16px", borderRadius:"8px", cursor:"pointer",
                             fontSize:"12px", fontWeight:700 }}>
                    {excluindo?"...":"Sim"}
                  </button>
                  <button onClick={()=>setConfirmDel(false)}
                    style={{ background:"#fff", border:`1.5px solid ${C.border}`,
                             color:C.text, padding:"8px 12px", borderRadius:"8px",
                             cursor:"pointer", fontSize:"12px" }}>
                    Não
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formulário de edição */}
          {canEdit && editando && (
            <div style={{ background:C.rowEven, border:`1.5px solid ${C.border}`,
                          borderRadius:"10px", padding:"14px" }}>
              <div style={{ display:"grid",
                            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                            gap:"12px", marginBottom:"12px" }}>
                <Field label="STATUS">
                  <select value={novoStatus} onChange={e=>setNovoStatus(e.target.value)}
                    onFocus={onFocus} onBlur={onBlur}
                    style={{ ...fieldStyle }}>
                    {STATUS_LISTA.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="NÚMERO OS">
                  <input value={os} onChange={e=>setOs(e.target.value)}
                    placeholder="Ex: OS-12345"
                    onFocus={onFocus} onBlur={onBlur}
                    style={fieldStyle}/>
                </Field>
                <Field label="Nº CHAMADO">
                  <input value={numCham} onChange={e=>setNumCham(e.target.value)}
                    placeholder="Ex: 987654"
                    onFocus={onFocus} onBlur={onBlur}
                    style={fieldStyle}/>
                </Field>
                <Field label="OBS. INTERNA">
                  <input value={obs} onChange={e=>setObs(e.target.value)}
                    placeholder="Observação..."
                    onFocus={onFocus} onBlur={onBlur}
                    style={fieldStyle}/>
                </Field>
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={salvar} disabled={salvando}
                  style={{ background:C.green, border:"none", color:"#fff",
                           padding:"10px 20px", borderRadius:"8px", cursor:"pointer",
                           fontSize:"13px", fontWeight:700 }}>
                  {salvando?"Salvando...":"Salvar"}
                </button>
                <button onClick={()=>setEditando(false)}
                  style={{ background:"#fff", border:`1.5px solid ${C.border}`,
                           color:C.text, padding:"10px 16px", borderRadius:"8px",
                           cursor:"pointer", fontSize:"13px" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────
export default function ModuleChamados({ isMobile, token, userInfo={} }) {
  const cargo   = userInfo.cargo ?? "vendedor";
  const headers = useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);

  const [chamados,     setChamados]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [filtroForn,   setFiltroForn]   = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/chamados`;
      const ps = [];
      if (filtroForn)   ps.push(`fornecedor=${filtroForn}`);
      if (filtroStatus) ps.push(`status=${encodeURIComponent(filtroStatus)}`);
      if (ps.length)    url += "?" + ps.join("&");
      const j = await fetch(url, { headers }).then(r=>r.json());
      setChamados(j.dados ?? []);
    } finally { setLoading(false); }
  }, [filtroForn, filtroStatus, headers]);

  useEffect(()=>{ carregar(); }, [carregar]);

  // Exporta os chamados (já filtrados) para CSV: CODCLI, RG, Status, Data de abertura
  const exportarExcel = useCallback(() => {
    if (chamados.length === 0) return;

    const fmtData = (dt) => {
      if (!dt) return "";
      const [d, t] = dt.split(" ");
      const [y, m, dia] = d.split("-");
      return `${dia}/${m}/${y} ${t?.slice(0,5) ?? ""}`.trim();
    };

    const cabecalho = ["CODCLI", "RG FREEZER", "STATUS", "DATA ABERTURA"];
    const linhas = chamados.map(c => [
      c.cod_cliente ?? "",
      c.rg_freezer ?? "",
      c.status ?? "",
      fmtData(c.criado_em),
    ]);

    const csv = [cabecalho, ...linhas]
      .map(r => r.map(cel => `"${String(cel).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const hoje = getToday().replace(/-/g, "");
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chamados_freezer_${hoje}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [chamados]);

  const sel = (val, set, opts) => (
    <select value={val} onChange={e=>set(e.target.value)}
      style={{ appearance:"none", border:`1.5px solid ${C.border}`, borderRadius:"8px",
               padding:"8px 12px", fontSize:"12px", outline:"none",
               cursor:"pointer", background:"#fff", color:val?C.text:C.textSub }}>
      {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
    </select>
  );

  // Totais por status
  const totais = useMemo(()=>{
    const m = {};
    chamados.forEach(c=>{ m[c.status]=(m[c.status]??0)+1; });
    return m;
  },[chamados]);

  return (
    <>
      <ModuleHeader icon={FileText} title="CHAMADOS DE FREEZER" isMobile={isMobile} />

      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding: isMobile ? "8px 12px" : "8px 16px",
                    display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>

        {sel(filtroForn, setFiltroForn, [
          ["","Todos fornecedores"],
          ["metalfrio","Metal Frio"],
          ["fricon","Fricon"],
        ])}

        {sel(filtroStatus, setFiltroStatus, [
          ["","Todos status"],
          ...STATUS_LISTA.map(s=>[s,s]),
        ])}

        <button onClick={carregar} disabled={loading}
          style={{ background:"rgba(0,0,0,.07)", border:`1.5px solid ${C.border}`,
                   padding:"7px 10px", borderRadius:"8px", cursor:"pointer",
                   display:"flex", alignItems:"center" }}>
          <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
        </button>

        <button onClick={exportarExcel} disabled={chamados.length === 0}
          title="Exportar CODCLI, RG, Status e data de abertura"
          style={{ display:"flex", alignItems:"center", gap:"6px",
                   background: chamados.length ? C.green : "#ccc", border:"none", color:"#fff",
                   padding:"8px 12px", borderRadius:"8px",
                   cursor: chamados.length ? "pointer" : "default",
                   fontSize:"12px", fontWeight:700,
                   opacity: chamados.length ? 1 : 0.6 }}>
          <FileSpreadsheet size={14}/> Excel
        </button>

        <button onClick={()=>setShowForm(v=>!v)}
          style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"6px",
                   background:showForm?C.primaryDk:C.primary, border:"none", color:"#fff",
                   padding:"8px 14px", borderRadius:"8px", cursor:"pointer",
                   fontSize:"13px", fontWeight:700 }}>
          <Plus size={14}/> {showForm ? "Fechar" : "Novo chamado"}
        </button>
      </div>

      {/* Badges de status */}
      {Object.keys(totais).length > 0 && (
        <div style={{ padding:"8px 16px", display:"flex", gap:"6px",
                      flexWrap:"wrap", borderBottom:`1px solid ${C.border}`,
                      background:"#FAFAFA" }}>
          {Object.entries(totais).map(([s,n])=>{
            const cor = STATUS_CORES[s] ?? STATUS_CORES["Aberto"];
            return (
              <span key={s} onClick={()=>setFiltroStatus(filtroStatus===s?"":s)}
                style={{ background:filtroStatus===s?cor.color:cor.bg,
                         color:filtroStatus===s?"#fff":cor.color,
                         border:`1px solid ${cor.border}`,
                         borderRadius:"20px", padding:"3px 10px",
                         fontSize:"11px", fontWeight:600, cursor:"pointer" }}>
                {s} {n}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ padding: isMobile ? "10px 12px" : "12px 16px" }}>
        {showForm && (
          <FormAbertura token={token} isMobile={isMobile}
            onSucesso={()=>{ setShowForm(false); carregar(); }}/>
        )}

        <div style={{ fontSize:"11px", color:C.textSub, marginBottom:"8px" }}>
          {loading ? "Carregando..." : `${chamados.length} chamado(s)`}
        </div>

        {!loading && chamados.map(c=>(
          <ChamadoCard key={c.id} c={c} token={token} cargo={cargo}
            isMobile={isMobile} onUpdate={carregar}/>
        ))}

        {!loading && chamados.length===0 && (
          <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
            Nenhum chamado encontrado.
          </div>
        )}
      </div>
    </>
  );
}