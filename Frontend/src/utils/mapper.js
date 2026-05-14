export function mapRows(rows) {
  return rows.map(r => {
    const realizado = r.valor_faturado_secao || 0;
    const meta = r.valor_meta_secao || 0;

    const ating = meta > 0 ? (realizado / meta) * 100 : 0;

    const tendencia =
      r.dias_uteis_decorridos > 0
        ? ((realizado / r.dias_uteis_decorridos) * r.dias_uteis_mes_atual / meta) * 100
        : 0;

    const raf = meta - realizado;

    return {
      familia: r.secao,
      objetivo: meta,
      realizado,
      ating,
      tendencia,
      raf,
      status: tendencia >= 100 ? "up" : "down"
    };
  });
}