function escapeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function toCsv(
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) =>
    headers.map((header) => escapeCell(row[header])).join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}
