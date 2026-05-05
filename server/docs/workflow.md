# elle-eats Server — Entwickler-Workflow

Was du nach einem `git clone` brauchst, um den Server lokal laufen zu haben, samt Demo-Daten.

## Voraussetzungen

- **Node.js ≥ 20** (für `node --env-file` und `node:sqlite`-kompatibles Native-Build).
  Check: `node --version`.
- macOS, Linux oder WSL. Auf Windows läuft `db:reset` (`rm -rf data`) nicht — entweder WSL nutzen oder den Befehl manuell ersetzen.

## 1. Erste Einrichtung

```bash
cd server
npm install
```

Beim Install wird `better-sqlite3` als Native-Modul gebaut. Wenn das fehlschlägt, fehlen Build-Tools (auf macOS: `xcode-select --install`).

## 2. Google-OAuth-Client einrichten

Einmalig in der [Google Cloud Console](https://console.cloud.google.com):

1. Neues Projekt anlegen (Name z. B. „elle-eats").
2. **OAuth Consent Screen** konfigurieren:
   - User Type: External
   - App-Name, Support-E-Mail, Developer-E-Mail eintragen
   - Im „Testing"-Status belassen — externe Verifikation brauchst du nicht, weil der Server selbst eine Allowlist erzwingt.
3. **Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/auth/google/callback` (lokal)
     - später: `https://<deine-domain>/auth/google/callback`
4. Die ausgegebene **Client ID** und **Client Secret** notieren.

## 3. `.env` anlegen

```bash
cp .env.example .env
```

Werte eintragen:

| Variable                | Wert                                                                  |
|-------------------------|-----------------------------------------------------------------------|
| `GOOGLE_CLIENT_ID`      | aus Schritt 2                                                         |
| `GOOGLE_CLIENT_SECRET`  | aus Schritt 2                                                         |
| `GOOGLE_REDIRECT_URI`   | `http://localhost:3000/auth/google/callback` (lokal)                  |
| `ALLOWED_EMAILS`        | komma-separierte Google-Mail-Adressen mit Edit-Recht                  |
| `SESSION_SECRET`        | `openssl rand -hex 32` ausführen, Output einsetzen                    |
| `COOKIE_SECURE`         | lokal auf `false`, in Produktion (HTTPS) auf `true` (Default)         |
| `PORT`, `DB_PATH`, `IMAGES_DIR` | Defaults sind ok                                              |

`.env` ist via `.gitignore` ausgeschlossen — Secrets bleiben lokal.

## 4. Daten seeden

```bash
npm run seed
```

Befüllt `data/elle-eats.db` mit zehn Demo-Rezepten (Bilder aus `public/assets/demo/`) und legt für die aktuelle Woche einen Beispielplan an.

Idempotent: Rezepte mit existierendem Slug werden übersprungen, eine bereits befüllte Woche wird nicht überschrieben.

## 5. Entwicklung starten

```bash
npm run dev
```

Server läuft auf http://localhost:3000 mit `--watch` (neustart bei Codeänderung). Liefert Frontend (`../public/`) **und** API von einem Origin aus — keine CORS-Konfiguration nötig.

Auth-Flow lokal:

1. Browser auf http://localhost:3000 → Read-only-Ansicht mit den Seed-Daten.
2. „Anmelden" oben rechts → Google-Login → zurück eingeloggt.
3. Edit-UI ist aktiv: Tag anklicken, Rezept anlegen/bearbeiten, Bilder hochladen.
4. „Abmelden" macht dich wieder zum Lese-Besucher.

## Skripte

| Befehl              | Zweck                                                          |
|---------------------|----------------------------------------------------------------|
| `npm run dev`       | Server lokal mit Live-Reload                                   |
| `npm start`         | Server ohne `--watch` (für Produktion)                         |
| `npm run seed`      | Seed-Daten in bestehende DB einfügen                           |
| `npm run db:reset`  | DB + Bilder löschen und neu seeden — nur lokal!                |

**Wichtig:** `db:reset` und `seed` **nie auf dem Produktivsystem** ausführen. Sie sind Dev-Tools.

## Verzeichnisstruktur

```
server/
├── package.json
├── .env.example       Vorlage für eigene .env
├── .env               Secrets, gitignored
├── docs/
│   └── workflow.md    dieses Dokument
├── src/
│   ├── index.js       Hono-App, Routen + Auth-Middleware
│   ├── db.js          SQLite-Setup + Schema
│   ├── storage.js     loadWeek/saveRecipe/etc., spiegelt Frontend-API
│   ├── auth.js        Google-OAuth + Session-Cookie + Allowlist
│   └── seed.js        Dev-Seed mit Demo-Rezepten und -Bildern
└── data/              gitignored: SQLite-Datei + Bilder
    ├── elle-eats.db
    └── images/<sha256>.{jpg,png}
```

## Architekturhinweise

- **Bilder content-addressed**: Dateiname ist SHA256 des Inhalts (`<hash>.<ext>`). Doppelte Uploads landen automatisch in derselben Datei. Vorteil beim Cache: `Cache-Control: immutable` ist dadurch korrekt.
- **Session ist ein signiertes Cookie** (HMAC-SHA256, 30 Tage), keine Session-Tabelle. Logout = Cookie löschen. `SESSION_SECRET` rotieren = alle bestehenden Sessions ungültig.
- **Allowlist** wird beim Server-Start aus `ALLOWED_EMAILS` gelesen. Änderung erfordert Server-Neustart.
- **Auth-Modell**: alle `GET`-Routen sind öffentlich (Lesemodus für jeden), `POST`/`PUT`/`DELETE` brauchen eine gültige Session. `/api/me` ist absichtlich geschützt — das Frontend nutzt es als Login-Statusabfrage.

## Troubleshooting

| Symptom                                         | Ursache / Fix                                                              |
|-------------------------------------------------|----------------------------------------------------------------------------|
| `Fehlende Umgebungsvariable: GOOGLE_CLIENT_ID`  | `.env` fehlt oder Variable leer.                                           |
| `Host key verification failed` (Git push)       | Nicht serverbezogen — siehe Haupt-Repo-Doku.                               |
| OAuth-Callback: „Ungültiger Auth-Status"        | Cookie-Drittpartei-Blockade oder falscher `GOOGLE_REDIRECT_URI`.           |
| OAuth-Callback: „Zugang nicht freigegeben"      | Mailadresse fehlt in `ALLOWED_EMAILS` (Komma-Liste, Kleinbuchstaben).      |
| Bilder laden mit 404                            | Datei in `data/images/` fehlt — `npm run db:reset` lädt sie neu.           |
