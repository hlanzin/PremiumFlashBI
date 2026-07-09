import { useState, useRef, useEffect } from "react";
import { FileDown, FileText, FileSpreadsheet } from "lucide-react";
import { C } from "../theme";

export default function ExportDropdown({ onExportExcel, onExportPdf, label, isMobile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          background: "rgba(255,255,255,.15)",
          border: "1px solid rgba(255,255,255,.3)",
          color: "#fff", padding: isMobile ? "6px" : "6px 12px",
          borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 700,
        }}>
        <FileDown size={13} />
        {!isMobile && (label ?? "Exportar")}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px",
          background: "#fff", borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0,0,0,.15)",
          border: `1px solid ${C.border}`,
          minWidth: "160px", zIndex: 50, overflow: "hidden",
        }}>
          {onExportExcel && (
            <button onClick={() => { onExportExcel(); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "10px 14px", border: "none",
                background: "none", cursor: "pointer", fontSize: "12px",
                color: C.text, fontFamily: C.sans,
                borderBottom: `1px solid ${C.border}`,
              }}>
              <FileSpreadsheet size={16} color="#16a34a" />
              <span style={{ fontWeight: 600 }}>Excel (.csv)</span>
            </button>
          )}
          {onExportPdf && (
            <button onClick={() => { onExportPdf(); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "10px 14px", border: "none",
                background: "none", cursor: "pointer", fontSize: "12px",
                color: C.text, fontFamily: C.sans,
              }}>
              <FileText size={16} color="#dc2626" />
              <span style={{ fontWeight: 600 }}>PDF</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
