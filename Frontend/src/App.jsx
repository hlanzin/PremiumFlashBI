import { useState, useEffect, lazy, Suspense } from "react";
import { patchFetch, useAuthHeaders } from "./api";
import { API_BASE } from "./config";

// ponytail: global fetch wrapper dispatches "unauthorized" on 401
patchFetch();

import Login          from "./auth/Login";
import ModuleFaturamento  from "./modules/faturamento";
import ModuleDistNumerica from "./modules/dist_numerica";
import ModuleEstoque      from "./modules/estoque";
import ModuleRanking      from "./modules/ranking";
import ModuleRankingClientes from "./modules/ranking_clientes";
import ModuleComparativoClientes from "./modules/comparativo_clientes";
import ModuleBateuLevou   from "./modules/bateu_levou";
import ModuleAdmin        from "./modules/admin";
import ModuleChamados     from "./modules/chamados";
import ModuleListaNegra   from "./modules/lista_negra";
import ModuleTroca        from "./modules/troca";
import ModuleContaCorrente from "./modules/conta_corrente";
import ModuleClientesForn   from "./modules/clientes_fornecedor";
import ModuleVendasProduto  from "./modules/vendas_produto_forn";
import ModuleCampanhaFini from "./modules/campanha_fini"
import ModuleExclusoes from "./modules/exclusoes";
import ModuleSugestaoPedido from "./modules/sugestao_pedido";
import ModuleIncentivo from "./modules/incentivos";
import ModuleIncentivosAdmin from "./modules/incentivos_admin";
import ModuleAlertas from "./modules/alertas";
const ModulePedidos = lazy(() => import("./modules/pedidos"));
import { C, GLOBAL_CSS } from "./theme";
import { useIsMobile }   from "./hooks";
import {
  BarChart3, TrendingUp, TrendingDown, Package, Tag, Star, Settings, Snowflake, ShoppingCart, ShoppingBag, Banknote, Wallet, Users,
  Candy, Ban, ClipboardList, Menu, AlertTriangle, Trophy, GitCompare, Gift,
} from "lucide-react";
import Sidebar from "./components/Sidebar";

// ── Categorias da sidebar (agrupam os módulos em dropdowns) ──────────────────
const CATEGORIAS = [
  { id:"vendas",      label:"Vendas & Análise", icon:BarChart3, ids:["faturamento","ranking","dist_numerica","ranking_clientes","comparativo_clientes","clientes_forn","lista_negra"] },
  { id:"campanhas",   label:"Campanhas",        icon:Tag,       ids:["bateu_levou","campanha_fini","vendas_produto"] },
  { id:"operacional", label:"Operacional",      icon:Package,   ids:["estoque","pedidos","troca","chamados","sugestao_pedido"] },
  { id:"admin",       label:"Administração",    icon:Settings,  ids:["admin","exclusoes","incentivos_admin"] },
];

// ── Módulos fora de categoria (ficam soltos na sidebar, sem dropdown) ───────
const STANDALONE_IDS = ["conta_corrente", "alertas"];

