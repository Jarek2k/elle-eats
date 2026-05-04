# Style Guide — elle eats

Visuelle Sprache für die Webseite. Abgeleitet aus den Originalfotos der Küche: warmes Eichenholz, helles Leinenweiß, eine echte Schiefertafel an der Tür, schwarze Metallregale, Pflanzen, Wein und Keramik.

Der Stil ist **ruhig, warm, durchdacht**. Keine Effekt-Hascherei, keine Verläufe, keine Drop Shadows „auf Vorrat". Tiefe entsteht aus Material und Typografie, nicht aus UI-Tricks. Die Seite soll sich anfühlen wie ein Notizbuch in einer guten Küche — eher Cookbook als App.

---

## 1 · Stimmung in einem Satz

> Eine handgeschriebene Wochenkarte auf einem Leinen-Tischtuch, neben einer Tasse Kaffee und einem aufgeschlagenen Kochbuch.

**Adjektive:** warm, leise, taktil, kuratiert, geerdet.
**Nicht:** verspielt, technisch, „cleane SaaS-App", grell, neon.

---

## 2 · Farbpalette

Alle Werte aus den Küchenfotos abgeleitet — die echte Tafel inklusive. Die Palette ist **bewusst eng** — eine handvoll Töne, fast monochrom warm, mit zwei Akzenten.

### Neutrale Basis

| Token | Hex | Beschreibung | Verwendung |
|---|---|---|---|
| `--c-slate` | `#1E2421` | Tafel-Schwarz mit leichtem Grünstich, gemessen am echten Foto | Tafel-Oberfläche, dunkle Sektionen |
| `--c-frame` | `#0F1110` | Tiefschwarz des Holzrahmens um die Tafel | Tafel-Rahmen, schwere Borders |
| `--c-ink` | `#1A1B1A` | Tinte, fast schwarz, Metall-Anthrazit der Regale | Primärtext auf hellem Grund, Linien, Icons |
| `--c-chalk` | `#EFE8DA` | Cremiges Kreide-Weiß, leicht warm, nie reines `#FFF` | Schrift auf der Tafel, Highlights |
| `--c-linen` | `#F5F1EA` | Wandweiß, warmes Off-White | Haupt-Hintergrund hell |
| `--c-paper` | `#FAF7F1` | Etwas heller als Leinen | Karten-Oberfläche, gehobene Flächen |

### Hölzer

| Token | Hex | Beschreibung | Verwendung |
|---|---|---|---|
| `--c-oak` | `#C9A574` | Helle Eiche, wie die Arbeitsplatte | Akzent-Flächen, ausgewählte Hover-Zustände |
| `--c-walnut` | `#6E4A2D` | Walnuss, wie der Esstisch | Sekundärtext, Borders auf hellem Grund |

### Akzente (sparsam einsetzen)

| Token | Hex | Beschreibung | Verwendung |
|---|---|---|---|
| `--c-sage` | `#8B9D7E` | Salbei-Grün, wie die Pflanzen am Fenster | „Heute" / aktiver Tag, kleine Highlights |
| `--c-burgundy` | `#6B2E2E` | Wein-Burgund, wie die Flasche auf der Arbeitsplatte | Selten — z.B. besonderes Gericht |

**Regel:** Auf einer Ansicht maximal **eine** Akzentfarbe gleichzeitig sichtbar. Akzente bleiben Akzente.

### Kontrast

- Body-Text auf `--c-linen`: `--c-ink` (≥ 14:1)
- Body-Text auf `--c-slate`: `--c-chalk` (≥ 12:1)
- Sekundärtext: 60–70 % Opacity der Primärfarbe — nie eigene Grautöne erfinden.

---

## 3 · Typografie

Zwei Schriften für die UI, **zwei für die Tafel**. Die Tafel ist eine eigene Bühne und darf zwei Hand-Fonts kombinieren — die echte Tafel tut genau das: eckige Caps für die Tag-Header, lockere Schreibschrift für die Gerichte.

