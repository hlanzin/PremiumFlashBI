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

export async function apiGet(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiPost(url, body, headers) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiPut(url, body, headers) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiDelete(url, headers) {
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