// ── Registro de módulos ───────────────────────────────────────────────────────
const BI_MODULES = [
  { id:"faturamento",   label:"Faturamento",     icon:BarChart3,   component:ModuleFaturamento,  cargos:null },
  { id:"ranking",       label:"Ranking",          icon:Star,        component:ModuleRanking,      cargos:["admin","gerencial","supervisor"] },
  { id:"dist_numerica", label:"Dist. Numérica",   icon:TrendingUp,  component:ModuleDistNumerica, cargos:null },
  { id:"lista_negra",   label:"Lista Negra",       icon:TrendingDown,component:ModuleListaNegra,  cargos:["admin","gerencial","supervisor","vendedor","fornecedor"] },
  { id:"bateu_levou",   label:"Bateu Levou",       icon:Tag,         component:ModuleBateuLevou,   cargos:null },
  { id:"troca",         label:"Troca",             icon:Banknote,     component:ModuleTroca,       cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"pedidos",       label:"Pedidos",           icon:ShoppingCart,  component:ModulePedidos,       cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"conta_corrente",    label:"Conta Corrente",    icon:Wallet,   component:ModuleContaCorrente, cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"clientes_forn",   label:"Clientes",          icon:Users,        component:ModuleClientesForn,  cargos:["admin","gerencial","fornecedor"] },
  { id:"vendas_produto",  label:"Vendas Produto",     icon:ShoppingBag,  component:ModuleVendasProduto, cargos:["admin","gerencial","fornecedor"] },
  { id:"ranking_clientes", label:"Ranking Clientes",  icon:Trophy,       component:ModuleRankingClientes, cargos:["admin","gerencial","fornecedor","supervisor","vendedor"] },
  { id:"comparativo_clientes", label:"Comparativo Clientes", icon:GitCompare, component:ModuleComparativoClientes, cargos:["admin","gerencial","fornecedor","supervisor","vendedor"] },
  { id:"estoque",       label:"Estoque",           icon:Package,     component:ModuleEstoque,      cargos:null },
  { id:"chamados",      label:"Chamados Freezer",  icon:Snowflake,   component:ModuleChamados,     cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"admin",         label:"Admin",             icon:Settings,    component:ModuleAdmin,        cargos:["admin"] },
  { id:"exclusoes", label:"Exclusões", icon:Ban, component:ModuleExclusoes, cargos:["admin"] },
  { id:"incentivos_admin", label:"Incentivos (config)", icon:Gift, component:ModuleIncentivosAdmin, cargos:["admin"] },
  { id:"campanha_fini", label:"Campanha Fini", icon:Candy, component:ModuleCampanhaFini, cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"sugestao_pedido", label:"Sugestão de Pedido", icon:ClipboardList, component:ModuleSugestaoPedido, cargos:["admin","gerencial"] },
  { id:"alertas", label:"Alertas RCA", icon:AlertTriangle, component:ModuleAlertas, cargos:null },
];

// ── Incentivos (dropdown na sidebar) ──────────────────────────────────────────
// Lista buscada do backend (models/incentivos.py) — admin cadastra pela tela
// de Administração, aparece aqui sozinho. "Ranking Geral" é sempre fixo,
// soma todos os incentivos ativos do momento.
const RANKING_GERAL_ITEM = { id: "ranking-geral", label: "🏆 Ranking Geral" };

