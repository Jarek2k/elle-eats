# elle-eats

Persönlicher Wochen-Speiseplan als Webseite. Sieben Tage, pro Tag ein Gericht, präsentiert wie auf einem schwarzen Brett / einer Kreidetafel.

## Scope

- **Wochenansicht**: 7 Tage (Mo–So), pro Tag ein Gericht. Historie über mehrere Wochen.
- **Rezepte**: Titel, Zutaten, Zubereitung, Notizen, Bilder. Verlinkt mit Wochen-Einträgen über den Titel.
- **Auth**: Lesen für jeden öffentlich; Anlegen/Editieren/Löschen erfordert Google-Login mit Email-Allowlist.
- **Bearbeiten direkt im Browser** — kein separates Admin-UI.

**Nicht im Scope:** Einkaufsliste, mehrere editierende Nutzer, geteilte Pläne, Kalender-Sync, Mahlzeit-Templates. Bitte nicht vorab einbauen.

## Sprache

- Gesamte UI und alle Inhalte auf **Deutsch**.
- Code-Identifier (Variablen, Funktionen, Dateinamen) auf **Englisch**.
- Keine i18n-Infrastruktur — Texte direkt im Markup.

## Optik

- Look: **Kreidetafel / schwarzes Brett**.
  - Dunkler Hintergrund (sehr dunkles Grau / Schwarz, nicht reines `#000`, leicht texturiert wenn möglich).
  - Schrift in heller Kreide-Anmutung; handschriftliche Font für Gerichte (z. B. Google Fonts: `Caveat`, `Kalam`, `Patrick Hand`).
  - Tagesnamen wirken wie überschriebene Tafel-Sektionen.
- Mobile-first, einfaches responsives Layout.
- Inspirations-Bilder liegen in `docs/inspiration/` (`kitchen*.jpeg`) — nur als Referenz, nicht ausliefern.

## Tech-Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript. Kein Build-Tool, kein Framework, keine Dependencies.
  - Auslieferungsordner: `public/` (`index.html`, `app.js`, `styles.css`, Demo-Bilder unter `assets/demo/`).
- **Backend**: Node ≥20 in `server/`. Drei Dependencies: `hono` (HTTP), `better-sqlite3` (DB), `arctic` (Google OAuth).
  - Setup und Start: siehe [server/docs/workflow.md](server/docs/workflow.md).
- Reine Demo-Vorschau ohne Server: `npx serve public` öffnen.
- Frameworks fürs Frontend (React/Next/Astro o. ä.) erst, wenn der Funktionsumfang es wirklich verlangt — **vorher fragen**. Backend-Libraries oberhalb der drei genannten ebenfalls vorher fragen.

## Datenhaltung

- **Zwei Modi**, automatisch erkannt beim App-Start (Ping auf `/healthz`):
  - **API-Modus** (Server erreichbar): SQLite hinter REST. Bilder als Dateien (`<sha256>.{jpg,png}`) unter `server/data/images/`, content-addressed (Dedup gratis).
  - **Demo-Modus** (kein Server, z. B. GitHub Pages): `localStorage` mit eingebautem Seed.
- Wochen-Schlüssel im ISO-Format `YYYY-Www` (Mo als Wochenstart).
- Storage-Operationen sind im Frontend hinter einer einheitlichen async-Schicht gekapselt (`Storage.loadWeek`, `saveRecipe`, `addRecipeImage`, …). Aufrufer kennen die Modus-Unterschiede nicht.
- **Frontend-Demo-Seed** läuft nur in `mode === 'demo'` und auf `localhost`/`127.0.0.1`/`file://` oder mit `?demo=1`.
- **Server-Seed** (`npm run seed`) befüllt die Dev-DB mit Demo-Rezepten + Bildern. **Niemals in Produktion ausführen.** `npm run db:reset` löscht zusätzlich vorher alles weg — auch nur lokal.

## Hosting

