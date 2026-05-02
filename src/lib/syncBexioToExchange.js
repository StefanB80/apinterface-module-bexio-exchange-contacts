const ews = require("ews-javascript-api");
const { createExchangeService } = require("./exchangeServiceFactory");
const { fetchAllContacts } = require("./bexioContacts");
const { readBexioFieldValue } = require("./bexioFieldValue");
const { resolveFieldMappingForBexioRow } = require("./fieldMappingBlocks");
const { EXCHANGE_CONTACT_FIELDS, allExchangeKeys } = require("./fieldCatalog");

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

function buildDefaultFieldMapping() {
  const base = {
    displayName: "full_name",
    givenName: "name_1",
    surname: "name_2",
    companyName: "name_1",
    jobTitle: "",
    department: "",
    emailAddress1: "mail",
    emailAddress2: "mail_second",
    emailAddress3: "",
    businessPhone: "phone_fixed",
    mobilePhone: "phone_mobile",
    homePhone: "phone_home",
    street: "address",
    city: "city",
    postalCode: "postcode",
    businessState: "",
    businessCountry: "",
    homeStreet: "",
    homeCity: "",
    homePostalCode: "",
    homeState: "",
    homeCountry: "",
    otherStreet: "",
    otherCity: "",
    otherPostalCode: "",
    otherState: "",
    otherCountry: "",
    nickName: "",
    middleName: "",
    initials: "",
    fileAs: "",
    generation: "",
    officeLocation: "",
    profession: "",
    assistantName: "",
    manager: "",
    spouseName: "",
    mileage: "",
    businessHomePage: "url",
    imAddress1: "skype_name",
    imAddress2: "",
    imAddress3: "",
    birthday: "birthday",
    weddingAnniversary: "",
    assistantPhone: "",
    businessFax: "phone_fax",
    businessPhone2: "",
    callback: "",
    carPhone: "",
    companyMainPhone: "",
    homeFax: "",
    homePhone2: "",
    isdn: "",
    otherFax: "",
    otherTelephone: "phone_other",
    pager: "",
    primaryPhone: "",
    radioPhone: "",
    telex: "",
    ttyTddPhone: "",
    body: "remarks"
  };
  for (const { key } of EXCHANGE_CONTACT_FIELDS) {
    if (base[key] === undefined) {
      base[key] = "";
    }
  }
  return base;
}

const DEFAULT_FIELD_MAPPING = buildDefaultFieldMapping();

const PHONE_TO_EWS = {
  assistantPhone: ews.PhoneNumberKey.AssistantPhone,
  businessFax: ews.PhoneNumberKey.BusinessFax,
  businessPhone: ews.PhoneNumberKey.BusinessPhone,
  businessPhone2: ews.PhoneNumberKey.BusinessPhone2,
  callback: ews.PhoneNumberKey.Callback,
  carPhone: ews.PhoneNumberKey.CarPhone,
  companyMainPhone: ews.PhoneNumberKey.CompanyMainPhone,
  homeFax: ews.PhoneNumberKey.HomeFax,
  homePhone: ews.PhoneNumberKey.HomePhone,
  homePhone2: ews.PhoneNumberKey.HomePhone2,
  isdn: ews.PhoneNumberKey.Isdn,
  mobilePhone: ews.PhoneNumberKey.MobilePhone,
  otherFax: ews.PhoneNumberKey.OtherFax,
  otherTelephone: ews.PhoneNumberKey.OtherTelephone,
  pager: ews.PhoneNumberKey.Pager,
  primaryPhone: ews.PhoneNumberKey.PrimaryPhone,
  radioPhone: ews.PhoneNumberKey.RadioPhone,
  telex: ews.PhoneNumberKey.Telex,
  ttyTddPhone: ews.PhoneNumberKey.TtyTddPhone
};

function readMappedValue(bexioRow, bexioField) {
  return readBexioFieldValue(bexioRow, bexioField);
}

