const fs = require("fs");
const path = require("path");
const fsp = require("fs/promises");
const { probeApi } = require("../lib/bexioContacts");
const { createExchangeService, probeContactsFolder } = require("../lib/exchangeServiceFactory");
const { syncBexioContactsToExchange, DEFAULT_FIELD_MAPPING } = require("../lib/syncBexioToExchange");

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

function normalizeFieldMapping(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    displayName: trim(src.displayName || DEFAULT_FIELD_MAPPING.displayName),
    givenName: trim(src.givenName || DEFAULT_FIELD_MAPPING.givenName),
    surname: trim(src.surname || DEFAULT_FIELD_MAPPING.surname),
    companyName: trim(src.companyName || DEFAULT_FIELD_MAPPING.companyName),
    emailAddress1: trim(src.emailAddress1 || DEFAULT_FIELD_MAPPING.emailAddress1),
    businessPhone: trim(src.businessPhone || DEFAULT_FIELD_MAPPING.businessPhone),
    mobilePhone: trim(src.mobilePhone || DEFAULT_FIELD_MAPPING.mobilePhone),
    street: trim(src.street || DEFAULT_FIELD_MAPPING.street),
    city: trim(src.city || DEFAULT_FIELD_MAPPING.city),
    postalCode: trim(src.postalCode || DEFAULT_FIELD_MAPPING.postalCode)
  };
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
    updatedAt: "",
    lastSyncAt: "",
    lastSyncSummary: "",
    lastSyncLog: "",
    moduleVersion: readPackageVersion(releaseDir)
  };
  if (!id) {
    return empty;
  }
  const filePath = companyConfigPath(releaseDir, id);
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const merged = { ...empty, ...parsed, fieldMapping: normalizeFieldMapping(parsed.fieldMapping) };
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
  const fieldMapping = normalizeFieldMapping({
    displayName: body.map_displayName || (prev.fieldMapping && prev.fieldMapping.displayName),
    givenName: body.map_givenName || (prev.fieldMapping && prev.fieldMapping.givenName),
    surname: body.map_surname || (prev.fieldMapping && prev.fieldMapping.surname),
    companyName: body.map_companyName || (prev.fieldMapping && prev.fieldMapping.companyName),
    emailAddress1: body.map_emailAddress1 || (prev.fieldMapping && prev.fieldMapping.emailAddress1),
    businessPhone: body.map_businessPhone || (prev.fieldMapping && prev.fieldMapping.businessPhone),
    mobilePhone: body.map_mobilePhone || (prev.fieldMapping && prev.fieldMapping.mobilePhone),
    street: body.map_street || (prev.fieldMapping && prev.fieldMapping.street),
    city: body.map_city || (prev.fieldMapping && prev.fieldMapping.city),
    postalCode: body.map_postalCode || (prev.fieldMapping && prev.fieldMapping.postalCode)
  });

  const logLines = [];

  if (action === "test_bexio") {
    await probeApi(bexioBaseUrl, bexioToken);
    appendLog(logLines, "bexio: Verbindung OK (Testabruf /2.0/contact)");
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      updatedAt: new Date().toISOString(),
      lastCheckBexioAt: new Date().toISOString(),
      lastSyncLog: logLines.join("\n"),
      lastSyncSummary: "bexio Test OK"
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
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      updatedAt: new Date().toISOString(),
      lastCheckEwsAt: new Date().toISOString(),
      lastSyncLog: logLines.join("\n"),
      lastSyncSummary: "EWS Test OK"
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
    const { map, stats } = await syncBexioContactsToExchange({
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      idMap,
      log: (line) => {
        logs.push(`${new Date().toISOString()} ${line}`);
      },
      fieldMapping
    });
    await writeIdMap(releaseDir, targetCompanyId, map);
    const summary = `${stats.created} neu, ${stats.updated} aktualisiert, ${stats.errors} Fehler (${stats.totalBexio} bexio)`;
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncSummary: summary,
      lastSyncLog: logs.slice(-80).join("\n")
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
    const payload = {
      bexioBaseUrl,
      bexioToken,
      ewsUrl,
      ewsUser,
      ewsPassword,
      exchangeVersion,
      fieldMapping,
      updatedAt: new Date().toISOString()
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
