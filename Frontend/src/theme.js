// theme.js — paleta de cores, formatadores e helpers visuais compartilhados

export const C = {
  primary:   "#CC0000",
  primaryDk: "#990000",
  gold:      "#C8960C",
  goldLight: "#F5D76E",
  header:    "#AA0000",
  subHeader: "#CC0000",
  rowEven:   "#FFF8F8",
  rowOdd:    "#FFFFFF",
  rowHover:  "#FFE8E8",
  border:    "#E0B8B8",
  total:     "#AA0000",
  totalTxt:  "#FFFFFF",
  green:     "#16a34a",
  red:       "#dc2626",
  amber:     "#d97706",
  text:      "#1e293b",
  textSub:   "#475569",
  bg:        "#F5EEEE",
  mono:      "Consolas,'Courier New',monospace",
  sans:      "'Segoe UI',Arial,sans-serif",
};

export const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2,
  }).format(v ?? 0);

export const fmtPct = (v) => (v == null ? "—" : v.toFixed(1) + "%");

export const fmtQty = (v) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(v);

export const pctStyle = (p) => {
  if (p == null) return { color: C.textSub };
  if (p >= 100)  return { color:"#fff", background:C.green, borderRadius:"3px", padding:"1px 5px", fontWeight:600 };
  if (p >= 90)   return { color:"#fff", background:C.amber, borderRadius:"3px", padding:"1px 5px", fontWeight:600 };
  return               { color:"#fff", background:C.red,   borderRadius:"3px", padding:"1px 5px", fontWeight:600 };
};

// Ícone circular de status (verde ≥100, âmbar ≥90, vermelho <90)
// Importar nos módulos: import { C, pctStyle, arrow } from "../../theme"
// Requer TrendingUp, TrendingDown, Minus do lucide-react no componente que usar
export const arrowStyle = (p) => {
  if (p == null) return null;
  if (p >= 100) return { bg: C.green,  shadow: "rgba(22,163,74,.5)"  };
  if (p >= 90)  return { bg: C.amber,  shadow: "rgba(217,119,6,.5)"  };
  return              { bg: C.red,    shadow: "rgba(220,38,38,.5)"  };
};

// Retorna a data local no formato YYYY-MM-DD (evita offset UTC)
export const getToday = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

export const GLOBAL_CSS = `
  * { box-sizing:border-box; margin:0; padding:0 }
  body { background:${C.bg}; font-family:${C.sans}; -webkit-tap-highlight-color:transparent }
  @keyframes spin  { to { transform:rotate(360deg) } }
  @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
  input::placeholder { color:#aaa }
  select:focus { outline:2px solid ${C.gold} }
  ::-webkit-scrollbar { height:4px; width:4px }
  ::-webkit-scrollbar-track { background:#f1f1f1 }
  ::-webkit-scrollbar-thumb { background:${C.primary}; border-radius:2px }
`;