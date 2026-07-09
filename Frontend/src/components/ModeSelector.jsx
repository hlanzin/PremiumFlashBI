import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { C } from "../theme";

export default function ModeSelector({ modes, active, onChange, isMobile }) {
  const [open, setOpen] = useState(false);
  const current = modes.find(m => m.id === active);

  const triggerStyle = isMobile ? {
    display: "flex", alignItems: "center", gap: "6px",
    width: "100%", padding: "8px 12px",
    background: C.primary, color: "#fff",
    border: "none", borderRadius: "6px",
    cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: C.sans,
  } : {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 12px",
    background: "#fff", color: C.text,
    border: `1px solid ${C.border}`, borderRadius: "6px",
    cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: C.sans,
  };

  return (
    <div style={{ position: "relative", display: isMobile ? "block" : "inline-block", minWidth: isMobile ? "auto" : "150px" }}>
      <button onClick={() => setOpen(v => !v)} style={triggerStyle}>
        {current?.Icon && <current.Icon size={isMobile ? 16 : 14} />}
        {current?.label ?? "Selecionar"}
        <ChevronDown size={13} style={{ marginLeft: "auto" }} />
      </button>

      {open && (
        <div
          style={{
            position: isMobile ? "fixed" : "absolute",
            inset: isMobile ? 0 : undefined,
            top: isMobile ? undefined : "calc(100% + 4px)",
            left: isMobile ? undefined : 0,
            zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isMobile ? "rgba(0,0,0,.5)" : "none",
            animation: "fadeIn .15s ease",
          }}
          onClick={() => setOpen(false)}
        >
          <div onClick={e => e.stopPropagation()}
            style={isMobile ? {
              background: "#fff", borderRadius: "12px",
              width: "min(300px, 88vw)",
              boxShadow: "0 12px 48px rgba(0,0,0,.2)",
              animation: "slideUp .2s ease",
              overflow: "hidden",
            } : {
              background: "#fff", borderRadius: "8px",
              minWidth: "180px",
              boxShadow: "0 4px 20px rgba(0,0,0,.15)",
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
            {isMobile && (
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, fontSize: "15px", color: C.text }}>Selecionar modo</div>
              </div>
            )}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr",
              gap: isMobile ? "8px" : 0,
              padding: isMobile ? "12px" : 0,
            }}>
              {modes.map(m => {
                const ativo = m.id === active;
                return (
                  <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                    style={isMobile ? {
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      padding: "16px 8px", border: `2px solid ${ativo ? C.primary : C.border}`,
                      borderRadius: "10px", cursor: "pointer",
                      background: ativo ? C.rowEven : "#fff",
                      color: ativo ? C.primary : C.text,
                      fontWeight: ativo ? 700 : 400, fontSize: "12px",
                      fontFamily: C.sans,
                    } : {
                      display: "flex", alignItems: "center", gap: "8px",
                      width: "100%", padding: "10px 14px", border: "none",
                      background: ativo ? C.rowEven : "#fff",
                      cursor: "pointer", fontSize: "12px", fontFamily: C.sans,
                      color: ativo ? C.primary : C.text,
                      fontWeight: ativo ? 700 : 400,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {isMobile ? (
                      <>
                        <div style={{
                          width: "40px", height: "40px", borderRadius: "10px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: ativo ? C.primary : C.rowEven,
                          color: ativo ? "#fff" : C.primary,
                        }}>
                          <m.Icon size={20} />
                        </div>
                        {m.label}
                      </>
                    ) : (
                      <>
                        <m.Icon size={15} color={ativo ? C.primary : C.textSub} />
                        {m.label}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
