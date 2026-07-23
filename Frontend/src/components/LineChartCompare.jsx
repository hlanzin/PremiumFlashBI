import { useState, useRef, useMemo } from "react";
import { C } from "../theme";

const W = 760, H_DEFAULT = 220;
const PAD = { top: 16, right: 16, bottom: 26, left: 54 };

function niceMax(value) {
  if (!value || value <= 0) return 10;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const norm = value / base;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return niceNorm * base;
}

/**
 * Gráfico de linha pra comparar 2+ séries num eixo X compartilhado (ex.:
 * mês 1..12). Sem biblioteca externa — SVG simples com crosshair + tooltip
 * no hover e legenda (linha-chave, nunca só a cor).
 */
export default function LineChartCompare({ series, xLabels, formatValue, height = H_DEFAULT }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // índice do mês em hover

  const n = xLabels.length;
  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const maxVal = useMemo(() => {
    const all = series.flatMap(s => s.values);
    return niceMax(Math.max(1, ...all));
  }, [series]);

  const xAt = (i) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v) => PAD.top + plotH - (v / maxVal) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tooltipLeft = hover != null ? (xAt(hover) / W) * 100 : 0;
  const tooltipSide = tooltipLeft > 60 ? "right" : "left";

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {/* Gridlines — hairline, recessivas */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="#E8D8D8" strokeWidth="1" />
            <text x={PAD.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle"
              fontSize="10" fill={C.textSub} fontFamily={C.sans}>{formatValue(t)}</text>
          </g>
        ))}

        {/* Eixo X */}
        {xLabels.map((lbl, i) => (
          (i % Math.ceil(n / 12) === 0) && (
            <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle"
              fontSize="10" fill={C.textSub} fontFamily={C.sans}>{lbl}</text>
          )
        ))}

        {/* Crosshair */}
        {hover != null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + plotH}
            stroke="#C9B8B8" strokeWidth="1" />
        )}

        {/* Linhas + marcadores */}
        {series.map(s => {
          const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
          return (
            <g key={s.key}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(v)} r={hover === i ? 5 : 4}
                  fill={s.color} stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          );
        })}
      </svg>

      {hover != null && (
        <div style={{
          position: "absolute", top: `${(PAD.top / height) * 100}%`,
          [tooltipSide]: `calc(${tooltipSide === "right" ? 100 - tooltipLeft : tooltipLeft}% + 10px)`,
          background: "#fff", border: `1px solid ${C.border}`, borderRadius: "8px",
          boxShadow: "0 4px 16px rgba(0,0,0,.15)", padding: "8px 12px", pointerEvents: "none",
          minWidth: "120px", zIndex: 5,
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: C.textSub, marginBottom: "4px" }}>
            {xLabels[hover]}
          </div>
          {series.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", marginTop: "2px" }}>
              <span style={{ width: "12px", height: "2px", background: s.color, flexShrink: 0 }} />
              <span style={{ color: C.textSub }}>{s.label}:</span>
              <span style={{ fontWeight: 700, color: C.text, marginLeft: "auto", fontFamily: C.mono }}>
                {formatValue(s.values[hover])}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Legenda — linha-chave, nunca só a cor */}
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "6px", flexWrap: "wrap" }}>
        {series.map(s => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: C.textSub }}>
            <span style={{ width: "14px", height: "2px", background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
