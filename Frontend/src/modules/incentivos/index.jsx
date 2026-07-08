import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { Gift, ChevronDown, ChevronRight, Trophy, RefreshCw } from "lucide-react";
import { C, fmtN, fmtR, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";

// medalha para as 3 primeiras equipes
const medalha = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null);

export default function ModuleIncentivo({ isMobile, token, incentivoId = "yopro", incentivoNome }) {
  const headers = useAuthHeaders(token);
  const [dados, setDados]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [expanded, setExpanded] = useState({});

  const fetchDados = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/incentivos/${incentivoId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDados(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [incentivoId, headers]);

  useEffect(() => { fetchDados(); setExpanded({}); }, [incentivoId]);

  const equipes = dados?.equipes ?? [];
  const totalGeral = dados?.total_geral ?? { caixas: 0, premio: 0 };
  const info = dados?.incentivo;

  const nomeExib = incentivoNome || info?.nome || "Incentivo";

  return (
    <>
      <ModuleHeader icon={Gift} title={nomeExib.toUpperCase()} isMobile={isMobile} />

      {/* Barra de resumo */}
      <div style={{ background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "10px 12px" : "12px 20px",
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        {info && (
          <div style={{ fontSize: "11px", color: C.textSub }}>
            <b style={{ color: C.text }}>R$ {fmtN(info.valor_por_caixa)}</b> por caixa fechada
            <span style={{ margin: "0 8px", color: C.border }}>|</span>
            Produtos: {info.produtos?.join(", ")}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "5px 14px", borderRadius: "6px", background: C.total,
            color: C.totalTxt, fontWeight: 700, fontSize: "13px", display: "flex", gap: "10px" }}>
            <span>{fmtN(totalGeral.caixas)} cx</span>
            <span>·</span>
            <span>{fmtR(totalGeral.premio)}</span>
          </div>
          <button onClick={fetchDados} disabled={loading}
            style={{ border: `1px solid ${C.border}`, background: "#fff", borderRadius: "6px",
              padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
              fontSize: "11px", color: C.textSub }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Atualizar
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "10px 12px" : "12px 20px" }}>
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Carregando apuração...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && !error && equipes.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Nenhuma venda apurada no período.
          </div>
        )}

        {!loading && equipes.map((eq, ei) => {
          const med = medalha(ei);
          return (
            <div key={eq.cod_supervisor} style={{ marginBottom: "14px",
              border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden" }}>
              {/* Cabeçalho da equipe */}
              <div style={{ padding: "8px 14px", background: ei < 3 ? "#FFF9E6" : "#F4F4F4",
                borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{med || <Trophy size={15} style={{ color: C.textSub }} />}</span>
                <span style={{ fontWeight: 700, fontSize: "13px", color: C.text }}>
                  {eq.nome_supervisor}</span>
                <span style={{ fontSize: "10px", color: C.textSub }}>
                  {eq.vendedores.length} vendedores</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: C.textSub, fontFamily: C.mono }}>
                    {fmtN(eq.total_caixas)} cx</span>
                
                </div>
              </div>

              {/* Tabela de vendedores */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: C.subHeader, color: "#fff" }}>
                      <th style={thL}></th>
                      <th style={thL}>VENDEDOR</th>
                      <th style={thR}>CAIXAS</th>
                      <th style={thR}>PRÊMIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eq.vendedores.map((v, vi) => {
                      const key = `${eq.cod_supervisor}_${v.cod_vendedor}`;
                      const isExp = !!expanded[key];
                      return (
                        <Fragment key={key}>
                          <tr
                            onClick={() => setExpanded(ex => ({ ...ex, [key]: !ex[key] }))}
                            style={{ cursor: "pointer",
                              background: vi % 2 === 0 ? C.rowEven : C.rowOdd,
                              borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ ...tdBase, width: "28px", textAlign: "center" }}>
                              {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </td>
                            <td style={{ ...tdBase, fontWeight: 500 }}>
                              <span style={{ color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>
                                {v.cod_vendedor}</span>{" "}{v.nome_vendedor}
                            </td>
                            <td style={{ ...tdBase, textAlign: "right", fontFamily: C.mono }}>
                              {fmtN(v.total_caixas)}</td>
                            <td style={{ ...tdBase, textAlign: "right", fontFamily: C.mono,
                              fontWeight: 700, color: C.green }}>{fmtR(v.total_premio)}</td>
                          </tr>
                          {isExp && v.produtos.map(p => (
                            <tr key={`${key}_${p.cod_produto}`} style={{ background: "#FBFBFB" }}>
                              <td style={tdBase}></td>
                              <td style={{ ...tdBase, paddingLeft: "20px", color: C.textSub }}>
                                <span style={{ fontFamily: C.mono, fontSize: "10px" }}>{p.cod_produto}</span>{" "}
                                {p.descricao}
                                <span style={{ fontSize: "10px", color: C.textSub }}>
                                  {" "}({fmtN(p.unidades)} un ÷ {p.qt_unit_cx})</span>
                              </td>
                              <td style={{ ...tdBase, textAlign: "right", fontFamily: C.mono, color: C.textSub }}>
                                {fmtN(p.caixas)}</td>
                              <td style={{ ...tdBase, textAlign: "right", fontFamily: C.mono, color: C.textSub }}>
                                {fmtR(p.premio)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                      <td style={tdBase}></td>
                      <td style={tdBase}>TOTAL EQUIPE</td>
                      <td style={{ ...tdBase, textAlign: "right", fontFamily: C.mono }}>
                        {fmtN(eq.total_caixas)}</td>
                      <td style={{ ...tdBase, textAlign: "right", fontFamily: C.mono }}>
                        {fmtR(eq.total_premio)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const thL = { padding: "6px 8px", textAlign: "left", fontSize: "10px", fontWeight: 700,
  letterSpacing: "0.04em", whiteSpace: "nowrap" };
const thR = { ...thL, textAlign: "right" };
const tdBase = { padding: "6px 8px", fontSize: "12px" };