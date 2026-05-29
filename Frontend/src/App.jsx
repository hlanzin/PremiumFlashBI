import { useState, useEffect } from "react";
import Login          from "./auth/Login";
import ModuleFaturamento  from "./modules/faturamento";
import ModuleDistNumerica from "./modules/dist_numerica";
import ModuleEstoque      from "./modules/estoque";
import ModuleRanking      from "./modules/ranking";
import ModuleBateuLevou   from "./modules/bateu_levou";
import ModuleAdmin        from "./modules/admin";
import ModuleChamados     from "./modules/chamados";
import ModuleListaNegra   from "./modules/lista_negra";
import ModuleTroca        from "./modules/troca";
import ModulePedidos      from "./modules/pedidos";
import { C, GLOBAL_CSS } from "./theme";
import { useIsMobile }   from "./hooks";
import {
  BarChart3, TrendingUp, TrendingDown, Package, Tag, Star, Settings, Snowflake, ShoppingCart,
  LogOut, Menu, X, ChevronRight,
  Banknote,
} from "lucide-react";

// ── Registro de módulos ───────────────────────────────────────────────────────
const BI_MODULES = [
  { id:"faturamento",   label:"Faturamento",     icon:BarChart3,   component:ModuleFaturamento,  cargos:null },
  { id:"ranking",       label:"Ranking",          icon:Star,        component:ModuleRanking,      cargos:["admin","gerencial","supervisor"] },
  { id:"dist_numerica", label:"Dist. Numérica",   icon:TrendingUp,  component:ModuleDistNumerica, cargos:null },
  { id:"lista_negra",   label:"Lista Negra",       icon:TrendingDown,component:ModuleListaNegra,  cargos:["admin","gerencial","supervisor","vendedor","fornecedor"] },
  { id:"bateu_levou",   label:"Bateu Levou",       icon:Tag,         component:ModuleBateuLevou,   cargos:null },
  { id:"troca",         label:"Troca",             icon:Banknote, component:ModuleTroca,       cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"pedidos",       label:"Pedidos",           icon:ShoppingCart, component:ModulePedidos,     cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"estoque",       label:"Estoque",           icon:Package,     component:ModuleEstoque,      cargos:null },
  { id:"chamados",      label:"Chamados Freezer",  icon:Snowflake,   component:ModuleChamados,     cargos:["admin","gerencial","supervisor","vendedor"] },
  { id:"admin",         label:"Admin",             icon:Settings,    component:ModuleAdmin,        cargos:["admin"] },
];

