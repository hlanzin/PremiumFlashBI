import { C } from "../theme";

export default function TableCard({ children, style, maxHeight, noOverflow }) {
  const scroll = !!maxHeight;
  return (
    <div style={{
      margin: "12px 16px",
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: "8px",
      overflow: scroll ? "auto" : "hidden",
      maxHeight: maxHeight,
      boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 4px 12px rgba(170,0,0,.06)",
      ...style,
    }}>
      {children}
    </div>
  );
}