### Display — `Fraunces`
Eine moderne Serif mit weichem, leicht buchhaftem Charakter. Für Seitenüberschriften, Wochen-Header („KW 18 · Mai 2026") und gelegentliche Zitate. Wird **nicht** auf der Tafel verwendet.
- Größen: 48–96 px
- Gewicht: 300–400, **niemals Bold**
- Letter-spacing: 0 oder leicht negativ (-0.01em)

### Tafel-Header — `Architects Daughter`
Eckige, fast architektonische Hand-Caps. Bildet die Wochentag-Überschriften auf der Tafel ab — wie auf der echten Tafel mit Kreide geschrieben.
- Verwendung: **nur** Wochentag-Header auf der Tafel
- Schreibweise: `text-transform: uppercase`, voll ausgeschrieben (MITTWOCH, nicht „Mi")
- Größen: 22–32 px
- Letter-spacing: `0.04em`
- Direkt unter dem Wort: handgezogene Kreidelinie (siehe 5.2)

### Tafel-Gericht — `Caveat`
Lockere, fließende Handschrift. Für die Gerichte unterhalb der Tag-Header — entspannt, nicht geschnörkelt.
- Verwendung: **nur** Gerichts-Texte auf der Tafel
- Größen: 26–34 px
- Gewicht: 400 (Standard), 600 für besondere Hervorhebung
- Mixed Case (normales Schreiben), niemals Caps

### UI & Body — `Inter`
Neutrale, hervorragend lesbare Sans-Serif für alles Funktionale **außerhalb** der Tafel: Navigation, Buttons, Beschreibungen, Datumsangaben, Meta-Infos.
- Größen: 14, 16, 18, 22 px
- Gewicht: 400 (Body), 500 (Buttons), 600 (Labels)
- Letter-spacing: 0; bei Caps `+0.08em`

### Skala

| Rolle | Font | Größe | Zeilenhöhe |
|---|---|---|---|
| Page Title | Fraunces 400 | 72 px | 1.05 |
| Section Title | Fraunces 400 | 36 px | 1.2 |
| Wochen-Header („KW 18") | Inter 600 caps | 14 px | 1.0 |
| Tafel-Tag (MITTWOCH) | Architects Daughter | 24 px | 1.0 |
| Tafel-Gericht | Caveat 400 | 30 px | 1.2 |
| Body | Inter 400 | 16 px | 1.6 |
| Meta / Datum | Inter 400 | 14 px | 1.4 |

---

## 4 · Layout & Raum

- **Großzügiger Whitespace.** Lieber weniger Inhalt pro Bildschirm als zu viel.
- **Spalten:** Mobile-first; Desktop-Grundraster 12 Spalten, max. Breite `1100 px`, zentriert.
- **Spacing-Skala (4er):** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`. Nichts dazwischen.
- **Ränder außen:** Mobile `24 px`, Tablet `48 px`, Desktop `96 px`.

---

## 5 · Komponenten

### 5.1 · Die Tafel (Wochenansicht)

Zentrales Element. Bildet die echte Tafel an der Küchentür ab — bis hin zum Holzrahmen.

- **Format:** Hochformat, Verhältnis ca. **2 : 3** (z.B. 480 × 720 px Desktop, voll responsiv auf Mobile)
- **Rahmen:** `--c-frame` (`#0F1110`), Breite `28 px` Desktop / `18 px` Mobile, leicht erhaben mit feiner heller Innenkante (`inset 0 0 0 1px rgba(239,232,218,0.06)`)
- **Tafel-Oberfläche:** `--c-slate` mit ganz leichtem radialem Verlauf — etwas heller in der oberen Bildhälfte, simuliert seitliches Licht aus dem Küchenfenster
  - Beispiel: `radial-gradient(ellipse 120% 100% at 30% 25%, #262C29 0%, #1E2421 60%, #181D1B 100%)`
- **Karten-Schatten:** dezent, weich nach unten — `0 18px 40px rgba(15, 17, 16, 0.18)` (nicht weicher Glow)
- **Ecken:** `border-radius: 4 px` außen (Rahmen), `2 px` innen (Tafel-Oberfläche)
- **Padding innen (Tafel):** `48 px` Desktop / `28 px` Mobile, oben/unten gleichmäßig
- **„Heute":** kleiner Salbei-Punkt (`--c-sage`, 6 px) **links** neben dem aktuellen Wochentag-Header, vertikal mittig zur CAPS-Zeile

### 5.2 · Tag-Block (zwei Zeilen)

Jeder Tag besteht aus **zwei Zeilen** untereinander, nicht nebeneinander. So steht es auch auf der echten Tafel.

```
MITTWOCH
─────────────
gegrillte Aubergine mit Mango

DONNERSTAG
─────────────
Ofenhalloumi mit Fenchel

FREITAG
─────────────
Edamame-Tacos
```

- **Zeile 1 — Wochentag:** `Architects Daughter`, uppercase, voll ausgeschrieben (MITTWOCH, DONNERSTAG, …), `--c-chalk`
- **Kreidelinie unter dem Wochentag:** dünne Linie (`1.5 px`), `--c-chalk` mit `opacity: 0.55`, `stroke-linecap: round`, leicht unregelmäßig wirkend (handgezogen). Länge ≈ Breite des Wortes + `12 px`
- **Zeile 2 — Gericht:** `Caveat 400`, mixed case, `--c-chalk`. Steht direkt unter der Linie
- **Leerer Tag:** Wochentag-Header und Linie sichtbar, **Gerichts-Zeile bleibt leer** (kein Em-Dash, kein Platzhalter — wie auf der echten Tafel der ungeschriebene Sonntag/Montag)
- **Abstand zwischen Tag-Blöcken:** `s-6` (32 px) Desktop / `s-5` (24 px) Mobile
- **Bearbeiten:** Klick auf einen Block öffnet Inline-Editor (kein Modal); Wochentag-Header bleibt sichtbar, Gerichts-Zeile wird zum Eingabefeld in Caveat

### 5.3 · Reihenfolge der Tage

Die Tafel zeigt die Tage **chronologisch ab heute**, nicht fix Mo–So. Auf der echten Tafel beginnt es mit dem aktuellen Tag und läuft bis zum entsprechenden Wochentag der Folgewoche oder bis das Brett voll ist. Für die Webseite:

- **Anzeige:** 7 Tage ab heute, jeder Tag mit Datum-Tag oben rechts klein (Inter, Opacity 0.4) optional
- Vergangene Wochen werden in der Historien-Ansicht auf Mo–So normalisiert

### 5.4 · Buttons

Zurückhaltend. Niemals knallig.

- **Primär:** Fläche `--c-ink`, Text `--c-chalk`, Padding `12 24`, kein Border-Radius über `4 px`
- **Sekundär:** transparent, Border `1 px solid var(--c-ink)`, Text `--c-ink`
- **Tertiär (Link-artig):** nur Text mit feiner Unterstreichung, Hover schiebt Unterstreichung um 2 px nach unten
- Schrift: Inter 500, 14–16 px

### 5.5 · Wochen-Navigation

Vor / Zurück / Heute als Tertiär-Buttons. Aktuelle Wochennummer mittig in Fraunces. Keine großen Pfeil-Icons; eher `‹  KW 18 · Mai 2026  ›`.

---

## 6 · Bewegung

- Übergänge nur dort, wo sie etwas erklären (Wochenwechsel, Eintrag öffnet sich).
- Dauer **220–360 ms**, Easing `cubic-bezier(0.2, 0.8, 0.2, 1)` (sanftes Out).
- Keine Bounce-, Flip- oder Scale-Effekte.
- Mikrointeraktion erlaubt: das Kreide-Wort „erscheint" beim Speichern leicht (Fade + 4 px Offset).

---

## 7 · Bildsprache & Texturen

- Hauptseite: **keine Fotos**. Die Tafel selbst ist das Bild.
- Wenn Texturen genutzt werden, dann **subtil** (max. 4 % Noise auf Tafelflächen).
- Icons: dünn, 1.25 px Strichstärke, Lucide- oder Phosphor-Stil — minimal.
- Keine Emojis im UI.

---

## 8 · Stilprinzipien (Checkliste vor Commit)

- [ ] Kein reines Schwarz, kein reines Weiß.
- [ ] Maximal eine Akzentfarbe sichtbar.
- [ ] Außerhalb der Tafel maximal **zwei** Schriftarten (Fraunces + Inter).
- [ ] Architects Daughter und Caveat **ausschließlich** auf der Tafel.
- [ ] Wochentage auf der Tafel: voll ausgeschrieben in Caps, mit Kreidelinie.
- [ ] Tafel ist Hochformat mit sichtbarem schwarzem Rahmen.
- [ ] Spacing aus der 4er-Skala.
- [ ] Keine Drop-Shadow-Glows, keine bunten Verläufe.
- [ ] Texte leise, präzise, deutsch — keine Marketing-Floskeln.

---

## 9 · CSS-Variablen (zum direkten Einsetzen)

```css
:root {
  /* Farben */
  --c-slate:    #1E2421;
  --c-frame:    #0F1110;
  --c-ink:      #1A1B1A;
  --c-chalk:    #EFE8DA;
  --c-linen:    #F5F1EA;
  --c-paper:    #FAF7F1;
  --c-oak:      #C9A574;
  --c-walnut:   #6E4A2D;
  --c-sage:     #8B9D7E;
  --c-burgundy: #6B2E2E;

  /* Typografie */
  --f-display:    'Fraunces', 'Hoefler Text', Georgia, serif;
  --f-chalk-cap:  'Architects Daughter', 'Bradley Hand', cursive;
  --f-chalk:      'Caveat', 'Bradley Hand', cursive;
  --f-body:       'Inter', 'Helvetica Neue', system-ui, sans-serif;

  /* Spacing */
  --s-1:  4px;  --s-2:  8px;  --s-3: 12px;  --s-4: 16px;
  --s-5: 24px;  --s-6: 32px;  --s-7: 48px;  --s-8: 64px;
  --s-9: 96px;  --s-10: 128px;

  /* Tafel */
  --frame-width: 28px;
  --tafel-bg: radial-gradient(ellipse 120% 100% at 30% 25%,
              #262C29 0%, #1E2421 60%, #181D1B 100%);

  /* Sonstiges */
  --radius: 4px;
  --shadow-card: 0 18px 40px rgba(15, 17, 16, 0.18);
  --transition: 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

body {
  background: var(--c-linen);
  color: var(--c-ink);
  font-family: var(--f-body);
  font-size: 16px;
  line-height: 1.6;
}
```

Google-Fonts-Import:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Architects+Daughter&family=Caveat:wght@400;600&family=Inter:wght@400;500;600&display=swap">
```

---

Eine visuelle Zusammenfassung dieses Guides liegt unter `STYLEGUIDE.svg` (im Browser öffnen für die finale Schrift-Darstellung).
