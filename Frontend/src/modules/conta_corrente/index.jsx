import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Users, User, Building2, Shield,
         ChevronDown, Wallet, CheckCircle, XCircle, Clock, Plus, Minus } from "lucide-react";
import { C, fmtR, fmtDt, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import Dropdown from "../../components/Dropdown";
import ModuleHeader from "../../components/ModuleHeader";
import TableCard from "../../components/TableCard";
import { arrow } from "../../components/ArrowBadge";

const fmtDtHora = v => {
  if (!v) return "—";
  const [dt, hr] = String(v).split("T");
  const [y,m,d] = dt.split("-");
  return `${d}/${m}/${y} ${hr ? hr.slice(0,5) : ""}`;
};

const STATUS_CFG = {
  pendente:  { label:"Pendente",  bg:"#FEF9C3", color:"#854D0E", Icon:Clock       },
  aprovado:  { label:"Aprovado",  bg:"#DCFCE7", color:"#166534", Icon:CheckCircle },
  rejeitado: { label:"Rejeitado", bg:"#FEE2E2", color:"#991B1B", Icon:XCircle     },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pendente;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"4px",
      padding:"2px 8px", borderRadius:"10px", fontSize:"10px", fontWeight:700,
      background:cfg.bg, color:cfg.color, whiteSpace:"nowrap" }}>
      <cfg.Icon size={10}/>{cfg.label}
    </span>
  );
}

function SaldoCard({ row, onSolicitar, cargo }) {
  const pct = row.vllimcred > 0 ? (row.vlcorrente / row.vllimcred) * 100 : 0;
  const cor  = pct >= 80 ? C.red : pct >= 50 ? C.amber : C.green;
  const [hov, setHov] = useState(false);
  const podeSolicitar = cargo === "vendedor" || cargo === "supervisor" || cargo === "admin" || cargo === "gerencial";
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:hov?C.rowHover:"#fff", border:`1px solid ${C.border}`,
        borderRadius:"8px", padding:"12px 14px",
        boxShadow: hov?"0 4px 12px rgba(170,0,0,.12)":"0 1px 4px rgba(0,0,0,.06)",
        transition:"all .15s" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"8px" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:"13px", color:C.text }}>{row.nome_vendedor}</div>
          <div style={{ fontSize:"10px", color:C.textSub }}>RCA #{row.cod_vendedor} · {row.nome_supervisor ?? "—"}</div>
        </div>
        {podeSolicitar && (
          <button onClick={()=>onSolicitar(row)}
            style={{ display:"none", alignItems:"center", gap:"4px", padding:"4px 8px",
              background:C.primary, border:"none", color:"#fff", borderRadius:"5px",
              cursor:"pointer", fontSize:"11px", fontWeight:700 }}>
            <Plus size={11}/> Solicitar
          </button>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px", marginBottom:"8px" }}>
        {[
          ["Utilizado",   fmtR(row.vlcorrente),  cor   ],
          ["Limite",      fmtR(row.vllimcred),    C.text],
          ["Disponível",  fmtR(row.disponivel),   C.green],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:C.rowEven, borderRadius:"5px", padding:"5px 8px" }}>
            <div style={{ fontSize:"9px", color:C.textSub, fontWeight:600 }}>{l}</div>
            <div style={{ fontSize:"12px", fontWeight:700, color:c, fontFamily:C.mono }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ height:"5px", background:"#EED0D0", borderRadius:"3px", overflow:"hidden" }}>
        <div style={{ width:`${Math.min(pct,100)}%`, height:"100%",
          background:cor, borderRadius:"3px", transition:"width .3s" }}/>
      </div>
      <div style={{ fontSize:"9px", color:C.textSub, marginTop:"2px", textAlign:"right" }}>
        {pct.toFixed(1)}% utilizado
      </div>
    </div>
  );
}

