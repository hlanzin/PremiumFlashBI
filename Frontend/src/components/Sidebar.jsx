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
};
const fade = (show) => ({ opacity: show ? 1 : 0, overflow: "hidden", whiteSpace: "nowrap", transition: "opacity .15s ease" });

export default function Sidebar({ isMobile, open, onClose, modulos, activeModule, onNav, incentivosOpen, setIncentivosOpen, collapsed, setCollapsed, activeIncentivo, onNavIncentivo, incentivosList, userNome, onLogout }) {
  const sw = !isMobile && collapsed ? SIDEBAR_W_COL : SIDEBAR_W;

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
        {modulos.map(({ id, label, icon: Icon }) => {
          const active = activeModule === id;
          return (
            <button key={id} onClick={() => onNav(id)}
              title={collapsed ? label : undefined}
              style={{ ...btnBase, ...(active ? btnActive : {}) }}>
              <Icon size={17} style={{ flexShrink: 0 }} />
              <span style={fade(!collapsed)}>{label}</span>
            </button>
          );
        })}

        {/* Incentivos */}
        <button onClick={() => {
          if (collapsed) { setCollapsed(false); setIncentivosOpen(true); }
          else setIncentivosOpen(o => !o);
        }}
          title={collapsed ? "Incentivos" : undefined}
          style={{ ...btnBase, ...(activeModule === "incentivos" ? btnActive : {}) }}>
          <Gift size={17} style={{ flexShrink: 0 }} />
          <span style={{ ...fade(!collapsed), flex: 1, textAlign: "left" }}>Incentivos</span>
          <span style={{ ...fade(!collapsed), flexShrink: 0, display: "flex" }}>
            {incentivosOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </button>

        <div style={{ ...fade(!collapsed), paddingLeft: "42px" }}>
          {incentivosOpen && incentivosList.map(inc => {
            const active = activeModule === "incentivos" && activeIncentivo === inc.id;
            return (
              <button key={inc.id} onClick={() => onNavIncentivo(inc.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  width: "100%", padding: "8px 18px 8px 0",
                  border: "none", cursor: "pointer", fontFamily: C.sans,
                  fontSize: "12px", transition: "all .15s",
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
