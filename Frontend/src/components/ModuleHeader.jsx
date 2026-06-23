import { C } from "../theme";

export default function ModuleHeader({ icon: Icon, title, subtitle, titleExtra, children, isMobile }) {
  if (isMobile) return null;

  return (
    <div style={{
      background: `linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      borderBottom: `3px solid ${C.gold}`,
    }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: "20px", color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>PREMIUM</div>
        <div style={{ fontWeight: 700, fontSize: "9px", color: C.gold, letterSpacing: "0.14em" }}>DISTRIBUIDORA</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          {Icon && <Icon size={16} color={C.gold} />}
          {title}
          {subtitle && (
            <span style={{ fontWeight: 400, fontSize: "11px", color: "rgba(255,255,255,.7)", marginLeft: "4px" }}>
              ({subtitle})
            </span>
          )}
        </div>
        {titleExtra && <div style={{ color: "rgba(255,220,180,.9)", fontSize: "11px", marginTop: "2px" }}>{titleExtra}</div>}
      </div>
      {children && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>{children}</div>}
    </div>
  );
}
