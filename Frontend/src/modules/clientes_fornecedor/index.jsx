import { useState, useEffect, useMemo } from "react";
import { Search, Users } from "lucide-react";
import { C, fmtR, fmtDt } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import SelectModal from "../../components/SelectModal";
import ModuleHeader from "../../components/ModuleHeader";
import { exportCSV } from "../../utils/exportCSV";
import TableCard from "../../components/TableCard";
import { useSort } from "../../hooks/useSort";

function getMesLabels() {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const hoje  = new Date();
  return Array.from({length:6}, (_,i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  });
}

export default function ModuleClientesFornecedor({ isMobile, token, userInfo = {} }) {
  const headers      = useAuthHeaders(token);
  const cargo        = userInfo.cargo ?? "gerencial";
  const isFornecedor = cargo === "fornecedor";
  const { sortCol, sortDir, handleSort } = useSort("razao_social", "asc");
  const mesLabels    = useMemo(() => getMesLabels(), []);

  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel, setFornSel] = useState(null);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/lista-negra/fornecedores`, { headers })
      .then(r => r.json())
      .then(j => {
        const lista = (j.dados ?? []).map(f => ({ cod: f.id, nome: f.nome }));
        setFornecedores(lista);
        if (isFornecedor && lista.length > 0) setFornSel(lista[0].cod);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!fornSel) return;
    setLoading(true); setError(null);
    fetch(`${API_BASE}/api/clientes-fornecedor?codfornec=${fornSel}`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => {
        const mapped = (j.dados ?? []).map(r => ({
          ...r,
          cidade: r.nome_cidade,
          ultima_data: r.dt_ultima_compra,
          ultimo_valor: r.vl_ultima_compra,
          pedidos_abertos: r.pedidos_abertos ?? 0,
        }));
        setDados(mapped);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fornSel]);

  const colunas = [
    { label: "CLIENTE", col: "razao_social" },
    { label: "CIDADE", col: "cidade" },
    { label: "ULTIMA COMPRA", col: "ultima_data" },
    { label: "ULTIMO VALOR", col: "ultimo_valor" },
    ...mesLabels.map((m, i) => ({ label: m, col: `m${i}` })),
    { label: "PED. ABERTO", col: "pedidos_abertos" },
  ];

  const rows = useMemo(() => {
    let r = [...dados];
    if (busca) {
      const s = busca.toLowerCase();
      r = r.filter(row =>
        (row.razao_social ?? "").toLowerCase().includes(s) ||
        (row.cidade ?? "").toLowerCase().includes(s));
    }
    r.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "pt-BR")
        : String(bv).localeCompare(String(av), "pt-BR");
    });
    return r;
  }, [dados, busca, sortCol, sortDir]);

  const handleExportExcel = () => {
    const header = ["Cliente", "Cidade", "Última Compra", "Último Valor", ...mesLabels, "Ped. Aberto"];
    const dataRows = rows.map(r => [
      r.razao_social, r.cidade || "", r.ultima_data || "", fmtR(r.ultimo_valor),
      ...Array.from({length: 6}, (_, i) => r[`m${i}`] > 0 ? fmtR(r[`m${i}`]) : ""),
      String(r.pedidos_abertos ?? 0),
    ]);
    exportCSV("ClientesFornecedor", header, dataRows);
  };

  return (
    <>
      <ModuleHeader icon={Users} title="CLIENTES POR FORNECEDOR" isMobile={isMobile}
        onExportExcel={handleExportExcel} />

      <div style={{
        background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <SelectModal value={fornSel} onChange={setFornSel} options={fornecedores}
          placeholder="Selecione um fornecedor..." labelKey="nome" valueKey="cod" isMobile={isMobile} />

        <div style={{ display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "5px 10px", background: C.bg, flex: isMobile ? "1" : "none" }}>
          <Search size={12} style={{ color: C.textSub }} />
          <input placeholder="Filtrar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px",
                     width: isMobile ? "auto" : "130px", outline: "none", color: C.text, fontFamily: C.sans }} />
        </div>
      </div>

      <TableCard isMobile={isMobile} maxHeight="70vh">
        {loading && <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Carregando...</div>}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!fornSel && !loading && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Selecione um fornecedor para visualizar os clientes.
          </div>
        )}
        {fornSel && !loading && !error && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "10px" : "11px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr style={{ background: C.subHeader }}>
                  <th style={{ padding: "5px 6px", border: `1px solid ${C.primaryDk}`, position: "sticky", left: 0, background: C.subHeader, zIndex: 3, minWidth: "120px" }}>CLIENTE</th>
                  <Th label="CIDADE" col="cidade" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="ULTIMA COMPRA" col="ultima_data" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                  <Th label="ULTIMO VALOR" col="ultimo_valor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  {mesLabels.map((m, i) => (
                    <Th key={i} label={m} col={`m${i}`} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  ))}
                  <Th label="PED. ABERTO" col="pedidos_abertos" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const bg = r.pedidos_abertos > 0 ? "#FFF8E1" : (i % 2 === 0 ? C.rowEven : C.rowOdd);
                  return (
                    <tr key={r.cod_cliente ?? i} style={{ background: bg, borderBottom: `1px solid ${C.border}` }}>
                      <td style={{
                        padding: "5px 6px", position: "sticky", left: 0, background: bg, zIndex: 1,
                        fontWeight: 600, fontSize: "11px", minWidth: "120px", whiteSpace: "nowrap",
                      }}>{r.razao_social}</td>
                      <td style={{ padding: "5px 6px" }}>{r.cidade}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center", fontFamily: C.mono, fontSize: "10px" }}>{fmtDt(r.ultima_data)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: C.mono, fontWeight: 600 }}>{fmtR(r.ultimo_valor)}</td>
                      {mesLabels.map((_, mi) => (
                        <td key={mi} style={{
                          padding: "5px 6px", textAlign: "right", fontFamily: C.mono, fontSize: "10px",
                          background: r[`m${mi}`] > 0 ? "#E8F5E9" : "transparent",
                          fontWeight: r[`m${mi}`] > 0 ? 600 : 400,
                        }}>{r[`m${mi}`] > 0 ? fmtR(r[`m${mi}`]) : "—"}</td>
                      ))}
                      <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: r.pedidos_abertos > 0 ? C.amber : C.textSub }}>
                        {r.pedidos_abertos ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", color: C.textSub }}>Nenhum cliente encontrado.</div>
            )}
          </>
        )}
      </TableCard>
    </>
  );
}
