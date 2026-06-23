import { useMemo } from "react";

export function useFilteredRows(data, search, sortCol, sortDir, searchFields) {
  return useMemo(() => {
    let r = [...data];

    if (search && searchFields) {
      const s = search.toLowerCase();
      r = r.filter((row) =>
        searchFields.some((field) =>
          String(row[field] ?? "").toLowerCase().includes(s)
        )
      );
    }

    r.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return sortDir === "asc"
        ? av.localeCompare(bv, "pt-BR")
        : bv.localeCompare(av, "pt-BR");
    });

    return r;
  }, [data, search, sortCol, sortDir, searchFields]);
}
