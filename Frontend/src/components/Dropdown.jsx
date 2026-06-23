import { ChevronDown } from "lucide-react";
import { C } from "../theme";

export default function Dropdown({ value, onChange, options, placeholder, labelKey = "nome", valueKey = "cod", minWidth }) {
  return (
    <div style={{ position: "relative", display: "inline-block", minWidth: minWidth ?? "180px" }}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: "6px",
          padding: "7px 32px 7px 10px",
          fontSize: "12px",
          fontFamily: C.sans,
          color: value ? C.text : C.textSub,
          cursor: "pointer",
          outline: "none",
          width: "100%",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o[valueKey]} value={o[valueKey]}>
            {o[labelKey]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        style={{
          position: "absolute",
          right: "8px",
          top: "50%",
          transform: "translateY(-50%)",
          color: C.textSub,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
