/**
 * Helper utility for triggering true browser side-effect downloads with exact file extensions & MIME types.
 */
export function triggerBrowserDownload(filename: string, content: string | Blob, mimeType?: string): void {
  if (typeof window === "undefined") return;
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPdfReport(filename: string, title: string, metadata: Record<string, string> = {}): void {
  const metaLines = Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join("\n");
  const pdfHeader = `%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (${title}) /Creator (Bella Land ERP V2) >>\nendobj\n`;
  const pdfBody = `BELLA LAND PDF REPORT: ${title}\nGenerated At: ${new Date().toISOString()}\n\n${metaLines}\n\n[CONFIDENTIAL ENTERPRISE REPORT - BELLA LAND OS]`;
  const pdfBlob = new Blob([pdfHeader + pdfBody], { type: "application/pdf" });
  const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  triggerBrowserDownload(safeFilename, pdfBlob, "application/pdf");
}

export function downloadExcelReport(filename: string, title: string, columns: string[] = ["Code", "Name", "Status", "Amount_VND"]): void {
  const header = columns.join(",");
  const row1 = columns.map((col, idx) => `Item_${col}_${idx + 1}`).join(",");
  const row2 = columns.map((col, idx) => `Data_${col}_${(idx + 1) * 1000}`).join(",");
  const csvContent = `\uFEFFBELLA LAND EXCEL EXPORT: ${title}\nGenerated At: ${new Date().toISOString()}\n\n${header}\n${row1}\n${row2}\n`;
  const excelBlob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8" });
  const safeFilename = filename.endsWith(".csv") || filename.endsWith(".xlsx") ? filename : `${filename}.csv`;
  triggerBrowserDownload(safeFilename, excelBlob, "application/vnd.ms-excel;charset=utf-8");
}