function ModalSolicitar({ row, onClose, onSubmit, loading, isSupervisor, destinoNome }) {
  const [valor, setValor]       = useState("");
  const [tipo, setTipo]         = useState(isSupervisor ? "debito" : "credito");
  const [historico, setHist]    = useState("");

  const submit = () => {
    const v = parseFloat(valor.replace(",","."));
    if (!v || v <= 0) return alert("Informe um valor válido");
    if (!historico.trim()) return alert("Informe o histórico/motivo");
    onSubmit({ codusur:row.cod_vendedor, valor:v, tipo, historico:historico.trim() });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:"10px", padding:"24px",
          width:"min(400px, 92vw)", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight:700, fontSize:"15px", color:C.primary, marginBottom:"4px" }}>
          {isSupervisor ? "Transferência" : "Solicitar Lançamento"} — {row.nome_vendedor}
        </div>

        {/* Info de transferência para supervisor */}
        {isSupervisor && (
          <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA",
            borderRadius:"6px", padding:"8px 12px", marginBottom:"12px",
            fontSize:"11px", color:"#92400E" }}>
            <b>Débito de:</b> {row.nome_vendedor} (RCA #{row.cod_vendedor})<br/>
            <b>Crédito em:</b> {destinoNome} (sua conta RCA)
          </div>
        )}

        {/* Tipo — supervisor só vê "Débito" */}
        {!isSupervisor && (
          <div style={{ marginBottom:"10px" }}>
            <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub }}>TIPO</label>
            <div style={{ display:"flex", gap:"8px", marginTop:"4px" }}>
              {[["credito","Crédito",C.green],["debito","Débito",C.red]].map(([id,label,cor])=>(
                <button key={id} onClick={()=>setTipo(id)}
                  style={{ flex:1, padding:"7px", border:`2px solid ${tipo===id?cor:C.border}`,
                    borderRadius:"6px", cursor:"pointer", fontWeight:700, fontSize:"12px",
                    background:tipo===id?cor:"#fff", color:tipo===id?"#fff":C.text }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom:"10px" }}>
          <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub }}>VALOR (R$)</label>
          <input value={valor} onChange={e=>setValor(e.target.value)}
            placeholder="0,00" type="number" step="0.01" min="0"
            style={{ width:"100%", marginTop:"4px", padding:"8px 10px",
              border:`1px solid ${C.border}`, borderRadius:"6px",
              fontSize:"14px", fontFamily:C.mono, outline:"none", boxSizing:"border-box" }}/>
        </div>

        <div style={{ marginBottom:"16px" }}>
          <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub }}>HISTÓRICO / MOTIVO</label>
          <input value={historico} onChange={e=>setHist(e.target.value)}
            placeholder="Descreva o motivo..." maxLength={40}
            style={{ width:"100%", marginTop:"4px", padding:"8px 10px",
              border:`1px solid ${C.border}`, borderRadius:"6px",
              fontSize:"12px", outline:"none", boxSizing:"border-box" }}/>
          <div style={{ fontSize:"9px", color:C.textSub, textAlign:"right" }}>{historico.length}/40</div>
        </div>

        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"9px", border:`1px solid ${C.border}`,
              borderRadius:"6px", cursor:"pointer", fontSize:"13px", background:"#fff" }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            style={{ flex:2, padding:"9px", background:C.primary, border:"none",
              borderRadius:"6px", cursor:"pointer", fontSize:"13px",
              fontWeight:700, color:"#fff", opacity:loading?.6:1 }}>
            {loading ? "Enviando..." : isSupervisor ? "Transferir" : "Solicitar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalVerba({ onClose, onSubmit, loading }) {
  const [valor, setValor]    = useState("");
  const [historico, setHist] = useState("");

  const submit = () => {
    const v = parseFloat(valor.replace(",","."));
    if (!v || v <= 0) return alert("Informe um valor válido");
    if (!historico.trim()) return alert("Informe o motivo");
    onSubmit({ valor:v, tipo:"verba", historico:historico.trim() });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:"10px", padding:"24px",
          width:"min(380px, 92vw)", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight:700, fontSize:"15px", color:"#7C3AED", marginBottom:"4px" }}>
          💰 Solicitar Verba
        </div>
        <div style={{ fontSize:"11px", color:C.textSub, marginBottom:"16px" }}>
          Solicitação de verba enviada ao admin para aprovação.
        </div>

        <div style={{ marginBottom:"10px" }}>
          <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub }}>VALOR (R$)</label>
          <input value={valor} onChange={e=>setValor(e.target.value)}
            placeholder="0,00" type="number" step="0.01" min="0"
            style={{ width:"100%", marginTop:"4px", padding:"8px 10px",
              border:`1px solid ${C.border}`, borderRadius:"6px",
              fontSize:"14px", fontFamily:C.mono, outline:"none", boxSizing:"border-box" }}/>
        </div>

        <div style={{ marginBottom:"16px" }}>
          <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub }}>MOTIVO</label>
          <input value={historico} onChange={e=>setHist(e.target.value)}
            placeholder="Descreva o motivo..." maxLength={40}
            style={{ width:"100%", marginTop:"4px", padding:"8px 10px",
              border:`1px solid ${C.border}`, borderRadius:"6px",
              fontSize:"12px", outline:"none", boxSizing:"border-box" }}/>
          <div style={{ fontSize:"9px", color:C.textSub, textAlign:"right" }}>{historico.length}/40</div>
        </div>

        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"9px", border:`1px solid ${C.border}`,
              borderRadius:"6px", cursor:"pointer", fontSize:"13px", background:"#fff" }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            style={{ flex:2, padding:"9px", background:"#7C3AED", border:"none",
              borderRadius:"6px", cursor:"pointer", fontSize:"13px",
              fontWeight:700, color:"#fff", opacity:loading?.6:1 }}>
            {loading ? "Enviando..." : "💰 Solicitar Verba"}
          </button>
        </div>
      </div>
    </div>
  );
}


