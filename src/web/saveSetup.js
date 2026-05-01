const fs = require("fs");
const path = require("path");
const fsp = require("fs/promises");
const { probeApi } = require("../lib/bexioContacts");
const { createExchangeService, probeContactsFolder } = require("../lib/exchangeServiceFactory");
const {
  syncBexioContactsToExchange,
  DEFAULT_FIELD_MAPPING,
  normalizeFieldMapping
} = require("../lib/syncBexioToExchange");
const {
  BEXIO_CONTACT_FIELDS,
  EXCHANGE_CONTACT_FIELDS,
  allBexioKeys,
  allExchangeKeys
} = require("../lib/fieldCatalog");

function trim(value) {
  return String(value || "").trim();
}

function resolveModuleBase(releaseDir) {
  let abs = path.resolve(releaseDir);
  for (let i = 0; i < 8; i += 1) {
    const b = path.basename(abs);
    if (b === "current") {
      return path.dirname(abs);
    }
    if (b === "releases") {
      return path.dirname(abs);
    }
    const parent = path.dirname(abs);
    if (parent === abs) {
      break;
    }
    abs = parent;
  }
  return path.resolve(releaseDir);
}

function resolveConfigDir(releaseDir) {
  const custom = trim(process.env.BEC_CONFIG_DIR);
  if (custom) {
    return custom;
  }
  return path.join(resolveModuleBase(releaseDir), "var");
}

function companyConfigPath(releaseDir, companyId) {
  return path.join(resolveConfigDir(releaseDir), `company-${Number(companyId)}.json`);
}

function companyIdMapPath(releaseDir, companyId) {
  return path.join(resolveConfigDir(releaseDir), `company-${Number(companyId)}-bexio-exchange-contact-map.json`);
}

