/**
 * Kontaktfelder bexio API 2.0 / Exchange EWS (Contact) für Auswahl und Sync.
 * Exchange-Telefonkeys entsprechen ews-javascript-api PhoneNumberKey.
 * ewsId: Bezeichner wie in EWS / ews-javascript-api (ContactSchema, IndexedPropertyDefinition).
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

/** Exchange / EWS Contact — ewsId entspricht den Namen in ews-javascript-api ContactSchema */
const EXCHANGE_CONTACT_FIELDS = [
  { key: "fileAs", ewsId: "FileAs", label: "File As (Ablagename)" },
  { key: "displayName", ewsId: "DisplayName", label: "DisplayName" },
  { key: "givenName", ewsId: "GivenName", label: "GivenName" },
  { key: "middleName", ewsId: "MiddleName", label: "MiddleName" },
  { key: "surname", ewsId: "Surname", label: "Surname" },
  { key: "initials", ewsId: "Initials", label: "Initials" },
  { key: "nickName", ewsId: "NickName", label: "NickName" },
  { key: "generation", ewsId: "Generation", label: "Generation (Suffix)" },
  { key: "companyName", ewsId: "CompanyName", label: "CompanyName" },
  { key: "jobTitle", ewsId: "JobTitle", label: "JobTitle" },
  { key: "department", ewsId: "Department", label: "Department" },
  { key: "officeLocation", ewsId: "OfficeLocation", label: "OfficeLocation" },
  { key: "profession", ewsId: "Profession", label: "Profession" },
  { key: "assistantName", ewsId: "AssistantName", label: "AssistantName" },
  { key: "manager", ewsId: "Manager", label: "Manager" },
  { key: "spouseName", ewsId: "SpouseName", label: "SpouseName" },
  { key: "mileage", ewsId: "Mileage", label: "Mileage" },
  { key: "emailAddress1", ewsId: "EmailAddress1", label: "E-Mail 1 (EmailAddress1)" },
  { key: "emailAddress2", ewsId: "EmailAddress2", label: "E-Mail 2 (EmailAddress2)" },
  { key: "emailAddress3", ewsId: "EmailAddress3", label: "E-Mail 3 (EmailAddress3)" },
  { key: "imAddress1", ewsId: "ImAddress1", label: "IM-Adresse 1 (ImAddress1)" },
  { key: "imAddress2", ewsId: "ImAddress2", label: "IM-Adresse 2 (ImAddress2)" },
  { key: "imAddress3", ewsId: "ImAddress3", label: "IM-Adresse 3 (ImAddress3)" },
  { key: "assistantPhone", ewsId: "AssistantPhone", label: "Telefon Assistent/in (AssistantPhone)" },
  { key: "businessFax", ewsId: "BusinessFax", label: "Geschäfts-Fax (BusinessFax)" },
  { key: "businessPhone", ewsId: "BusinessPhone", label: "Geschäftstelefon (BusinessPhone)" },
  { key: "businessPhone2", ewsId: "BusinessPhone2", label: "Geschäftstelefon 2 (BusinessPhone2)" },
  { key: "callback", ewsId: "Callback", label: "Rückruf (Callback)" },
  { key: "carPhone", ewsId: "CarPhone", label: "Autotelefon (CarPhone)" },
  { key: "companyMainPhone", ewsId: "CompanyMainPhone", label: "Zentrale (CompanyMainPhone)" },
  { key: "homeFax", ewsId: "HomeFax", label: "Privat-Fax (HomeFax)" },
  { key: "homePhone", ewsId: "HomePhone", label: "Privattelefon (HomePhone)" },
  { key: "homePhone2", ewsId: "HomePhone2", label: "Privattelefon 2 (HomePhone2)" },
  { key: "isdn", ewsId: "Isdn", label: "ISDN" },
  { key: "mobilePhone", ewsId: "MobilePhone", label: "Mobiltelefon (MobilePhone)" },
  { key: "otherFax", ewsId: "OtherFax", label: "Weiteres Fax (OtherFax)" },
  { key: "otherTelephone", ewsId: "OtherTelephone", label: "Weiteres Telefon (OtherTelephone)" },
  { key: "pager", ewsId: "Pager", label: "Pager" },
  { key: "primaryPhone", ewsId: "PrimaryPhone", label: "Haupttelefon (PrimaryPhone)" },
  { key: "radioPhone", ewsId: "RadioPhone", label: "Funk (RadioPhone)" },
  { key: "telex", ewsId: "Telex", label: "Telex" },
  { key: "ttyTddPhone", ewsId: "TtyTddPhone", label: "TTY/TDD" },
  { key: "street", ewsId: "BusinessAddressStreet", label: "Geschäft: Strasse" },
  { key: "city", ewsId: "BusinessAddressCity", label: "Geschäft: Ort" },
  { key: "postalCode", ewsId: "BusinessAddressPostalCode", label: "Geschäft: PLZ" },
  { key: "businessState", ewsId: "BusinessAddressState", label: "Geschäft: Kanton/Bundesland" },
  { key: "businessCountry", ewsId: "BusinessAddressCountryOrRegion", label: "Geschäft: Land/Region" },
  { key: "homeStreet", ewsId: "HomeAddressStreet", label: "Privat: Strasse" },
  { key: "homeCity", ewsId: "HomeAddressCity", label: "Privat: Ort" },
  { key: "homePostalCode", ewsId: "HomeAddressPostalCode", label: "Privat: PLZ" },
  { key: "homeState", ewsId: "HomeAddressState", label: "Privat: Kanton/Bundesland" },
  { key: "homeCountry", ewsId: "HomeAddressCountryOrRegion", label: "Privat: Land/Region" },
  { key: "otherStreet", ewsId: "OtherAddressStreet", label: "Weitere Adr.: Strasse" },
  { key: "otherCity", ewsId: "OtherAddressCity", label: "Weitere Adr.: Ort" },
  { key: "otherPostalCode", ewsId: "OtherAddressPostalCode", label: "Weitere Adr.: PLZ" },
  { key: "otherState", ewsId: "OtherAddressState", label: "Weitere Adr.: Kanton/Bundesland" },
  { key: "otherCountry", ewsId: "OtherAddressCountryOrRegion", label: "Weitere Adr.: Land/Region" },
  { key: "businessHomePage", ewsId: "BusinessHomePage", label: "Geschäfts-Webseite (BusinessHomePage)" },
  { key: "body", ewsId: "Body", label: "Notizen (EWS Body, Outlook-Kontaktnotizen)" },
  { key: "birthday", ewsId: "Birthday", label: "Geburtstag (Birthday)" },
  { key: "weddingAnniversary", ewsId: "WeddingAnniversary", label: "Hochzeitstag (WeddingAnniversary)" }
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
