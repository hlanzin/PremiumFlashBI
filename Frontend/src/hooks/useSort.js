import { useState } from "react";

export function useSort(initialCol, initialDir = "desc") {
  const [sortCol, setSortCol] = useState(initialCol);
  const [sortDir, setSortDir] = useState(initialDir);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(initialDir);
    }
  };

  return { sortCol, sortDir, handleSort };
}
