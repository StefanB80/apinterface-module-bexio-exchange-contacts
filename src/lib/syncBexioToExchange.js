const ews = require("ews-javascript-api");
const { createExchangeService } = require("./exchangeServiceFactory");
const { fetchAllContacts } = require("./bexioContacts");
const { allExchangeKeys } = require("./fieldCatalog");

function trim(value) {
  return String(value || "").trim();
}

function displayNameFromBexio(c) {
  const a = trim(c.name_1);
  const b = trim(c.name_2);
  const joined = [a, b].filter(Boolean).join(" ").trim();
  if (joined) {
    return joined;
  }
  const id = c.id != null ? String(c.id) : "";
  return id ? `bexio Kontakt ${id}` : "bexio Kontakt";
}

const DEFAULT_FIELD_MAPPING = {
  displayName: "full_name",
  givenName: "name_1",
  surname: "name_2",
  companyName: "name_1",
  jobTitle: "",
  department: "",
  emailAddress1: "mail",
  emailAddress2: "mail_second",
  businessPhone: "phone_fixed",
  mobilePhone: "phone_mobile",
  homePhone: "phone_home",
  street: "address",
  city: "city",
  postalCode: "postcode"
};

function readMappedValue(bexioRow, bexioField) {
  const key = trim(bexioField);
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

function normalizeFieldMapping(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = { ...DEFAULT_FIELD_MAPPING };
  for (const k of Object.keys(out)) {
    if (src[k] !== undefined && src[k] !== null) {
      out[k] = trim(String(src[k]));
    }
  }
  return out;
}

/** @param {Record<string, boolean>|null|undefined} input */
function normalizeEnabledExchange(input) {
  const keys = allExchangeKeys();
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      out[k] = Boolean(src[k]);
    } else {
      out[k] = true;
    }
  }
  return out;
}

function applyBexioToEwsContact(bexioRow, contact, fieldMapping, enabledExchange) {
  const map = normalizeFieldMapping(fieldMapping);
  const en = normalizeEnabledExchange(enabledExchange);

  if (en.displayName !== false) {
    const display = readMappedValue(bexioRow, map.displayName) || displayNameFromBexio(bexioRow);
    contact.DisplayName = display;
  }

  if (en.givenName !== false) {
    contact.GivenName = readMappedValue(bexioRow, map.givenName);
  }
  if (en.surname !== false) {
    contact.Surname = readMappedValue(bexioRow, map.surname);
  }
  if (en.companyName !== false) {
    contact.CompanyName = readMappedValue(bexioRow, map.companyName);
  }
  if (en.jobTitle !== false) {
    contact.JobTitle = readMappedValue(bexioRow, map.jobTitle);
  }
  if (en.department !== false) {
    contact.Department = readMappedValue(bexioRow, map.department);
  }

  if (en.emailAddress1 !== false) {
    const mail = readMappedValue(bexioRow, map.emailAddress1);
    if (mail.includes("@")) {
      contact.EmailAddresses[ews.EmailAddressKey.EmailAddress1] = mail;
    }
  }
  if (en.emailAddress2 !== false) {
    const mail2 = readMappedValue(bexioRow, map.emailAddress2);
    if (mail2.includes("@")) {
      contact.EmailAddresses[ews.EmailAddressKey.EmailAddress2] = mail2;
    }
  }

  if (en.businessPhone !== false) {
    const fixed = readMappedValue(bexioRow, map.businessPhone);
    if (fixed) {
      contact.PhoneNumbers[ews.PhoneNumberKey.BusinessPhone] = fixed;
    }
  }
  if (en.mobilePhone !== false) {
    const mobile = readMappedValue(bexioRow, map.mobilePhone);
    if (mobile) {
      contact.PhoneNumbers[ews.PhoneNumberKey.MobilePhone] = mobile;
    }
  }
  if (en.homePhone !== false) {
    const home = readMappedValue(bexioRow, map.homePhone);
    if (home) {
      contact.PhoneNumbers[ews.PhoneNumberKey.HomePhone] = home;
    }
  }

  if (en.street !== false || en.city !== false || en.postalCode !== false) {
    const street = en.street !== false ? readMappedValue(bexioRow, map.street) : "";
    const city = en.city !== false ? readMappedValue(bexioRow, map.city) : "";
    const zip = en.postalCode !== false ? readMappedValue(bexioRow, map.postalCode) : "";
    if (street || city || zip) {
      const addr = new ews.PhysicalAddressEntry();
      if (street) {
        addr.Street = street;
      }
      if (city) {
        addr.City = city;
      }
      if (zip) {
        addr.PostalCode = zip;
      }
      contact.PhysicalAddresses[ews.PhysicalAddressKey.Business] = addr;
    }
  }
}

/**
 * @param {object} params
 * @param {string} params.bexioBaseUrl
 * @param {string} params.bexioToken
 * @param {string} params.ewsUrl
 * @param {string} params.ewsUser
 * @param {string} params.ewsPassword
 * @param {string} [params.exchangeVersion]
 * @param {Record<string, { ewsItemId: string }>} params.idMap
 * @param {(line: string) => void} [params.log]
 * @param {Record<string, boolean>} [params.enabledExchange]
 */
async function syncBexioContactsToExchange(params) {
  const log = params.log || (() => {});
  const fieldMapping = normalizeFieldMapping(params.fieldMapping);
  const enabledExchange = normalizeEnabledExchange(params.enabledExchange);
  const service = createExchangeService({
    ewsUrl: params.ewsUrl,
    ewsUser: params.ewsUser,
    ewsPassword: params.ewsPassword,
    exchangeVersion: params.exchangeVersion
  });

  const rows = await fetchAllContacts(params.bexioBaseUrl, params.bexioToken, log);
  log(`Synchronisation: ${rows.length} bexio-Kontakte nach Filter`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  const map = params.idMap && typeof params.idMap === "object" ? { ...params.idMap } : {};

  for (const row of rows) {
    const bid = row.id != null ? String(row.id) : "";
    if (!bid) {
      continue;
    }
    try {
      const existing = map[bid];
      if (existing && trim(existing.ewsItemId)) {
        const bound = await ews.Contact.Bind(
          service,
          new ews.ItemId(existing.ewsItemId),
          ews.PropertySet.FirstClassProperties
        );
        applyBexioToEwsContact(row, bound, fieldMapping, enabledExchange);
        await bound.Update(ews.ConflictResolutionMode.AlwaysOverwrite);
        updated += 1;
      } else {
        const contact = new ews.Contact(service);
        applyBexioToEwsContact(row, contact, fieldMapping, enabledExchange);
        await contact.Save(ews.WellKnownFolderName.Contacts);
        const idObj = contact.Id;
        const uid = idObj && idObj.UniqueId ? String(idObj.UniqueId) : "";
        if (!uid) {
          throw new Error("Exchange hat keine Item-Id zurueckgegeben");
        }
        map[bid] = { ewsItemId: uid };
        created += 1;
      }
    } catch (err) {
      errors += 1;
      const msg = err && err.message ? err.message : String(err);
      log(`Fehler bexio id=${bid}: ${msg}`);
    }
  }

  return {
    map,
    stats: { totalBexio: rows.length, created, updated, errors }
  };
}

module.exports = {
  syncBexioContactsToExchange,
  displayNameFromBexio,
  DEFAULT_FIELD_MAPPING,
  normalizeFieldMapping,
  normalizeEnabledExchange,
  applyBexioToEwsContact
};
