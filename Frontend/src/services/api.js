const API_BASE = import.meta.env.VITE_API_URL;

export async function getFaturamento(mode, code) {
  let url = `${API_BASE}/api/faturamento`;

  if (mode === "vendedor" && code) {
    url += `/vendedor/${code}`;
  }

  if (mode === "supervisor" && code) {
    url += `/supervisor/${code}`;
  }

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Erro HTTP ${res.status}`);
  }

  return res.json();
}