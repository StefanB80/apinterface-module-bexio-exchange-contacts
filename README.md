# apinterface-module-bexio-exchange-contacts

Synchronisiert Kontakte aus bexio in ein Exchange-On-Premises-Postfach (Ordner Kontakte) via EWS.

## Versionierung

- Modulpaket: package.json (ersion, Suffix -bec)
- Release-Tag: X.Y.Z-bec
- Core bleibt separat versioniert.

## Voraussetzungen

- APInterface Core mit aktivem Modul-Discovery
- Firma hat Apps exio und xchange aktiv
- Exchange EWS Endpoint erreichbar (z. B. https://mail.example.com/EWS/Exchange.asmx)
- Benutzer mit Schreibrecht auf Kontakte-Ordner

## Konfiguration im Modul

- bexio Basis-URL + API-Token
- EWS URL + Benutzer + Passwort
- Exchange Version (Standard Exchange2016)

## Persistenz

Pro Firma unter ar/:

- company-<id>.json (Konfiguration, letzter Lauf)
- company-<id>-bexio-exchange-contact-map.json (bexio-ID -> Exchange-Item-ID)

## Deployment (SSH/vServer)

Serverpfad (Beispiel):

- /opt/apps/apinterface/bexio-exchange-contacts

Ablauf:

1. Tag erstellen: X.Y.Z-bec
2. CI-Workflow deploy-module-bexio-exchange-contacts.yml ausfuehren oder Tag-Push nutzen
3. Auf Server in/deploy.sh <tag> (via SSH) ausfuehren

## Sicherheit

- Zugangsdaten werden nicht im UI ausgegeben
- Tokens/Passwoerter nur serverseitig in ar/ je Firma
- Keine Aenderung anderer Projekte; Modul ist in sich abgeschlossen
