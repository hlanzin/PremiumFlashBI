import { RefreshCw } from "lucide-react";
import { C } from "../theme";
import ExportDropdown from "./ExportDropdown";

export default function ModuleHeader({ icon: Icon, title, subtitle, titleExtra, children, isMobile, onRefresh, loading, onExportExcel, onExportPdf }) {
  const right = (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px", flexShrink: 0 }}>
      {onRefresh && (
        <button onClick={onRefresh} disabled={loading}
          style={{
            background: "rgba(255,255,255,.15)", border: "none", borderRadius: "6px",
            padding: "4px 8px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: "4px",
            fontSize: "11px", fontWeight: 700, opacity: loading ? .6 : 1,
          }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      )}
      {(onExportExcel || onExportPdf) && (
        <ExportDropdown isMobile={isMobile} label={isMobile ? "" : "Exportar"} onExportExcel={onExportExcel} onExportPdf={onExportPdf} />
      )}
      {children}
    </div>
  );

  if (isMobile) {
    return (
      <div style={{
        background: `linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: "8px",
        borderBottom: `2px solid ${C.gold}`,
      }}>
        <div style={{ flex: 1, minWidth: 0, color: "#fff", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
          {Icon && <Icon size={13} color={C.gold} />}
          {title}
        </div>
        {right}
      </div>
    );
  }

  return (
    <div style={{
      background: `linear-gradient(135deg,${C.header},${C.primary} 60%,${C.header})`,
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      borderBottom: `3px solid ${C.gold}`,
    }}>

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
      {right}
    </div>
  );
}