function readPackageVersion(releaseDir) {
  try {
    const raw = fs.readFileSync(path.join(releaseDir, "package.json"), "utf8");
    return String(JSON.parse(raw).version || "").trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function readIdMap(releaseDir, companyId) {
  const p = companyIdMapPath(releaseDir, companyId);
  try {
    const raw = await fsp.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.byBexioId === "object" ? parsed.byBexioId : {};
  } catch {
    return {};
  }
}

async function writeIdMap(releaseDir, companyId, byBexioId) {
  const p = companyIdMapPath(releaseDir, companyId);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const payload = {
    byBexioId,
    updatedAt: new Date().toISOString()
  };
  await fsp.writeFile(p, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function maskSecret(value, visible = 4) {
  const s = trim(value);
  if (!s) {
    return "";
  }
  if (s.length <= visible) {
    return "****";
  }
  return `${s.slice(0, visible)}…`;
}

function readEnabledKeysFromBody(body, fieldName, prevKeys) {
  const raw = body[fieldName];
  const fallback = () =>
    Array.isArray(prevKeys) && prevKeys.length ? [...prevKeys] : allBexioKeys();
  const fallbackEx = () =>
    Array.isArray(prevKeys) && prevKeys.length ? [...prevKeys] : allExchangeKeys();

  if (raw === undefined) {
    return fieldName === "exchangeEnabled" ? fallbackEx() : fallback();
  }
  const list = Array.isArray(raw) ? raw.map(trim).filter(Boolean) : [trim(raw)].filter(Boolean);
  if (!list.length) {
    return fieldName === "exchangeEnabled" ? fallbackEx() : fallback();
  }
  return list;
}

function exchangeEnabledFromKeys(keys) {
  const set = new Set(keys);
  return Object.fromEntries(allExchangeKeys().map((k) => [k, set.has(k)]));
}

function appendProtocolHistory(prev, entry) {
  const hist = Array.isArray(prev.protocolHistory) ? [...prev.protocolHistory] : [];
  hist.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    at: new Date().toISOString(),
    type: entry.type,
    summary: trim(entry.summary),
    log: String(entry.log || "")
  });
  while (hist.length > 50) {
    hist.shift();
  }
  return hist;
}

function buildFieldMappingFromBody(body, prevMap) {
  const p = prevMap && typeof prevMap === "object" ? prevMap : {};
  return normalizeFieldMapping({
    displayName: body.map_displayName || p.displayName,
    givenName: body.map_givenName || p.givenName,
    surname: body.map_surname || p.surname,
    companyName: body.map_companyName || p.companyName,
    jobTitle: body.map_jobTitle || p.jobTitle,
    department: body.map_department || p.department,
    emailAddress1: body.map_emailAddress1 || p.emailAddress1,
    emailAddress2: body.map_emailAddress2 || p.emailAddress2,
    businessPhone: body.map_businessPhone || p.businessPhone,
    mobilePhone: body.map_mobilePhone || p.mobilePhone,
    homePhone: body.map_homePhone || p.homePhone,
    street: body.map_street || p.street,
    city: body.map_city || p.city,
    postalCode: body.map_postalCode || p.postalCode
  });
}

async function readRawCompanyConfig(releaseDir, companyId) {
  const id = Number(companyId);
  if (!id) {
    return {};
  }
  try {
    const raw = await fsp.readFile(companyConfigPath(releaseDir, id), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function loadSetup(releaseDir, companyId) {
  const id = Number(companyId);
  const empty = {
    bexioBaseUrl: "https://api.bexio.com",
    bexioToken: "",
    ewsUrl: "",
    ewsUser: "",
    ewsPassword: "",
    exchangeVersion: "Exchange2016",
    fieldMapping: { ...DEFAULT_FIELD_MAPPING },
    defaultFieldMapping: { ...DEFAULT_FIELD_MAPPING },
    bexioEnabledKeys: allBexioKeys(),
    exchangeEnabledKeys: allExchangeKeys(),
    protocolHistory: [],
    updatedAt: "",
    lastSyncAt: "",
    lastSyncSummary: "",
    lastSyncLog: "",
    probeBexioOk: false,
    probeBexioAt: "",
    probeBexioSummary: "",
    probeBexioLog: "",
    probeEwsOk: false,
    probeEwsAt: "",
    probeEwsSummary: "",
    probeEwsLog: "",
    moduleVersion: readPackageVersion(releaseDir),
    bexioFieldCatalog: BEXIO_CONTACT_FIELDS,
    exchangeFieldCatalog: EXCHANGE_CONTACT_FIELDS
  };
  if (!id) {
    return empty;
  }
  const filePath = companyConfigPath(releaseDir, id);
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const merged = {
      ...empty,
      ...parsed,
      fieldMapping: normalizeFieldMapping(parsed.fieldMapping || {}),
      defaultFieldMapping: { ...DEFAULT_FIELD_MAPPING },
      bexioFieldCatalog: BEXIO_CONTACT_FIELDS,
      exchangeFieldCatalog: EXCHANGE_CONTACT_FIELDS
    };
    merged.bexioEnabledKeys = Array.isArray(parsed.bexioEnabledKeys) && parsed.bexioEnabledKeys.length
      ? parsed.bexioEnabledKeys.map(trim)
      : allBexioKeys();
    merged.exchangeEnabledKeys = Array.isArray(parsed.exchangeEnabledKeys) && parsed.exchangeEnabledKeys.length
      ? parsed.exchangeEnabledKeys.map(trim)
      : allExchangeKeys();
    merged.protocolHistory = Array.isArray(parsed.protocolHistory) ? parsed.protocolHistory : [];
    merged.probeBexioOk = Boolean(parsed.probeBexioOk);
    merged.probeBexioAt = trim(parsed.probeBexioAt || "");
    merged.probeBexioSummary = trim(parsed.probeBexioSummary || "");
    merged.probeBexioLog = String(parsed.probeBexioLog || "");
    merged.probeEwsOk = Boolean(parsed.probeEwsOk);
    merged.probeEwsAt = trim(parsed.probeEwsAt || "");
    merged.probeEwsSummary = trim(parsed.probeEwsSummary || "");
    merged.probeEwsLog = String(parsed.probeEwsLog || "");
    merged.moduleVersion = readPackageVersion(releaseDir);
    if (merged.bexioToken) {
      merged.bexioTokenMasked = maskSecret(merged.bexioToken);
      merged.bexioTokenSet = true;
      delete merged.bexioToken;
    }
    if (merged.ewsPassword) {
      merged.ewsPasswordSet = true;
      delete merged.ewsPassword;
    }
    return merged;
  } catch {
    return empty;
  }
}

function appendLog(lines, msg, maxLines = 80) {
  lines.push(`${new Date().toISOString()} ${msg}`);
  if (lines.length > maxLines) {
    lines.splice(0, lines.length - maxLines);
  }
}

function probeExtras(prev) {
  return {
    probeBexioOk: Boolean(prev.probeBexioOk),
    probeBexioAt: trim(prev.probeBexioAt || ""),
    probeBexioSummary: trim(prev.probeBexioSummary || ""),
    probeBexioLog: String(prev.probeBexioLog || ""),
    probeEwsOk: Boolean(prev.probeEwsOk),
    probeEwsAt: trim(prev.probeEwsAt || ""),
    probeEwsSummary: trim(prev.probeEwsSummary || ""),
    probeEwsLog: String(prev.probeEwsLog || ""),
    lastSyncAt: trim(prev.lastSyncAt || "")
  };
}

async function saveSetup({ companyId, body, releaseDir, isPlatformAdmin }) {
  if (!releaseDir || !companyId) {
    throw new Error("Ungueltiger Aufruf");
  }

  const opIsAdmin = Boolean(isPlatformAdmin);
  const sessionCompanyId = Number(companyId);
  const requestedTarget = Number(body.setupCompanyId || sessionCompanyId) || sessionCompanyId;
  let targetCompanyId = sessionCompanyId;
  if (requestedTarget !== sessionCompanyId) {
    if (!opIsAdmin) {
      throw new Error("Zugriff verweigert");
    }
    targetCompanyId = requestedTarget;
  }

  const action = trim(body.action).toLowerCase();
  const prev = await readRawCompanyConfig(releaseDir, targetCompanyId);

  const bexioBaseUrl = trim(body.bexioBaseUrl || prev.bexioBaseUrl || "https://api.bexio.com");
  let bexioToken = trim(body.bexioToken || "");
  if (!bexioToken) {
    bexioToken = trim(prev.bexioToken || "");
  }

  const ewsUrl = trim(body.ewsUrl || prev.ewsUrl);
  const ewsUser = trim(body.ewsUser || prev.ewsUser);
  let ewsPassword = trim(body.ewsPassword || "");
  if (!ewsPassword) {
    ewsPassword = trim(prev.ewsPassword || "");
  }

  const exchangeVersion = trim(body.exchangeVersion || prev.exchangeVersion || "Exchange2016");
  const fieldMapping = buildFieldMappingFromBody(body, prev.fieldMapping);
  const bexioEnabledKeys = readEnabledKeysFromBody(body, "bexioEnabled", prev.bexioEnabledKeys);
  const exchangeEnabledKeys = readEnabledKeysFromBody(body, "exchangeEnabled", prev.exchangeEnabledKeys);

  const logLines = [];

  if (action === "test_bexio") {
    await probeApi(bexioBaseUrl, bexioToken);
    appendLog(logLines, "bexio: Verbindung OK (Testabruf /2.0/contact)");
    const logText = logLines.join("\n");
    const protocolHistory = appendProtocolHistory(prev, {
      type: "test_bexio",
      summary: "bexio Test OK",
      log: logText
    });
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      bexioEnabledKeys,
      exchangeEnabledKeys,
      protocolHistory,
      updatedAt: new Date().toISOString(),
      lastSyncLog: logText,
      lastSyncSummary: "bexio Test OK",
      probeBexioOk: true,
      probeBexioAt: new Date().toISOString(),
      probeBexioSummary: "bexio Test OK",
      probeBexioLog: logText,
      probeEwsOk: Boolean(prev.probeEwsOk),
      probeEwsAt: trim(prev.probeEwsAt || ""),
      probeEwsSummary: trim(prev.probeEwsSummary || ""),
      probeEwsLog: String(prev.probeEwsLog || ""),
      lastSyncAt: trim(prev.lastSyncAt || "")
    };
    await fsp.mkdir(resolveConfigDir(releaseDir), { recursive: true });
    await fsp.writeFile(
      companyConfigPath(releaseDir, targetCompanyId),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  if (action === "test_ews") {
    const svc = createExchangeService({ ewsUrl, ewsUser, ewsPassword, exchangeVersion });
    await probeContactsFolder(svc);
    appendLog(logLines, "Exchange: Kontakte-Ordner lesbar (EWS OK)");
    const logText = logLines.join("\n");
    const protocolHistory = appendProtocolHistory(prev, {
      type: "test_ews",
      summary: "EWS Test OK",
      log: logText
    });
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      bexioEnabledKeys,
      exchangeEnabledKeys,
      protocolHistory,
      updatedAt: new Date().toISOString(),
      lastSyncLog: logText,
      lastSyncSummary: "EWS Test OK",
      probeEwsOk: true,
      probeEwsAt: new Date().toISOString(),
      probeEwsSummary: "EWS Test OK",
      probeEwsLog: logText,
      probeBexioOk: Boolean(prev.probeBexioOk),
      probeBexioAt: trim(prev.probeBexioAt || ""),
      probeBexioSummary: trim(prev.probeBexioSummary || ""),
      probeBexioLog: String(prev.probeBexioLog || ""),
      lastSyncAt: trim(prev.lastSyncAt || "")
    };
    await fsp.mkdir(resolveConfigDir(releaseDir), { recursive: true });
    await fsp.writeFile(
      companyConfigPath(releaseDir, targetCompanyId),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  if (action === "sync") {
    if (!bexioToken) {
      throw new Error("bexio Token fehlt");
    }
    if (!ewsUrl || !ewsUser || !ewsPassword) {
      throw new Error("Exchange EWS-Zugang unvollstaendig");
    }
    const idMap = await readIdMap(releaseDir, targetCompanyId);
    const logs = [];
    const enabledExchange = exchangeEnabledFromKeys(exchangeEnabledKeys);
    const { map, stats } = await syncBexioContactsToExchange({
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      idMap,
      enabledExchange,
      log: (line) => {
        logs.push(`${new Date().toISOString()} ${line}`);
      }
    });
    await writeIdMap(releaseDir, targetCompanyId, map);
    const summary = `${stats.created} neu, ${stats.updated} aktualisiert, ${stats.errors} Fehler (${stats.totalBexio} bexio)`;
    const logText = logs.slice(-80).join("\n");
    const protocolHistory = appendProtocolHistory(prev, {
      type: "sync",
      summary,
      log: logText
    });
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      bexioEnabledKeys,
      exchangeEnabledKeys,
      protocolHistory,
      updatedAt: new Date().toISOString(),
      ...probeExtras(prev),
      lastSyncAt: new Date().toISOString(),
      lastSyncSummary: summary,
      lastSyncLog: logText
    };
    await fsp.mkdir(resolveConfigDir(releaseDir), { recursive: true });
    await fsp.writeFile(
      companyConfigPath(releaseDir, targetCompanyId),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  if (!bexioToken && action === "save") {
    bexioToken = trim(prev.bexioToken || "");
  }
  if (!ewsPassword && action === "save") {
    ewsPassword = trim(prev.ewsPassword || "");
  }

  if (action === "save" || action === "") {
    if (!bexioToken) {
      throw new Error("bexio Token fehlt");
    }
    if (!ewsUrl || !ewsUser || !ewsPassword) {
      throw new Error("Exchange EWS-Zugang unvollstaendig (URL, Benutzer, Passwort)");
    }
    const protocolHistory = Array.isArray(prev.protocolHistory) ? prev.protocolHistory : [];
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      bexioEnabledKeys,
      exchangeEnabledKeys,
      protocolHistory,
      updatedAt: new Date().toISOString(),
      ...probeExtras(prev),
      lastSyncSummary: trim(prev.lastSyncSummary || ""),
      lastSyncLog: String(prev.lastSyncLog || "")
    };
    await fsp.mkdir(resolveConfigDir(releaseDir), { recursive: true });
    await fsp.writeFile(
      companyConfigPath(releaseDir, targetCompanyId),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  throw new Error("Unbekannte Aktion");
}

module.exports = {
  loadSetup,
  saveSetup
};
