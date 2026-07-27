import { useState, useEffect, useMemo, useRef } from "react";
import { Trophy, Search, X } from "lucide-react";
import { C, fmtR, fmtN, fmtDt, getToday } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import Th from "../../components/Th";
import SelectModal from "../../components/SelectModal";
import ModuleHeader from "../../components/ModuleHeader";
import TableCard from "../../components/TableCard";
import DatePicker from "../../components/DatePicker";
import SkeletonRows from "../../components/SkeletonRows";
import { medal } from "../../components/ArrowBadge";
import { exportCSV } from "../../utils/exportCSV";
import { useSort } from "../../hooks/useSort";

const fmtPeso = (v) => v == null ? "—" : `${fmtN(v)} kg`;
const TODOS_FORNECEDORES = "__todos__";

const primeiroDiaMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export default function ModuleRankingClientes({ isMobile, token, userInfo = {} }) {
  const headers      = useAuthHeaders(token);
  const cargo        = userInfo.cargo ?? "gerencial";
  const codUser      = userInfo.cod_winthor ?? null;
  const isFornecedor = cargo === "fornecedor";
  const isGerencial  = cargo === "gerencial" || cargo === "admin";
  const isSupervisor = cargo === "supervisor";
  const { sortCol, sortDir, handleSort } = useSort("valor_total", "desc");

  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel, setFornSel] = useState(null);
  const [dtIni, setDtIni] = useState(primeiroDiaMes());
  const [dtFim, setDtFim] = useState(getToday());
  const [supervisores, setSupervisores] = useState([]);
  const [supSel, setSupSel] = useState(isSupervisor ? codUser : null);
  const [vendedores, setVendedores] = useState([]);
  const [vendSel, setVendSel] = useState(null);
  const [busca, setBusca] = useState("");

  const [dados, setDados] = useState([]);
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fornecedores ──────────────────────────────────────────────────────────
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

  // "Todos os Fornecedores" — opção extra no topo da lista, que soma todos
  // os fornecedores que o usuário tem acesso num ranking só.
  const fornecedoresComTodos = useMemo(() => (
    fornecedores.length > 0
      ? [{ cod: TODOS_FORNECEDORES, nome: "Todos os Fornecedores" }, ...fornecedores]
      : fornecedores
  ), [fornecedores]);

  const codfornecParam = fornSel === TODOS_FORNECEDORES
    ? fornecedores.map(f => f.cod).join(",")
    : fornSel;

  // ── Supervisores (só gerencial/admin escolhem) ───────────────────────────
  useEffect(() => {
    if (!isGerencial) return;
    fetch(`${API_BASE}/api/faturamento/supervisores`, { headers })
      .then(r => r.json())
      .then(j => setSupervisores((j.dados ?? []).map(s => ({ cod: s.cod_supervisor, nome: s.nome_supervisor }))))
      .catch(() => {});
  }, []);

  // ── Vendedores da equipe do supervisor selecionado ──────────────────────
  useEffect(() => {
    if (!supSel) { setVendedores([]); setVendSel(null); return; }
    fetch(`${API_BASE}/api/ranking-clientes/vendedores/${supSel}`, { headers })
      .then(r => r.json())
      .then(j => setVendedores((j.dados ?? []).map(v => ({ cod: v.cod_vendedor, nome: v.nome_vendedor }))))
      .catch(() => setVendedores([]));
    setVendSel(null);
  }, [supSel]);

  // Vendedor tem a própria carteira fixa; supervisor tem seu próprio filtro
  // fixo (supSel = ele mesmo) — só gerencial/admin têm supervisor pra
  // limpar. Vendedor selecionado dá pra limpar em qualquer um dos dois.
  const temFiltroCarteira = (isGerencial && !!supSel) || !!vendSel;
  const limparFiltroCarteira = () => {
    if (isGerencial) setSupSel(null);
    setVendSel(null);
  };

  // ── Dados do ranking ──────────────────────────────────────────────────────
  // Guarda a requisição mais recente — se o usuário trocar o filtro rápido
  // (ex.: selecionar o supervisor antes da 1ª busca "geral" terminar), a
  // resposta de uma busca antiga que volta depois não pode sobrescrever o
  // resultado da busca mais nova já filtrada.
  const reqIdRef = useRef(0);

  const fetchData = () => {
    if (!fornSel) return;
    const reqId = ++reqIdRef.current;
    setLoading(true); setError(null);
    const params = new URLSearchParams({ codfornec: codfornecParam, dt_ini: dtIni, dt_fim: dtFim });
    if (isGerencial && supSel) params.set("filtro_supervisor", supSel);
    if ((isGerencial || isSupervisor) && vendSel) params.set("filtro_vendedor", vendSel);
    fetch(`${API_BASE}/api/ranking-clientes?${params.toString()}`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { if (reqId === reqIdRef.current) { setDados(j.dados ?? []); setCarregouUmaVez(true); } })
      .catch(e => { if (reqId === reqIdRef.current) setError(e.message); })
      .finally(() => { if (reqId === reqIdRef.current) setLoading(false); });
  };

  useEffect(() => { fetchData(); }, [fornSel, dtIni, dtFim, supSel, vendSel]);

  const rows = useMemo(() => {
    let r = [...dados];
    if (busca) {
      const s = busca.toLowerCase();
      r = r.filter(row =>
        (row.nome_cliente ?? "").toLowerCase().includes(s) ||
        (row.nome_cidade ?? "").toLowerCase().includes(s));
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

  const tot = useMemo(() => ({
    valor: rows.reduce((s, r) => s + (r.valor_total ?? 0), 0),
    peso:  rows.reduce((s, r) => s + (r.peso_total ?? 0), 0),
  }), [rows]);

  const handleExportExcel = () => {
    const header = ["#", "Cliente", "Cidade", "Vendedor", "Qtd", "Peso (kg)", "Valor", "Notas", "Última Compra"];
    const dataRows = rows.map((r, i) => [
      i + 1, r.nome_cliente, r.nome_cidade || "", r.nome_vendedor || "",
      fmtN(r.quantidade), fmtN(r.peso_total), fmtR(r.valor_total),
      String(r.qt_notas ?? 0), fmtDt(r.ultima_compra),
    ]);
    exportCSV("RankingClientes", header, dataRows);
  };

  return (
    <>
      <ModuleHeader icon={Trophy} title="RANKING DE CLIENTES" isMobile={isMobile}
        titleExtra={rows.length > 0 && <>Total: <b>{fmtR(tot.valor)}</b> · <b>{fmtPeso(tot.peso)}</b></>}
        onRefresh={fetchData} loading={loading}
        onExportExcel={rows.length > 0 ? handleExportExcel : undefined} />

      <div style={{
        background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <SelectModal value={fornSel} onChange={setFornSel} options={fornecedoresComTodos}
          placeholder="Selecione um fornecedor..." labelKey="nome" valueKey="cod" isMobile={isMobile} />

        {isGerencial && (
          <SelectModal value={supSel} onChange={setSupSel} options={supervisores}
            placeholder="Todos supervisores..." labelKey="nome" valueKey="cod" isMobile={isMobile} />
        )}

        {(isGerencial || isSupervisor) && (
          <SelectModal value={vendSel} onChange={setVendSel} options={vendedores}
            placeholder={supSel ? "Todos vendedores..." : "Escolha um supervisor"} labelKey="nome" valueKey="cod" isMobile={isMobile} />
        )}

        {temFiltroCarteira && (
          <button onClick={limparFiltroCarteira}
            style={{ display: "flex", alignItems: "center", gap: "4px", background: "none",
              border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 10px",
              fontSize: "12px", color: C.textSub, cursor: "pointer", fontFamily: C.sans }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <X size={12} /> Limpar filtro
          </button>
        )}

        <DatePicker value={dtIni} onChange={setDtIni} max={dtFim} isMobile={isMobile} />
        <span style={{ color: C.textSub, fontSize: "12px" }}>até</span>
        <DatePicker value={dtFim} onChange={setDtFim} min={dtIni} max={getToday()} isMobile={isMobile} />

        <div style={{ display: "flex", alignItems: "center", gap: "6px",
          border: `1px solid ${C.border}`, borderRadius: "6px",
          padding: "5px 10px", background: C.bg, marginLeft: isMobile ? 0 : "auto",
          flex: isMobile ? "1" : "none" }}>
          <Search size={12} style={{ color: C.textSub }} />
          <input placeholder="Filtrar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px",
                     width: isMobile ? "auto" : "150px", outline: "none", color: C.text, fontFamily: C.sans }} />
        </div>
      </div>

      <TableCard isMobile={isMobile} maxHeight="70vh">
        {loading && !carregouUmaVez && <SkeletonRows count={8} height={36} />}
        {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}
        {!fornSel && !loading && (
          <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
            Selecione um fornecedor para ver o ranking.
          </div>
        )}
        {fornSel && !error && (carregouUmaVez || !loading) && (
          <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 200ms ease" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "11px" : "12px" }}>
              <thead>
                <tr>
                  <th style={{ padding: "6px 8px", background: C.subHeader, color: "#fff", fontSize: "10px", fontWeight: 700,
                    textAlign: "center", border: `1px solid ${C.primaryDk}`, width: "40px" }}>#</th>
                  <Th label="CLIENTE" col="nome_cliente" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="CIDADE" col="nome_cidade" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="VENDEDOR" col="nome_vendedor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <Th label="QTD" col="quantidade" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="PESO (KG)" col="peso_total" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="VALOR" col="valor_total" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                  <Th label="NOTAS" col="qt_notas" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                  <Th label="ÚLT. COMPRA" col="ultima_compra" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="center" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const m = medal(i + 1);
                  return (
                    <tr key={r.cod_cliente ?? i}
                      style={{ background: i % 2 === 0 ? C.rowEven : C.rowOdd }}
                      onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.rowEven : C.rowOdd}>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>
                        {m ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: "24px", height: "24px", borderRadius: "50%", background: m.bg, color: m.color,
                          fontSize: "11px", fontWeight: 800 }}>{m.label}</span> : i + 1}
                      </td>
                      <td style={{ padding: "5px 8px", fontWeight: 600 }}>{r.nome_cliente}</td>
                      <td style={{ padding: "5px 8px", color: C.textSub }}>{r.nome_cidade}</td>
                      <td style={{ padding: "5px 8px", color: C.textSub }}>{r.nome_vendedor ?? `#${r.cod_vendedor}`}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono }}>{fmtN(r.quantidade)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono,
                        fontWeight: sortCol === "peso_total" ? 700 : 400 }}>{fmtPeso(r.peso_total)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: C.mono,
                        fontWeight: sortCol === "valor_total" ? 700 : 400 }}>{fmtR(r.valor_total)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: C.mono }}>{r.qt_notas}</td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: C.mono, fontSize: "11px" }}>{fmtDt(r.ultima_compra)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background: C.total, color: C.totalTxt, fontWeight: 700 }}>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }} colSpan={4}>
                      {rows.length} cliente(s)
                    </td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }} />
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmtPeso(tot.peso)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}`, textAlign: "right", fontFamily: C.mono }}>{fmtR(tot.valor)}</td>
                    <td style={{ padding: "6px 8px", border: `1px solid ${C.primaryDk}` }} colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
            {rows.length === 0 && (
              <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>Nenhum dado disponível.</div>
            )}
          </div>
        )}
      </TableCard>
    </>
  );
}
