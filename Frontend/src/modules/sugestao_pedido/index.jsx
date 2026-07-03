import { useState, useEffect, useMemo } from "react";
import { ClipboardList, Search, FileSpreadsheet, FileText, Calculator } from "lucide-react";
import { C, fmtN, fmtR, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders, apiGet } from "../../api";
import ModuleHeader from "../../components/ModuleHeader";
import Dropdown from "../../components/Dropdown";
import { exportCSV } from "../../utils/exportCSV";

const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };

const campo = {
  border: `1px solid ${C.border}`, borderRadius: "6px", padding: "7px 10px",
  fontSize: "12px", fontFamily: "inherit", color: C.text, background: "#fff", outline: "none",
};

function LabelCampo({ children }) {
  return <span style={{ fontSize: "9px", fontWeight: 700, color: C.textSub,
    letterSpacing: "0.05em", display: "block", marginBottom: "3px" }}>{children}</span>;
}

export default function ModuleSugestaoPedido({ isMobile, token, userInfo = {} }) {
  const headers = useAuthHeaders(token);

  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel,   setFornSel]   = useState(null);
  const [diniV,     setDiniV]     = useState(primeiroDiaMes());
  const [dfimV,     setDfimV]     = useState(getToday());
  const [diniC,     setDiniC]     = useState(primeiroDiaMes());
  const [dfimC,     setDfimC]     = useState(getToday());
  const [diasEst,   setDiasEst]   = useState(15);

  const [dados,   setDados]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [busca,   setBusca]   = useState("");
  const [buscou,  setBuscou]  = useState(false);

  useEffect(() => {
    apiGet(`${API_BASE}/api/lista-negra/fornecedores`, headers)
      .then(j => setFornecedores(j.dados ?? []))
      .catch(() => {});
  }, []);

  const buscar = () => {
    if (!fornSel) return;
    setLoading(true); setError(null); setBuscou(true);
    const qs = new URLSearchParams({
      codfornec: fornSel, dini: diniV, dfim: dfimV,
      dcorte_ini: diniC, dcorte_fim: dfimC, dias_estoque: diasEst,
    });
    apiGet(`${API_BASE}/api/sugestao-pedido?${qs}`, headers)
      .then(j => setDados(j.dados ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  const filtrados = useMemo(() => {
    if (!busca) return dados;
    const s = busca.toLowerCase();
    return dados.filter(r =>
      (r.descricao ?? "").toLowerCase().includes(s) ||
      String(r.cod_produto ?? "").includes(s) ||
      String(r.cod_fabrica ?? "").includes(s));
  }, [dados, busca]);

  const totais = useMemo(() => ({
    vendida:  filtrados.reduce((s, r) => s + (r.qt_vendida ?? 0), 0),
    cortada:  filtrados.reduce((s, r) => s + (r.qt_cortada ?? 0), 0),
    sugestao: filtrados.reduce((s, r) => s + (r.sugestao_qt ?? 0), 0),
    sugestaoCx: filtrados.reduce((s, r) => s + (r.qt_unit_cx > 0 ? Math.ceil((r.sugestao_qt ?? 0) / r.qt_unit_cx) : 0), 0),
    peso:     filtrados.reduce((s, r) => s + (r.peso_sugestao ?? ((r.sugestao_qt ?? 0) * (r.peso_bruto ?? 0))), 0),
  }), [filtrados]);

  const fornNome = fornecedores.find(f => String(f.id) === String(fornSel))?.nome ?? fornSel;

  const pesoDe = (r) => r.peso_sugestao ?? ((r.sugestao_qt ?? 0) * (r.peso_bruto ?? 0));
  const cxDe   = (r) => (r.qt_unit_cx > 0 ? Math.ceil((r.sugestao_qt ?? 0) / r.qt_unit_cx) : null);
  const estCxDe = (r) => (r.qt_unit_cx > 0 ? (r.estoque_disponivel ?? 0) / r.qt_unit_cx : null);

  const exportarExcel = () => {
    if (!filtrados.length) return;
    exportCSV(`Sugestao_Pedido_${fornNome}_${getToday()}`,
      ["COD_FAB", "COD_PROD", "PRODUTO", "QT_CX", "VENDA_PERIODO", "DIAS_UTEIS",
       "MEDIA_DIA", "ESTOQUE_DISP", "ESTOQUE_DISP_CX", "CORTE", "ULT_VLR_ENTRADA",
       "SUGESTAO_CX", "PESO_SUGESTAO_KG"],
      filtrados.map(r => [
        r.cod_fabrica ?? "",
        r.cod_produto ?? "",
        `"${(r.descricao ?? "").replace(/"/g, '""')}"`,
        r.qt_unit_cx ?? "",
        String(r.qt_vendida ?? 0).replace(".", ","),
        r.dias_uteis ?? "",
        String(r.media_dia ?? 0).replace(".", ","),
        String(r.estoque_disponivel ?? 0).replace(".", ","),
        (estCxDe(r) != null ? String(estCxDe(r).toFixed(2)).replace(".", ",") : ""),
        String(r.qt_cortada ?? 0).replace(".", ","),
        String((r.ult_vlr_entrada ?? 0).toFixed(4)).replace(".", ","),
        (cxDe(r) ?? ""),
        String(pesoDe(r).toFixed(3)).replace(".", ","),
      ]));
  };

  const exportarPDF = async () => {
    if (!filtrados.length) return;

    // Carrega jsPDF + autoTable (paginação de verdade, sem imagem espremida)
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = res; s.onerror = rej; document.body.appendChild(s);
      });
    }
    if (!window.jspdf.jsPDF.API.autoTable) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
        s.onload = res; s.onerror = rej; document.body.appendChild(s);
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const body = filtrados.map(r => [
      r.cod_fabrica ?? "",
      r.descricao ?? "",
      r.qt_unit_cx ?? "",
      fmtN(r.qt_vendida),
      fmtN(r.media_dia),
      fmtN(r.estoque_disponivel),
      (estCxDe(r) != null ? fmtN(estCxDe(r)) : "—"),
      fmtN(r.qt_cortada),
      fmtR(r.ult_vlr_entrada),
      (cxDe(r) ?? "—"),
      fmtN(pesoDe(r)),
    ]);

    body.push([
      "", "TOTAL", "", fmtN(totais.vendida), "", "", "", fmtN(totais.cortada), "",
      fmtN(totais.sugestaoCx), fmtN(totais.peso),
    ]);

    doc.autoTable({
      head: [[
        "Cód Fab", "Produto", "Qt/Cx", "Venda", "Méd/Dia", "Est. Disp",
        "Est. Cx", "Corte", "Últ. Entrada", "Sug. Cx", "Peso (kg)",
      ]],
      body,
      startY: 24,
      margin: { top: 22, left: 8, right: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", lineColor: [220,220,220], lineWidth: 0.1 },
      headStyles: { fillColor: [170, 0, 0], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
      alternateRowStyles: { fillColor: [255, 248, 248] },
      columnStyles: {
        0: { cellWidth: 34, halign: "left" },
        1: { cellWidth: "auto", halign: "left" },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 16, halign: "right" },
        8: { cellWidth: 22, halign: "right" },
        9: { cellWidth: 18, halign: "right", fillColor: [255, 244, 204], textColor: [140, 100, 0], fontStyle: "bold" },
        10:{ cellWidth: 22, halign: "right" },
      },
      didParseCell: (d) => {
        if (d.row.index === body.length - 1) {
          d.cell.styles.fillColor = [140, 0, 0];
          d.cell.styles.textColor = 255;
          d.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => {
        doc.setFillColor(170, 0, 0);
        doc.rect(0, 0, pageW, 17, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13); doc.setTextColor(200, 150, 12);
        doc.text("PREMIUM DISTRIBUIDORA", 8, 7.5);
        doc.setFontSize(9); doc.setTextColor(255, 255, 255);
        doc.text(`Sugestão de Pedido — ${fornNome}`, 8, 13.5);
        doc.setFontSize(7); doc.setTextColor(255, 220, 180);
        doc.text(
          `Venda: ${diniV} a ${dfimV}  |  Corte: ${diniC} a ${dfimC}  |  Dias de estoque: ${diasEst}`,
          pageW - 8, 7.5, { align: "right" });
        const page = doc.internal.getNumberOfPages();
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`Página ${page}`, pageW - 8, pageH - 5, { align: "right" });
        doc.text(`Gerado em ${getToday()}`, 8, pageH - 5);
      },
    });

    doc.save(`Sugestao_Pedido_${fornNome}_${getToday()}.pdf`);
  };

  const Th = ({ children, align = "right" }) => (
    <th style={{ padding: "6px 8px", fontSize: "10px", fontWeight: 700, textAlign: align,
      whiteSpace: "nowrap", border: `1px solid ${C.primaryDk}`, position: "sticky", top: 0,
      background: C.subHeader, color: "#fff", zIndex: 1 }}>{children}</th>
  );
  const td = (extra = {}) => ({ padding: "5px 8px", fontSize: "11px", ...extra });

  return (
    <>
      <ModuleHeader icon={ClipboardList} title="SUGESTÃO DE PEDIDO" isMobile={isMobile} />

      <div style={{ background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "10px 12px" : "12px 20px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <LabelCampo>FORNECEDOR</LabelCampo>
            <Dropdown value={fornSel} onChange={setFornSel} options={fornecedores}
              placeholder="Selecione..." labelKey="nome" valueKey="id" minWidth="200px" />
          </div>
          <div>
            <LabelCampo>DIAS DE ESTOQUE</LabelCampo>
            <input type="number" min="1" value={diasEst}
              onChange={e => setDiasEst(Number(e.target.value))}
              style={{ ...campo, width: "90px" }} />
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: "10px",
            display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <LabelCampo>VENDA — INÍCIO</LabelCampo>
              <input type="date" value={diniV} max={getToday()}
                onChange={e => setDiniV(e.target.value)} style={campo} />
            </div>
            <div>
              <LabelCampo>VENDA — FIM</LabelCampo>
              <input type="date" value={dfimV} max={getToday()}
                onChange={e => setDfimV(e.target.value)} style={campo} />
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: "10px",
            display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <LabelCampo>CORTE — INÍCIO</LabelCampo>
              <input type="date" value={diniC} max={getToday()}
                onChange={e => setDiniC(e.target.value)} style={campo} />
            </div>
            <div>
              <LabelCampo>CORTE — FIM</LabelCampo>
              <input type="date" value={dfimC} max={getToday()}
                onChange={e => setDfimC(e.target.value)} style={campo} />
            </div>
          </div>
          <button onClick={buscar} disabled={!fornSel || loading}
            style={{ background: fornSel ? C.primary : C.border, border: "none", color: "#fff",
              padding: "8px 18px", borderRadius: "6px", cursor: fornSel ? "pointer" : "default",
              fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px",
              opacity: fornSel ? 1 : 0.5 }}>
            <Calculator size={14} /> {loading ? "Calculando..." : "Calcular"}
          </button>
        </div>
      </div>

      {dados.length > 0 && (
        <div style={{ background: "#FAFAFA", borderBottom: `1px solid ${C.border}`,
          padding: isMobile ? "6px 12px" : "8px 20px",
          display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px",
            border: `1px solid ${C.border}`, borderRadius: "6px", padding: "5px 10px", background: "#fff" }}>
            <Search size={12} style={{ color: C.textSub }} />
            <input placeholder="Produto, código..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "12px",
                width: isMobile ? "auto" : "160px", outline: "none", color: C.text }} />
          </div>
          <span style={{ fontSize: "11px", color: C.textSub }}>{filtrados.length} itens</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
            <button onClick={exportarExcel}
              style={{ display: "flex", alignItems: "center", gap: "5px", background: "#1D6F42",
                border: "none", color: "#fff", padding: "6px 12px", borderRadius: "6px",
                cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={exportarPDF}
              style={{ display: "flex", alignItems: "center", gap: "5px", background: "#B91C1C",
                border: "none", color: "#fff", padding: "6px 12px", borderRadius: "6px",
                cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
              <FileText size={13} /> PDF
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? "10px 12px" : "12px 20px" }}>
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Calculando sugestão...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!loading && !error && !buscou && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Escolha o fornecedor e os períodos, depois clique em <b>Calcular</b>.
          </div>
        )}
        {!loading && !error && buscou && filtrados.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Nenhum produto com venda ou corte no período.
          </div>
        )}

        {!loading && filtrados.length > 0 && (
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`,
            borderRadius: "6px", maxHeight: "calc(100vh - 280px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", background: "#fff" }}>
              <thead>
                <tr>
                  <Th align="left">PRODUTO</Th>
                  <Th align="center">QT/CX</Th>
                  <Th>VENDA</Th>
                  <Th>MÉD/DIA</Th>
                  <Th>EST. DISP</Th>
                  <Th>EST. CX</Th>
                  <Th>CORTE</Th>
                  <Th>ÚLT. ENTRADA</Th>
                  <Th>SUG. CX</Th>
                  <Th>PESO (KG)</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i) => {
                  const sugCx = cxDe(r);
                  return (
                    <tr key={r.cod_produto ?? i}
                      style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd }}>
                      <td style={td({ fontWeight: 500, maxWidth: "260px", minWidth: "180px" })}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.descricao}</div>
                        <div style={{ fontSize: "9px", color: C.textSub, fontFamily: C.mono }}>
                          {r.cod_produto} · fab {r.cod_fabrica}</div>
                      </td>
                      <td style={td({ textAlign: "center", fontFamily: C.mono, color: C.textSub })}>{r.qt_unit_cx}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono })}>{fmtN(r.qt_vendida)}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.textSub })}>{fmtN(r.media_dia)}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono,
                        color: (r.estoque_disponivel ?? 0) <= 0 ? C.red : C.text })}>{fmtN(r.estoque_disponivel)}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.textSub })}>
                        {estCxDe(r) != null ? fmtN(estCxDe(r)) : "—"}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono,
                        color: (r.qt_cortada ?? 0) > 0 ? C.amber : C.textSub })}>{fmtN(r.qt_cortada)}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.textSub })}>{fmtR(r.ult_vlr_entrada)}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono, fontWeight: 700,
                        background: "#FFF4CC", color: "#8C6400" })}>
                        {sugCx != null ? sugCx : "—"}</td>
                      <td style={td({ textAlign: "right", fontFamily: C.mono, color: C.textSub })}>{fmtN(pesoDe(r))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700,
                  position: "sticky", bottom: 0 }}>
                  <td style={td({ border: `1px solid ${C.primaryDk}` })}>TOTAL — {filtrados.length} itens</td>
                  <td style={td({ border: `1px solid ${C.primaryDk}` })}></td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, border: `1px solid ${C.primaryDk}` })}>{fmtN(totais.vendida)}</td>
                  <td style={td({ border: `1px solid ${C.primaryDk}` })}></td>
                  <td style={td({ border: `1px solid ${C.primaryDk}` })}></td>
                  <td style={td({ border: `1px solid ${C.primaryDk}` })}></td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, border: `1px solid ${C.primaryDk}` })}>{fmtN(totais.cortada)}</td>
                  <td style={td({ border: `1px solid ${C.primaryDk}` })}></td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, border: `1px solid ${C.primaryDk}` })}>{fmtN(totais.sugestaoCx)}</td>
                  <td style={td({ textAlign: "right", fontFamily: C.mono, border: `1px solid ${C.primaryDk}` })}>{fmtN(totais.peso)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}