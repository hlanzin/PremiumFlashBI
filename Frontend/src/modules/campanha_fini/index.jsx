import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, Candy, FileSpreadsheet, User } from "lucide-react";
import { C, fmtR, fmtPct } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders, apiGet } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";
import TableCard from "../../components/TableCard";
import { arrow } from "../../components/ArrowBadge";
import { exportCSV } from "../../utils/exportCSV";

// Barra de progresso de atingimento da meta
function ProgressBar({ pct }) {
  const p = Math.max(0, Math.min(pct ?? 0, 130));
  const cor = (pct ?? 0) >= 100 ? C.green : (pct ?? 0) >= 90 ? C.amber : C.red;
  return (
    <div style={{ width: "100%", height: "7px", background: C.rowEven,
                  borderRadius: "4px", overflow: "hidden", minWidth: "60px" }}>
      <div style={{ width: `${(p / 130) * 100}%`, height: "100%",
                    background: cor, borderRadius: "4px", transition: "width .3s" }} />
    </div>
  );
}

// Card de um vendedor — recolhível, lista os clientes dele
function VendedorCard({ nome, supervisor, linhas, isMobile, aberto, onToggle }) {
  const tot = useMemo(() => ({
    meta:  linhas.reduce((s, r) => s + (r.meta_cliente ?? 0), 0),
    real:  linhas.reduce((s, r) => s + (r.realizado_mes_atual ?? 0), 0),
    dia:   linhas.reduce((s, r) => s + (r.realizado_dia ?? 0), 0),
  }), [linhas]);
  const pct = tot.meta > 0 ? (tot.real / tot.meta) * 100 : 0;

  return (
    <div style={{ marginBottom: "10px", border: `1px solid ${C.border}`,
                  borderRadius: "6px", overflow: "hidden", background: "#fff",
                  boxShadow: "0 1px 4px rgba(170,0,0,.07)" }}>
      {/* Cabeçalho do vendedor */}
      <div onClick={onToggle} style={{ cursor: "pointer", padding: isMobile ? "10px 12px" : "10px 14px",
        display: "flex", alignItems: "center", gap: "10px",
        background: `linear-gradient(135deg,${C.primary},${C.header})`,
        color: "#fff", borderBottom: aberto ? `2px solid ${C.gold}` : "none" }}>
        {aberto ? <ChevronDown size={15} style={{ flexShrink: 0 }} />
                : <ChevronRight size={15} style={{ flexShrink: 0 }} />}
        <User size={14} style={{ flexShrink: 0, color: C.gold }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "13px", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
          {supervisor && <div style={{ fontSize: "10px", color: "rgba(255,255,255,.75)" }}>
            Sup: {supervisor}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,.75)" }}>
            {linhas.length} cliente{linhas.length !== 1 ? "s" : ""}</div>
          <div style={{ fontSize: "12px", fontWeight: 700 }}>
            {fmtR(tot.real)} / {fmtR(tot.meta)}</div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px",
                      minWidth: isMobile ? "auto" : "90px", justifyContent: "flex-end" }}>
          <span style={{ fontSize: "12px", fontWeight: 700 }}>{fmtPct(pct)}</span>
          {arrow(pct)}
        </div>
      </div>

      {/* Lista de clientes */}
      {aberto && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "10px" : "11px" }}>
            <thead>
              <tr style={{ background: C.subHeader, color: "#fff" }}>
                {["CLIENTE", "CIDADE", "META", "REALIZADO", "CARTEIRA", "HOJE", "FALTA", "%"].map((h, i) => (
                  <th key={h} style={{ padding: "5px 8px", fontSize: "10px", fontWeight: 700,
                    textAlign: i >= 2 ? "right" : "left", whiteSpace: "nowrap",
                    border: `1px solid ${C.primaryDk}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((r, i) => (
                <tr key={r.cod_cliente ?? i}
                  style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd }}
                  onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.rowEven : C.rowOdd}>
                  <td style={{ padding: "5px 8px", fontWeight: 500, maxWidth: "200px",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.nome_cliente}</td>
                  <td style={{ padding: "5px 8px", color: C.textSub, fontSize: "10px",
                               maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.nome_cidade}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmtR(r.meta_cliente)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, fontWeight: 700, color: C.primary }}>{fmtR(r.realizado_mes_atual)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, color: C.textSub }}>{fmtR(r.cart_semana)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, color: C.textSub }}>{fmtR(r.realizado_dia)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono,
                               color: (r.resta_a_fazer ?? 0) > 0 ? C.red : C.green }}>
                    {fmtR(r.resta_a_fazer)}</td>
                  <td style={{ padding: "5px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                      <ProgressBar pct={r.pct_meta} />
                      <span style={{ fontFamily: C.mono, fontSize: "10px", fontWeight: 700,
                                     minWidth: "38px", textAlign: "right",
                                     color: (r.pct_meta ?? 0) >= 100 ? C.green : (r.pct_meta ?? 0) >= 90 ? C.amber : C.red }}>
                        {fmtPct(r.pct_meta)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ModuleCampanhaFini({ isMobile, token, userInfo = {} }) {
  const headers = useAuthHeaders(token);

  const [dados,   setDados]   = useState([]);
  const [totais,  setTotais]  = useState({});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [busca,   setBusca]   = useState("");
  const [abertos, setAbertos] = useState(() => new Set());

  useEffect(() => {
    setLoading(true); setError(null);
    apiGet(`${API_BASE}/api/campanha-fini`, headers)
      .then(j => {
        setDados(j.dados ?? []);
        setTotais(j.totais ?? {});
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Agrupa por vendedor
  const grupos = useMemo(() => {
    let linhas = [...dados];
    if (busca) {
      const s = busca.toLowerCase();
      linhas = linhas.filter(r =>
        (r.nome_cliente ?? "").toLowerCase().includes(s) ||
        (r.nome_cidade ?? "").toLowerCase().includes(s) ||
        (r.nome_vendedor ?? "").toLowerCase().includes(s));
    }
    const map = new Map();
    linhas.forEach(r => {
      const k = r.cod_vendedor ?? "—";
      if (!map.has(k)) map.set(k, {
        cod: k, nome: r.nome_vendedor ?? `Vendedor ${k}`,
        supervisor: r.nome_supervisor, linhas: [],
      });
      map.get(k).linhas.push(r);
    });
    return Array.from(map.values())
      .map(g => ({
        ...g,
        meta: g.linhas.reduce((s, r) => s + (r.meta_cliente ?? 0), 0),
        real: g.linhas.reduce((s, r) => s + (r.realizado_mes_atual ?? 0), 0),
      }))
      .sort((a, b) => b.real - a.real);
  }, [dados, busca]);

  const toggle = (cod) => setAbertos(prev => {
    const next = new Set(prev);
    next.has(cod) ? next.delete(cod) : next.add(cod);
    return next;
  });

  const todosAbertos = grupos.length > 0 && grupos.every(g => abertos.has(g.cod));
  const toggleTodos = () => {
    if (todosAbertos) setAbertos(new Set());
    else setAbertos(new Set(grupos.map(g => g.cod)));
  };

  const exportarExcel = () => {
    if (!dados.length) return;
    exportCSV(`Campanha_Fini_${new Date().toISOString().slice(0,10)}`, [
      "VENDEDOR", "SUPERVISOR", "CLIENTE", "CIDADE",
      "META", "REALIZADO", "CARTEIRA_SEMANA", "REALIZADO_DIA", "FALTA", "PCT_META"
    ], dados.map(r => [
      `"${(r.nome_vendedor ?? "").replace(/"/g, '""')}"`,
      `"${(r.nome_supervisor ?? "").replace(/"/g, '""')}"`,
      `"${(r.nome_cliente ?? "").replace(/"/g, '""')}"`,
      `"${(r.nome_cidade ?? "").replace(/"/g, '""')}"`,
      String((r.meta_cliente ?? 0).toFixed(2)).replace(".", ","),
      String((r.realizado_mes_atual ?? 0).toFixed(2)).replace(".", ","),
      String((r.cart_semana ?? 0).toFixed(2)).replace(".", ","),
      String((r.realizado_dia ?? 0).toFixed(2)).replace(".", ","),
      String((r.resta_a_fazer ?? 0).toFixed(2)).replace(".", ","),
      String((r.pct_meta ?? 0).toFixed(1)).replace(".", ","),
    ]));
  };

  const pctGeral = totais.meta > 0 ? (totais.realizado / totais.meta) * 100 : 0;

  return (
    <>
      <ModuleHeader icon={Candy} title="CAMPANHA FINI" isMobile={isMobile} />

      {/* Toolbar */}
      <div style={{ background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>

        {grupos.length > 0 && (
          <button onClick={toggleTodos}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "6px",
                     padding: "6px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                     color: C.text }}>
            {todosAbertos ? "Recolher todos" : "Expandir todos"}
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${C.border}`, borderRadius: "6px", padding: "5px 10px",
          background: C.bg, flex: isMobile ? "1" : "none", marginLeft: isMobile ? "0" : "auto" }}>
          <Search size={12} style={{ color: C.textSub }} />
          <input placeholder="Cliente, cidade, vendedor..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px",
                     width: isMobile ? "auto" : "160px", outline: "none", color: C.text, fontFamily: C.sans }} />
        </div>

        {dados.length > 0 && (
          <button onClick={exportarExcel}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: "#1D6F42",
                     border: "none", color: "#fff", padding: "5px 12px", borderRadius: "6px",
                     cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
            <FileSpreadsheet size={13} /> Exportar
          </button>
        )}
      </div>

      {/* Resumo geral */}
      {!loading && dados.length > 0 && (
        <div style={{ display: "flex", gap: isMobile ? "8px" : "12px", flexWrap: "wrap",
          padding: isMobile ? "8px 12px" : "10px 20px", background: "#FAFAFA",
          borderBottom: `1px solid ${C.border}` }}>
          {[
            ["META TOTAL", fmtR(totais.meta), C.text],
            ["REALIZADO", fmtR(totais.realizado), C.primary],
            ["HOJE", fmtR(totais.realizado_dia), C.textSub],
          ].map(([label, val, cor]) => (
            <div key={label} style={{ flex: isMobile ? "1 1 30%" : "none",
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: "6px",
              padding: "6px 14px", minWidth: isMobile ? "auto" : "120px" }}>
              <div style={{ fontSize: "9px", color: C.textSub, fontWeight: 700, letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: cor, fontFamily: C.mono }}>{val}</div>
            </div>
          ))}
          <div style={{ flex: isMobile ? "1 1 100%" : "none", background: "#fff",
            border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 14px",
            display: "flex", alignItems: "center", gap: "10px", minWidth: isMobile ? "auto" : "150px" }}>
            <div>
              <div style={{ fontSize: "9px", color: C.textSub, fontWeight: 700, letterSpacing: "0.05em" }}>ATINGIMENTO</div>
              <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: C.mono,
                color: pctGeral >= 100 ? C.green : pctGeral >= 90 ? C.amber : C.red }}>{fmtPct(pctGeral)}</div>
            </div>
            {arrow(pctGeral)}
          </div>
        </div>
      )}

      <TableCard isMobile={isMobile} style={{ background: "transparent", border: "none", boxShadow: "none" }}>
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Carregando...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && !error && grupos.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Nenhum cliente com meta na campanha.
          </div>
        )}
        {!loading && !error && grupos.map(g => (
          <VendedorCard key={g.cod} nome={g.nome} supervisor={g.supervisor}
            linhas={g.linhas} isMobile={isMobile}
            aberto={abertos.has(g.cod)} onToggle={() => toggle(g.cod)} />
        ))}
      </TableCard>
    </>
  );
}