function ModalAprovar({ sol, onClose, onConfirm, loading }) {
  const [obs, setObs] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:"10px", padding:"24px",
          width:"min(380px, 92vw)", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight:700, fontSize:"15px", color:C.primary, marginBottom:"4px" }}>
          Confirmar Aprovação
        </div>
        <div style={{ fontSize:"12px", color:C.textSub, marginBottom:"16px" }}>
          {sol.nome_vendedor} · {sol.tipo === "credito" ? "+" : "-"}{fmtR(sol.valor)}
        </div>
        <div style={{ background:C.rowEven, borderRadius:"6px", padding:"10px 12px",
          fontSize:"12px", marginBottom:"12px" }}>
          <b>Motivo:</b> {sol.historico}
        </div>
        <div style={{ marginBottom:"16px" }}>
          <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub }}>OBS. ADMIN (opcional)</label>
          <input value={obs} onChange={e=>setObs(e.target.value)} maxLength={40}
            placeholder="Observação interna..."
            style={{ width:"100%", marginTop:"4px", padding:"8px 10px",
              border:`1px solid ${C.border}`, borderRadius:"6px",
              fontSize:"12px", outline:"none", boxSizing:"border-box" }}/>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"9px", border:`1px solid ${C.border}`,
              borderRadius:"6px", cursor:"pointer", fontSize:"13px", background:"#fff" }}>
            Cancelar
          </button>
          <button onClick={()=>onConfirm(obs)} disabled={loading}
            style={{ flex:2, padding:"9px", background:C.green, border:"none",
              borderRadius:"6px", cursor:"pointer", fontSize:"13px",
              fontWeight:700, color:"#fff", opacity:loading?.6:1 }}>
            {loading ? "Aprovando..." : "✔ Aprovar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ABAS = ["saldos","pendentes","historico","extrato"];

export default function ModuleContaCorrente({ isMobile, token, userInfo = {} }) {
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;
  const isAdmin = cargo === "admin";
  const isSupervisor = cargo === "supervisor";
  // Espelha config.py SUP_TO_RCA — supervisor → seu próprio RCA
  const SUP_TO_RCA_FE = {2:2, 8:160, 9:180};
  const meuRca = isSupervisor ? (SUP_TO_RCA_FE[codUser] ?? null) : null;
  const headers = useMemo(() => ({ Authorization:`Bearer ${token}` }), [token]);

  const [aba,         setAba]         = useState("saldos");
  const [saldos,      setSaldos]      = useState([]);
  const [pendentes,   setPendentes]   = useState([]);
  const [historico,   setHistorico]   = useState([]);
  const [extrato,     setExtrato]     = useState([]);
  const [extratoRca,  setExtratoRca]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [error,       setError]       = useState(null);
  const [busca,       setBusca]       = useState("");

  const [modalSol,    setModalSol]    = useState(null);   // row selecionado p/ solicitar
  const [modalAprov,  setModalAprov]  = useState(null);   // sol p/ aprovar
  const [modalVerba,  setModalVerba]  = useState(false);  // verba p/ supervisor

  const api = useCallback(async (path, opts={}) => {
    const res = await fetch(`${API_BASE}${path}`, { headers, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [headers]);

  const fetchSaldos = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSaldos((await api("/api/conta-corrente")).dados ?? []); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const fetchPendentes = useCallback(async () => {
    setLoading(true); setError(null);
    try { setPendentes((await api("/api/conta-corrente/pendentes")).dados ?? []); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const fetchHistorico = useCallback(async () => {
    setLoading(true); setError(null);
    try { setHistorico((await api("/api/conta-corrente/historico")).dados ?? []); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  const fetchExtrato = useCallback(async (codusur) => {
    setLoading(true); setError(null);
    try {
      setExtratoRca(codusur);
      setExtrato((await api(`/api/conta-corrente/extrato/${codusur}`)).dados ?? []);
      setAba("extrato");
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    if (aba === "saldos")    fetchSaldos();
    if (aba === "pendentes") fetchPendentes();
    if (aba === "historico") fetchHistorico();
  }, [aba]);

  const handleVerba = async (payload) => {
    setLoadingAcao(true);
    try {
      await api("/api/conta-corrente/solicitar", {
        method:"POST",
        headers:{ ...headers, "Content-Type":"application/json" },
        body: JSON.stringify({ ...payload, codusur: codUser }),
      });
      setModalVerba(false);
      alert("Solicitação de verba enviada!");
    } catch(e) { alert(`Erro: ${e.message}`); }
    finally { setLoadingAcao(false); }
  };

  const handleSolicitar = async (payload) => {
    setLoadingAcao(true);
    try {
      await api("/api/conta-corrente/solicitar", {
        method:"POST",
        headers:{ ...headers, "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });
      setModalSol(null);
      alert("Solicitação enviada com sucesso!");
      fetchSaldos();
    } catch(e) { alert(`Erro: ${e.message}`); }
    finally { setLoadingAcao(false); }
  };

  const handleAprovar = async (solId, obs) => {
    setLoadingAcao(true);
    try {
      const r = await api(`/api/conta-corrente/aprovar/${solId}`, {
        method:"POST",
        headers:{ ...headers, "Content-Type":"application/json" },
        body: JSON.stringify({ obs_admin: obs }),
      });
      setModalAprov(null);
      alert(`Aprovado! Saldo: ${fmtR(r.vlcorrente_ant)} → ${fmtR(r.vlcorrente_novo)}`);
      fetchPendentes();
    } catch(e) { alert(`Erro: ${e.message}`); }
    finally { setLoadingAcao(false); }
  };

  const handleRejeitar = async (solId) => {
    if (!confirm("Rejeitar esta solicitação?")) return;
    try {
      await api(`/api/conta-corrente/rejeitar/${solId}`, {
        method:"POST",
        headers:{ ...headers, "Content-Type":"application/json" },
        body: JSON.stringify({ obs_admin:"" }),
      });
      fetchPendentes();
    } catch(e) { alert(`Erro: ${e.message}`); }
  };

  const saldosFiltrados = useMemo(() => {
    if (!busca) return saldos;
    const s = busca.toLowerCase();
    return saldos.filter(r =>
      r.nome_vendedor?.toLowerCase().includes(s) ||
      String(r.cod_vendedor).includes(s)
    );
  }, [saldos, busca]);

  const totLimite    = saldos.reduce((a,r)=>a+(r.vllimcred??0),0);
  const totUtilizado = saldos.reduce((a,r)=>a+(r.vlcorrente??0),0);
  const totDisp      = saldos.reduce((a,r)=>a+(r.disponivel??0),0);

  const abas_visiveis = isAdmin
    ? ["saldos","pendentes","historico"]
    : cargo === "vendedor"
    ? ["saldos","historico"]
    : ["saldos","historico"];

  return (<>
    <ModuleHeader icon={Wallet} title="CONTA CORRENTE RCA" isMobile={isMobile}>
      {aba==="saldos" && saldos.length > 0 && (
        <div style={{ display:"flex", gap:"16px", fontSize:"11px" }}>
          {[["Limite Total",fmtR(totLimite),C.gold],
            ["Utilizado",fmtR(totUtilizado),C.red],
            ["Disponível",fmtR(totDisp),C.green]].map(([l,v,c])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ color:"rgba(255,255,255,.65)", fontSize:"10px" }}>{l}</div>
              <div style={{ color:c, fontWeight:700, fontFamily:C.mono }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {pendentes.length > 0 && aba !== "pendentes" && (
        <button onClick={()=>setAba("pendentes")}
          style={{ background:C.amber, border:"none", color:"#fff",
            padding:"5px 10px", borderRadius:"6px", cursor:"pointer",
            fontSize:"11px", fontWeight:700, display:"flex", alignItems:"center", gap:"4px" }}>
          <Clock size={11}/> {pendentes.length} pendente{pendentes.length>1?"s":""}
        </button>
      )}
    </ModuleHeader>

    {/* Abas */}
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
      padding:isMobile?"6px 10px":"8px 16px",
      display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
      <div style={{ display:"flex", border:`1px solid ${C.border}`, borderRadius:"6px", overflow:"hidden" }}>
        {[
          ["saldos",    "Saldos"],
          ...(isAdmin?[["pendentes",`Pendentes${pendentes.length>0?` (${pendentes.length})`:""}`]]:[] ),
          ["historico", "Histórico"],
          ...(aba==="extrato"?[["extrato","Extrato"]]:[] ),
        ].map(([id,label],idx,arr)=>(
          <button key={id} onClick={()=>setAba(id)}
            style={{ padding:"6px 12px", border:"none", cursor:"pointer", fontSize:"12px",
              background:aba===id?C.primary:"#fff",
              color:aba===id?"#fff":id==="pendentes"&&pendentes.length>0?C.amber:C.text,
              fontWeight:aba===id||id==="pendentes"&&pendentes.length>0?700:400,
              borderRight:idx<arr.length-1?`1px solid ${C.border}`:"none" }}>
            {label}
          </button>
        ))}
      </div>

      {aba==="saldos" && (
        <input placeholder="Buscar vendedor..." value={busca} onChange={e=>setBusca(e.target.value)}
          style={{ padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
            fontSize:"12px", outline:"none", width:"180px" }}/>
      )}

      {cargo === "supervisor" && (
        <button onClick={()=>setModalVerba(true)}
          style={{ display:"none", alignItems:"center", gap:"5px", padding:"6px 12px",
            background:"#7C3AED", border:"none", color:"#fff", borderRadius:"6px",
            cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
          💰 Solicitar Verba
        </button>
      )}

      <button onClick={()=>{
        if(aba==="saldos")    fetchSaldos();
        if(aba==="pendentes") fetchPendentes();
        if(aba==="historico") fetchHistorico();
      }} disabled={loading}
        style={{ background:"rgba(0,0,0,.07)", border:`1px solid ${C.border}`,
          padding:"6px 8px", borderRadius:"6px", cursor:"pointer",
          display:"flex", alignItems:"center" }}>
        <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
      </button>
    </div>

    {/* Conteúdo */}
    <div style={{ padding:isMobile?"8px":"12px 16px" }}>
      {loading && <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Carregando...</div>}
      {error   && <div style={{ padding:"24px", textAlign:"center", color:C.red }}>{error}</div>}

      {/* ── Saldos ── */}
      {aba==="saldos" && !loading && !error && (
        <div style={{ display:"grid",
          gridTemplateColumns: isMobile?"1fr":"repeat(auto-fill, minmax(280px, 1fr))",
          gap:"12px" }}>
          {saldosFiltrados.map(row => (
            <SaldoCard key={row.cod_vendedor} row={row}
              cargo={cargo}
              onSolicitar={r => setModalSol(r)}/>
          ))}
          {saldosFiltrados.length === 0 && (
            <div style={{ gridColumn:"1/-1", padding:"48px", textAlign:"center", color:C.textSub }}>
              Nenhum vendedor encontrado.
            </div>
          )}
        </div>
      )}

      {/* ── Pendentes (admin) ── */}
      {aba==="pendentes" && !loading && !error && (
        <TableCard>
          {pendentes.length === 0
            ? <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Nenhuma solicitação pendente.</div>
            : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                <thead>
                  <tr>
                    {["DATA","VENDEDOR","TIPO","VALOR","HISTÓRICO","AÇÕES"].map(h=>(
                      <th key={h} style={{ padding:"6px 10px", background:C.subHeader,
                        color:"#fff", fontSize:"10px", fontWeight:700, whiteSpace:"nowrap",
                        border:`1px solid ${C.primaryDk}`, textAlign: h==="VALOR"?"right":"left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((s,i)=>{
                    const bg = i%2===0?C.rowEven:C.rowOdd;
                    const td = { padding:"7px 10px", borderBottom:`1px solid ${C.border}`, background:bg };
                    return (
                      <tr key={s.id}>
                        <td style={{ ...td, fontFamily:C.mono, fontSize:"11px" }}>{fmtDtHora(s.criado_em)}</td>
                        <td style={{ ...td, fontWeight:600 }}>{s.nome_vendedor}</td>
                        <td style={{ ...td }}>
                          <span style={{ padding:"2px 7px", borderRadius:"8px", fontSize:"10px",
                            fontWeight:700,
                            background: s.tipo==="verba"?"#EDE9FE":s.tipo==="credito"?"#DCFCE7":"#FEE2E2",
                            color:      s.tipo==="verba"?"#7C3AED":s.tipo==="credito"?C.green:C.red }}>
                            {s.tipo==="verba"?"💰 verba":s.tipo==="credito"?<>+crédito</>:<>-débito</>}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700,
                          color: s.tipo==="verba"?"#7C3AED":s.tipo==="credito"?C.green:C.red }}>{fmtR(s.valor)}</td>
                        <td style={{ ...td, maxWidth:"200px", overflow:"hidden",
                          textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.historico}</td>
                        <td style={{ ...td }}>
                          <div style={{ display:"flex", gap:"6px" }}>
                            <button onClick={()=>setModalAprov(s)}
                              style={{ padding:"4px 10px", background:C.green, border:"none",
                                color:"#fff", borderRadius:"4px", cursor:"pointer",
                                fontSize:"11px", fontWeight:700 }}>✔ Aprovar</button>
                            <button onClick={()=>handleRejeitar(s.id)}
                              style={{ padding:"4px 10px", background:C.red, border:"none",
                                color:"#fff", borderRadius:"4px", cursor:"pointer",
                                fontSize:"11px", fontWeight:700 }}>✖ Rejeitar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </TableCard>
      )}

      {/* ── Histórico ── */}
      {aba==="historico" && !loading && !error && (
        <TableCard>
          {historico.length === 0
            ? <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Sem histórico.</div>
            : <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
                  <thead>
                    <tr>
                      {["DATA","VENDEDOR","TIPO","VALOR","HISTÓRICO","STATUS","RESOLVIDO POR"].map(h=>(
                        <th key={h} style={{ padding:"6px 10px", background:C.subHeader,
                          color:"#fff", fontSize:"10px", fontWeight:700, whiteSpace:"nowrap",
                          border:`1px solid ${C.primaryDk}`, textAlign:h==="VALOR"?"right":"left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((s,i)=>{
                      const bg = i%2===0?C.rowEven:C.rowOdd;
                      const td = { padding:"6px 10px", borderBottom:`1px solid ${C.border}`, background:bg };
                      return (
                        <tr key={s.id}>
                          <td style={{ ...td, fontFamily:C.mono, fontSize:"11px" }}>{fmtDtHora(s.criado_em)}</td>
                          <td style={{ ...td, fontWeight:500 }}>{s.nome_vendedor}</td>
                          <td style={{ ...td }}>
                            <span style={{ padding:"2px 7px", borderRadius:"8px", fontSize:"10px",
                              fontWeight:700,
                              background:s.tipo==="verba"?"#EDE9FE":s.tipo==="credito"?"#DCFCE7":"#FEE2E2",
                              color:s.tipo==="verba"?"#7C3AED":s.tipo==="credito"?C.green:C.red }}>
                              {s.tipo==="verba"?"💰 verba":s.tipo}
                            </span>
                          </td>
                          <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700,
                            color:s.tipo==="credito"?C.green:C.red }}>{fmtR(s.valor)}</td>
                          <td style={{ ...td, maxWidth:"180px", overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.historico}</td>
                          <td style={{ ...td }}><StatusBadge status={s.status}/></td>
                          <td style={{ ...td, fontSize:"11px", color:C.textSub }}>{s.resolvido_por ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          }
        </TableCard>
      )}

      {/* ── Extrato Oracle ── */}
      {aba==="extrato" && !loading && !error && (
        <TableCard>
          <div style={{ padding:"8px 14px", background:`linear-gradient(90deg,${C.header},${C.primary})`,
            color:"#fff", fontWeight:700, fontSize:"12px" }}>
            Extrato Winthor — RCA #{extratoRca}
          </div>
          {extrato.length === 0
            ? <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>Sem movimentações.</div>
            : <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
                  <thead>
                    <tr>
                      {["DATA","ROTINA","SALDO ANT.","SALDO NOVO","DIFERENÇA","HISTÓRICO","OBS"].map(h=>(
                        <th key={h} style={{ padding:"5px 8px", background:C.subHeader,
                          color:"#fff", fontSize:"10px", fontWeight:700, whiteSpace:"nowrap",
                          border:`1px solid ${C.primaryDk}`,
                          textAlign:["SALDO ANT.","SALDO NOVO","DIFERENÇA"].includes(h)?"right":"left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extrato.map((e,i)=>{
                      const bg = i%2===0?C.rowEven:C.rowOdd;
                      const td = { padding:"5px 8px", borderBottom:`1px solid ${C.border}`, background:bg };
                      const diff = (e.vlcorrente??0) - (e.vlcorrenteant??0);
                      return (
                        <tr key={i}>
                          <td style={{ ...td, fontFamily:C.mono, whiteSpace:"nowrap" }}>{fmtDt(e.data_mov)}</td>
                          <td style={{ ...td, textAlign:"center", color:C.textSub }}>{e.rotina}</td>
                          <td style={{ ...td, textAlign:"right", fontFamily:C.mono }}>{fmtR(e.vlcorrenteant)}</td>
                          <td style={{ ...td, textAlign:"right", fontFamily:C.mono, fontWeight:700 }}>{fmtR(e.vlcorrente)}</td>
                          <td style={{ ...td, textAlign:"right", fontFamily:C.mono,
                            color:diff>=0?C.green:C.red, fontWeight:600 }}>
                            {diff>=0?"+":""}{fmtR(diff)}
                          </td>
                          <td style={{ ...td }}>{e.historico}</td>
                          <td style={{ ...td, color:C.textSub }}>{e.historico2}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          }
        </TableCard>
      )}
    </div>

    {/* Botão extrato por card (coloca abaixo dos saldos) */}
    {aba==="saldos" && !loading && !error && isAdmin && saldosFiltrados.length > 0 && (
      <div style={{ padding:"0 16px 8px", display:"flex", gap:"6px", flexWrap:"wrap" }}>
        {saldosFiltrados.map(row=>(
          <button key={row.cod_vendedor} onClick={()=>fetchExtrato(row.cod_vendedor)}
            style={{ padding:"3px 10px", fontSize:"10px", fontWeight:600,
              border:`1px solid ${C.border}`, borderRadius:"12px",
              background:"#fff", color:C.textSub, cursor:"pointer" }}>
            Extrato #{row.cod_vendedor}
          </button>
        ))}
      </div>
    )}

    {/* Modais */}
    {modalVerba && (
      <ModalVerba loading={loadingAcao}
        onClose={()=>setModalVerba(false)}
        onSubmit={handleVerba}/>
    )}
    {modalSol && (
      <ModalSolicitar row={modalSol} loading={loadingAcao}
        isSupervisor={isSupervisor}
        destinoNome={isSupervisor ? (saldos.find(s=>s.cod_vendedor===meuRca)?.nome_vendedor ?? `RCA #${meuRca}`) : null}
        onClose={()=>setModalSol(null)}
        onSubmit={handleSolicitar}/>
    )}
    {modalAprov && (
      <ModalAprovar sol={modalAprov} loading={loadingAcao}
        onClose={()=>setModalAprov(null)}
        onConfirm={(obs)=>handleAprovar(modalAprov.id, obs)}/>
    )}
  </>);
}