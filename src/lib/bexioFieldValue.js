/**
 * Liest einen bexio-Kontaktwert fuer Bedingungen und Mapping (API-Feldnamen / full_name).
 */

function trim(value) {
  return String(value || "").trim();
}

function readBexioFieldValue(bexioRow, fieldKey) {
  const key = trim(fieldKey);
  if (!key) {
    return "";
  }
  if (key === "full_name") {
    const full = [trim(bexioRow.name_1), trim(bexioRow.name_2)].filter(Boolean).join(" ").trim();
    return full;
  }
  const raw = bexioRow[key];
  if (raw === undefined || raw === null) {
    return "";
  }
  if (typeof raw === "object") {
    try {
      return trim(JSON.stringify(raw));
    } catch {
      return "";
    }
  }
  return trim(String(raw));
}

module.exports = { readBexioFieldValue };
