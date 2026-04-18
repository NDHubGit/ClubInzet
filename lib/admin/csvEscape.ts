/** Excel-compatibele CSV-cel (Nederlandse komma-separator in header). */
export function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRows(headers: string[], dataRows: string[][]): string {
  const lines = [headers.join(","), ...dataRows.map((cells) => cells.join(","))];
  return lines.join("\r\n") + "\r\n";
}
