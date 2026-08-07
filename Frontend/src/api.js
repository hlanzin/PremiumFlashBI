import { useMemo } from "react";
import { API_BASE } from "./config";

export function patchFetch() {
  const orig = window.fetch;
  window.fetch = async (input, init) => {
    const res = await orig(input, init);
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("unauthorized"));
    }
    return res;
  };
}

export function useAuthHeaders(token) {
  return useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
}

// Lança um Error com .detail = corpo "detail" do FastAPI (string, ou lista
// de erros de validação em 422) quando disponível — quem pegar o catch pode
// mostrar mensagem de verdade em vez de só "HTTP 422".
async function _erroDaResposta(res) {
  let detail;
  try { detail = (await res.json()).detail; } catch { /* corpo não era JSON */ }
  const err = new Error(`HTTP ${res.status}`);
  err.status = res.status;
  err.detail = detail;
  return err;
}

export async function apiGet(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw await _erroDaResposta(res);
  return res.json();
}

export async function apiPost(url, body, headers) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await _erroDaResposta(res);
  return res.json();
}

export async function apiPut(url, body, headers) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await _erroDaResposta(res);
  return res.json();
}

export async function apiDelete(url, headers) {
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok) throw await _erroDaResposta(res);
  return res.json();
}
