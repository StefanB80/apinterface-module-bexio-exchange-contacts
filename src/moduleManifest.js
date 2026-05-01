const packageJson = require("../package.json");

const moduleManifest = {
  id: "bexio-exchange-contacts",
  slug: "apinterface-module-bexio-exchange-contacts",
  version: packageJson.version,
  displayName: "bexio ↔ Exchange Kontakte",
  appKey: "exchange",
  appKeys: ["bexio", "exchange"],
  path: "/modules/bexio-exchange-contacts",
  category: "integration",
  systems: [
    { id: "bexio", label: "bexio", icon: "bexio" },
    { id: "exchange", label: "Exchange", icon: "exchange" }
  ],
  setup: {
    title: "Modul Setup",
    description:
      "Synchronisation von bexio-Kontakten in das Exchange-Postfach (Kontakte-Ordner) über EWS. Voraussetzung: On-Premises-Exchange mit erreichbarer EWS-URL und Zugangsdaten mit Kontakte-Schreibrecht.",
    sections: []
  },
  visual: {
    type: "dual-system",
    interaction: { dragAndDrop: true, planned: true },
    circle: { center: { x: 450, y: 270 }, radius: 195 },
    apps: [
      { id: "bexio", label: "bexio", icon: "bexio", position: { x: 230, y: 270 } },
      { id: "exchange", label: "Exchange", icon: "exchange", position: { x: 670, y: 270 } }
    ],
    dataStreams: [
      {
        id: "contacts-ews",
        label: "Kontakte (bexio → Exchange)",
        source: "bexio",
        target: "exchange",
        midpoint: { x: 450, y: 195 }
      }
    ]
  }
};

module.exports = { moduleManifest };
