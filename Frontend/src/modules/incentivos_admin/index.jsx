import { useState, useEffect, useCallback } from "react";
import { Gift, Plus, Edit2, Trash2, Search, X } from "lucide-react";
import { C, fmtDt } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders, apiGet, apiPost, apiPut, apiDelete } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";
import Modal from "../../components/Modal";
import SelectModal from "../../components/SelectModal";

const TIPOS = [
  { valor: "fixo", label: "Fixo por caixa" },
  { valor: "escalonado", label: "Escalonado (faixas)" },
  { valor: "combo", label: "Combo de produtos" },
];

// Extrai uma string legível de qualquer formato de erro que a API devolva —
// FastAPI manda {"detail": "texto"} nos nossos HTTPException, mas em erro de
// validação (422) manda {"detail": [{"msg": "...", "loc": [...]}, ...]} —
// sem isso, `new Error(detail)` de um array/objeto vira "[object Object]".
function msgDeErro(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg ?? JSON.stringify(d)).join("; ");
  return JSON.stringify(detail);
}

const inputStyle = {
  width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`,
  borderRadius: "6px", fontSize: "12px", fontFamily: C.sans, boxSizing: "border-box",
};
const labelStyle = { fontSize: "11px", fontWeight: 700, color: C.textSub, marginBottom: "4px", display: "block" };
const sectionTitle = { fontSize: "12px", fontWeight: 700, color: C.text, margin: "18px 0 8px" };

export default function ModuleIncentivosAdmin({ isMobile, token }) {
  const headers = useAuthHeaders(token);
  const [incentivos, setIncentivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // incentivo sendo criado/editado, ou null

  const fetchIncentivos = useCallback(() => {
    setLoading(true); setError(null);
    apiGet(`${API_BASE}/api/incentivos/admin/listar`, headers)
      .then(j => setIncentivos(j.incentivos ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [headers]);

  useEffect(() => { fetchIncentivos(); }, [fetchIncentivos]);

  const abrirNovo = () => setEditando({ id: null, nome: "", tipo: "fixo", data_ini: "", data_fim: "",
    valor_por_caixa: "", valor_por_combo: "", ativo: 1, produtos: [], faixas: [], equipes_override: [] });

  const abrirEdicao = (inc) => setEditando({ ...inc });

  const toggleAtivo = async (inc) => {
    await apiPut(`${API_BASE}/api/incentivos/admin/${inc.id}`, { ativo: inc.ativo ? 0 : 1 }, headers);
    fetchIncentivos();
  };

  const excluir = async (inc) => {
    if (!confirm(`Excluir "${inc.nome}" de vez? Não dá pra desfazer.`)) return;
    await apiDelete(`${API_BASE}/api/incentivos/admin/${inc.id}`, headers);
    fetchIncentivos();
  };

  return (
    <>
      <ModuleHeader icon={Gift} title="INCENTIVOS — ADMINISTRAÇÃO" isMobile={isMobile}
        onRefresh={fetchIncentivos} loading={loading} />

      <div style={{ padding: isMobile ? "10px 12px" : "12px 20px" }}>
        <button onClick={abrirNovo}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: C.primary, color: "#fff",
            border: "none", borderRadius: "6px", padding: "8px 14px", fontSize: "12px", fontWeight: 700,
            cursor: "pointer", marginBottom: "14px" }}>
          <Plus size={14} /> Novo Incentivo
        </button>

        {error && <div style={{ padding: "20px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && incentivos.length === 0 && !error && (
          <div style={{ padding: "40px", textAlign: "center", color: C.textSub }}>
            Nenhum incentivo cadastrado ainda.
          </div>
        )}

        {incentivos.length > 0 && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: C.subHeader, color: "#fff" }}>
                  <th style={th}>NOME</th>
                  <th style={th}>TIPO</th>
                  <th style={th}>PERÍODO</th>
                  <th style={th}>PRODUTOS</th>
                  <th style={{ ...th, textAlign: "center" }}>EQUIPES C/ REGRA PRÓPRIA</th>
                  <th style={{ ...th, textAlign: "center" }}>ATIVO</th>
                  <th style={{ ...th, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {incentivos.map((inc, i) => (
                  <tr key={inc.id} style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd, borderBottom: `1px solid ${C.border}` }}>
                    <td style={td}>{inc.nome}</td>
                    <td style={td}>{TIPOS.find(t => t.valor === inc.tipo)?.label ?? inc.tipo}</td>
                    <td style={{ ...td, fontFamily: C.mono, fontSize: "11px" }}>{fmtDt(inc.data_ini)} – {fmtDt(inc.data_fim)}</td>
                    <td style={td}>{inc.produtos?.length ?? 0}</td>
                    <td style={{ ...td, textAlign: "center" }}>{inc.equipes_override?.length ?? 0}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => toggleAtivo(inc)}
                        title={inc.ativo ? "Desativar" : "Reativar"}
                        style={{ background: inc.ativo ? "#F0FFF4" : "#FFF0F0",
                          border: `1px solid ${inc.ativo ? C.green : C.red}30`, color: inc.ativo ? C.green : C.red,
                          borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                        {inc.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => abrirEdicao(inc)} title="Editar"
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, marginRight: "6px" }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => excluir(inc)} title="Excluir"
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.red }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <FormIncentivo editando={editando} headers={headers} isMobile={isMobile}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); fetchIncentivos(); }} />
      )}
    </>
  );
}

// ── Modal de criação/edição ──────────────────────────────────────────────────
function FormIncentivo({ editando, headers, isMobile, onClose, onSaved }) {
  const [form, setForm] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const isNovo = !editando.id;

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));

  const salvarDados = async () => {
    if (!form.nome || !form.tipo || !form.data_ini || !form.data_fim) {
      setMsg("Preenche nome, tipo e período."); return null;
    }
    setSalvando(true); setMsg("");
    try {
      const body = {
        nome: form.nome, tipo: form.tipo, data_ini: form.data_ini, data_fim: form.data_fim,
        valor_por_caixa: form.tipo === "fixo" ? Number(form.valor_por_caixa) || 0 : null,
        valor_por_combo: form.tipo === "combo" ? Number(form.valor_por_combo) || 0 : null,
      };
      if (isNovo) {
        const j = await apiPost(`${API_BASE}/api/incentivos/admin`, body, headers);
        const novoForm = { ...form, id: j.id };
        setForm(novoForm);
        return novoForm.id;
      } else {
        await apiPut(`${API_BASE}/api/incentivos/admin/${form.id}`, body, headers);
        return form.id;
      }
    } catch (e) {
      setMsg(msgDeErro(e.detail, e.message)); return null;
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEFechar = async () => {
    const id = await salvarDados();
    if (id) onSaved();
  };

  return (
    <Modal open onClose={onClose} icon={Gift} title={isNovo ? "Novo Incentivo" : `Editar — ${form.nome}`}
      width="min(680px, 95vw)" noPadding>
      <div style={{ padding: "16px 20px", maxHeight: "75vh", overflowY: "auto" }}>
        <label style={labelStyle}>Nome</label>
        <input style={inputStyle} value={form.nome} onChange={set("nome")} placeholder="Ex.: Incentivo YoPro" />

        <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "160px" }}>
            <label style={labelStyle}>Tipo</label>
            <select style={inputStyle} value={form.tipo} onChange={set("tipo")}>
              {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: "130px" }}>
            <label style={labelStyle}>Início</label>
            <input type="date" style={inputStyle} value={form.data_ini ?? ""} onChange={set("data_ini")} />
          </div>
          <div style={{ flex: 1, minWidth: "130px" }}>
            <label style={labelStyle}>Fim</label>
            <input type="date" style={inputStyle} value={form.data_fim ?? ""} onChange={set("data_fim")} />
          </div>
        </div>

        {form.tipo === "fixo" && (
          <div style={{ marginTop: "10px", maxWidth: "220px" }}>
            <label style={labelStyle}>R$ por caixa fechada</label>
            <input type="number" step="0.01" style={inputStyle} value={form.valor_por_caixa ?? ""} onChange={set("valor_por_caixa")} />
          </div>
        )}
        {form.tipo === "combo" && (
          <div style={{ marginTop: "10px", maxWidth: "220px" }}>
            <label style={labelStyle}>R$ por cliente com combo completo</label>
            <input type="number" step="0.01" style={inputStyle} value={form.valor_por_combo ?? ""} onChange={set("valor_por_combo")} />
          </div>
        )}

        {msg && <div style={{ color: C.red, fontSize: "11px", marginTop: "8px" }}>{msg}</div>}

        <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
          <button onClick={handleSalvarEFechar} disabled={salvando}
            style={{ background: C.primary, color: "#fff", border: "none", borderRadius: "6px",
              padding: "8px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            {salvando ? "Salvando..." : (isNovo ? "Criar e continuar" : "Salvar dados")}
          </button>
          {!isNovo && (
            <button onClick={onClose}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px",
                padding: "8px 16px", fontSize: "12px", cursor: "pointer", color: C.textSub }}>
              Fechar
            </button>
          )}
        </div>

        {/* Seções abaixo só fazem sentido depois que o incentivo tem ID (foi criado) */}
        {form.id && (
          <>
            <SecaoProdutosGerais incentivoId={form.id} headers={headers} />
            {form.tipo === "escalonado" && <SecaoFaixas incentivoId={form.id} headers={headers} />}
            <SecaoEquipes incentivoId={form.id} headers={headers} />
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Produtos gerais ───────────────────────────────────────────────────────────
function SecaoProdutosGerais({ incentivoId, headers }) {
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    apiGet(`${API_BASE}/api/incentivos/admin/listar`, headers)
      .then(j => setProdutos((j.incentivos ?? []).find(i => i.id === incentivoId)?.produtos ?? []));
  }, [incentivoId]);

  const buscar = () => {
    if (busca.trim().length < 2) return;
    apiGet(`${API_BASE}/api/incentivos/admin/produtos/buscar?q=${encodeURIComponent(busca.trim())}`, headers)
      .then(j => setResultados(j.dados ?? []));
  };

  const adicionar = (p) => {
    if (produtos.some(x => x.codprod === p.codprod)) return;
    setProdutos(prev => [...prev, { codprod: p.codprod, descricao: p.descricao }]);
  };
  const remover = (codprod) => setProdutos(prev => prev.filter(p => p.codprod !== codprod));

  const salvar = async () => {
    setSalvando(true);
    await apiPut(`${API_BASE}/api/incentivos/admin/${incentivoId}/produtos`, { produtos }, headers);
    setSalvando(false);
  };

  return (
    <div>
      <div style={sectionTitle}>Produtos gerais (aplica a quem não tem regra própria)</div>
      <div style={{ display: "flex", gap: "6px" }}>
        <input style={inputStyle} value={busca} onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === "Enter" && buscar()} placeholder="Buscar por nome ou código..." />
        <button onClick={buscar} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "0 12px", cursor: "pointer" }}><Search size={14} /></button>
      </div>
      {resultados.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", marginTop: "6px", maxHeight: "140px", overflowY: "auto" }}>
          {resultados.map(p => (
            <div key={p.codprod} onClick={() => adicionar(p)}
              style={{ padding: "6px 10px", fontSize: "12px", cursor: "pointer", borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>{p.codprod}</span> {p.descricao}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
        {produtos.map(p => (
          <span key={p.codprod} style={{ display: "flex", alignItems: "center", gap: "4px",
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "3px 8px", fontSize: "11px" }}>
            {p.descricao || p.codprod}
            <X size={11} style={{ cursor: "pointer" }} onClick={() => remover(p.codprod)} />
          </span>
        ))}
        {produtos.length === 0 && <span style={{ fontSize: "11px", color: C.textSub }}>Nenhum produto ainda.</span>}
      </div>
      <button onClick={salvar} disabled={salvando}
        style={{ marginTop: "8px", background: C.green, color: "#fff", border: "none", borderRadius: "6px",
          padding: "6px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
        {salvando ? "Salvando..." : "Salvar produtos"}
      </button>
    </div>
  );
}

// ── Faixas (tipo escalonado) ──────────────────────────────────────────────────
function SecaoFaixas({ incentivoId, headers }) {
  const [faixas, setFaixas] = useState([{ limite: "", valor: "" }]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    apiGet(`${API_BASE}/api/incentivos/admin/listar`, headers)
      .then(j => {
        const f = (j.incentivos ?? []).find(i => i.id === incentivoId)?.faixas ?? [];
        setFaixas(f.length ? f.map(x => ({ limite: x.limite ?? "", valor: x.valor })) : [{ limite: "", valor: "" }]);
      });
  }, [incentivoId]);

  const setFaixa = (i, campo, val) => setFaixas(prev => prev.map((f, idx) => idx === i ? { ...f, [campo]: val } : f));
  const addFaixa = () => setFaixas(prev => [...prev, { limite: "", valor: "" }]);
  const removerFaixa = (i) => setFaixas(prev => prev.filter((_, idx) => idx !== i));

  const salvar = async () => {
    setSalvando(true);
    const payload = faixas.map((f, i) => ({
      limite: i === faixas.length - 1 ? null : (Number(f.limite) || 0),
      valor: Number(f.valor) || 0,
    }));
    await apiPut(`${API_BASE}/api/incentivos/admin/${incentivoId}/faixas`, { faixas: payload }, headers);
    setSalvando(false);
  };

  return (
    <div>
      <div style={sectionTitle}>Faixas — R$ por caixa conforme o total do vendedor</div>
      {faixas.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "11px", color: C.textSub, width: "70px" }}>
            {i === faixas.length - 1 ? "sem teto" : "até caixa"}
          </span>
          {i !== faixas.length - 1 && (
            <input type="number" style={{ ...inputStyle, width: "90px" }} value={f.limite}
              onChange={e => setFaixa(i, "limite", e.target.value)} placeholder="ex: 40" />
          )}
          <span style={{ fontSize: "11px", color: C.textSub }}>R$</span>
          <input type="number" step="0.01" style={{ ...inputStyle, width: "90px" }} value={f.valor}
            onChange={e => setFaixa(i, "valor", e.target.value)} placeholder="ex: 1.00" />
          {faixas.length > 1 && (
            <X size={14} style={{ cursor: "pointer", color: C.red }} onClick={() => removerFaixa(i)} />
          )}
        </div>
      ))}
      <button onClick={addFaixa} style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: "6px",
        padding: "5px 10px", fontSize: "11px", cursor: "pointer", color: C.primary }}>+ Adicionar faixa</button>
      <div>
        <button onClick={salvar} disabled={salvando}
          style={{ marginTop: "8px", background: C.green, color: "#fff", border: "none", borderRadius: "6px",
            padding: "6px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
          {salvando ? "Salvando..." : "Salvar faixas"}
        </button>
      </div>
    </div>
  );
}

// ── Regra própria por equipe ──────────────────────────────────────────────────
function SecaoEquipes({ incentivoId, headers }) {
  const [supervisores, setSupervisores] = useState([]);
  const [equipesOverride, setEquipesOverride] = useState([]);
  const [supSel, setSupSel] = useState(null);

  const carregarEquipes = useCallback(() => {
    apiGet(`${API_BASE}/api/incentivos/admin/listar`, headers)
      .then(j => setEquipesOverride((j.incentivos ?? []).find(i => i.id === incentivoId)?.equipes_override ?? []));
  }, [incentivoId]);

  useEffect(() => {
    apiGet(`${API_BASE}/api/faturamento/supervisores`, headers)
      .then(j => setSupervisores(j.dados ?? []));
    carregarEquipes();
  }, [incentivoId, carregarEquipes]);

  const removerOverride = async (sup) => {
    await apiDelete(`${API_BASE}/api/incentivos/admin/${incentivoId}/equipe/${sup}`, headers);
    carregarEquipes();
  };

  const nomeSup = (cod) => supervisores.find(s => s.cod_supervisor === cod)?.nome_supervisor ?? `Supervisor #${cod}`;

  return (
    <div>
      <div style={sectionTitle}>Regra de produtos própria por equipe (opcional)</div>
      <div style={{ fontSize: "11px", color: C.textSub, marginBottom: "8px" }}>
        Escolha uma equipe pra dar uma lista de produtos diferente da geral. Ranking continua mostrando todo mundo junto.
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        {equipesOverride.map(sup => (
          <span key={sup} style={{ display: "flex", alignItems: "center", gap: "6px",
            background: "#FFF7E6", border: `1px solid ${C.gold}50`, borderRadius: "12px", padding: "4px 10px", fontSize: "11px" }}>
            {nomeSup(sup)}
            <button onClick={() => setSupSel(sup)} style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: "10px", textDecoration: "underline" }}>editar</button>
            <X size={11} style={{ cursor: "pointer" }} onClick={() => removerOverride(sup)} />
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <div style={{ minWidth: "220px" }}>
          <SelectModal value={null} onChange={setSupSel} options={supervisores.filter(s => !equipesOverride.includes(s.cod_supervisor))}
            placeholder="Adicionar equipe..." labelKey="nome_supervisor" valueKey="cod_supervisor" />
        </div>
      </div>

      {supSel && (
        <EditorProdutosEquipe incentivoId={incentivoId} headers={headers} codSupervisor={supSel}
          nome={nomeSup(supSel)} onClose={() => { setSupSel(null); carregarEquipes(); }} />
      )}
    </div>
  );
}

function EditorProdutosEquipe({ incentivoId, headers, codSupervisor, nome, onClose }) {
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    apiGet(`${API_BASE}/api/incentivos/admin/${incentivoId}/equipe/${codSupervisor}/produtos`, headers)
      .then(j => setProdutos(j.produtos ?? []));
  }, [incentivoId, codSupervisor]);

  const buscar = () => {
    if (busca.trim().length < 2) return;
    apiGet(`${API_BASE}/api/incentivos/admin/produtos/buscar?q=${encodeURIComponent(busca.trim())}`, headers)
      .then(j => setResultados(j.dados ?? []));
  };
  const adicionar = (p) => {
    if (produtos.some(x => x.codprod === p.codprod)) return;
    setProdutos(prev => [...prev, { codprod: p.codprod, descricao: p.descricao }]);
  };
  const remover = (codprod) => setProdutos(prev => prev.filter(p => p.codprod !== codprod));

  const salvar = async () => {
    setSalvando(true);
    await apiPut(`${API_BASE}/api/incentivos/admin/${incentivoId}/equipe/${codSupervisor}/produtos`, { produtos }, headers);
    setSalvando(false);
    onClose();
  };

  return (
    <div style={{ border: `1px solid ${C.gold}50`, borderRadius: "8px", padding: "10px", marginTop: "8px", background: "#FFFDF5" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "6px" }}>Produtos específicos — {nome}</div>
      <div style={{ display: "flex", gap: "6px" }}>
        <input style={inputStyle} value={busca} onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === "Enter" && buscar()} placeholder="Buscar produto..." />
        <button onClick={buscar} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "0 12px", cursor: "pointer" }}><Search size={14} /></button>
      </div>
      {resultados.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: "6px", marginTop: "6px", maxHeight: "120px", overflowY: "auto", background: "#fff" }}>
          {resultados.map(p => (
            <div key={p.codprod} onClick={() => adicionar(p)}
              style={{ padding: "6px 10px", fontSize: "12px", cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>{p.codprod}</span> {p.descricao}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
        {produtos.map(p => (
          <span key={p.codprod} style={{ display: "flex", alignItems: "center", gap: "4px",
            background: "#fff", border: `1px solid ${C.border}`, borderRadius: "12px", padding: "3px 8px", fontSize: "11px" }}>
            {p.descricao || p.codprod}
            <X size={11} style={{ cursor: "pointer" }} onClick={() => remover(p.codprod)} />
          </span>
        ))}
        {produtos.length === 0 && <span style={{ fontSize: "11px", color: C.textSub }}>Nenhum produto — salvar vazio remove a regra da equipe.</span>}
      </div>
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        <button onClick={salvar} disabled={salvando}
          style={{ background: C.green, color: "#fff", border: "none", borderRadius: "6px",
            padding: "6px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onClose}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px",
            padding: "6px 12px", fontSize: "11px", cursor: "pointer", color: C.textSub }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

const th = { padding: "7px 10px", textAlign: "left", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", fontSize: "12px" };
