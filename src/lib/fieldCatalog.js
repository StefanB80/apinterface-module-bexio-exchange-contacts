/**
 * Kontaktfelder bexio API 2.0 / Exchange EWS (Kontakt) für Auswahl und Sync.
 */

const BEXIO_CONTACT_FIELDS = [
  { key: "full_name", label: "Vollname (name_1 + name_2)", synthetic: true },
  { key: "id", label: "id (Kontakt-ID)" },
  { key: "nr", label: "nr (Kontaktnummer)" },
  { key: "contact_type_id", label: "contact_type_id" },
  { key: "name_1", label: "name_1" },
  { key: "name_2", label: "name_2" },
  { key: "salutation_id", label: "salutation_id" },
  { key: "salutation_form", label: "salutation_form" },
  { key: "title_id", label: "title_id" },
  { key: "birthday", label: "birthday" },
  { key: "address", label: "address" },
  { key: "address_alt", label: "address_alt" },
  { key: "postcode", label: "postcode" },
  { key: "city", label: "city" },
  { key: "country_id", label: "country_id" },
  { key: "mail", label: "mail" },
  { key: "mail_second", label: "mail_second" },
  { key: "phone_fixed", label: "phone_fixed" },
  { key: "phone_mobile", label: "phone_mobile" },
  { key: "phone_home", label: "phone_home" },
  { key: "phone_fax", label: "phone_fax" },
  { key: "phone_other", label: "phone_other" },
  { key: "url", label: "url" },
  { key: "skype_name", label: "skype_name" },
  { key: "remarks", label: "remarks" },
  { key: "language_id", label: "language_id" },
  { key: "contact_group_ids", label: "contact_group_ids" },
  { key: "owner_id", label: "owner_id" },
  { key: "updated_at", label: "updated_at" }
];

const EXCHANGE_CONTACT_FIELDS = [
  { key: "displayName", label: "DisplayName" },
  { key: "givenName", label: "GivenName" },
  { key: "surname", label: "Surname" },
  { key: "companyName", label: "CompanyName" },
  { key: "jobTitle", label: "JobTitle" },
  { key: "department", label: "Department" },
  { key: "emailAddress1", label: "EmailAddress1" },
  { key: "emailAddress2", label: "EmailAddress2" },
  { key: "businessPhone", label: "BusinessPhone" },
  { key: "mobilePhone", label: "MobilePhone" },
  { key: "homePhone", label: "HomePhone" },
  { key: "street", label: "Geschäftsadresse Street" },
  { key: "city", label: "Geschäftsadresse City" },
  { key: "postalCode", label: "Geschäftsadresse PostalCode" }
];

function allKeys(list) {
  return list.map((f) => f.key);
}

module.exports = {
  BEXIO_CONTACT_FIELDS,
  EXCHANGE_CONTACT_FIELDS,
  allBexioKeys: () => allKeys(BEXIO_CONTACT_FIELDS),
  allExchangeKeys: () => allKeys(EXCHANGE_CONTACT_FIELDS)
};
