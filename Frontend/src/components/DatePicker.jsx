import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { C } from "../theme";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEM = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function diasNoMes(ano, mes) { return new Date(ano, mes + 1, 0).getDate(); }

function primeiroDiaSemana(ano, mes) { return new Date(ano, mes, 1).getDay(); }

export default function DatePicker({ value, onChange, max, min, isMobile }) {
  const [open, setOpen] = useState(false);
  const [ano, setAno] = useState(value ? new Date(value).getFullYear() : new Date().getFullYear());
  const [mes, setMes] = useState(value ? new Date(value).getMonth() : new Date().getMonth());

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const maxDate = max ?? hojeStr;
  const maxObj = new Date(maxDate + "T23:59:59");
  const minObj = min ? new Date(min + "T00:00:00") : null;

  const fmtExib = (data) => {
    if (!data) return "Selecionar data";
    const [a, m, d] = data.split("-");
    return `${parseInt(d)}/${parseInt(m)}/${a}`;
  };

  const dias = [];
  const total = diasNoMes(ano, mes);
  const inicio = primeiroDiaSemana(ano, mes);
  for (let i = 0; i < inicio; i++) dias.push(null);
  for (let d = 1; d <= total; d++) {
    const yyyy = ano;
    const mm = String(mes + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dataStr = `${yyyy}-${mm}-${dd}`;
    const dt = new Date(yyyy, mes, d);
    dias.push({ d, dataStr, disabled: dt > maxObj || (minObj && dt < minObj) });
  }
  while (dias.length % 7 !== 0) dias.push(null);

  const nav = (dir) => {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    if (novoAno > maxObj.getFullYear() || (novoAno === maxObj.getFullYear() && novoMes > maxObj.getMonth())) return;
    if (minObj && (novoAno < minObj.getFullYear() || (novoAno === minObj.getFullYear() && novoMes < minObj.getMonth()))) return;
    setMes(novoMes);
    setAno(novoAno);
  };

  const selecionar = (dataStr) => {
    onChange(dataStr);
    setOpen(false);
  };

  const buttonStyle = {
    display: "flex", alignItems: "center", gap: "6px",
    border: `1px solid ${C.border}`, borderRadius: "6px",
    padding: "5px 10px", background: "#fff",
    cursor: "pointer", fontSize: "12px", fontFamily: C.mono,
    color: C.text, whiteSpace: "nowrap",
  };

  if (isMobile) {
    return (
      <div>
        <button onClick={() => setOpen(true)} style={buttonStyle}>
          <CalendarDays size={13} color={C.primary} />
          {fmtExib(value)}
        </button>
        {open && (
          <CalendarioModal
            ano={ano} mes={mes} dias={dias} hojeStr={hojeStr}
            value={value} onSelect={selecionar} onClose={() => setOpen(false)}
            onNav={nav} fmtExib={fmtExib}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen(true)} style={buttonStyle}>
        <CalendarDays size={13} color={C.primary} />
        {fmtExib(value)}
      </button>
      {open && (
        <CalendarioModal
          ano={ano} mes={mes} dias={dias} hojeStr={hojeStr}
          value={value} onSelect={selecionar} onClose={() => setOpen(false)}
          onNav={nav} fmtExib={fmtExib}
        />
      )}
    </div>
  );
}

function CalendarioModal({ ano, mes, dias, hojeStr, value, onSelect, onClose, onNav }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,.5)", animation: "fadeIn .15s ease",
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "12px", width: "min(320px, 92vw)",
          boxShadow: "0 12px 48px rgba(0,0,0,.2)", animation: "slideUp .2s ease",
          overflow: "hidden",
        }}
      >
        <div style={{ background: C.primary, padding: "14px 16px", color: "#fff" }}>
          <div style={{ fontSize: "11px", opacity: .7, fontWeight: 600 }}>{MESES[mes].toUpperCase()}</div>
          <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.02em" }}>{ano}</div>
        </div>

        <div style={{ padding: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <button onClick={() => onNav(-1)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: C.textSub, display: "flex" }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: "13px", color: C.text }}>{MESES[mes]} {ano}</span>
            <button onClick={() => onNav(1)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: C.textSub, display: "flex" }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
            {DIAS_SEM.map(d => (
              <div key={d} style={{ fontSize: "10px", fontWeight: 700, color: C.textSub, padding: "4px 0" }}>{d}</div>
            ))}
            {dias.map((item, i) => {
              if (!item) return <div key={i} />;
              const sel = value === item.dataStr;
              const hoje = item.dataStr === hojeStr;
              return (
                <button key={i} disabled={item.disabled}
                  onClick={() => onSelect(item.dataStr)}
                  style={{
                    padding: "6px 0", border: "none", borderRadius: "6px", cursor: item.disabled ? "default" : "pointer",
                    fontSize: "12px", fontFamily: C.mono, fontWeight: sel ? 700 : 400,
                    background: sel ? C.primary : hoje ? C.rowEven : "transparent",
                    color: sel ? "#fff" : item.disabled ? "#ccc" : C.text,
                    opacity: item.disabled ? .4 : 1,
                  }}
                >
                  {item.d}
                </button>
              );
            })}
          </div>
        </div>

        {value && (
          <div style={{ padding: "8px 12px 12px", display: "flex", gap: "6px" }}>
            <button onClick={() => onSelect(hojeStr)}
              style={{ flex: 1, padding: "7px", border: `1px solid ${C.border}`, borderRadius: "6px",
                cursor: "pointer", fontSize: "12px", fontWeight: 600, background: "#fff", color: C.text }}>
              Hoje
            </button>
            <button onClick={onClose}
              style={{ flex: 1, padding: "7px", border: "none", borderRadius: "6px",
                cursor: "pointer", fontSize: "12px", fontWeight: 700, background: C.primary, color: "#fff" }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
