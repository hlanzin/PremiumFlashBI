import { useState, useEffect, useMemo, useRef } from "react";
import { GitCompare, Search, TrendingUp, TrendingDown, X, List } from "lucide-react";
import { C, fmtR, fmtN, fmtDt } from "../../theme";
import { API_BASE } from "../../config";
import { useAuthHeaders } from "../../api";
import SelectModal from "../../components/SelectModal";
import ModuleHeader from "../../components/ModuleHeader";
import SkeletonRows from "../../components/SkeletonRows";
import Modal from "../../components/Modal";
import LineChartCompare from "../../components/LineChartCompare";
import { exportCSV } from "../../utils/exportCSV";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const TODOS_FORNECEDORES = "__todos__";
// Fornecedores com janela de "cliente ativo" reduzida pra 2 meses (regra
// comercial própria) — mesma lista de config.FORNEC_ATIVOS_2M no backend.
const FORNEC_ATIVOS_2M = [1841];

const STATUS_CFG = {
  novo:           { label: "Novo",           plural: "Novos",           bg: "#DBEAFE", fg: "#1D4ED8" },
  recorrente:     { label: "Recorrente",     plural: "Recorrentes",     bg: "#DCFCE7", fg: "#15803D" },
  perdido:        { label: "Perdido",        plural: "Perdidos",        bg: "#FEE2E2", fg: "#B91C1C" },
  perdido_no_ano: { label: "Perdido no Ano", plural: "Perdidos no Ano", bg: "#FFEDD5", fg: "#C2410C" },
};