- **GitHub Pages** (https://jarek2k.github.io/elle-eats/): Demo-Modus, statisches Frontend mit Seed-Daten. Auto-Deploy via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) bei Push auf `main`.
- **Hetzner-VPS** (geplant): produktiv mit Backend. Plan: Caddy als Reverse-Proxy + systemd-Service, kein Docker. Konfig kommt parallel zum Code unter `deploy/` (noch nicht angelegt).
- Nichts in den Code aufnehmen, das ein bestimmtes Hosting *fest* voraussetzt.

## Verzeichnisstruktur

```
elle-eats/
├── CLAUDE.md
├── CONTRIBUTING.md
├── .gitignore
├── .github/workflows/       # GitHub Actions (Pages-Deploy)
├── public/                  # Frontend, statisch ausgeliefert
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/demo/         # Demo-Gerichtsbilder (Seed-Daten)
├── server/                  # Backend (Node, Hono, SQLite)
│   ├── package.json
│   ├── .env.example         # Vorlage; .env selbst gitignored
│   ├── docs/workflow.md     # Onboarding/Setup-Doku
│   ├── src/
│   │   ├── index.js         # Hono-App, Routen, Auth-Middleware
│   │   ├── db.js            # SQLite-Setup + Schema
│   │   ├── storage.js       # spiegelt Frontend-Storage
│   │   ├── auth.js          # Google-OAuth + Session-Cookie
│   │   └── seed.js          # Dev-Seed (npm run seed)
│   └── data/                # gitignored: DB-Datei + Bilder
└── docs/                    # Projekt-Referenzmaterial, nicht ausgeliefert
    ├── design/              # Styleguide & Designreferenzen
    │   ├── STYLEGUIDE.md
    │   └── STYLEGUIDE.svg
    ├── inspiration/         # Inspirationsbilder (Quelle für Styleguide)
    │   └── *.jpeg
    └── kosten.md            # interne Notizen
```

## Auth-Modell

- **Lesen ist öffentlich.** `GET`-Routen für Wochen, Rezepte, Bilder brauchen kein Login. Auch Inkognito-Besucher sehen alle Inhalte.
- **Schreiben braucht Login.** `POST`/`PUT`/`DELETE` auf `/api/*` erfordern eine gültige Session (sonst 401). `/api/me` ist absichtlich geschützt — das Frontend nutzt es als Login-Statusabfrage beim Start.
- **Login via Google OAuth** + Allowlist (`ALLOWED_EMAILS` in `.env`). Wer nicht drin steht, sieht „Zugang nicht freigegeben".
- **Session = signiertes Cookie** (HMAC-SHA256, 30 Tage). Keine Session-Tabelle. Logout löscht den Cookie. `SESSION_SECRET` rotieren = alle Sessions ungültig.
- **Frontend** spiegelt das Modell: ohne Login Read-only-UI (Edit-Buttons versteckt, Felder readonly), mit Login alles editierbar. Auth-Link rechts in der Section-Nav (`Anmelden` / `Abmelden`).

## Konventionen

- Kein Code-Kommentar, der nur beschreibt, *was* der Code tut. Nur kurze Hinweise zu nicht-offensichtlichen Entscheidungen.
- Datumslogik: Wochenstart Montag, deutsche Wochentagsbeschriftung (`Mo`, `Di`, `Mi`, `Do`, `Fr`, `Sa`, `So`).
- Funktionen klein und benannt; keine Klassen/Frameworks „auf Vorrat".
- Bilder server-seitig immer **content-addressed** (`<sha256>.<ext>`). Filename ist kein Anzeigename, nur Hash + Endung.

## Workflow für Claude

- Vor dem Hinzufügen neuer Bibliotheken oder eines Frameworks **rückfragen**.
- Bei UI-Änderungen kurz beschreiben, wie es sich anfühlen soll, statt nur Code zu liefern.
- Änderungen klein halten — dieses Projekt wächst Schritt für Schritt.
- Server-Setup-Details stehen in [server/docs/workflow.md](server/docs/workflow.md) — dort verweisen, hier nicht duplizieren.
- **Niemals** `npm run seed` oder `npm run db:reset` in einem Produktivkontext ausführen. Nur lokal.
