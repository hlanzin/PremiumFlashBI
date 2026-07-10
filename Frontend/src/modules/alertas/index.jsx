import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Check, X, RefreshCw } from "lucide-react";
import { C } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders, apiGet, apiPost } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";

const STATUS_COR = {
  pendente:   { bg: "#FFF4CC", tx: "#8C6400", label: "PENDENTE" },
  confirmado: { bg: "#DFF3E3", tx: "#1D6F42", label: "CONFIRMADO" },
  errado:     { bg: "#FBDEDE", tx: "#B91C1C", label: "ERRADO" },
};

function Badge({ status }) {
  const s = STATUS_COR[status] ?? STATUS_COR.pendente;
  return (
    <span style={{ background: s.bg, color: s.tx, fontWeight: 700, fontSize: "10px",
      padding: "3px 8px", borderRadius: "10px", letterSpacing: "0.03em" }}>{s.label}</span>
  );
}

// Painel de confirmação (certo/errado + motivo) inline por alerta
function PainelResposta({ alerta, onResponder, salvando }) {
  const [motivo, setMotivo] = useState(alerta.motivo ?? "");
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const obrigatorio = alerta.motivo_obrigatorio;

  const confirmar = () => {
    if (obrigatorio && !motivo.trim()) { setMostrarMotivo(true); return; }
    onResponder(alerta.alerta_id, "confirmado", motivo);
  };
  const marcarErrado = () => {
    onResponder(alerta.alerta_id, "errado", motivo);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={confirmar} disabled={salvando}
          title={obrigatorio ? "Motivo obrigatório para confirmar" : "Confirmar"}
          style={{ display: "flex", alignItems: "center", gap: "4px", background: "#1D6F42",
            border: "none", color: "#fff", padding: "5px 10px", borderRadius: "6px",
            cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
          <Check size={12} /> Certo
        </button>
        <button onClick={marcarErrado} disabled={salvando}
          style={{ display: "flex", alignItems: "center", gap: "4px", background: "#B91C1C",
            border: "none", color: "#fff", padding: "5px 10px", borderRadius: "6px",
            cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
          <X size={12} /> Errado
        </button>
        {!mostrarMotivo && (
          <button onClick={() => setMostrarMotivo(true)}
            style={{ background: "transparent", border: `1px solid ${C.border}`,
              color: C.textSub, padding: "5px 8px", borderRadius: "6px",
              cursor: "pointer", fontSize: "10px" }}>
            + motivo
          </button>
        )}
      </div>
      {(mostrarMotivo || obrigatorio) && (
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder={obrigatorio ? "Motivo obrigatório para confirmar..." : "Motivo (opcional)..."}
          style={{ width: "260px", minHeight: "44px", fontSize: "11px", padding: "6px 8px",
            border: `1px solid ${obrigatorio && !motivo.trim() ? C.red : C.border}`,
            borderRadius: "6px", fontFamily: "inherit", resize: "vertical" }} />
      )}
    </div>
  );
}

// Detalhe de duplicidade: carrega pedidos+itens já comparados automaticamente
// (sem seleção manual), em cards empilhados — pensado para uso no celular.
function DetalheDuplicidade({ alertaId, headers, isMobile }) {
  const [pedidos, setPedidos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    apiGet(`${API_BASE}/api/alertas/duplicidade/${alertaId}`, headers)
      .then(j => setPedidos(j.pedidos ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [alertaId]);

  const fmtMoeda = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return (
    <div style={{ padding: "16px", fontSize: "12px", color: C.textSub, textAlign: "center" }}>
      Carregando pedidos e itens...</div>
  );
  if (error) return (
    <div style={{ padding: "16px", fontSize: "12px", color: C.textSub, textAlign: "center" }}>
      {error.includes("404")
        ? "Esta duplicidade não está mais disponível (talvez já tenha sido resolvida). Atualize a lista."
        : `Erro: ${error}`}
    </div>
  );
  if (!pedidos || pedidos.length === 0) return (
    <div style={{ padding: "16px", fontSize: "12px", color: C.textSub, textAlign: "center" }}>
      Nenhum pedido encontrado no período.</div>
  );

  // Produtos repetidos entre os pedidos = os que causaram o alerta de duplicidade
  const totalRepetidos = pedidos.reduce((s, p) =>
    s + (p.itens ?? []).filter(it => it.repetido).length, 0);

  return (
    <div style={{ padding: isMobile ? "10px" : "14px 16px", background: "#FAFAFA",
      borderTop: `1px solid ${C.border}` }}>
      {totalRepetidos > 0 && (
        <div style={{ background: "#FBDEDE", color: "#B91C1C", fontSize: "11px", fontWeight: 700,
          padding: "8px 10px", borderRadius: "6px", marginBottom: "10px" }}>
          ⚠️ {totalRepetidos} produto{totalRepetidos > 1 ? "s" : ""} repetido{totalRepetidos > 1 ? "s" : ""} entre os pedidos
        </div>
      )}

      {/* Grid: 1 coluna no mobile, 2+ no desktop (comparação lado a lado) */}
      <div style={{ display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "10px" }}>
        {pedidos.map(p => (
          <div key={p.numped} style={{ background: "#fff", border: `1px solid ${C.border}`,
            borderRadius: "8px", overflow: "hidden" }}>
            {/* Cabeçalho do pedido */}
            <div style={{ background: C.subHeader, color: "#fff", padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", fontFamily: C.mono }}>
                  Pedido {p.numped}</span>
                <span style={{ fontSize: "10px", opacity: 0.85 }}>{p.posicao}</span>
              </div>
              <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
                {p.data} · {p.nome_rca}
              </div>
            </div>
            {/* Valor total do pedido */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: "#FBFBFB" }}>
              <span style={{ fontSize: "11px", color: C.textSub }}>{p.qt_itens} itens</span>
              <span style={{ fontWeight: 700, fontSize: "14px", fontFamily: C.mono, color: C.text }}>
                {fmtMoeda(p.vltotal)}</span>
            </div>
            {/* Itens do pedido */}
            <div>
              {(p.itens ?? []).map((it, i) => (
                <div key={`${p.numped}_${it.cod_produto}_${i}`}
                  style={{ display: "flex", justifyContent: "space-between", gap: "8px",
                    padding: "7px 12px", fontSize: "12px",
                    background: it.repetido ? "#FFF4CC" : (i % 2 === 0 ? "#fff" : "#FAFAFA"),
                    borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontWeight: it.repetido ? 700 : 400, color: it.repetido ? "#8C6400" : C.text }}>
                      {it.repetido && "🔁 "}{it.descricao}
                    </div>
                    <div style={{ fontSize: "10px", color: C.textSub, fontFamily: C.mono }}>
                      qt {it.qt}</div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {fmtMoeda(it.vltotal)}</div>
                </div>
              ))}
              {(p.itens ?? []).length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: "11px", color: C.textSub, textAlign: "center" }}>
                  Sem itens</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModuleAlertas({ isMobile, token }) {
  const headers = useAuthHeaders(token);
  const [dados, setDados] = useState([]);
  const [pendentes, setPendentes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [filtroTipo, setFiltroTipo] = useState("");
  const [salvando, setSalvando] = useState({});

  const fetchDados = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const j = await apiGet(`${API_BASE}/api/alertas`, headers);
      setDados(j.dados ?? []);
      setPendentes(j.pendentes ?? 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchDados(); }, []);

  const tipos = useMemo(() => [...new Set(dados.map(a => a.tipo))], [dados]);
  const filtrados = useMemo(() =>
    filtroTipo ? dados.filter(a => a.tipo === filtroTipo) : dados, [dados, filtroTipo]);

  const responder = async (alertaId, status, motivo) => {
    setSalvando(s => ({ ...s, [alertaId]: true }));
    try {
      await apiPost(`${API_BASE}/api/alertas/${alertaId}/responder`, { status, motivo }, headers);
      const alertaAntes = dados.find(a => a.alerta_id === alertaId);
      setDados(prev => prev.map(a => a.alerta_id === alertaId
        ? { ...a, status, motivo } : a));
      if (alertaAntes?.status === "pendente" && status !== "pendente") {
        setPendentes(p => Math.max(0, p - 1));
      } else if (alertaAntes?.status !== "pendente" && status === "pendente") {
        setPendentes(p => p + 1);
      }
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(s => ({ ...s, [alertaId]: false }));
    }
  };

  return (
    <>
      <ModuleHeader icon={AlertTriangle} title="ALERTAS RCA" isMobile={isMobile} />

      <div style={{ background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "10px 12px" : "12px 20px",
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "7px 10px",
            fontSize: "12px", background: "#fff" }}>
          <option value="">Todos os tipos ({dados.length})</option>
          {tipos.map(t => (
            <option key={t} value={t}>{t} ({dados.filter(a => a.tipo === t).length})</option>
          ))}
        </select>
        <div style={{ padding: "5px 12px", borderRadius: "6px", background: pendentes > 0 ? "#FFF4CC" : "#DFF3E3",
          color: pendentes > 0 ? "#8C6400" : "#1D6F42", fontWeight: 700, fontSize: "12px" }}>
          {pendentes} pendente{pendentes !== 1 ? "s" : ""}
        </div>
        <button onClick={fetchDados} disabled={loading}
          style={{ marginLeft: "auto", border: `1px solid ${C.border}`, background: "#fff",
            borderRadius: "6px", padding: "6px 10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: C.textSub }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Atualizar
        </button>
      </div>

      <div style={{ padding: isMobile ? "10px 12px" : "12px 20px" }}>
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Carregando alertas...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && !error && filtrados.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Nenhum alerta encontrado. 🎉
          </div>
        )}

        {!loading && filtrados.map(a => {
          const isDup = a.tipo === "POSSÍVEL DUPLICIDADE";
          const isExp = !!expanded[a.alerta_id];
          return (
            <div key={a.alerta_id} style={{ marginBottom: "8px", border: `1px solid ${C.border}`,
              borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: "12px",
                flexWrap: isMobile ? "wrap" : "nowrap" }}>
                {isDup && (
                  <button onClick={() => setExpanded(ex => ({ ...ex, [a.alerta_id]: !ex[a.alerta_id] }))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px",
                      color: C.textSub, flexShrink: 0 }}>
                    {isExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "12px", color: C.text }}>{a.tipo}</span>
                    <Badge status={a.status} />
                    {a.status_pedido && (
                      <span style={{ fontSize: "10px", color: C.textSub, fontFamily: C.mono }}>
                        {a.status_pedido}</span>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: C.textSub, marginTop: "3px" }}>
                    Cliente <b style={{ fontFamily: C.mono }}>{a.cliente}</b> · RCA{" "}
                    <b style={{ fontFamily: C.mono }}>{a.rca}</b> — {a.nome}
                  </div>
                  {a.motivo && (
                    <div style={{ fontSize: "11px", color: C.textSub, marginTop: "4px",
                      fontStyle: "italic", background: "#FAFAFA", padding: "4px 8px", borderRadius: "4px" }}>
                      "{a.motivo}" {a.respondido_por && `— RCA ${a.respondido_por}`}
                    </div>
                  )}
                </div>
                {a.status === "pendente" ? (
                  <PainelResposta alerta={a} onResponder={responder} salvando={!!salvando[a.alerta_id]} />
                ) : (
                  <button onClick={() => responder(a.alerta_id, "pendente", null)}
                    style={{ fontSize: "10px", color: C.textSub, background: "none",
                      border: `1px solid ${C.border}`, borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}>
                    reabrir
                  </button>
                )}
              </div>
              {isDup && isExp && <DetalheDuplicidade alertaId={a.alerta_id} headers={headers} isMobile={isMobile} />}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}