function fmtDeltaPct(v) {
  if (v == null) return <span style={{ color: C.textSub }}>—</span>;
  const cor = v > 0 ? C.green : v < 0 ? C.red : C.textSub;
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : null;
  return (
    <span style={{ color: cor, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "3px" }}>
      {Icon && <Icon size={12} />}{v > 0 ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

function StatTile({ label, atual, anterior, deltaPct, formatValue }) {
  return (
    <div style={{ flex: 1, minWidth: "160px", background: "#fff", border: `1px solid ${C.border}`,
      borderRadius: "8px", padding: "12px 16px" }}>
      <div style={{ fontSize: "11px", color: C.textSub, fontWeight: 600, marginBottom: "4px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "20px", fontWeight: 800, color: C.text }}>{formatValue(atual)}</span>
        {fmtDeltaPct(deltaPct)}
      </div>
      <div style={{ fontSize: "11px", color: C.textSub, marginTop: "2px" }}>
        Ano anterior: {formatValue(anterior)}
      </div>
    </div>
  );
}

function pctDelta(atual, anterior) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

export default function ModuleComparativoClientes({ isMobile, token, userInfo = {} }) {
  const headers      = useAuthHeaders(token);
  const cargo        = userInfo.cargo ?? "gerencial";
  const codUser      = userInfo.cod_winthor ?? null;
  const isFornecedor = cargo === "fornecedor";
  const isGerencial  = cargo === "gerencial" || cargo === "admin";
  const isSupervisor = cargo === "supervisor";

  const anoHoje = new Date().getFullYear();
  const [fornecedores, setFornecedores] = useState([]);
  const [fornSel, setFornSel] = useState(null);
  const [anoAtual, setAnoAtual] = useState(anoHoje);
  const [supervisores, setSupervisores] = useState([]);
  const [supSel, setSupSel] = useState(isSupervisor ? codUser : null);
  const [vendedores, setVendedores] = useState([]);
  const [vendSel, setVendSel] = useState(null);

  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [clienteSel, setClienteSel] = useState(null); // {cod_cliente, nome_cliente}
  const [detalheCli, setDetalheCli] = useState(null);
  const [loadingCli, setLoadingCli] = useState(false);

  // Modal de lista — 'novo' | 'recorrente' | 'perdido' | 'todos' | null
  const [listaModal, setListaModal] = useState(null);
  const [listaBusca, setListaBusca] = useState("");

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
  // os fornecedores que o usuário tem acesso num comparativo só (útil pra
  // ver a atividade do cliente com a distribuidora inteira, não só 1 marca).
  const fornecedoresComTodos = useMemo(() => (
    fornecedores.length > 0
      ? [{ cod: TODOS_FORNECEDORES, nome: "Todos os Fornecedores" }, ...fornecedores]
      : fornecedores
  ), [fornecedores]);

  const codfornecParam = fornSel === TODOS_FORNECEDORES
    ? fornecedores.map(f => f.cod).join(",")
    : fornSel;

  // Fornecedores com janela de "cliente ativo" reduzida pra 2 meses (regra
  // comercial própria) — mesma lista de config.FORNEC_ATIVOS_2M no backend.
  const mesesAtivos = String(codfornecParam ?? "").split(",")
    .some(c => FORNEC_ATIVOS_2M.includes(Number(c))) ? 2 : 3;

  useEffect(() => {
    if (!isGerencial) return;
    fetch(`${API_BASE}/api/faturamento/supervisores`, { headers })
      .then(r => r.json())
      .then(j => setSupervisores((j.dados ?? []).map(s => ({ cod: s.cod_supervisor, nome: s.nome_supervisor }))))
      .catch(() => {});
  }, []);

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

  // Guarda a requisição mais recente — se o usuário trocar o filtro rápido
  // (ex.: selecionar o supervisor antes da 1ª busca "geral" terminar), a
  // resposta de uma busca antiga que volta depois não pode sobrescrever o
  // resultado da busca mais nova já filtrada.
  const reqIdRef = useRef(0);

  const fetchData = () => {
    if (!fornSel) return;
    const reqId = ++reqIdRef.current;
    setLoading(true); setError(null);
    const params = new URLSearchParams({ codfornec: codfornecParam, ano_atual: anoAtual });
    if (isGerencial && supSel) params.set("filtro_supervisor", supSel);
    if ((isGerencial || isSupervisor) && vendSel) params.set("filtro_vendedor", vendSel);
    fetch(`${API_BASE}/api/comparativo-clientes/geral?${params.toString()}`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { if (reqId === reqIdRef.current) setResp(j); })
      .catch(e => { if (reqId === reqIdRef.current) setError(e.message); })
      .finally(() => { if (reqId === reqIdRef.current) setLoading(false); });
  };

  useEffect(() => { fetchData(); }, [fornSel, anoAtual, supSel, vendSel]);

  const clientes = resp?.clientes ?? [];
  const resumo   = resp?.resumo ?? {};
  const mensal   = resp?.mensal ?? [];

  // Lista completa, ordenada por valor do ano atual — base do export e do modal "todos"
  const rows = useMemo(() => [...clientes].sort((a, b) => (b.valor_atual ?? 0) - (a.valor_atual ?? 0)), [clientes]);

  const serieMensal = useMemo(() => ([
    { key: "atual",    label: String(anoAtual),     color: C.primary, values: mensal.map(m => m.valor_atual) },
    { key: "anterior", label: String(anoAtual - 1), color: C.gold,    values: mensal.map(m => m.valor_anterior) },
  ]), [mensal, anoAtual]);

  const serieMensalCliente = useMemo(() => {
    if (!detalheCli || detalheCli.erro) return null;
    return [
      { key: "atual",    label: String(anoAtual),     color: C.primary, values: detalheCli.mensal.map(m => m.valor_atual) },
      { key: "anterior", label: String(anoAtual - 1), color: C.gold,    values: detalheCli.mensal.map(m => m.valor_anterior) },
    ];
  }, [detalheCli, anoAtual]);

  const clientesDaLista = useMemo(() => {
    if (!listaModal) return [];
    let base = listaModal === "todos" ? rows
      : listaModal === "perdido_no_ano" ? clientes.filter(c => c.perdido_no_ano)
      : clientes.filter(c => c.status === listaModal);
    if (listaModal === "perdido") {
      base = [...base].sort((a, b) => (b.valor_anterior ?? 0) - (a.valor_anterior ?? 0));
    }
    // posição calculada ANTES do filtro de busca — buscar um cliente mostra
    // a posição real dele no ranking, não a posição dentro do resultado filtrado.
    const comPosicao = base.map((c, i) => ({ ...c, _posicao: i + 1 }));
    if (!listaBusca) return comPosicao;
    const s = listaBusca.toLowerCase().trim();
    return comPosicao.filter(c =>
      (c.nome_cliente ?? "").toLowerCase().includes(s) ||
      (c.nome_cidade ?? "").toLowerCase().includes(s) ||
      String(c.cod_cliente ?? "").includes(s));
  }, [rows, clientes, listaModal, listaBusca]);

  const abrirCliente = (cliente) => {
    setClienteSel(cliente);
    setDetalheCli(null); setLoadingCli(true);
    const params = new URLSearchParams({ codfornec: codfornecParam, ano_atual: anoAtual });
    if (isGerencial && supSel) params.set("filtro_supervisor", supSel);
    if ((isGerencial || isSupervisor) && vendSel) params.set("filtro_vendedor", vendSel);
    fetch(`${API_BASE}/api/comparativo-clientes/cliente/${cliente.cod_cliente}?${params.toString()}`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setDetalheCli)
      .catch(() => setDetalheCli({ erro: true }))
      .finally(() => setLoadingCli(false));
  };

  const abrirClienteDaLista = (cliente) => {
    setListaModal(null); setListaBusca("");
    abrirCliente(cliente);
  };

  const handleExportExcel = () => {
    const header = ["Cliente", "Cidade", "Vendedor", `Valor ${anoAtual}`, `Valor ${anoAtual - 1}`, "Crescimento %", "Status"];
    const dataRows = rows.map(r => [
      r.nome_cliente, r.nome_cidade || "", r.nome_vendedor || "",
      fmtR(r.valor_atual), fmtR(r.valor_anterior),
      r.crescimento_pct != null ? `${r.crescimento_pct}%` : "",
      STATUS_CFG[r.status]?.label ?? r.status,
    ]);
    exportCSV(`ComparativoClientes_${anoAtual}`, header, dataRows);
  };

  const anos = Array.from({ length: 6 }, (_, i) => anoHoje - i);
  const tituloLista = listaModal === "todos" ? "Todos os Clientes" : listaModal ? `Clientes ${STATUS_CFG[listaModal].plural}` : "";

  return (
    <>
      <ModuleHeader icon={GitCompare} title="COMPARATIVO DE CLIENTES" isMobile={isMobile}
        subtitle={`${anoAtual} vs ${anoAtual - 1}`}
        onRefresh={fetchData} loading={loading}
        onExportExcel={rows.length > 0 ? handleExportExcel : undefined} />

      <div style={{
        background: "#fff", borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "6px 12px" : "8px 20px",
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
      }}>
        <SelectModal value={fornSel} onChange={setFornSel} options={fornecedoresComTodos}
          placeholder="Selecione um fornecedor..." labelKey="nome" valueKey="cod" isMobile={isMobile} />

        <select value={anoAtual} onChange={e => setAnoAtual(Number(e.target.value))}
          style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 10px",
            fontSize: "12px", background: "#fff", color: C.text, outline: "none" }}>
          {anos.map(a => <option key={a} value={a}>{a} vs {a - 1}</option>)}
        </select>

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
      </div>

      {!fornSel && !loading && (
        <div style={{ padding: "48px", textAlign: "center", color: C.textSub }}>
          Selecione um fornecedor para ver o comparativo.
        </div>
      )}

      {loading && !resp && <div style={{ padding: "16px 20px" }}><SkeletonRows count={3} height={60} /></div>}
      {error && <div style={{ padding: "40px", textAlign: "center", color: C.red }}>Erro: {error}</div>}

      {fornSel && !error && resp && (
        <div style={{ padding: isMobile ? "12px" : "16px 20px",
          opacity: loading ? 0.55 : 1, transition: "opacity 200ms ease" }}>
          {/* ── Stat tiles ── */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
            <StatTile label={`CLIENTES ATIVOS (últimos ${mesesAtivos} meses)`} atual={resumo.ativos_atual} anterior={resumo.ativos_anterior}
              deltaPct={pctDelta(resumo.ativos_atual, resumo.ativos_anterior)} formatValue={fmtN} />
            <StatTile label="CLIENTES ATENDIDOS NO PERÍODO" atual={resumo.atendidos_atual} anterior={resumo.atendidos_anterior}
              deltaPct={pctDelta(resumo.atendidos_atual, resumo.atendidos_anterior)} formatValue={fmtN} />
            <StatTile label="VALOR TOTAL" atual={resumo.valor_total_atual} anterior={resumo.valor_total_anterior}
              deltaPct={pctDelta(resumo.valor_total_atual, resumo.valor_total_anterior)} formatValue={fmtR} />
            <div style={{ flex: 1, minWidth: "220px", background: "#fff", border: `1px solid ${C.border}`,
              borderRadius: "8px", padding: "12px 16px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {["novo", "recorrente", "perdido", "perdido_no_ano"].map(k => (
                <button key={k} onClick={() => { setListaModal(k); setListaBusca(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.7}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                  <div style={{ fontSize: "10px", color: C.textSub, fontWeight: 600 }}>{STATUS_CFG[k].plural.toUpperCase()}</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: STATUS_CFG[k].fg }}>
                    {resumo[k === "perdido_no_ano" ? "perdidos_no_ano" : `${k}s`] ?? 0}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Gráfico mensal ── */}
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: "8px",
            padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: C.text }}>Valor faturado por mês</div>
              <button onClick={() => { setListaModal("todos"); setListaBusca(""); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", background: C.primary, color: "#fff",
                  border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                <List size={13} /> Ver todos os clientes ({rows.length})
              </button>
            </div>
            <LineChartCompare series={serieMensal} xLabels={MESES} formatValue={fmtR} />
          </div>
        </div>
      )}

      {/* ── Modal: lista de clientes (todos, ou por status) ── */}
      <Modal open={!!listaModal} onClose={() => { setListaModal(null); setListaBusca(""); }}
        icon={GitCompare} title={tituloLista}
        subtitle={`${clientesDaLista.length} cliente(s)`} width="min(620px, 94vw)" noPadding>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px",
            border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 10px" }}>
            <Search size={13} color={C.textSub} />
            <input autoFocus placeholder="Buscar por código, nome ou cidade..." value={listaBusca}
              onChange={e => setListaBusca(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: "12px", flex: 1, fontFamily: C.sans, color: C.text, background: "transparent" }} />
            {listaBusca && (
              <button onClick={() => setListaBusca("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub, display: "flex" }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {clientesDaLista.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: C.textSub, fontSize: "12px" }}>
              Nenhum cliente encontrado.
            </div>
          )}
          {clientesDaLista.map((c, i) => {
            const st = STATUS_CFG[c.status] ?? { label: c.status, bg: "#eee", fg: "#666" };
            return (
              <div key={c.cod_cliente ?? i} onClick={() => abrirClienteDaLista(c)}
                style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                  background: i % 2 === 0 ? "#fff" : C.rowEven }}
                onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : C.rowEven}>
                <div style={{ width: "30px", flexShrink: 0, textAlign: "center", fontSize: "11px",
                  fontWeight: 700, color: C.textSub, fontFamily: C.mono }}>{c._posicao}º</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: C.text, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.nome_cliente}
                    <span style={{ fontFamily: C.mono, fontWeight: 400, color: C.textSub, fontSize: "10px", marginLeft: "6px" }}>
                      #{c.cod_cliente}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: C.textSub }}>
                    {c.nome_cidade} · {c.nome_vendedor ?? `#${c.cod_vendedor}`}
                    {listaModal === "perdido_no_ano" && (
                      <> · última compra: {fmtDt(c.ultima_compra_atual)}</>
                    )}
                  </div>
                </div>
                {listaModal === "todos" && (
                  <span style={{ background: st.bg, color: st.fg, fontSize: "10px", fontWeight: 700,
                    padding: "2px 8px", borderRadius: "10px", flexShrink: 0 }}>{st.label}</span>
                )}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: C.mono, fontSize: "12px", fontWeight: 700 }}>
                    {fmtR(listaModal === "perdido" ? c.valor_anterior : c.valor_atual)}
                  </div>
                  {(listaModal === "todos" || listaModal === "recorrente") && (
                    <div style={{ fontSize: "10px" }}>{fmtDeltaPct(c.crescimento_pct)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ── Drill-down de 1 cliente ── */}
      <Modal open={!!clienteSel} onClose={() => setClienteSel(null)} icon={GitCompare}
        title={clienteSel?.nome_cliente} subtitle={`${anoAtual} vs ${anoAtual - 1}`} width="min(640px, 94vw)">
        {loadingCli && <SkeletonRows count={3} height={40} />}
        {detalheCli?.erro && <div style={{ color: C.red, padding: "16px 0" }}>Erro ao carregar dados do cliente.</div>}
        {detalheCli && !detalheCli.erro && (
          <>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <StatTile label="VALOR NO ANO" atual={detalheCli.resumo.valor_atual} anterior={detalheCli.resumo.valor_anterior}
                deltaPct={detalheCli.resumo.crescimento_pct} formatValue={fmtR} />
            </div>
            <LineChartCompare
              series={serieMensalCliente}
              xLabels={MESES} formatValue={fmtR} height={200} />
          </>
        )}
      </Modal>
    </>
  );
}
