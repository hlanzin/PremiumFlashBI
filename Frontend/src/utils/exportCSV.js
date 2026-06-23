export function exportCSV(filename, headerRow, dataRows) {
  if (!dataRows.length) return;

  const blob = new Blob(["\uFEFF" + [headerRow.join(";"), ...dataRows.map((r) => r.join(";"))].join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
