import { ChevronUp, ChevronDown } from "lucide-react";
import { C } from "../theme";

export default function Th({ label, col, sortCol, sortDir, onSort, align, sticky }) {
  const active = col && sortCol === col;
  return (
    <th
      onClick={() => col && onSort && onSort(col)}
      style={{
        padding: "6px 8px",
        background: active ? C.primaryDk : C.subHeader,
        color: "#fff",
        fontSize: "10px",
        fontWeight: 700,
        textAlign: align ?? "left",
        cursor: col && onSort ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        border: `1px solid ${C.primaryDk}`,
        letterSpacing: "0.04em",
        ...(sticky ? { position: "sticky", left: 0, zIndex: 3 } : {}),
      }}
    >
      {label}
      {active &&
        (sortDir === "asc" ? (
          <ChevronUp size={9} style={{ verticalAlign: "middle", marginLeft: "2px" }} />
        ) : (
          <ChevronDown size={9} style={{ verticalAlign: "middle", marginLeft: "2px" }} />
        ))}
    </th>
  );
}
