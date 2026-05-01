const ews = require("ews-javascript-api");

function trim(value) {
  return String(value || "").trim();
}

/**
 * @param {string} versionKey e.g. Exchange2016
 */
function resolveExchangeVersion(versionKey) {
  const key = trim(versionKey) || "Exchange2016";
  const v = ews.ExchangeVersion[key];
  if (v === undefined) {
    return ews.ExchangeVersion.Exchange2016;
  }
  return v;
}

/**
 * @param {{ ewsUrl: string, ewsUser: string, ewsPassword: string, exchangeVersion?: string }} opts
 */
function createExchangeService(opts) {
  const url = trim(opts.ewsUrl);
  const user = trim(opts.ewsUser);
  const password = trim(opts.ewsPassword);
  if (!url) {
    throw new Error("EWS-URL fehlt");
  }
  if (!user || !password) {
    throw new Error("Exchange Benutzer oder Passwort fehlt");
  }

  const service = new ews.ExchangeService(resolveExchangeVersion(opts.exchangeVersion));
  service.Url = new ews.Uri(url);
  service.Credentials = new ews.WebCredentials(user, password);
  return service;
}

async function probeContactsFolder(service) {
  await ews.Folder.Bind(service, ews.WellKnownFolderName.Contacts, ews.PropertySet.FirstClassProperties);
}

module.exports = {
  createExchangeService,
  probeContactsFolder,
  resolveExchangeVersion
};
