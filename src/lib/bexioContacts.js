function trim(value) {
  return String(value || "").trim();
}

/**
 * @param {string} baseUrl e.g. https://api.bexio.com
 * @param {string} token Bearer token
 * @param {(line: string) => void} [log]
 */
async function fetchAllContacts(baseUrl, token, log) {
  const root = trim(baseUrl).replace(/\/+$/, "");
  if (!root) {
    throw new Error("bexio Basis-URL fehlt");
  }
  if (!trim(token)) {
    throw new Error("bexio Token fehlt");
  }

  const out = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const url = `${root}/2.0/contact?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`bexio API ${res.status}: ${text.slice(0, 500)}`);
    }
    let batch;
    try {
      batch = JSON.parse(text);
    } catch {
      throw new Error("bexio API: keine gueltige JSON-Antwort");
    }
    if (!Array.isArray(batch)) {
      throw new Error("bexio API: erwartet wurde ein Array von Kontakten");
    }
    if (log) {
      log(`bexio: Offset ${offset}, erhalten ${batch.length}`);
    }
    if (batch.length === 0) {
      break;
    }
    for (const row of batch) {
      if (row && (row.is_deleted === true || row.is_deleted === 1)) {
        continue;
      }
      out.push(row);
    }
    if (batch.length < limit) {
      break;
    }
    offset += limit;
  }

  return out;
}

async function probeApi(baseUrl, token) {
  const root = trim(baseUrl).replace(/\/+$/, "");
  const url = `${root}/2.0/contact?limit=1&offset=0`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`bexio API ${res.status}: ${text.slice(0, 500)}`);
  }
}

module.exports = {
  fetchAllContacts,
  probeApi
};