const SIDEBAR_W     = 220;   // largura expandida
const SIDEBAR_W_COL = 56;    // largura colapsada (só ícones)

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
  const [sidebarOpen,    setSidebarOpen]    = useState(false);   // mobile: gaveta aberta
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // desktop: colapsado

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
  const ActiveModule = BI_MODULES.find(m => m.id === activeModule)?.component ?? ModuleFaturamento;
  const collapsed    = !isMobile && sidebarCollapsed;
  const sw           = collapsed ? SIDEBAR_W_COL : SIDEBAR_W;

  const handleNav = (id) => {
    setActiveModule(id);
    if (isMobile) setSidebarOpen(false);
  };

  // Sidebar content (compartilhado entre mobile e desktop)
  const SidebarContent = () => (
    <div style={{
      display:"flex", flexDirection:"column", height:"100%",
      fontFamily: C.sans,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "18px 0" : "16px 18px",
        borderBottom:`1px solid rgba(255,255,255,.12)`,
        display:"flex", alignItems:"center",
        justifyContent: collapsed ? "center" : "space-between",
      }}>
        {!collapsed && (
          <div>
            <div style={{ fontWeight:900, fontSize:"17px", color:"#fff", letterSpacing:"0.06em", lineHeight:1 }}>PREMIUM</div>
            <div style={{ fontWeight:700, fontSize:"8px", color:C.gold, letterSpacing:"0.16em", marginTop:"2px" }}>DISTRIBUIDORA · BI</div>
          </div>
        )}
        {/* Botão colapsar — só desktop */}
        {!isMobile && (
          <button onClick={() => setSidebarCollapsed(v => !v)}
            style={{ background:"rgba(255,255,255,.1)", border:"none", color:"#fff",
                     width:"28px", height:"28px", borderRadius:"6px", cursor:"pointer",
                     display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {collapsed
              ? <ChevronRight size={15}/>
              : <Menu size={15}/>}
          </button>
        )}
        {/* Botão fechar — só mobile */}
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,.7)",
                     cursor:"pointer", padding:"4px", marginLeft:"auto" }}>
            <X size={18}/>
          </button>
        )}
      </div>

      {/* Itens de navegação */}
      <nav style={{ flex:1, padding:"10px 0", overflowY:"auto" }}>
        {modulosVisiveis.map(({ id, label, icon: Icon }) => {
          const active = activeModule === id;
          return (
            <button key={id} onClick={() => handleNav(id)}
              title={collapsed ? label : undefined}
              style={{
                display:"flex", alignItems:"center",
                gap: collapsed ? 0 : "10px",
                justifyContent: collapsed ? "center" : "flex-start",
                width:"100%", padding: collapsed ? "11px 0" : "10px 18px",
                border:"none", cursor:"pointer", fontFamily:C.sans,
                fontSize:"13px", fontWeight: active ? 700 : 400,
                background: active
                  ? "rgba(255,255,255,.15)"
                  : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,.65)",
                borderLeft: active && !collapsed
                  ? `3px solid ${C.gold}`
                  : "3px solid transparent",
                transition:"all .15s",
              }}>
              <Icon size={17} style={{ flexShrink:0 }}/>
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Usuário + logout */}
      <div style={{
        borderTop:`1px solid rgba(255,255,255,.12)`,
        padding: collapsed ? "12px 0" : "12px 18px",
      }}>
        {!collapsed && (
          <div style={{ fontSize:"11px", color:"rgba(255,255,255,.5)", marginBottom:"8px",
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {auth.userInfo.nome || auth.userInfo.username}
          </div>
        )}
        <button onClick={handleLogout}
          title={collapsed ? "Sair" : undefined}
          style={{
            display:"flex", alignItems:"center",
            gap: collapsed ? 0 : "8px",
            justifyContent: collapsed ? "center" : "flex-start",
            width:"100%", background:"rgba(255,255,255,.08)",
            border:"1px solid rgba(255,255,255,.15)", color:"rgba(255,255,255,.7)",
            padding: collapsed ? "8px 0" : "7px 10px",
            borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontFamily:C.sans,
          }}>
          <LogOut size={14}/>
          {!collapsed && "Sair"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:C.sans,
                  fontSize:"13px", color:C.text, display:"flex" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Sidebar desktop ── */}
      {!isMobile && (
        <div style={{
          width:`${sw}px`, minHeight:"100vh", flexShrink:0,
          background:`linear-gradient(180deg,${C.primaryDk} 0%,${C.header} 100%)`,
          position:"sticky", top:0, height:"100vh",
          transition:"width .2s ease",
          boxShadow:"2px 0 8px rgba(0,0,0,.25)",
          overflow:"hidden",
        }}>
          <SidebarContent/>
        </div>
      )}

      {/* ── Gaveta mobile ── */}
      {isMobile && (
        <>
          {/* Overlay */}
          <div onClick={() => setSidebarOpen(false)}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:99,
              opacity: sidebarOpen ? 1 : 0,
              pointerEvents: sidebarOpen ? "auto" : "none",
              transition:"opacity .25s ease",
            }}/>
          {/* Drawer */}
          <div style={{
            position:"fixed", top:0, left:0, bottom:0,
            width:`${SIDEBAR_W}px`, zIndex:100,
            background:`linear-gradient(180deg,${C.primaryDk} 0%,${C.header} 100%)`,
            boxShadow:"4px 0 16px rgba(0,0,0,.4)",
            transform: sidebarOpen ? "translateX(0)" : `translateX(-${SIDEBAR_W}px)`,
            transition:"transform .25s ease",
          }}>
            <SidebarContent/>
          </div>
        </>
      )}

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
              {BI_MODULES.find(m => m.id === activeModule)?.label}
            </div>
          </div>
        )}

        {/* Módulo ativo */}
        <div style={{ flex:1 }}>
          <ActiveModule
            key={activeModule}
            isMobile={isMobile}
            token={auth.token}
            userInfo={auth.userInfo}
          />
        </div>
      </div>
    </div>
  );
}