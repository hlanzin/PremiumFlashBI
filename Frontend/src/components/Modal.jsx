import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { C } from "../theme";

export default function Modal({ open, onClose, title, icon: Icon, subtitle, children, footer, width, noPadding }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,.5)",
        animation: "fadeIn .15s ease",
      }}
      // Sem onClick aqui de propósito — fechar clicando no fundo fechava
      // sem querer quando o mouse começava um arrasto/seleção dentro do
      // modal e soltava fora. Fecha só pelo X (ou Esc).
    >
      <div
        ref={ref}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: width ?? "min(420px, 92vw)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 48px rgba(0,0,0,.2)",
          animation: "slideUp .2s ease",
        }}
      >
        {title && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "16px 20px 0",
            borderBottom: noPadding ? "none" : `1px solid ${C.border}`,
            paddingBottom: noPadding ? 0 : "14px",
          }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
              {Icon && <Icon size={18} color={C.primary} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: C.text }}>
                  {title}
                </div>
                {subtitle && (
                  <div style={{ fontSize: "11px", color: C.textSub, marginTop: "2px" }}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.textSub, padding: "4px", borderRadius: "6px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <X size={16} />
            </button>
          </div>
        )}
        <div style={{
          padding: noPadding ? 0 : "16px 20px",
          overflowY: "auto",
          flex: 1,
        }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: "12px 20px",
            borderTop: `1px solid ${C.border}`,
            display: "flex", gap: "8px", justifyContent: "flex-end",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
