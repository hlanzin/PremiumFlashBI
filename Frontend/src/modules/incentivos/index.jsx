import { useState, useEffect, useCallback } from "react";
import { Gift, RefreshCw } from "lucide-react";
import { C, fmtN, fmtR } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";

const medalha = (pos) => (pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : null);
// últimos colocados = "lanterninha" (só quando há gente suficiente pra fazer sentido)
const ehLanterninha = (pos, total) => total >= 6 && pos > total - 3;

export default function ModuleIncentivo({ isMobile, token, incentivoId = "yopro", incentivoNome }) {
  const headers = useAuthHeaders(token);
  const [dados, setDados]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const isGeral = incentivoId === "ranking-geral";

  const fetchDados = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = isGeral
        ? `${API_BASE}/api/incentivos/ranking-geral/consolidado`
        : `${API_BASE}/api/incentivos/${incentivoId}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDados(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [incentivoId, headers, isGeral]);

  useEffect(() => { fetchDados(); }, [incentivoId]);

  const ranking = dados?.ranking ?? [];
  const totalGeral = dados?.total_geral ?? {};
  const info = dados?.incentivo;
  const incentivosList = dados?.incentivos ?? [];   // para o breakdown do ranking geral
  const nomeExib = incentivoNome || info?.nome || dados?.nome || "Incentivo";

  // Tipo combo (Gulozitos) usa "combos" no lugar de "caixas"
  const isCombo = info?.tipo === "combo";
  const metricaLabel = isCombo ? "COMBOS" : "CAIXAS";
  const metricaDe = (v) => isCombo ? (v.total_combos ?? 0) : (v.total_caixas ?? 0);
  const totalMetrica = isCombo ? (totalGeral.combos ?? 0) : (totalGeral.caixas ?? 0);

  return (
    <>
      <ModuleHeader icon={Gift} title={nomeExib.toUpperCase()} isMobile={isMobile} />

      {/* Barra de resumo */}
      <div style={{ background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "10px 12px" : "12px 20px",
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        {isGeral ? (
          <div style={{ fontSize: "11px", color: C.textSub }}>
            <b style={{ color: C.text }}>Soma de todos os incentivos</b>
            {incentivosList.length > 0 && (
              <span> — {incentivosList.map(i => i.nome.replace("Incentivo ", "")).join(" + ")}</span>
            )}
          </div>
        ) : info && (
          <div style={{ fontSize: "11px", color: C.textSub }}>
            {isCombo ? (
              <span>
                <b style={{ color: C.text }}>R$ {fmtN(info.valor_por_combo)}</b> por cliente que levar os {info.produtos?.length} produtos
              </span>
            ) : info.faixas ? (
              <span>
                <b style={{ color: C.text }}>Faixas:</b>{" "}
                {info.faixas.map((f, i) => {
                  const ini = i === 0 ? 1 : info.faixas[i - 1].ate + 1;
                  const lbl = f.ate == null ? `${ini}+` : `${ini}–${f.ate}`;
                  return (
                    <span key={i} style={{ marginRight: "8px" }}>
                      {lbl} cx: <b style={{ color: C.text }}>R$ {fmtN(f.valor)}</b>
                    </span>
                  );
                })}
              </span>
            ) : (
              <span>
                <b style={{ color: C.text }}>R$ {fmtN(info.valor_por_caixa)}</b> por caixa fechada
              </span>
            )}
            <span style={{ margin: "0 8px", color: C.border }}>|</span>
            Produtos: {info.produtos?.join(", ")}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "5px 14px", borderRadius: "6px", background: C.total,
            color: C.totalTxt, fontWeight: 700, fontSize: "13px", display: "flex", gap: "10px" }}>
            {!isGeral && <span>{fmtN(totalMetrica)} {isCombo ? "combos" : "cx"}</span>}
            {!isGeral && <span>·</span>}
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
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Carregando ranking...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && !error && ranking.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Nenhuma venda apurada no período.
          </div>
        )}

        {!loading && ranking.length > 0 && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden" }}>
            {/* Pódio: top 3 em destaque */}
            {!isMobile && ranking.length >= 3 && (
              <div style={{ display: "flex", gap: "10px", padding: "16px",
                background: "linear-gradient(180deg,#FFFBEF,#fff)", borderBottom: `1px solid ${C.border}` }}>
                {[ranking[1], ranking[0], ranking[2]].map((v, idx) => {
                  const realPos = v.posicao;
                  const destaque = realPos === 1;
                  return (
                    <div key={v.cod_vendedor} style={{ flex: destaque ? 1.2 : 1,
                      background: "#fff", border: `2px solid ${destaque ? C.gold : C.border}`,
                      borderRadius: "10px", padding: destaque ? "16px 12px" : "12px",
                      textAlign: "center", alignSelf: destaque ? "flex-start" : "center",
                      boxShadow: destaque ? "0 4px 12px rgba(212,160,23,.25)" : "none" }}>
                      <div style={{ fontSize: destaque ? "32px" : "26px" }}>{medalha(realPos)}</div>
                      <div style={{ fontWeight: 700, fontSize: destaque ? "14px" : "12px",
                        color: C.text, marginTop: "4px" }}>{v.nome_vendedor}</div>
                      <div style={{ fontSize: "10px", color: C.textSub, marginBottom: "6px" }}>
                        {v.nome_supervisor}</div>
                      <div style={{ fontWeight: 800, fontSize: destaque ? "18px" : "15px",
                        color: C.green, fontFamily: C.mono }}>{fmtR(v.total_premio)}</div>
                      {!isGeral && (
                        <div style={{ fontSize: "10px", color: C.textSub, fontFamily: C.mono }}>
                          {fmtN(metricaDe(v))} {isCombo ? "combos" : "caixas"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabela do ranking completo */}
            <div style={{ overflowX: "auto" }}>
              {isGeral ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: C.subHeader, color: "#fff" }}>
                      <th style={{ ...th, textAlign: "center", width: "48px" }}>#</th>
                      <th style={th}>VENDEDOR</th>
                      <th style={th}>EQUIPE</th>
                      {incentivosList.map(inc => (
                        <th key={inc.id} style={{ ...th, textAlign: "right" }}>
                          {inc.nome.replace("Incentivo ", "").toUpperCase()}</th>
                      ))}
                      <th style={{ ...th, textAlign: "right" }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((v, i) => {
                      const med = medalha(v.posicao);
                      const lant = ehLanterninha(v.posicao, ranking.length);
                      return (
                        <tr key={v.cod_vendedor}
                          style={{ background: v.posicao <= 3 ? "#FFFDF5" : lant ? "#FBF3F3" : (i % 2 === 0 ? C.rowEven : C.rowOdd),
                            borderBottom: `1px solid ${C.border}`,
                            opacity: lant ? 0.85 : 1 }}>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                            {med ? <span style={{ fontSize: "16px" }}>{med}</span>
                              : lant ? <span title="Lanterninha" style={{ fontSize: "14px" }}>🔦</span>
                              : v.posicao}
                          </td>
                          <td style={{ ...td, fontWeight: 500 }}>
                            <span style={{ color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>
                              {v.cod_vendedor}</span>{" "}{v.nome_vendedor}
                          </td>
                          <td style={{ ...td, color: C.textSub, fontSize: "11px" }}>{v.nome_supervisor}</td>
                          {incentivosList.map(inc => (
                            <td key={inc.id} style={{ ...td, textAlign: "right", fontFamily: C.mono, color: C.textSub }}>
                              {fmtR(v.por_incentivo?.[inc.id])}</td>
                          ))}
                          <td style={{ ...td, textAlign: "right", fontFamily: C.mono, fontWeight: 700,
                            color: C.green, fontSize: "13px" }}>{fmtR(v.total_premio)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                      <td style={td}></td>
                      <td style={td}>TOTAL GERAL — {ranking.length} vendedores</td>
                      <td style={td}></td>
                      {incentivosList.map(inc => (
                        <td key={inc.id} style={{ ...td, textAlign: "right", fontFamily: C.mono }}>
                          {fmtR(ranking.reduce((s, v) => s + (v.por_incentivo?.[inc.id] || 0), 0))}</td>
                      ))}
                      <td style={{ ...td, textAlign: "right", fontFamily: C.mono }}>{fmtR(totalGeral.premio)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: C.subHeader, color: "#fff" }}>
                      <th style={{ ...th, textAlign: "center", width: "48px" }}>#</th>
                      <th style={th}>VENDEDOR</th>
                      <th style={th}>EQUIPE</th>
                      <th style={{ ...th, textAlign: "right" }}>{metricaLabel}</th>
                      {!isCombo && <th style={{ ...th, textAlign: "right" }}>R$/CX</th>}
                      <th style={{ ...th, textAlign: "right" }}>PRÊMIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((v, i) => {
                      const med = medalha(v.posicao);
                      return (
                        <tr key={v.cod_vendedor}
                          style={{ background: v.posicao <= 3 ? "#FFFDF5" : (i % 2 === 0 ? C.rowEven : C.rowOdd),
                            borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                            {med ? <span style={{ fontSize: "16px" }}>{med}</span> : v.posicao}
                          </td>
                          <td style={{ ...td, fontWeight: 500 }}>
                            <span style={{ color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>
                              {v.cod_vendedor}</span>{" "}{v.nome_vendedor}
                          </td>
                          <td style={{ ...td, color: C.textSub, fontSize: "11px" }}>{v.nome_supervisor}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: C.mono }}>{fmtN(metricaDe(v))}</td>
                          {!isCombo && (
                            <td style={{ ...td, textAlign: "right", fontFamily: C.mono, color: C.textSub }}>
                              {fmtR(v.valor_caixa_aplicado)}</td>
                          )}
                          <td style={{ ...td, textAlign: "right", fontFamily: C.mono, fontWeight: 700,
                            color: C.green }}>{fmtR(v.total_premio)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                      <td style={td}></td>
                      <td style={td}>TOTAL GERAL — {ranking.length} vendedores</td>
                      <td style={td}></td>
                      <td style={{ ...td, textAlign: "right", fontFamily: C.mono }}>{fmtN(totalMetrica)}</td>
                      {!isCombo && <td style={td}></td>}
                      <td style={{ ...td, textAlign: "right", fontFamily: C.mono }}>{fmtR(totalGeral.premio)}</td>
                    </tr>
                </tfoot>
              </table>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const th = { padding: "7px 10px", textAlign: "left", fontSize: "10px", fontWeight: 700,
  letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", fontSize: "12px" };