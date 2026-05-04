# elle-eats

Persönlicher Wochen-Speiseplan als Webseite. Sieben Tage, pro Tag ein Gericht, präsentiert wie auf einem schwarzen Brett / einer Kreidetafel.

## Scope (v1)

- Wochenansicht: 7 Tage (Mo–So), pro Tag ein Gericht.
- Historie: vergangene und kommende Wochen anzeigen / wechseln können.
- Bearbeiten direkt im Browser (Gericht eintragen / ändern / löschen).

**Nicht im Scope (v1):** Rezepte/Zutaten, Einkaufsliste, Mehrbenutzer, Login, Foto-Uploads. Bitte nicht vorab einbauen.

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
- Inspirations-Bilder liegen in `input/` (`kitchen*.jpeg`) — nur als Referenz, nicht ausliefern.

## Tech-Stack

- **v1: Vanilla HTML, CSS, JavaScript.** Kein Build-Tool, kein Framework, keine Dependencies.
- Auslieferungsordner: `public/` (`index.html` als Einstieg, Logik in `app.js`, Styles in `styles.css`, Demo-Bilder unter `public/assets/images/`).
- Lokal starten mit `npx serve public` (Node). Direkt im Browser per Doppelklick auf `public/index.html` ebenfalls möglich.
- Frameworks (React/Next/Astro o. ä.) erst, wenn der Funktionsumfang es wirklich verlangt — vorher fragen.

## Datenhaltung

- **v1: `localStorage`.** Daten bleiben im Browser des Nutzers.
- Datenmodell bewusst simpel und backend-tauglich halten, z. B.:
  ```
  {
    "weeks": {
      "2026-W18": { "mon": "...", "tue": "...", ..., "sun": "..." },
      ...
    }
  }
  ```
- Wochen-Schlüssel im ISO-Format `YYYY-Www` (Mo als Wochenstart).
- **Zukunft:** echtes Backend / Datenbank, sobald Mehrgerätenutzung gewünscht. Code so strukturieren, dass Storage hinter einer schmalen Funktion (`loadWeek`, `saveWeek`, `listWeeks`) gekapselt ist — Austausch später ohne UI-Änderung.
- **Demo-Daten (Seed):** laufen nur lokal (`localhost`, `127.0.0.1`, `file://`) oder mit URL-Parameter `?demo=1`. In Produktion startet die App leer.

## Hosting

- Noch nicht entschieden. Bis dahin lokal entwickeln; nichts in den Code aufnehmen, das ein bestimmtes Hosting voraussetzt.

## Verzeichnisstruktur (Soll)

```
elle-eats/
├── CLAUDE.md
├── CONTRIBUTING.md
├── .gitignore
├── public/                  # Auslieferung — alles was deployed wird
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
│       └── demo/            # Demo-Gerichtsbilder (Seed-Daten, nur lokal/`?demo=1`)
└── docs/                    # Referenzmaterial, nicht ausgeliefert
    ├── design/              # Styleguide & Designreferenzen
    │   ├── STYLEGUIDE.md
    │   └── STYLEGUIDE.svg
    ├── inspiration/         # Inspirationsbilder (Quelle für Styleguide)
    │   └── *.jpeg
    └── kosten.md            # interne Notizen
```

## Konventionen

- Kein Code-Kommentar, der nur beschreibt, *was* der Code tut. Nur kurze Hinweise zu nicht-offensichtlichen Entscheidungen.
- Datumslogik: Wochenstart Montag, deutsche Wochentagsbeschriftung (`Mo`, `Di`, `Mi`, `Do`, `Fr`, `Sa`, `So`).
- Funktionen klein und benannt; keine Klassen/Frameworks „auf Vorrat“.

## Workflow für Claude

- Vor dem Hinzufügen neuer Bibliotheken oder eines Frameworks **rückfragen**.
- Bei UI-Änderungen kurz beschreiben, wie es sich anfühlen soll, statt nur Code zu liefern.
- Änderungen klein halten — dieses Projekt wächst Schritt für Schritt.
