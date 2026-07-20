import { useState } from "react";
import { C } from "../theme";
import { API_BASE } from "../config";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.detail ?? "Credenciais inválidas.");
      }
      const { access_token, username: respUser, nome, cargo, cod_winthor, secoes, codfornecs } = await res.json();
      localStorage.setItem("flash_token",    access_token);
      localStorage.setItem("flash_userinfo", JSON.stringify({ username: respUser, nome, cargo, cod_winthor, secoes, codfornecs }));
      onLogin(access_token, { username: respUser, nome, cargo, cod_winthor, secoes, codfornecs });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:"100vh", background:`linear-gradient(135deg,#880000,#CC0000 60%,#880000)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily: C.sans, padding:"16px",
    }}>
      <div style={{
        background:"#fff", borderRadius:"12px", padding:"40px 36px",
        width:"100%", maxWidth:"380px", boxShadow:"0 8px 32px rgba(0,0,0,.35)",
      }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"28px" }}>
          <div style={{ fontWeight:900, fontSize:"28px", color:C.primary, letterSpacing:"0.06em" }}>
            PREMIUM
          </div>
          <div style={{ fontWeight:700, fontSize:"11px", color:C.gold, letterSpacing:"0.16em" }}>
            DISTRIBUIDORA
          </div>
          <div style={{ marginTop:"8px", fontSize:"13px", color:C.textSub }}>
            Flash BI — Acesso
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub, display:"block", marginBottom:"4px" }}>
              USUÁRIO
            </label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              required autoComplete="username"
              style={{
                width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`,
                borderRadius:"6px", fontSize:"13px", outline:"none",
                fontFamily:C.sans, color:C.text,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize:"11px", fontWeight:600, color:C.textSub, display:"block", marginBottom:"4px" }}>
              SENHA
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              style={{
                width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`,
                borderRadius:"6px", fontSize:"13px", outline:"none",
                fontFamily:C.sans, color:C.text,
              }}
            />
          </div>

          {error && (
            <div style={{
              background:"#fee2e2", border:`1px solid ${C.red}`, borderRadius:"6px",
              padding:"8px 12px", fontSize:"12px", color:C.red,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              background: loading ? "#aaa" : C.primary, color:"#fff", border:"none",
              borderRadius:"6px", padding:"12px", fontSize:"14px", fontWeight:700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily:C.sans,
              marginTop:"4px",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}