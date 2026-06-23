import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, ChevronDown, TrendingUp, TrendingDown, Minus, FileText, Star } from "lucide-react";
import { C, fmt, fmtPct, pctStyle, fmtN, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import Dropdown from "../../components/Dropdown";
import ModuleHeader from "../../components/ModuleHeader";
import { arrow, medal } from "../../components/ArrowBadge";
import SkeletonRows from "../../components/SkeletonRows";
import { useSort } from "../../hooks/useSort";

export default function ModuleRanking({ isMobile, token, userInfo = {} }) {
  const headers = useAuthHeaders(token);
  const cargo   = userInfo.cargo ?? "gerencial";
  const codUser = userInfo.cod_winthor ?? null;
  const isAdmin = cargo === "admin";
  const { sortCol, sortDir, handleSort } = useSort("faturamento", "desc");

  const [rows, setRows] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [supervisores, setSupervisores] = useState([]);
  const [supSel, setSupSel] = useState(cargo === "supervisor" ? codUser : null);
  const [dataRef, setDataRef] = useState(getToday());
  const tableRef = useRef(null);

  useEffect(() => {
    if (cargo !== "gerencial" && cargo !== "admin") return;
    fetch(`${API_BASE}/api/faturamento/supervisores`, { headers })
      .then(r => r.json())
      .then(j => setSupervisores((j.dados ?? []).map(s => ({ cod: s.cod_supervisor, nome: s.nome_supervisor }))))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${API_BASE}/api/faturamento/ranking${supSel ? `/${supSel}` : ""}?data=${dataRef}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const mapped = (json.dados ?? []).map(r => ({
        ...r,
        faturamento: r.valor_faturado_mes_atual ?? 0,
        meta: r.valor_meta_secao ?? 0,
        pct_atingido: r.valor_meta_secao > 0
          ? (Math.max(0, r.valor_faturado_mes_atual ?? 0) / r.valor_meta_secao) * 100
          : null,
        tendencia: r.tendencia_pct,
        necessidade_dia: r.necessidade_dia,
        nao_faturado_hoje: r.nao_faturado_hoje,
        faturado_hoje: r.faturado_hoje,
        realizado_dia: r.realizado_dia,
        dias_uteis_decorridos: r.dias_uteis_decorridos,
        dias_uteis_mes_atual: r.dias_uteis_mes_atual,
        pct_dia: (r.necessidade_dia ?? 0) > 0 ? ((r.nao_faturado_hoje ?? 0) / r.necessidade_dia) * 100 : null,
      }));
      setRows(mapped);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [supSel, dataRef, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = useMemo(() => {
    let r = [...rows];
    r.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "pt-BR")
        : String(bv).localeCompare(String(av), "pt-BR");
    });
    return r;
  }, [rows, sortCol, sortDir]);

  const tot = useMemo(() => {
    const fat = rows.reduce((s, r) => s + (r.faturamento ?? 0), 0);
    const meta = rows.reduce((s, r) => s + (r.meta ?? 0), 0);
    const raf = rows.reduce((s, r) => s + (r.resta_a_fazer ?? 0), 0);
    const nec = rows.reduce((s, r) => s + (r.necessidade_dia ?? 0), 0);
    const dia = rows.reduce((s, r) => s + (r.realizado_dia ?? 0), 0);
    const nfh = rows.reduce((s, r) => s + (r.nao_faturado_hoje ?? 0), 0);
    const pctGeral = meta > 0 ? (fat / meta) * 100 : null;
    const div = rows.length > 0 && rows[0].dias_uteis_decorridos > 0
      ? (fat / rows[0].dias_uteis_decorridos) * rows[0].dias_uteis_mes_atual
      : 0;
    const tendPct = meta > 0 && div > 0 ? (div / meta) * 100 : null;
    const rafDia = nec - dia;
    const pctDia = nec > 0 ? (nfh / nec) * 100 : null;
    return { fat, meta, media: rows.length > 0 ? fat / rows.length : 0, raf, nec, dia, nfh, rafDia, pctDia, pctGeral, tendPct };
  }, [rows]);

  const exportToPDF = async () => {
    const { jsPDF } = window.jspdf;
    const res = await fetch("/jspdf.debug.js"); // fallback
    if (!window.html2canvas) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.body.appendChild(s);
      await new Promise(r => { s.onload = r; });
    }
    if (!window.jspdf) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.body.appendChild(s);
      await new Promise(r => { s.onload = r; });
    }

    const tabelaHTML = `
      <div style="padding:16px;font-family:Segoe UI,Arial,sans-serif">
        <h2 style="color:#990000">PREMIUM DISTRIBUIDORA</h2>
        <h3 style="color:#C8960C">Ranking de Vendas — ${dataRef}</h3>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px">
          <thead><tr style="background:#CC0000;color:#fff">
            <th>#</th><th>VENDEDOR</th><th>FATURAMENTO</th><th>META</th><th>% ATING</th><th>TENDÊNCIA</th>
          </tr></thead>
          <tbody>
            ${sorted.map((r, i) => `<tr${i % 2 === 0 ? ' style="background:#FFF8F8"' : ""}>
              <td>${i + 1}°</td>
              <td>${r.nome_vendedor ?? `#${r.cod_vendedor}`}</td>
              <td align="right">R$ ${(r.meta ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
              <td align="right">R$ ${(r.faturamento ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
              <td align="center">${r.pct_atingido != null ? r.pct_atingido.toFixed(1)+"%" : "—"}</td>
              <td align="center">${r.tendencia != null ? r.tendencia.toFixed(1)+"%" : "—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed"; wrapper.style.left = "-9999px"; wrapper.style.top = "0";
    wrapper.innerHTML = tabelaHTML;
    document.body.appendChild(wrapper);

    const canvas = await window.html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: "#fff" });
    const doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(170, 0, 0); doc.rect(0, 0, 297, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13); doc.setTextColor(200, 150, 12); doc.text("PREMIUM DISTRIBUIDORA", 10, 8);
    doc.setFontSize(8); doc.setTextColor(255, 220, 180); doc.text(`Ranking — ${dataRef}`, 10, 14);
    const ratio = Math.min(270 / (canvas.width / 2), 180 / (canvas.height / 2));
    const fw = (canvas.width / 2) * ratio, fh = (canvas.height / 2) * ratio;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", (297 - fw) / 2, 20, fw, fh);
    doc.save(`Ranking_${dataRef}.pdf`);
    document.body.removeChild(wrapper);
  };

  return (
    <>
      <ModuleHeader icon={Star} title="RANKING DE VENDEDORES"
        titleExtra={<>Total: <b>{fmt(tot.fat)}</b> · Meta: <b>{fmt(tot.meta)}</b> · Média: <b>{fmt(tot.media)}</b></>}
        isMobile={isMobile}>
        <button onClick={fetchData} disabled={loading}
          style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.3)", color: "#fff",
                   padding: "6px 10px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
        {rows.length > 0 && (
          <button onClick={exportToPDF}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.3)", color: "#fff", padding: "6px 12px",
              borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
            <FileText size={13} /> PDF
          </button>
        )}
      </ModuleHeader>

      <div style={{
        background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${C.border}`, borderRadius: "6px", padding: "5px 10px", background: "#fff" }}>
          <span style={{ fontSize: "11px", color: C.textSub, fontWeight: 600, whiteSpace: "nowrap" }}>Data</span>
          <input type="date" value={dataRef} max={getToday()}
            onChange={e => setDataRef(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: "12px", fontFamily: C.mono,
                     color: C.text, background: "transparent", cursor: "pointer" }} />
        </div>

        {(cargo === "gerencial" || cargo === "admin") && (
          <Dropdown value={supSel} onChange={setSupSel} options={supervisores} placeholder="Todos supervisores..." />
        )}

        {isAdmin && (
          <button onClick={() => setShowDebug(v => !v)}
            style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700,
              cursor: "pointer", border: `1.5px solid ${showDebug ? "#7C3AED" : "#CBD5E1"}`,
              background: showDebug ? "#7C3AED" : "#fff", color: showDebug ? "#fff" : "#64748b" }}>
            🔬 Debug
          </button>
        )}
      </div>

      <div style={{ margin: isMobile ? "8px" : "12px 16px", background: "#fff",
        border: `1px solid ${C.border}`, borderRadius: "4px", overflow: "hidden",
        boxShadow: `0 1px 6px rgba(170,0,0,.1)` }}>
        {loading && <SkeletonRows count={6} height={36} />}
        {error && <div style={{ padding: "24px", textAlign: "center", color: C.red }}>{error}</div>}
        {!loading && !error && (
          <div style={{ overflowX: "auto" }} ref={tableRef}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "12px" }}>
              <thead>
                <tr>
                  <th style={{ padding: "6px 8px", background: C.subHeader, color: "#fff", fontSize: "10px", fontWeight: 700,
                    textAlign: "center", border: `1px solid ${C.primaryDk}`, width: "40px" }}>#</th>
                  <Th label="VENDEDOR" col="nome_vendedor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="FATURAMENTO" col="faturamento" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="META" col="meta" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="RESTA A FAZER" col="resta_a_fazer" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="% ATING" col="pct_atingido" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                  <Th label="TENDÊNCIA" col="tendencia" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                  <Th label="NECESS/DIA" col="necessidade_dia" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="REALIZ/DIA" col="faturado_hoje" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="RAF DIA" col="raf_dia" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="% DIA" col="pct_dia" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                  <Th label="STATUS" align="center" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const m = medal(i + 1);
                  const pct = r.pct_atingido;
                  return (
                    <tr key={r.cod_vendedor ?? i}
                      style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd }}
                      onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.rowEven : C.rowOdd}>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>
                        {m ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: "24px", height: "24px", borderRadius: "50%", background: m.bg, color: m.color,
                          fontSize: "11px", fontWeight: 800 }}>{m.label}</span> : i + 1}
                      </td>
                      <td style={{ padding: "5px 8px", fontWeight: 600 }}>{r.nome_vendedor ?? `#${r.cod_vendedor}`}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, fontWeight: 600 }}>{fmt(r.faturamento)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmt(r.meta)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, color: C.red, fontWeight: 600 }}>{fmt(r.resta_a_fazer)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}><span style={pctStyle(pct)}>{fmtPct(pct)}</span></td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}><span style={pctStyle(r.tendencia)}>{fmtPct(r.tendencia)}</span></td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmt(r.necessidade_dia)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmt(r.realizado_dia)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono, color: C.red, fontWeight: 600 }}>{fmt((r.necessidade_dia ?? 0) - (r.realizado_dia ?? 0))}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}><span style={pctStyle(r.pct_dia)}>{fmtPct(r.pct_dia)}</span></td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>{arrow(pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {sorted.length > 0 && (
                <tfoot>
                  <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }}></td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }}>{sorted.length} vendedores</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmt(tot.fat)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmt(tot.meta)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmt(tot.raf)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "center" }}>
                      <span style={pctStyle(tot.pctGeral)}>{fmtPct(tot.pctGeral)}</span>
                    </td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "center" }}><span style={pctStyle(tot.tendPct)}>{fmtPct(tot.tendPct)}</span></td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmt(tot.nec)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmt(tot.dia)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmt(tot.rafDia)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "center" }}><span style={pctStyle(tot.pctDia)}>{fmtPct(tot.pctDia)}</span></td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "center" }}>{arrow(tot.pctGeral)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {sorted.length === 0 && !loading && (
              <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Nenhum dado disponível.</div>
            )}
          </div>
        )}
      </div>

      {isAdmin && showDebug && sorted.length > 0 && (
        <div style={{ margin: "0 16px 16px", background: "#fff", border: "1.5px solid #7C3AED",
          borderRadius: "6px", overflow: "hidden", boxShadow: "0 1px 6px rgba(124,58,237,.15)" }}>
          <div style={{ padding: "8px 14px", background: "#7C3AED", color: "#fff", fontWeight: 700, fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            🔬 Debug SQL — dados brutos
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr>
                  {["COD","VENDEDOR","FAT","META","%","TEND","RAF","NEC","DIA","DD","DM"].map(h => (
                    <th key={h} style={{ padding: "5px 8px", background: "#EDE9FE", color: "#4C1D95", fontSize: "10px",
                      fontWeight: 700, border: "1px solid #C4B5FD", textAlign: h === "VENDEDOR" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.cod_vendedor ?? i} style={{ background: i % 2 === 0 ? "#FAF5FF" : "#fff" }}>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", fontFamily: C.mono }}>{r.cod_vendedor}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF" }}>{r.nome_vendedor}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.faturamento?.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.meta?.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.pct_atingido?.toFixed(1)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.tendencia?.toFixed(1)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.resta_a_fazer?.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.necessidade_dia?.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.nao_faturado_hoje?.toFixed(2)}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.dias_uteis_decorridos}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #E9D5FF", textAlign: "right", fontFamily: C.mono }}>{r.dias_uteis_mes_atual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
