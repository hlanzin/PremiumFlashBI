import { useState, useRef, useMemo, useEffect } from "react";
import { C } from "../theme";

const W = 760, H_DEFAULT = 220;
const BASE_PAD = { top: 16, right: 16, bottom: 26, left: 54 };
const ANIM_MS = 450;

function niceMax(value) {
  if (!value || value <= 0) return 10;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const norm = value / base;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return niceNorm * base;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Mede a largura real do texto renderizado (canvas 2D é o jeito padrão de
// medir texto fora do DOM) — evita estimar por nº de caracteres, que fica
// curto dependendo dos dígitos/formatação e deixa o valor vazar pra fora
// do SVG.
let _measureCanvas = null;
function measureTextWidth(text, fontSizePx, fontFamily) {
  if (typeof document === "undefined") return text.length * fontSizePx * 0.6;
  if (!_measureCanvas) _measureCanvas = document.createElement("canvas");
  const ctx = _measureCanvas.getContext("2d");
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

// Anima os VALORES de cada série (não só a cor/posição) quando a prop
// `series` muda — ex.: trocar o filtro de supervisor faz os pontos e a
// linha subirem/descerem suavemente até a nova altura, em vez de saltar
// direto pro valor novo. Passo a passo via requestAnimationFrame porque
// SVG puro não anima "points" de <polyline> por CSS.
function useAnimatedSeries(series, duration = ANIM_MS) {
  const [animated, setAnimated] = useState(series);
  const fromRef = useRef(series);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = series;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setAnimated(to.map((s, si) => ({
        ...s,
        values: s.values.map((v, i) => {
          const fromVal = from[si]?.values[i] ?? v;
          return fromVal + (v - fromVal) * eased;
        }),
      })));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  return animated;
}

/**
 * Gráfico de linha pra comparar 2+ séries num eixo X compartilhado (ex.:
 * mês 1..12). Sem biblioteca externa — SVG simples com crosshair + tooltip
 * no hover e legenda (linha-chave, nunca só a cor). Pontos/linha animam
 * (ease-out) quando os valores mudam (troca de filtro, novo período etc.).
 */
export default function LineChartCompare({ series, xLabels, formatValue, height = H_DEFAULT }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // índice do mês em hover
  const animatedSeries = useAnimatedSeries(series);

  const n = xLabels.length;

  // Escala do eixo Y fixa no valor final (não anima) — só os pontos/linha
  // se movem dentro dela, senão o eixo ficaria "pulando" durante a transição.
  // Valor líquido de devolução pode ficar negativo num mês — quando isso
  // acontece, o eixo passa a ser simétrico (0 no meio do gráfico) pra
  // caber os dois lados; sem valor negativo, continua 0 embaixo como antes.
  const { minAxis, maxVal, hasNegative } = useMemo(() => {
    const all = series.flatMap(s => s.values);
    const rawMin = Math.min(0, ...all);
    const rawMax = Math.max(0, ...all);
    const negative = rawMin < 0;
    if (negative) {
      const maxAbs = niceMax(Math.max(1, Math.abs(rawMin), rawMax));
      return { minAxis: -maxAbs, maxVal: maxAbs, hasNegative: true };
    }
    return { minAxis: 0, maxVal: niceMax(Math.max(1, rawMax)), hasNegative: false };
  }, [series]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(minAxis + (maxVal - minAxis) * f));

  // Largura do eixo Y dinâmica: valores grandes formatados (ex.: "R$ 123.456,78")
  // não cabem nos 54px fixos de padding e passavam da borda esquerda do
  // gráfico. Estima a largura pelo nº de caracteres do maior label e abre
  // espaço suficiente (nunca menos que o padrão).
  const AXIS_FONT_PX = 9;
  const tickLabels = ticks.map(t => String(formatValue(t)));
  const maxLabelWidth = Math.max(0, ...tickLabels.map(l => measureTextWidth(l, AXIS_FONT_PX, C.sans)));
  const pad = { ...BASE_PAD, left: Math.max(BASE_PAD.left, maxLabelWidth + 16) };

  const plotW = W - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xAt = (i) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v) => pad.top + plotH - ((v - minAxis) / (maxVal - minAxis)) * plotH;

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((relX - pad.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tooltipLeft = hover != null ? (xAt(hover) / W) * 100 : 0;
  const tooltipSide = tooltipLeft > 60 ? "right" : "left";

  // Posição vertical do tooltip: por padrão fica perto do topo, mas se o
  // ponto em hover (o mais alto entre as séries naquele mês) estiver na
  // metade de cima do gráfico, o tooltip fixo ali em cima acabava caindo
  // por cima do próprio ponto e escondendo o valor — nesse caso desce o
  // tooltip pra logo abaixo do ponto em vez de ficar sempre no topo.
  const peakY = hover != null
    ? Math.min(...animatedSeries.map(s => yAt(s.values[hover])))
    : pad.top;
  const tooltipTopPx = peakY < height / 2 ? peakY + 16 : pad.top;
  const tooltipTop = (tooltipTopPx / height) * 100;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {/* Gridlines — hairline, recessivas. Linha do zero fica mais forte
            quando o gráfico tem lado negativo, pra marcar a base real. */}
        {ticks.map((t, i) => {
          const isZero = hasNegative && t === 0;
          return (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={yAt(t)} y2={yAt(t)}
                stroke={isZero ? "#B8A8A8" : "#E8D8D8"} strokeWidth={isZero ? 1.5 : 1} />
              <text x={pad.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle"
                fontSize={AXIS_FONT_PX} fontWeight={isZero ? 700 : 400}
                fill={isZero ? C.text : C.textSub} fontFamily={C.sans}>{tickLabels[i]}</text>
            </g>
          );
        })}

        {/* Eixo X — 1º/último label ancorado pra dentro (start/end em vez de
            middle) pra não vazar pela lateral do gráfico. */}
        {xLabels.map((lbl, i) => (
          (i % Math.ceil(n / 12) === 0) && (
            <text key={i} x={xAt(i)} y={height - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize="9" fill={C.textSub} fontFamily={C.sans}>{lbl}</text>
          )
        ))}

        {/* Crosshair */}
        {hover != null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.top} y2={pad.top + plotH}
            stroke="#C9B8B8" strokeWidth="1" />
        )}

        {/* Linhas + marcadores — usam os valores ANIMADOS (interpolados) */}
        {animatedSeries.map(s => {
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
          position: "absolute", top: `${tooltipTop}%`,
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
