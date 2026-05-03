function stampDate(date = new Date()) {
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export function buildAuthId(sequence: number, date = new Date()) {
  return `MA-ATH-${stampDate(date)}-${String(sequence).padStart(4, "0")}`;
}

export function buildSerialNumber(sequence: number) {
  return `MEEZY-${String(sequence).padStart(6, "0")}`;
}

export function buildBatchReference(date = new Date()) {
  return `BATCH-${stampDate(date)}-${Math.floor(date.getTime() / 1000)}`;
}
