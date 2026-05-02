const { evaluateConditions } = require("./conditionEvaluator");

function trim(value) {
  return String(value || "").trim();
}

function normalizeConditionRow(raw, isFirst) {
  const field = trim(raw && raw.field);
  const op = trim(raw && raw.op) || "eq";
  const value = raw && raw.value != null ? String(raw.value) : "";
  const join = isFirst ? "" : String(raw && raw.join ? raw.join : "and").toLowerCase() === "or" ? "or" : "and";
  const row = { field, op, value };
  if (!isFirst) {
    row.join = join;
  }
  return row;
}

function normalizeConditions(arr) {
  if (!Array.isArray(arr) || !arr.length) {
    return [];
  }
  return arr.map((r, i) => normalizeConditionRow(r, i === 0));
}

/**
 * @param {*} raw
 * @param {object} legacyMapping fuer Migration
 */
function normalizeFieldMappingBlocks(raw, legacyMapping) {
  const { normalizeFieldMapping } = require("./syncBexioToExchange");
  const leg = legacyMapping && typeof legacyMapping === "object" ? legacyMapping : {};
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((b, i) => ({
      id: trim(b && b.id) || `block-${i + 1}`,
      title: trim(b && b.title) || `Feldzuordnung ${i + 1}`,
      conditions: normalizeConditions(b && b.conditions),
      fieldMapping: normalizeFieldMapping((b && b.fieldMapping) || {})
    }));
  }
  return [
    {
      id: "block-1",
      title: "Feldzuordnung 1",
      conditions: [],
      fieldMapping: normalizeFieldMapping(leg)
    }
  ];
}

/**
 * Erstes passendes Block-Mapping; sonst Fallback auf Block ohne Bedingungen, sonst erster Block.
 */
function resolveFieldMappingForBexioRow(blocks, bexioRow) {
  const { normalizeFieldMapping } = require("./syncBexioToExchange");
  const list = Array.isArray(blocks) && blocks.length ? blocks : [];
  if (!list.length) {
    return normalizeFieldMapping({});
  }
  for (const block of list) {
    if (evaluateConditions(bexioRow, block.conditions)) {
      return normalizeFieldMapping(block.fieldMapping);
    }
  }
  const noCond = list.find((b) => !b.conditions || b.conditions.length === 0);
  if (noCond) {
    return normalizeFieldMapping(noCond.fieldMapping);
  }
  return normalizeFieldMapping(list[0].fieldMapping);
}

module.exports = {
  normalizeFieldMappingBlocks,
  resolveFieldMappingForBexioRow,
  normalizeConditions
};