export default function App() {
  const isMobile = useIsMobile();

  // ── Todos os hooks antes de qualquer return condicional ───────────────────
  const [auth, setAuth] = useState(() => {
    try {
      const token    = localStorage.getItem("flash_token") ?? "";
      const userInfo = JSON.parse(localStorage.getItem("flash_userinfo") ?? "null") ?? {};
      return { token, userInfo };
    } catch { return { token:"", userInfo:{} }; }
  });

  const [activeModule,   setActiveModule]   = useState("faturamento");
  const [activeIncentivo, setActiveIncentivo] = useState(null);   // id do incentivo ativo
  const [incentivosOpen, setIncentivosOpen] = useState(false);     // dropdown aberto
  const [sidebarOpen,    setSidebarOpen]    = useState(false);   // mobile: gaveta aberta
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // desktop: colapsado
  const [incentivosDb,   setIncentivosDb]   = useState([]);      // vindos do backend

  const authHeaders = useAuthHeaders(auth.token);

  // Busca a lista de incentivos ativos assim que loga — atualiza sozinho se
  // o admin criar/desativar um incentivo (basta recarregar a página).
  useEffect(() => {
    if (!auth.token) return;
    fetch(`${API_BASE}/api/incentivos`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : { incentivos: [] })
      .then(j => setIncentivosDb(j.incentivos ?? []))
      .catch(() => setIncentivosDb([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  const INCENTIVOS = [RANKING_GERAL_ITEM, ...incentivosDb.map(i => ({ id: i.id, label: i.nome }))];

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = (tok, info) => {
    localStorage.setItem("flash_token",    tok);
    localStorage.setItem("flash_userinfo", JSON.stringify(info));
    setAuth({ token: tok, userInfo: info });
  };

  const handleLogout = () => {
    localStorage.removeItem("flash_token");
    localStorage.removeItem("flash_userinfo");
    setAuth({ token:"", userInfo:{} });
    setActiveModule("faturamento");
  };

  // Redireciona para login automaticamente em qualquer 401
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener("unauthorized", handler);
    return () => window.removeEventListener("unauthorized", handler);
  }, []);

  // ── Tela de login ─────────────────────────────────────────────────────────
  if (!auth.token) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <Login onLogin={handleLogin}/>
      </>
    );
  }

  // ── App autenticado ───────────────────────────────────────────────────────
  const cargo = auth.userInfo?.cargo ?? "vendedor";
  const modulosVisiveis = BI_MODULES.filter(m => !m.cargos || m.cargos.includes(cargo));
  const categoriasVisiveis = CATEGORIAS
    .map(cat => ({ ...cat, modulos: cat.ids.map(id => modulosVisiveis.find(m => m.id === id)).filter(Boolean) }))
    .filter(cat => cat.modulos.length > 0);
  const standaloneVisiveis = STANDALONE_IDS
    .map(id => modulosVisiveis.find(m => m.id === id))
    .filter(Boolean);
  const isIncentivoAtivo = activeModule === "incentivos" && activeIncentivo;
  const ActiveModule = isIncentivoAtivo
    ? ModuleIncentivo
    : (BI_MODULES.find(m => m.id === activeModule)?.component ?? ModuleFaturamento);
  const collapsed    = !isMobile && sidebarCollapsed;

  const handleNav = (id) => {
    setActiveModule(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleNavIncentivo = (incId) => {
    setActiveModule("incentivos");
    setActiveIncentivo(incId);
    if (isMobile) setSidebarOpen(false);
  };



  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:C.sans,
                  fontSize:"13px", color:C.text, display:"flex" }}>
      <style>{GLOBAL_CSS}</style>

      <Sidebar
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        categorias={categoriasVisiveis}
        standalone={standaloneVisiveis}
        activeModule={activeModule}
        onNav={handleNav}
        incentivosOpen={incentivosOpen}
        setIncentivosOpen={setIncentivosOpen}
        collapsed={collapsed}
        setCollapsed={setSidebarCollapsed}
        activeIncentivo={activeIncentivo}
        onNavIncentivo={handleNavIncentivo}
        incentivosList={INCENTIVOS}
        userNome={auth.userInfo?.nome || auth.userInfo?.username}
        onLogout={handleLogout}
      />

      {/* ── Conteúdo principal ── */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>

        {/* Topbar mobile — só mostra o hamburguer */}
        {isMobile && (
          <div style={{
            background:`linear-gradient(135deg,${C.primaryDk},${C.primary})`,
            padding:"8px 12px", display:"flex", alignItems:"center", gap:"10px",
            borderBottom:`2px solid ${C.gold}`, position:"sticky", top:0, zIndex:50,
          }}>
            <button onClick={() => setSidebarOpen(true)}
              style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff",
                       width:"34px", height:"34px", borderRadius:"6px", cursor:"pointer",
                       display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Menu size={18}/>
            </button>
            <div>
              <div style={{ fontWeight:900, fontSize:"14px", color:"#fff", letterSpacing:"0.06em" }}>PREMIUM</div>
              <div style={{ fontWeight:700, fontSize:"8px", color:C.gold, letterSpacing:"0.14em" }}>DISTRIBUIDORA · BI</div>
            </div>
            <div style={{ marginLeft:"auto", fontSize:"11px", color:"rgba(255,255,255,.7)" }}>
              {isIncentivoAtivo
                ? `Incentivo ${INCENTIVOS.find(i => i.id === activeIncentivo)?.label}`
                : BI_MODULES.find(m => m.id === activeModule)?.label}
            </div>
          </div>
        )}

        {/* Módulo ativo */}
        <div style={{ flex:1 }}>
          <Suspense fallback={
            <div style={{ padding:"48px", textAlign:"center", color:C.textSub }}>
              Carregando...
            </div>
          }>
            <ActiveModule
              key={isIncentivoAtivo ? `incentivo_${activeIncentivo}` : activeModule}
              isMobile={isMobile}
              token={auth.token}
              userInfo={auth.userInfo}
              incentivoId={isIncentivoAtivo ? activeIncentivo : undefined}
              incentivoNome={isIncentivoAtivo
                ? INCENTIVOS.find(i => i.id === activeIncentivo)?.label
                : undefined}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}