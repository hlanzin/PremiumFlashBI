import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Plus, Edit2, Trash2, Check, X, ChevronDown, Shield } from "lucide-react";
import { C, getToday } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api-flash.premiumvc.com.br";

const CARGOS = ["admin","gerencial","supervisor","vendedor","fornecedor"];

const badge = (cargo) => {
  const cores = {
    admin:      ["#7C3AED","#EDE9FE"],
    gerencial:  [C.primary,"#FFF0F0"],
    supervisor: [C.amber,"#FFF9EB"],
    vendedor:   ["#2563EB","#EFF6FF"],
    fornecedor: [C.green,"#F0FFF4"],
  };
  const [color, bg] = cores[cargo] ?? [C.textSub, C.bg];
  return (
    <span style={{ background:bg, color, border:`1px solid ${color}30`,
                   borderRadius:"4px", padding:"2px 8px", fontSize:"10px", fontWeight:700 }}>
      {cargo}
    </span>
  );
};

// ── Painel de Usuários ────────────────────────────────────────────────────────
function PainelUsuarios({ token }) {
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const [usuarios,    setUsuarios]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [editando,    setEditando]    = useState(null);
  const [editForm,    setEditForm]    = useState({});   // fora do map — um usuário de cada vez
  const [novoUser,    setNovoUser]    = useState(false);
  const [form,        setForm]        = useState({});
  const [detalheSel,  setDetalheSel]  = useState(null);
  const [secoesList,  setSecoesList]  = useState([]);
  const [fornecList,  setFornecList]  = useState([]);
  const [msg,         setMsg]         = useState("");
  const [novaSenhas,  setNovaSenhas]  = useState({});
  const [novasSecoes, setNovasSecoes] = useState({});
  const [novosFornec, setNovosFornec] = useState({});

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch(`${API_BASE}/api/admin/usuarios`, { headers }).then(r => r.json());
      setUsuarios(j.dados ?? []);
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirDetalhes = async (u) => {
    if (detalheSel?.id === u.id) { setDetalheSel(null); return; }
    const [jSec, jFor] = await Promise.all([
      fetch(`${API_BASE}/api/admin/usuarios/${u.id}/secoes`,    { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/usuarios/${u.id}/codfornecs`, { headers }).then(r => r.json()),
    ]);
    setSecoesList(jSec.dados ?? []);
    setFornecList(jFor.dados ?? []);
    setDetalheSel(u);
  };

  const salvarEdicao = async (id, dados) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${id}`, {
      method:"PUT", headers, body:JSON.stringify(dados),
    });
    setEditando(null); carregar();
    setMsg("Salvo!"); setTimeout(() => setMsg(""), 2000);
  };

  const salvarSenha = async (id, senha) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${id}/senha`, {
      method:"PUT", headers, body:JSON.stringify({ nova_senha:senha }),
    });
    setMsg("Senha alterada!"); setTimeout(() => setMsg(""), 2000);
  };

  const toggleAtivo = async (u) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${u.id}`, {
      method:"PUT", headers, body:JSON.stringify({ ativo: u.ativo ? 0 : 1 }),
    });
    carregar();
  };

  const criarUsuario = async () => {
    if (!form.username || !form.senha || !form.cargo) return;
    await fetch(`${API_BASE}/api/admin/usuarios`, {
      method:"POST", headers, body:JSON.stringify(form),
    });
    setNovoUser(false); setForm({});
    carregar();
    setMsg("Usuário criado!"); setTimeout(() => setMsg(""), 2000);
  };

  const addSecao = async (uid, codsec) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${uid}/secoes`, {
      method:"POST", headers, body:JSON.stringify({ codsec }),
    });
    setSecoesList(p => [...p, codsec].sort((a,b) => a-b));
  };

  const delSecao = async (uid, codsec) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${uid}/secoes/${codsec}`, { method:"DELETE", headers });
    setSecoesList(p => p.filter(x => x !== codsec));
  };

  const addFornec = async (uid, codfornec) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${uid}/codfornecs`, {
      method:"POST", headers, body:JSON.stringify({ codfornec }),
    });
    setFornecList(p => [...p, codfornec].sort((a,b) => a-b));
  };

  const delFornec = async (uid, codfornec) => {
    await fetch(`${API_BASE}/api/admin/usuarios/${uid}/codfornecs/${codfornec}`, { method:"DELETE", headers });
    setFornecList(p => p.filter(x => x !== codfornec));
  };

  const thStyle = {
    padding:"7px 10px", background:C.subHeader, color:"#fff",
    fontSize:"11px", fontWeight:700, textAlign:"left",
    border:`1px solid ${C.primaryDk}`, whiteSpace:"nowrap",
  };
  const tdStyle = (extra={}) => ({
    padding:"7px 10px", borderBottom:`1px solid ${C.border}`,
    verticalAlign:"middle", fontSize:"12px", ...extra,
  });

  return (
    <div style={{ padding:"16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
        <button onClick={() => { setNovoUser(v=>!v); setForm({}); }}
          style={{ display:"flex", alignItems:"center", gap:"6px",
                   background:novoUser?C.primaryDk:C.primary, border:"none", color:"#fff",
                   padding:"8px 16px", borderRadius:"6px", cursor:"pointer",
                   fontSize:"12px", fontWeight:700, fontFamily:C.sans }}>
          <Plus size={14}/> Novo usuário
        </button>
        <button onClick={carregar} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:"6px", background:"#fff",
                   border:`1px solid ${C.border}`, color:C.text, padding:"7px 12px",
                   borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
          <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
        </button>
        {msg && <span style={{ fontSize:"12px", fontWeight:600, color:C.green }}>{msg}</span>}
      </div>

      {/* Formulário novo usuário */}
      {novoUser && (
        <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:"8px",
                      padding:"14px", marginBottom:"14px" }}>
          <div style={{ fontWeight:700, fontSize:"13px", color:C.primary, marginBottom:"10px" }}>
            Novo usuário
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", alignItems:"flex-end" }}>
            {[["username","Login",200],["senha","Senha",150],["nome","Nome",200]].map(([k,p,w]) => (
              <input key={k} placeholder={p} value={form[k]??""} type={k==="senha"?"password":"text"}
                onChange={e => setForm(f => ({...f,[k]:e.target.value}))}
                style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                         fontSize:"12px", outline:"none", width:`${w}px` }}/>
            ))}
            <select value={form.cargo??""} onChange={e => setForm(f => ({...f,cargo:e.target.value}))}
              style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                       fontSize:"12px", outline:"none" }}>
              <option value="">Cargo...</option>
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Cod Winthor" value={form.cod_winthor??""} type="number"
              onChange={e => setForm(f => ({...f,cod_winthor:e.target.value?Number(e.target.value):undefined}))}
              style={{ padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:"6px",
                       fontSize:"12px", outline:"none", width:"120px" }}/>
            <button onClick={criarUsuario}
              style={{ background:C.green, border:"none", color:"#fff", padding:"7px 16px",
                       borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Tabela de usuários */}
      <div style={{ background:"#fff", border:`1px solid ${C.border}`,
                    borderRadius:"8px", overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr>
                <th style={thStyle}>LOGIN</th>
                <th style={thStyle}>NOME</th>
                <th style={thStyle}>CARGO</th>
                <th style={thStyle}>COD</th>
                <th style={thStyle}>STATUS</th>
                <th style={thStyle}>CRIADO</th>
                <th style={{...thStyle, textAlign:"center"}}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding:"24px", textAlign:"center", color:C.textSub }}>
                  Carregando...
                </td></tr>
              )}
              {!loading && usuarios.map((u, i) => {
                const isEdit = editando === u.id;
                const bg = i%2===0 ? C.rowEven : C.rowOdd;

                return (
                  <>
                    <tr key={u.id} style={{ background:bg }}>
                      <td style={tdStyle({ fontFamily:C.mono, fontWeight:600 })}>{u.username}</td>
                      <td style={tdStyle()}>
                        {isEdit ? (
                          <input value={editForm.nome??u.nome??""} style={{ padding:"3px 6px",
                            border:`1px solid ${C.border}`, borderRadius:"4px", fontSize:"12px",
                            width:"140px", outline:"none" }}
                            onChange={e => setEditForm(f=>({...f,nome:e.target.value}))}/>
                        ) : u.nome}
                      </td>
                      <td style={tdStyle()}>
                        {isEdit ? (
                          <select value={editForm.cargo??u.cargo}
                            onChange={e => setEditForm(f=>({...f,cargo:e.target.value}))}
                            style={{ padding:"3px 6px", border:`1px solid ${C.border}`,
                                     borderRadius:"4px", fontSize:"12px", outline:"none" }}>
                            {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : badge(u.cargo)}
                      </td>
                      <td style={tdStyle({ fontFamily:C.mono })}>
                        {isEdit ? (
                          <input value={editForm.cod_winthor??u.cod_winthor??""} type="number"
                            onChange={e => setEditForm(f=>({...f,cod_winthor:Number(e.target.value)||undefined}))}
                            style={{ padding:"3px 6px", border:`1px solid ${C.border}`,
                                     borderRadius:"4px", fontSize:"12px", width:"80px", outline:"none" }}/>
                        ) : (u.cod_winthor ?? "—")}
                      </td>
                      <td style={tdStyle()}>
                        <span style={{ color:u.ativo?C.green:C.red, fontWeight:600, fontSize:"11px" }}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td style={tdStyle({ fontSize:"11px", color:C.textSub })}>
                        {u.criado_em?.split(" ")[0] ?? "—"}
                      </td>
                      <td style={tdStyle({ textAlign:"center" })}>
                        <div style={{ display:"flex", gap:"4px", justifyContent:"center" }}>
                          {isEdit ? (
                            <>
                              <button onClick={() => salvarEdicao(u.id, editForm)}
                                style={{ background:C.green, border:"none", color:"#fff",
                                         padding:"4px 8px", borderRadius:"4px", cursor:"pointer" }}>
                                <Check size={13}/>
                              </button>
                              <button onClick={() => setEditando(null)}
                                style={{ background:C.red, border:"none", color:"#fff",
                                         padding:"4px 8px", borderRadius:"4px", cursor:"pointer" }}>
                                <X size={13}/>
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditando(u.id); setEditForm({ nome:u.nome, cargo:u.cargo, cod_winthor:u.cod_winthor }); }}
                                title="Editar"
                                style={{ background:"#EBF5FF", border:"1px solid #BFDBFE", color:"#2563EB",
                                         padding:"4px 8px", borderRadius:"4px", cursor:"pointer" }}>
                                <Edit2 size={13}/>
                              </button>
                              <button onClick={() => abrirDetalhes(u)}
                                title="Seções/Fornecedores"
                                style={{ background:"#F0FFF4", border:"1px solid #BBF7D0", color:C.green,
                                         padding:"4px 8px", borderRadius:"4px", cursor:"pointer" }}>
                                <Shield size={13}/>
                              </button>
                              <button onClick={() => toggleAtivo(u)}
                                title={u.ativo?"Desativar":"Reativar"}
                                style={{ background:u.ativo?"#FFF0F0":"#F0FFF4",
                                         border:`1px solid ${u.ativo?C.red:C.green}30`,
                                         color:u.ativo?C.red:C.green,
                                         padding:"4px 8px", borderRadius:"4px", cursor:"pointer" }}>
                                {u.ativo ? <X size={13}/> : <Check size={13}/>}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Senha inline quando editando */}
                    {isEdit && (
                      <tr style={{ background:"#FFFBF0" }}>
                        <td colSpan={7} style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                            <span style={{ fontSize:"11px", color:C.textSub }}>Nova senha:</span>
                            <input type="password" value={novaSenhas[u.id]??""} placeholder="deixe em branco para não alterar"
                              onChange={e => setNovaSenhas(n=>({...n,[u.id]:e.target.value}))}
                              style={{ padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px",
                                       fontSize:"12px", outline:"none", width:"200px" }}/>
                            {novaSenhas[u.id] && (
                              <button onClick={() => { salvarSenha(u.id, novaSenhas[u.id]); setNovaSenhas(n=>({...n,[u.id]:""})); }}
                                style={{ background:C.amber, border:"none", color:"#fff",
                                         padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"11px" }}>
                                Salvar senha
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Detalhes de seções/codfornec */}
                    {detalheSel?.id === u.id && (
                      <tr style={{ background:"#F8F8FF" }}>
                        <td colSpan={7} style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ display:"flex", gap:"20px", flexWrap:"wrap" }}>
                            {/* Seções */}
                            <div>
                              <div style={{ fontSize:"11px", fontWeight:700, color:C.primary, marginBottom:"6px" }}>
                                SEÇÕES (Faturamento)
                              </div>
                              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
                                {secoesList.map(s => (
                                  <span key={s} style={{ background:C.rowEven, border:`1px solid ${C.border}`,
                                    borderRadius:"4px", padding:"2px 8px", fontSize:"11px",
                                    display:"flex", alignItems:"center", gap:"4px" }}>
                                    {s}
                                    <button onClick={() => delSecao(u.id, s)}
                                      style={{ background:"none", border:"none", color:C.red,
                                               cursor:"pointer", padding:"0", lineHeight:1 }}>
                                      <X size={10}/>
                                    </button>
                                  </span>
                                ))}
                                {secoesList.length === 0 && <span style={{ fontSize:"11px", color:C.textSub }}>nenhuma</span>}
                              </div>
                              <div style={{ display:"flex", gap:"6px" }}>
                                <input type="number" placeholder="CODSEC" value={novasSecoes[u.id]??""}
                                  onChange={e => setNovasSecoes(n=>({...n,[u.id]:e.target.value}))}
                                  style={{ padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px",
                                           fontSize:"11px", outline:"none", width:"100px" }}/>
                                <button onClick={() => { addSecao(u.id, Number(novasSecoes[u.id])); setNovasSecoes(n=>({...n,[u.id]:""})); }}
                                  style={{ background:C.primary, border:"none", color:"#fff",
                                           padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"11px" }}>
                                  + Adicionar
                                </button>
                              </div>
                            </div>

                            {/* CODFORNECs */}
                            <div>
                              <div style={{ fontSize:"11px", fontWeight:700, color:C.primary, marginBottom:"6px" }}>
                                FORNECEDORES (Dist. Numérica)
                              </div>
                              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
                                {fornecList.map(f => (
                                  <span key={f} style={{ background:C.rowEven, border:`1px solid ${C.border}`,
                                    borderRadius:"4px", padding:"2px 8px", fontSize:"11px",
                                    display:"flex", alignItems:"center", gap:"4px" }}>
                                    {f}
                                    <button onClick={() => delFornec(u.id, f)}
                                      style={{ background:"none", border:"none", color:C.red,
                                               cursor:"pointer", padding:"0", lineHeight:1 }}>
                                      <X size={10}/>
                                    </button>
                                  </span>
                                ))}
                                {fornecList.length === 0 && <span style={{ fontSize:"11px", color:C.textSub }}>nenhum</span>}
                              </div>
                              <div style={{ display:"flex", gap:"6px" }}>
                                <input type="number" placeholder="CODFORNEC" value={novosFornec[u.id]??""}
                                  onChange={e => setNovosFornec(n=>({...n,[u.id]:e.target.value}))}
                                  style={{ padding:"4px 8px", border:`1px solid ${C.border}`, borderRadius:"4px",
                                           fontSize:"11px", outline:"none", width:"110px" }}/>
                                <button onClick={() => { addFornec(u.id, Number(novosFornec[u.id])); setNovosFornec(n=>({...n,[u.id]:""})); }}
                                  style={{ background:C.primary, border:"none", color:"#fff",
                                           padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"11px" }}>
                                  + Adicionar
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Painel de Campanhas BL ────────────────────────────────────────────────────
function PainelCampanhas({ token }) {
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const [campanhas, setCampanhas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [confirm,   setConfirm]   = useState(null);
  const [msg,       setMsg]       = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch(`${API_BASE}/api/admin/campanhas`, { headers }).then(r => r.json());
      setCampanhas(j.dados ?? []);
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { carregar(); }, [carregar]);

  const deletar = async (id) => {
    await fetch(`${API_BASE}/api/bl/campanhas/${id}`, { method:"DELETE", headers });
    setConfirm(null); carregar();
    setMsg("Campanha excluída."); setTimeout(() => setMsg(""), 2500);
  };

  const thStyle = {
    padding:"7px 10px", background:C.subHeader, color:"#fff",
    fontSize:"11px", fontWeight:700, border:`1px solid ${C.primaryDk}`,
  };

  return (
    <div style={{ padding:"16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px" }}>
        <button onClick={carregar} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:"6px", background:"#fff",
                   border:`1px solid ${C.border}`, color:C.text, padding:"7px 12px",
                   borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
          <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
          Atualizar
        </button>
        {msg && <span style={{ fontSize:"12px", fontWeight:600, color:C.red }}>{msg}</span>}
      </div>

      <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:"8px", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>NOME</th>
              <th style={thStyle}>FORNECEDOR</th>
              <th style={thStyle}>SEÇÃO</th>
              <th style={thStyle}>UNIDADE</th>
              <th style={thStyle}>SEMANA INI</th>
              <th style={thStyle}>SEMANA FIM</th>
              <th style={{...thStyle, textAlign:"center"}}>STATUS</th>
              <th style={{...thStyle, textAlign:"center"}}>EXCLUIR</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ padding:"24px", textAlign:"center", color:C.textSub }}>
                Carregando...
              </td></tr>
            )}
            {!loading && campanhas.map((c, i) => (
              <tr key={c.id} style={{ background:i%2===0?C.rowEven:C.rowOdd }}>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`,
                             fontFamily:C.mono, color:C.textSub }}>{c.id}</td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, fontWeight:600 }}>{c.nome}</td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, color:C.textSub }}>{c.nome_fornecedor}</td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, fontFamily:C.mono }}>{c.codsec}</td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>
                  <span style={{ background:c.unidade==="CX"?"#EDE9FE":"#EFF6FF",
                                 color:c.unidade==="CX"?"#7C3AED":"#2563EB",
                                 borderRadius:"4px", padding:"2px 8px", fontSize:"10px", fontWeight:700 }}>
                    {c.unidade}
                  </span>
                </td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, fontFamily:C.mono }}>{c.semana_ini}</td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, fontFamily:C.mono }}>{c.semana_fim}</td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>
                  <span style={{ color:c.ativa?C.green:C.textSub, fontWeight:600, fontSize:"11px" }}>
                    {c.ativa ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td style={{ padding:"7px 10px", borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>
                  {confirm === c.id ? (
                    <div style={{ display:"flex", gap:"4px", justifyContent:"center" }}>
                      <button onClick={() => deletar(c.id)}
                        style={{ background:C.red, border:"none", color:"#fff",
                                 padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"11px" }}>
                        Confirmar
                      </button>
                      <button onClick={() => setConfirm(null)}
                        style={{ background:"#fff", border:`1px solid ${C.border}`, color:C.text,
                                 padding:"4px 8px", borderRadius:"4px", cursor:"pointer" }}>
                        <X size={12}/>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm(c.id)}
                      style={{ background:"#FFF0F0", border:`1px solid ${C.red}40`, color:C.red,
                               padding:"4px 10px", borderRadius:"4px", cursor:"pointer", fontSize:"11px" }}>
                      <Trash2 size={13}/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && campanhas.length === 0 && (
              <tr><td colSpan={9} style={{ padding:"24px", textAlign:"center", color:C.textSub }}>
                Nenhuma campanha.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Módulo Admin ──────────────────────────────────────────────────────────────
export default function ModuleAdmin({ isMobile, token, userInfo = {} }) {
  const [aba, setAba] = useState("usuarios");

  return (
    <>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#1e1e2e,#2d2d4e 60%,#1e1e2e)`,
                    padding:isMobile?"8px 12px":"10px 20px",
                    display:"flex", alignItems:"center", gap:"12px",
                    borderBottom:"3px solid #7C3AED" }}>
        <div>
          <div style={{ fontWeight:900, fontSize:isMobile?"16px":"20px", color:"#fff", letterSpacing:"0.06em", lineHeight:1 }}>PREMIUM</div>
          <div style={{ fontWeight:700, fontSize:"9px", color:"#A78BFA", letterSpacing:"0.14em" }}>DISTRIBUIDORA</div>
        </div>
        <div style={{ color:"#fff", fontWeight:700, fontSize:isMobile?"12px":"14px" }}>
          PAINEL DE CONTROLE
          <span style={{ marginLeft:"8px", background:"#7C3AED", borderRadius:"4px",
                         padding:"1px 8px", fontSize:"10px", color:"#EDE9FE" }}>ADMIN</span>
        </div>
      </div>

      {/* Abas */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.border}`,
                    padding:"8px 16px", display:"flex", gap:"8px" }}>
        {[["usuarios","Usuários"],["campanhas","Campanhas BL"]].map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding:"7px 16px", border:"none", cursor:"pointer",
                     fontSize:"12px", fontFamily:C.sans, borderRadius:"6px",
                     background:aba===id?"#7C3AED":"transparent",
                     color:aba===id?"#fff":C.text,
                     fontWeight:aba===id?700:400 }}>{label}
          </button>
        ))}
      </div>

      {aba === "usuarios"  && <PainelUsuarios  token={token}/>}
      {aba === "campanhas" && <PainelCampanhas token={token}/>}
    </>
  );
}