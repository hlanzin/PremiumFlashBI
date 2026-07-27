import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, LogOut, Menu, X, Gift } from "lucide-react";
import { C } from "../theme";

const SIDEBAR_W = 220;
const SIDEBAR_W_COL = 56;

const btnActive = { color: "#fff", background: "rgba(255,255,255,.15)", boxShadow: `inset 3px 0 ${C.gold}` };
const btnBase = {
  display: "flex", alignItems: "center", gap: "10px",
  justifyContent: "flex-start", width: "100%", padding: "10px 18px",
  border: "none", cursor: "pointer", fontFamily: C.sans,
  fontSize: "13px", transition: "all .15s",
  color: "rgba(255,255,255,.65)", background: "transparent",
  whiteSpace: "nowrap", overflow: "hidden",
};
const fade = (show) => ({ opacity: show ? 1 : 0, overflow: "hidden", whiteSpace: "nowrap", transition: "opacity .15s ease" });

export default function Sidebar({ isMobile, open, onClose, categorias, standalone, activeModule, onNav, incentivosOpen, setIncentivosOpen, collapsed, setCollapsed, activeIncentivo, onNavIncentivo, incentivosList, userNome, onLogout }) {
  const sw = !isMobile && collapsed ? SIDEBAR_W_COL : SIDEBAR_W;

  // Categorias abertas (dropdowns da navegação agrupada) — a categoria do
  // módulo ativo já nasce aberta (calculado direto no useState, sem esperar
  // um efeito depois do primeiro render, que é o que causava o flick de
  // renderizar fechada e só depois abrir). O resto fica fechado até o
  // usuário clicar.
  const [openCats, setOpenCats] = useState(() => {
    const cat = (categorias ?? []).find(c => c.modulos.some(m => m.id === activeModule));
    return cat ? new Set([cat.id]) : new Set();
  });
  useEffect(() => {
    const cat = (categorias ?? []).find(c => c.modulos.some(m => m.id === activeModule));
    if (cat) setOpenCats(prev => prev.has(cat.id) ? prev : new Set(prev).add(cat.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule]);
  const toggleCat = (id) => setOpenCats(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const inner = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: C.sans }}>
      {/* Header */}
      <div style={{
        padding: "16px 18px",
        borderBottom: "1px solid rgba(255,255,255,.12)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        whiteSpace: "nowrap",
      }}>
        <div style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200, overflow: "hidden", transition: "all .2s ease" }}>
          <div style={{ fontWeight: 900, fontSize: "17px", color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>PREMIUM</div>
          <div style={{ fontWeight: 700, fontSize: "8px", color: C.gold, letterSpacing: "0.16em", marginTop: "2px" }}>DISTRIBUIDORA · BI</div>
        </div>
        {!isMobile && (
          <button onClick={() => setCollapsed(v => !v)}
            style={{ background: "rgba(255,255,255,.1)", border: "none", color: "#fff",
              width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              transition: "background .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.1)"}>
            {collapsed ? <ChevronRight size={15} /> : <Menu size={15} />}
          </button>
        )}
        {isMobile && (
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)",
              cursor: "pointer", padding: "4px", marginLeft: "auto" }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto", overflowX: "hidden" }}>
        {collapsed ? (
          // ── Colapsado (desktop, só ícones): 1 ícone por categoria + os
          // módulos soltos (fora de categoria) direto — clicar numa
          // categoria expande a sidebar já com ela aberta ──
          <>
          {(standalone ?? []).map(({ id, label, icon: Icon }) => {
            const active = activeModule === id;
            return (
              <button key={id} onClick={() => onNav(id)} title={label}
                style={{ ...btnBase, ...(active ? btnActive : {}) }}>
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span style={fade(false)}>{label}</span>
              </button>
            );
          })}
          {(categorias ?? []).map(cat => {
            const hasActive = cat.modulos.some(m => m.id === activeModule)
              || (cat.id === "campanhas" && activeModule === "incentivos");
            return (
              <button key={cat.id}
                onClick={() => { setCollapsed(false); setOpenCats(prev => new Set(prev).add(cat.id)); }}
                title={cat.label}
                style={{ ...btnBase, ...(hasActive ? btnActive : {}) }}>
                <cat.icon size={17} style={{ flexShrink: 0 }} />
                <span style={fade(false)}>{cat.label}</span>
              </button>
            );
          })}
          </>
        ) : (
          // ── Expandido (mobile ou desktop aberto): módulos soltos direto no
          // topo (sem dropdown) + categorias em dropdown ──
          <>
          {(standalone ?? []).map(({ id, label, icon: Icon }) => {
            const active = activeModule === id;
            return (
              <button key={id} onClick={() => onNav(id)}
                style={{ ...btnBase, ...(active ? btnActive : {}) }}>
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span>{label}</span>
              </button>
            );
          })}
          {(categorias ?? []).map(cat => {
            const isOpen = openCats.has(cat.id);
            const hasActive = cat.modulos.some(m => m.id === activeModule)
              || (cat.id === "campanhas" && activeModule === "incentivos");
            return (
              <div key={cat.id}>
                <button onClick={() => toggleCat(cat.id)}
                  style={{ ...btnBase, ...(hasActive ? btnActive : {}) }}>
                  <cat.icon size={17} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: "left" }}>{cat.label}</span>
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {isOpen && (
                  <div style={{ paddingLeft: "14px" }}>
                    {cat.modulos.map(({ id, label, icon: Icon }) => {
                      const active = activeModule === id;
                      return (
                        <button key={id} onClick={() => onNav(id)}
                          style={{ ...btnBase, ...(active ? btnActive : {}),
                            padding: "9px 18px 9px 14px", fontSize: "12.5px" }}>
                          <Icon size={15} style={{ flexShrink: 0 }} />
                          <span>{label}</span>
                        </button>
                      );
                    })}

                    {cat.id === "campanhas" && (
                      <>
                        <button onClick={() => setIncentivosOpen(o => !o)}
                          style={{ ...btnBase, ...(activeModule === "incentivos" ? btnActive : {}),
                            padding: "9px 18px 9px 14px", fontSize: "12.5px" }}>
                          <Gift size={15} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, textAlign: "left" }}>Incentivos</span>
                          {incentivosOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        {incentivosOpen && (
                          <div style={{ paddingLeft: "28px" }}>
                            {incentivosList.map(inc => {
                              const active = activeModule === "incentivos" && activeIncentivo === inc.id;
                              return (
                                <button key={inc.id} onClick={() => onNavIncentivo(inc.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "8px",
                                    width: "100%", padding: "8px 18px 8px 0",
                                    border: "none", cursor: "pointer", fontFamily: C.sans,
                                    fontSize: "12px", transition: "all .15s",
                                    whiteSpace: "nowrap", overflow: "hidden",
                                    background: active ? "rgba(255,255,255,.12)" : "transparent",
                                    color: active ? "#fff" : "rgba(255,255,255,.55)",
                                    boxShadow: active ? `inset 3px 0 ${C.gold}` : "none",
                                  }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%",
                                    background: active ? C.gold : "rgba(255,255,255,.4)", flexShrink: 0 }} />
                                  {inc.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </>
        )}
      </nav>

      {/* Usuário */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,.12)",
        padding: "12px 18px", whiteSpace: "nowrap",
      }}>
        <div style={{ ...fade(!collapsed), fontSize: "11px", color: "rgba(255,255,255,.5)",
          marginBottom: "8px", textOverflow: "ellipsis" }}>
          {userNome}
        </div>
        <button onClick={onLogout} title={collapsed ? "Sair" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            justifyContent: "flex-start", width: "100%",
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)",
            padding: "7px 10px",
            borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: C.sans,
            transition: "background .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.08)"}>
          <LogOut size={14} />
          <span style={fade(!collapsed)}>Sair</span>
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 99,
            opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
            transition: "opacity .25s ease",
          }} />
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: `${SIDEBAR_W}px`, zIndex: 100,
          background: `linear-gradient(180deg,${C.primaryDk} 0%,${C.header} 100%)`,
          boxShadow: "4px 0 16px rgba(0,0,0,.4)",
          transform: open ? "translateX(0)" : `translateX(-${SIDEBAR_W}px)`,
          transition: "transform .25s ease",
        }}>
          {inner}
        </div>
      </>
    );
  }

  return (
    <div style={{
      width: `${sw}px`, minHeight: "100vh", flexShrink: 0,
      background: `linear-gradient(180deg,${C.primaryDk} 0%,${C.header} 100%)`,
      position: "sticky", top: 0, height: "100vh",
      transition: "width .2s ease",
      boxShadow: "2px 0 8px rgba(0,0,0,.25)",
      overflow: "hidden",
    }}>
      {inner}
    </div>
  );
}
