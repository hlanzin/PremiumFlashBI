import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C } from "../theme";

export function arrow(p) {
  if (p == null) return <span style={{ color: "#ccc" }}>—</span>;
  const [bg, shadow, Icon] =
    p >= 100
      ? [C.green, "rgba(22,163,74,.5)", TrendingUp]
      : p >= 90
        ? [C.amber, "rgba(217,119,6,.5)", Minus]
        : [C.red, "rgba(220,38,38,.5)", TrendingDown];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "26px",
        height: "26px",
        borderRadius: "50%",
        background: bg,
        boxShadow: `0 2px 5px ${shadow}`,
      }}
    >
      <Icon size={13} color="#fff" strokeWidth={2.5} />
    </div>
  );
}

export function medal(pos) {
  if (pos === 1) return { bg: "#FFD700", color: "#7A5800", label: "1°" };
  if (pos === 2) return { bg: "#C0C0C0", color: "#555", label: "2°" };
  if (pos === 3) return { bg: "#CD7F32", color: "#fff", label: "3°" };
  return null;
}
