const ews = require("ews-javascript-api");
const { createExchangeService } = require("./exchangeServiceFactory");
const { fetchAllContacts } = require("./bexioContacts");

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
  emailAddress1: "mail",
  businessPhone: "phone_fixed",
  mobilePhone: "phone_mobile",
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
  return trim(bexioRow[key]);
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

function applyBexioToEwsContact(bexioRow, contact, fieldMapping) {
  const map = normalizeFieldMapping(fieldMapping);
  const display = readMappedValue(bexioRow, map.displayName) || displayNameFromBexio(bexioRow);
  contact.DisplayName = display;

  const n1 = readMappedValue(bexioRow, map.givenName);
  const n2 = readMappedValue(bexioRow, map.surname);
  contact.GivenName = n1;
  contact.Surname = n2;
  contact.CompanyName = readMappedValue(bexioRow, map.companyName);

  const mail = readMappedValue(bexioRow, map.emailAddress1);
  if (mail.includes("@")) {
    contact.EmailAddresses[ews.EmailAddressKey.EmailAddress1] = mail;
  }

  const fixed = readMappedValue(bexioRow, map.businessPhone);
  const mobile = readMappedValue(bexioRow, map.mobilePhone);
  if (fixed) {
    contact.PhoneNumbers[ews.PhoneNumberKey.BusinessPhone] = fixed;
  }
  if (mobile) {
    contact.PhoneNumbers[ews.PhoneNumberKey.MobilePhone] = mobile;
  }

  const street = readMappedValue(bexioRow, map.street);
  const city = readMappedValue(bexioRow, map.city);
  const zip = readMappedValue(bexioRow, map.postalCode);
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
 */
async function syncBexioContactsToExchange(params) {
  const log = params.log || (() => {});
  const fieldMapping = normalizeFieldMapping(params.fieldMapping);
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
        applyBexioToEwsContact(row, bound, fieldMapping);
        await bound.Update(ews.ConflictResolutionMode.AlwaysOverwrite);
        updated += 1;
      } else {
        const contact = new ews.Contact(service);
        applyBexioToEwsContact(row, contact, fieldMapping);
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
  DEFAULT_FIELD_MAPPING
};