function normalizeFieldMapping(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = { ...DEFAULT_FIELD_MAPPING };
  for (const k of Object.keys(out)) {
    if (src[k] !== undefined && src[k] !== null) {
      const t = trim(String(src[k]));
      if (t) {
        out[k] = t;
      }
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

function setEmail(contact, fieldKey, enumName, bexioRow, map, en) {
  if (en[fieldKey] === false) {
    return;
  }
  const mail = readMappedValue(bexioRow, map[fieldKey]);
  if (mail.includes("@")) {
    contact.EmailAddresses[ews.EmailAddressKey[enumName]] = mail;
  }
}

function setIm(contact, enumName, fieldKey, bexioRow, map, en) {
  if (en[fieldKey] === false) {
    return;
  }
  const v = readMappedValue(bexioRow, map[fieldKey]);
  if (v) {
    contact.ImAddresses[ews.ImAddressKey[enumName]] = v;
  }
}

function trySetEwsDate(contact, prop, bexioRow, mapField, map, en) {
  if (en[mapField] === false) {
    return;
  }
  const t = readMappedValue(bexioRow, map[mapField]);
  if (!t) {
    return;
  }
  try {
    contact[prop] = ews.DateTime.Parse(t);
  } catch {
    /* bexio liefert oft nur Datum ohne Zeit */
  }
}

function writePhysicalIfAny(contact, addressKey, parts) {
  if (!parts.street && !parts.city && !parts.postal && !parts.state && !parts.country) {
    return;
  }
  const addr = new ews.PhysicalAddressEntry();
  if (parts.street) {
    addr.Street = parts.street;
  }
  if (parts.city) {
    addr.City = parts.city;
  }
  if (parts.postal) {
    addr.PostalCode = parts.postal;
  }
  if (parts.state) {
    addr.State = parts.state;
  }
  if (parts.country) {
    addr.CountryOrRegion = parts.country;
  }
  contact.PhysicalAddresses[addressKey] = addr;
}

function applyBexioToEwsContact(bexioRow, contact, fieldMapping, enabledExchange) {
  const map = normalizeFieldMapping(fieldMapping);
  const en = normalizeEnabledExchange(enabledExchange);

  if (en.fileAs !== false) {
    const v = readMappedValue(bexioRow, map.fileAs);
    if (v) {
      contact.FileAs = v;
    }
  }
  if (en.displayName !== false) {
    const display = readMappedValue(bexioRow, map.displayName) || displayNameFromBexio(bexioRow);
    contact.DisplayName = display;
  }
  if (en.givenName !== false) {
    contact.GivenName = readMappedValue(bexioRow, map.givenName);
  }
  if (en.middleName !== false) {
    contact.MiddleName = readMappedValue(bexioRow, map.middleName);
  }
  if (en.surname !== false) {
    contact.Surname = readMappedValue(bexioRow, map.surname);
  }
  if (en.initials !== false) {
    contact.Initials = readMappedValue(bexioRow, map.initials);
  }
  if (en.nickName !== false) {
    contact.NickName = readMappedValue(bexioRow, map.nickName);
  }
  if (en.generation !== false) {
    contact.Generation = readMappedValue(bexioRow, map.generation);
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
  if (en.officeLocation !== false) {
    contact.OfficeLocation = readMappedValue(bexioRow, map.officeLocation);
  }
  if (en.profession !== false) {
    contact.Profession = readMappedValue(bexioRow, map.profession);
  }
  if (en.assistantName !== false) {
    contact.AssistantName = readMappedValue(bexioRow, map.assistantName);
  }
  if (en.manager !== false) {
    contact.Manager = readMappedValue(bexioRow, map.manager);
  }
  if (en.spouseName !== false) {
    contact.SpouseName = readMappedValue(bexioRow, map.spouseName);
  }
  if (en.mileage !== false) {
    contact.Mileage = readMappedValue(bexioRow, map.mileage);
  }
  if (en.businessHomePage !== false) {
    contact.BusinessHomePage = readMappedValue(bexioRow, map.businessHomePage);
  }
  if (en.body !== false) {
    const noteText = readMappedValue(bexioRow, map.body);
    if (noteText) {
      contact.Body = new ews.MessageBody(ews.BodyType.Text, noteText);
    }
  }

  setEmail(contact, "emailAddress1", "EmailAddress1", bexioRow, map, en);
  setEmail(contact, "emailAddress2", "EmailAddress2", bexioRow, map, en);
  setEmail(contact, "emailAddress3", "EmailAddress3", bexioRow, map, en);

  setIm(contact, "ImAddress1", "imAddress1", bexioRow, map, en);
  setIm(contact, "ImAddress2", "imAddress2", bexioRow, map, en);
  setIm(contact, "ImAddress3", "imAddress3", bexioRow, map, en);

  for (const [fieldKey, pkey] of Object.entries(PHONE_TO_EWS)) {
    if (en[fieldKey] === false) {
      continue;
    }
    const v = readMappedValue(bexioRow, map[fieldKey]);
    if (v) {
      contact.PhoneNumbers[pkey] = v;
    }
  }

  if (en.street !== false || en.city !== false || en.postalCode !== false || en.businessState !== false || en.businessCountry !== false) {
    writePhysicalIfAny(contact, ews.PhysicalAddressKey.Business, {
      street: en.street !== false ? readMappedValue(bexioRow, map.street) : "",
      city: en.city !== false ? readMappedValue(bexioRow, map.city) : "",
      postal: en.postalCode !== false ? readMappedValue(bexioRow, map.postalCode) : "",
      state: en.businessState !== false ? readMappedValue(bexioRow, map.businessState) : "",
      country: en.businessCountry !== false ? readMappedValue(bexioRow, map.businessCountry) : ""
    });
  }

  if (
    en.homeStreet !== false ||
    en.homeCity !== false ||
    en.homePostalCode !== false ||
    en.homeState !== false ||
    en.homeCountry !== false
  ) {
    writePhysicalIfAny(contact, ews.PhysicalAddressKey.Home, {
      street: en.homeStreet !== false ? readMappedValue(bexioRow, map.homeStreet) : "",
      city: en.homeCity !== false ? readMappedValue(bexioRow, map.homeCity) : "",
      postal: en.homePostalCode !== false ? readMappedValue(bexioRow, map.homePostalCode) : "",
      state: en.homeState !== false ? readMappedValue(bexioRow, map.homeState) : "",
      country: en.homeCountry !== false ? readMappedValue(bexioRow, map.homeCountry) : ""
    });
  }

  if (
    en.otherStreet !== false ||
    en.otherCity !== false ||
    en.otherPostalCode !== false ||
    en.otherState !== false ||
    en.otherCountry !== false
  ) {
    writePhysicalIfAny(contact, ews.PhysicalAddressKey.Other, {
      street: en.otherStreet !== false ? readMappedValue(bexioRow, map.otherStreet) : "",
      city: en.otherCity !== false ? readMappedValue(bexioRow, map.otherCity) : "",
      postal: en.otherPostalCode !== false ? readMappedValue(bexioRow, map.otherPostalCode) : "",
      state: en.otherState !== false ? readMappedValue(bexioRow, map.otherState) : "",
      country: en.otherCountry !== false ? readMappedValue(bexioRow, map.otherCountry) : ""
    });
  }

  trySetEwsDate(contact, "Birthday", bexioRow, "birthday", map, en);
  trySetEwsDate(contact, "WeddingAnniversary", bexioRow, "weddingAnniversary", map, en);
}

/**
 * @param {object} params
 * @param {Record<string, { ewsItemId: string }>} params.idMap
 * @param {Record<string, boolean>} [params.enabledExchange]
 */
async function syncBexioContactsToExchange(params) {
  const log = params.log || (() => {});
  const legacyMapping = normalizeFieldMapping(params.fieldMapping);
  const blocks = Array.isArray(params.fieldMappingBlocks) ? params.fieldMappingBlocks : null;
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
      const fieldMapping =
        blocks && blocks.length ? resolveFieldMappingForBexioRow(blocks, row) : legacyMapping;
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
