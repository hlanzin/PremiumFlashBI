import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import { C } from "../theme";

export default function SelectModal({ value, onChange, options, placeholder, labelKey = "nome", valueKey = "cod", isMobile }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const current = options.find(o => o[valueKey] === value);

  const filtrados = useMemo(() => {
    if (!busca) return options;
    const s = busca.toLowerCase();
    return options.filter(o => (o[labelKey] ?? "").toLowerCase().includes(s));
  }, [options, busca, labelKey]);

  const triggerStyle = {
    display: "flex", alignItems: "center", gap: "6px",
    width: "100%", padding: "6px 28px 6px 10px",
    background: "#fff",
    border: `1px solid ${C.border}`, borderRadius: "6px",
    cursor: "pointer", fontSize: "12px", fontFamily: C.sans,
    color: current ? C.text : C.textSub,
    whiteSpace: "nowrap", position: "relative",
  };

  const itemStyle = (ativo) => ({
    display: "flex", alignItems: "center", gap: isMobile ? "8px" : "6px",
    width: "100%", padding: isMobile ? "12px 14px" : "7px 10px", border: "none",
    borderBottom: `1px solid ${C.border}`,
    cursor: "pointer", fontSize: isMobile ? "13px" : "11px", fontFamily: C.sans, whiteSpace: "nowrap",
    background: ativo ? C.rowEven : "#fff",
    color: ativo ? C.primary : C.text,
    fontWeight: ativo ? 700 : 400,
  });

  if (isMobile) {
    return (
      <div style={{ display: "block" }}>
        <button onClick={() => setOpen(true)} style={triggerStyle}>
          {current?.[labelKey] ?? placeholder}
          <ChevronDown size={13} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
        </button>
        {open && (
          <div style={{ position: "fixed", inset: 0, zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,.5)", animation: "fadeIn .15s ease" }}
            onClick={() => setOpen(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: "12px", width: "min(380px, 92vw)",
                maxHeight: "70vh", boxShadow: "0 12px 48px rgba(0,0,0,.2)",
                animation: "slideUp .2s ease", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: C.text, marginBottom: "8px" }}>{placeholder}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px",
                  border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 10px" }}>
                  <Search size={14} color={C.textSub} />
                  <input value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar..." autoFocus
                    style={{ border: "none", outline: "none", fontSize: "13px", flex: 1, fontFamily: C.sans, color: C.text, background: "transparent" }} />
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {filtrados.length === 0 && (
                  <div style={{ padding: "24px", textAlign: "center", color: C.textSub, fontSize: "13px" }}>Nenhum resultado</div>
                )}
                {filtrados.map(o => (
                  <button key={o[valueKey]} onClick={() => { onChange(o[valueKey]); setOpen(false); setBusca(""); }}
                    style={itemStyle(o[valueKey] === value)}>
                    {o[labelKey]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "max-content", minWidth: "150px" }}>
      <button onClick={() => setOpen(v => !v)} style={triggerStyle}>
        {current?.[labelKey] ?? placeholder}
        <ChevronDown size={13} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, minWidth: "100%",
          background: "#fff", border: `1px solid ${C.border}`, borderRadius: "8px",
          boxShadow: "0 6px 20px rgba(0,0,0,.15)",
          maxHeight: "300px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px",
              border: `1px solid ${C.border}`, borderRadius: "4px", padding: "4px 8px" }}>
              <Search size={12} color={C.textSub} />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar..." autoFocus
                style={{ border: "none", outline: "none", fontSize: "11px", flex: 1, fontFamily: C.sans, color: C.text, background: "transparent" }} />
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtrados.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", color: C.textSub, fontSize: "11px" }}>Nenhum resultado</div>
            )}
            {filtrados.map(o => (
              <button key={o[valueKey]} onClick={() => { onChange(o[valueKey]); setOpen(false); setBusca(""); }}
                style={itemStyle(o[valueKey] === value)}>
                {o[labelKey]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
