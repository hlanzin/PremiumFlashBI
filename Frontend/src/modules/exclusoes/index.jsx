
import { useState, useEffect } from "react";
import { Ban, Plus, Trash2, Building2, Tag } from "lucide-react";
import { C } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders, apiGet } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";
import { exportCSV } from "../../utils/exportCSV";

export default function ModuleExclusoes({ isMobile, token, userInfo = {} }) {
  const headers = useAuthHeaders(token);

  const [lista,    setLista]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState(null);

  const [tipo,  setTipo]  = useState("fornecedor");
  const [valor, setValor] = useState("");
  const [desc,  setDesc]  = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setLoading(true); setErro(null);
    apiGet(`${API_BASE}/api/admin/exclusoes`, headers)
      .then(j => setLista(j.dados ?? []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const adicionar = async () => {
    if (!valor) return;
    setSalvando(true); setErro(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/exclusoes`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, valor: Number(valor), descricao: desc || null }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.detail ?? res.statusText); }
      setValor(""); setDesc("");
      carregar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const remover = async (id) => {
    try {
      await fetch(`${API_BASE}/api/admin/exclusoes/${id}`, { method: "DELETE", headers });
      carregar();
    } catch (e) { setErro(e.message); }
  };

  const fornecedores = lista.filter(x => x.tipo === "fornecedor");
  const secoes       = lista.filter(x => x.tipo === "secao");

  const handleExportExcel = () => {
    const header = ["Tipo", "Código", "Descrição"];
    const dataRows = lista.map(x => [x.tipo === "fornecedor" ? "Fornecedor" : "Seção", String(x.valor), x.descricao || ""]);
    exportCSV("Exclusoes", header, dataRows);
  };

  const Grupo = ({ titulo, icon: Icon, itens, cor }) => (
    <div style={{ flex: 1, minWidth: isMobile ? "100%" : "280px",
      border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
      <div style={{ padding: "10px 14px", background: cor, color: "#fff",
        display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px" }}>
        <Icon size={15} /> {titulo} <span style={{ opacity: .8, fontWeight: 400 }}>({itens.length})</span>
      </div>
      {itens.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: C.textSub, fontSize: "12px" }}>
          Nenhuma exclusão.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <tbody>
            {itens.map((x, i) => (
              <tr key={x.id} style={{ background: i % 2 === 0 ? C.rowEven : "#fff" }}>
                <td style={{ padding: "7px 14px", fontFamily: C.mono, fontWeight: 700 }}>{x.valor}</td>
                <td style={{ padding: "7px 8px", color: C.textSub }}>{x.descricao || "—"}</td>
                <td style={{ padding: "7px 14px", textAlign: "right" }}>
                  <button onClick={() => remover(x.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.red,
                      display: "inline-flex", alignItems: "center" }} title="Remover">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <ModuleHeader icon={Ban} title="EXCLUSÕES (INDÚSTRIAS / SEÇÕES)" isMobile={isMobile}
        onExportExcel={handleExportExcel} />

      {/* Form de inclusão */}
      <div style={{ background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "10px 12px" : "12px 20px",
        display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: C.textSub, marginBottom: "3px" }}>TIPO</div>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "7px 10px",
              fontSize: "12px", background: "#fff", color: C.text, outline: "none" }}>
            <option value="fornecedor">Fornecedor / Indústria</option>
            <option value="secao">Seção</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: C.textSub, marginBottom: "3px" }}>CÓDIGO</div>
          <input type="number" value={valor} onChange={e => setValor(e.target.value)}
            placeholder="Ex: 2194" onKeyDown={e => e.key === "Enter" && adicionar()}
            style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "7px 10px",
              fontSize: "12px", width: "120px", outline: "none" }} />
        </div>
        <div style={{ flex: 1, minWidth: "140px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: C.textSub, marginBottom: "3px" }}>DESCRIÇÃO (opcional)</div>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Nome para referência" onKeyDown={e => e.key === "Enter" && adicionar()}
            style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "7px 10px",
              fontSize: "12px", width: "100%", outline: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={adicionar} disabled={!valor || salvando}
          style={{ background: valor ? C.primary : C.border, border: "none", color: "#fff",
            padding: "8px 16px", borderRadius: "6px", cursor: valor ? "pointer" : "default",
            fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px",
            opacity: valor ? 1 : 0.5 }}>
          <Plus size={14} /> {salvando ? "..." : "Adicionar"}
        </button>
      </div>

      {erro && (
        <div style={{ background: "#FFF0F0", borderBottom: "1px solid #FECACA", color: C.red,
          padding: "8px 20px", fontSize: "12px" }}>{erro}</div>
      )}

      <div style={{ padding: isMobile ? "12px" : "16px 20px" }}>
        <p style={{ fontSize: "12px", color: C.textSub, marginTop: 0, marginBottom: "14px" }}>
          Fornecedores e seções listados aqui <b>não aparecem</b> em nenhum dropdown, lista
          ou visão gerencial do sistema. As alterações valem em até 30 segundos.
        </p>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: C.textSub }}>Carregando...</div>
        ) : (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Grupo titulo="Fornecedores / Indústrias" icon={Building2} itens={fornecedores} cor={C.primary} />
            <Grupo titulo="Seções" icon={Tag} itens={secoes} cor={C.header} />
          </div>
        )}
      </div>
    </>
  );
}