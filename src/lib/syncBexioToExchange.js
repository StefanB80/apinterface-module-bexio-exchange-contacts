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

function applyBexioToEwsContact(bexioRow, contact) {
  const display = displayNameFromBexio(bexioRow);
  contact.DisplayName = display;

  const n1 = trim(bexioRow.name_1);
  const n2 = trim(bexioRow.name_2);
  contact.GivenName = n1;
  contact.Surname = n2;

  const mail = trim(bexioRow.mail || bexioRow.mail_second || "");
  if (mail.includes("@")) {
    contact.EmailAddresses[ews.EmailAddressKey.EmailAddress1] = mail;
  }

  const fixed = trim(bexioRow.phone_fixed || bexioRow.phone_home || "");
  const mobile = trim(bexioRow.phone_mobile || "");
  if (fixed) {
    contact.PhoneNumbers[ews.PhoneNumberKey.BusinessPhone] = fixed;
  }
  if (mobile) {
    contact.PhoneNumbers[ews.PhoneNumberKey.MobilePhone] = mobile;
  }

  const street = trim(bexioRow.address);
  const city = trim(bexioRow.city);
  const zip = trim(bexioRow.postcode);
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
        applyBexioToEwsContact(row, bound);
        await bound.Update(ews.ConflictResolutionMode.AlwaysOverwrite);
        updated += 1;
      } else {
        const contact = new ews.Contact(service);
        applyBexioToEwsContact(row, contact);
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
  displayNameFromBexio
};
