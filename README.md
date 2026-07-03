# Kwadrant — emotie-logger (PWA)

Minimalistische, Nederlandstalige PWA om emoties met één tik te loggen in vier
kwadranten (Forceren · Bouwen · Wegzakken · Opladen), met kalme inzichten
(weekverdeling, patronen per dagdeel, tijdlijn).

- **Offline-first**: service worker cachet de app-shell; werkt zonder internet.
- **Privacy**: alle logs staan lokaal op het apparaat (`localStorage`), niets gaat naar een server.
- **Installeerbaar**: voeg toe aan je beginscherm voor een standalone app-ervaring.

## Lokaal draaien

```bash
python3 -m http.server 8123
# open http://localhost:8123
```

## Techniek

Vanilla JS, geen buildstap. Bestanden: `index.html`, `styles.css`, `app.js`,
`manifest.webmanifest`, `sw.js`. Herbouwd uit een design-handoff (high-fidelity
prototype in HTML) naar productiecode.
