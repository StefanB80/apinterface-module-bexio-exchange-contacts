const { readBexioFieldValue } = require("./bexioFieldValue");

function trim(value) {
  return String(value || "").trim();
}

function toNumberOrNaN(s) {
  const n = Number(String(s).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @param {string} op  eq | ne | gt | gte | lt | lte | contains
 */
function compareValues(leftRaw, rightRaw, op) {
  const l = trim(leftRaw);
  const r = trim(rightRaw);
  const o = String(op || "eq").toLowerCase();

  if (o === "contains") {
    return l.toLowerCase().includes(r.toLowerCase());
  }

  const ln = toNumberOrNaN(l);
  const rn = toNumberOrNaN(r);
  if (!Number.isNaN(ln) && !Number.isNaN(rn)) {
    if (o === "eq") return ln === rn;
    if (o === "ne") return ln !== rn;
    if (o === "gt") return ln > rn;
    if (o === "gte") return ln >= rn;
    if (o === "lt") return ln < rn;
    if (o === "lte") return ln <= rn;
  }

  const lc = l.toLowerCase();
  const rc = r.toLowerCase();
  if (o === "eq") return lc === rc;
  if (o === "ne") return lc !== rc;
  if (o === "gt") return lc > rc;
  if (o === "gte") return lc >= rc;
  if (o === "lt") return lc < rc;
  if (o === "lte") return lc <= rc;
  return false;
}

/**
 * @param {object} row bexio contact
 * @param {{ field: string, op: string, value: string }} cond
 */
function evaluateOne(row, cond) {
  if (!cond || !trim(cond.field)) {
    return true;
  }
  const left = readBexioFieldValue(row, cond.field);
  return compareValues(left, cond.value != null ? String(cond.value) : "", String(cond.op || "eq"));
}

/**
 * @param {object} row
 * @param {Array<{ join?: string, field: string, op: string, value: string }>} conditions
 *        Erste Zeile: nur field/op/value. Ab zweiter Zeile: join = and | or (Bezug zur vorherigen Zeile).
 */
function evaluateConditions(row, conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true;
  }
  let acc = evaluateOne(row, conditions[0]);
  for (let i = 1; i < conditions.length; i += 1) {
    const c = conditions[i];
    const next = evaluateOne(row, c);
    const join = String(c.join || "and").toLowerCase() === "or" ? "or" : "and";
    if (join === "or") {
      acc = acc || next;
    } else {
      acc = acc && next;
    }
  }
  return acc;
}

module.exports = {
  evaluateConditions,
  compareValues,
  readBexioFieldValue
};
