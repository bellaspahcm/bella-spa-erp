/**
 * Helper utility for trigger true browser side-effect downloads for Real Estate reports, PDFs, and Excels.
 */
export function triggerBrowserDownload(filename: string, content: string, mimeType = "text/csv;charset=utf-8"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateMockCsvContent(title: string, columns: string[]): string {
  const header = columns.join(",");
  const row1 = columns.map((col, idx) => `Sample_${col}_${idx + 1}`).join(",");
  const row2 = columns.map((col, idx) => `Data_${col}_${(idx + 1) * 100}`).join(",");
  return `BELLA LAND REPORT: ${title}\nGenerated At: ${new Date().toISOString()}\n\n${header}\n${row1}\n${row2}\n`;
}
