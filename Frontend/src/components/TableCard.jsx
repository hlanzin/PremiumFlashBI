import { C } from "../theme";

export default function TableCard({ children, isMobile, style, maxHeight }) {
  const scroll = !!maxHeight;
  return (
    <div style={{
      margin: isMobile ? "8px" : "12px 16px",
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: "4px",
      overflow: scroll ? "auto" : "hidden",
      maxHeight: maxHeight,
      boxShadow: `0 1px 6px rgba(170,0,0,.1)`,
      ...style,
    }}>
      {children}
    </div>
  );
}
