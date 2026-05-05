import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createStorage } from './storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, '..', '..', 'public', 'assets', 'demo');

const DB_PATH    = process.env.DB_PATH    || './data/elle-eats.db';
const IMAGES_DIR = process.env.IMAGES_DIR || './data/images';

const recipes = [
  {
    title: 'Gegrillte Aubergine mit Mango',
    image: 'auberginemango.png',
    ingredients: '1 große Aubergine\n1 reife Mango\n1 rote Chili\n1 Limette\n2 EL Olivenöl\nSalz\nfrischer Koriander\n1 EL gerösteter Sesam',
    steps: 'Aubergine in 1 cm dicke Scheiben schneiden, leicht salzen, 10 Min. ziehen lassen, abtupfen.\nMit Olivenöl bestreichen und auf der heißen Grillpfanne von beiden Seiten dunkel grillen.\nMango würfeln, mit fein gehackter Chili, Limettensaft und einer Prise Salz mischen.\nAubergine anrichten, Mango-Salsa darüber, Koriander und Sesam drüber.',
    notes: 'Mit Naan oder Reis als Hauptgang, ohne Beilage als Vorspeise.',
  },
  {
    title: 'Ofen-Halloumi mit Fenchel',
    image: 'halumifenchel.png',
    ingredients: '1 große Knolle Fenchel\n250 g Halloumi\n1 Zitrone\n2 EL Olivenöl\n1 EL Honig\n1 TL Thymian\nschwarzer Pfeffer\nSalz',
    steps: 'Ofen auf 220 °C vorheizen.\nFenchel in dünne Spalten schneiden, mit Olivenöl, Salz und Thymian in einer Auflaufform vermengen, 15 Min. backen.\nHalloumi in Scheiben schneiden, auf den Fenchel legen, mit Honig beträufeln, weitere 10 Min. backen bis goldbraun.\nMit Zitronensaft und frisch gemahlenem Pfeffer servieren.',
    notes: 'Schmeckt warm wie kalt. Reste am nächsten Tag in den Salat.',
  },
  {
    title: 'Edamame Tacos',
    image: 'edamametacco.png',
    ingredients: '200 g Edamame, geschält\n6 kleine Maistortillas\n1 reife Avocado\n1 Limette\n2 EL Sojasoße\n1 TL Sriracha\n2 Frühlingszwiebeln\n1 EL Sesam\neingelegter Rotkohl',
    steps: 'Edamame kurz blanchieren, abschrecken.\nAvocado zerdrücken, mit Limettensaft und Salz abschmecken.\nTortillas in einer trockenen Pfanne anwärmen.\nAvocado aufstreichen, Edamame, Frühlingszwiebeln und Rotkohl drauf, mit Sojasoße und Sriracha beträufeln, Sesam drüber.',
    notes: 'Glutenfrei. Edamame am Vortag enthülsen spart Zeit.',
  },
  {
    title: 'Chili-Aubergine mit Reissalat',
    image: 'chilliaubergine.png',
    ingredients: '2 kleine Auberginen\n3 EL Sojasoße\n2 EL Reisessig\n1 EL brauner Zucker\n1 Knoblauchzehe\n1 daumengroßes Stück Ingwer\n1 rote Chili\n200 g Basmati\n1 Gurke\nfrische Minze\nÖl zum Braten',
    steps: 'Aubergine in dicke Stücke schneiden, in reichlich Öl scharf anbraten bis weich.\nSojasoße, Essig, Zucker, fein gehackten Knoblauch, Ingwer und Chili dazugeben, alles glasieren.\nReis kochen, abkühlen lassen, mit gewürfelter Gurke und Minze mischen.\nAubergine auf dem Reissalat anrichten.',
    notes: 'Aubergine braucht viel Öl — nicht sparen, sonst wird sie trocken.',
  },
  {
    title: 'Miso-Lachs mit Sesam-Pak-Choi',
    image: 'misolachs.png',
    ingredients: '2 Lachsfilets\n2 EL helles Miso\n1 EL Mirin\n1 EL Sojasoße\n1 TL Honig\n2 Pak Choi\n1 EL Sesamöl\n1 EL gerösteter Sesam',
    steps: 'Miso, Mirin, Sojasoße und Honig verrühren, Lachs 15 Min. darin marinieren.\nBei 200 °C 10–12 Min. backen, bis das Miso karamellisiert.\nPak Choi halbieren, in Sesamöl scharf anbraten, salzen.\nLachs auf Pak Choi anrichten, mit Sesam bestreuen.',
    notes: 'Miso brennt schnell an — die letzten 2 Min. nicht aus den Augen lassen.',
  },
  {
    title: 'Linsen-Dal mit Kokos und Koriander',
    image: 'linsendal.png',
    ingredients: '200 g rote Linsen\n1 Zwiebel\n2 Knoblauchzehen\n1 daumengroßes Stück Ingwer\n1 Dose Kokosmilch\n1 TL Kurkuma\n1 TL Garam Masala\n1 TL Kreuzkümmel\nfrischer Koriander\n1 Limette',
    steps: 'Zwiebel, Knoblauch und Ingwer fein hacken, in Öl andünsten, Gewürze kurz mitrösten.\nLinsen unterrühren, mit Kokosmilch und 300 ml Wasser auffüllen.\n20 Min. köcheln bis cremig, ggf. Wasser nachgießen.\nMit Salz und Limettensaft abschmecken, Koriander drüber.',
    notes: 'Mit Reis oder Naan. Hält 3 Tage im Kühlschrank, am zweiten Tag oft besser.',
  },
  {
    title: 'Burrata mit gerösteter Paprika und Basilikum',
    image: 'burrata.png',
    ingredients: '2 rote Paprika\n1 Burrata\n1 Knoblauchzehe\ngutes Olivenöl\nAceto Balsamico\n1 Bund Basilikum\n1 EL Pinienkerne\nSauerteigbrot',
    steps: 'Paprika ganz bei 220 °C 25 Min. im Ofen rösten, bis die Haut schwarz wird.\nIn einer Schüssel mit Deckel abkühlen lassen, Haut abziehen, in Streifen schneiden.\nMit gepresstem Knoblauch, Olivenöl und Salz marinieren.\nBurrata mittig anrichten, Paprika drumherum, Pinienkerne und Basilikum drüber, mit Balsamico beträufeln. Brot dazu.',
    notes: 'Burrata unbedingt zimmerwarm servieren — kalt schmeckt sie nach nichts.',
  },
  {
    title: 'Süßkartoffel-Curry mit Erdnuss',
    image: 'sueskartoffelcurry.png',
    ingredients: '600 g Süßkartoffel\n1 Zwiebel\n2 Knoblauchzehen\n1 EL rote Currypaste\n3 EL Erdnussbutter\n400 ml Kokosmilch\n1 Limette\n2 Hände voll Babyspinat\n2 EL geröstete Erdnüsse',
    steps: 'Süßkartoffel in Würfel schneiden.\nZwiebel und Knoblauch in Öl andünsten, Currypaste kurz anrösten, Erdnussbutter und Kokosmilch einrühren.\nSüßkartoffel dazugeben, 20 Min. köcheln, bis sie weich ist.\nSpinat unterheben, mit Limettensaft und Salz abschmecken, Erdnüsse drüber.',
    notes: 'Mit Jasminreis. Ein Schuss Sojasoße am Ende rundet ab.',
  },
  {
    title: 'Zucchini-Frittata mit Feta und Minze',
    image: 'zuchinifritatta.png',
    ingredients: '2 mittlere Zucchini\n6 Eier\n100 g Feta\n1 Bund Minze\n1 Zitrone\n2 EL Olivenöl\nSalz\nPfeffer',
    steps: 'Zucchini grob raspeln, salzen, 10 Min. ziehen lassen, ordentlich ausdrücken.\nEier mit Pfeffer verquirlen, Zucchini, zerbröselten Feta und gehackte Minze unterrühren.\nIn ofenfester Pfanne in Olivenöl 3 Min. anbraten, dann bei 180 °C 15 Min. fertig backen.\nMit Zitronenspalten servieren.',
    notes: 'Am nächsten Tag kalt aus der Hand fast besser als frisch.',
  },
  {
    title: 'Kichererbsen-Shakshuka',
    image: 'kichererbsenshakshuka.png',
    ingredients: '1 Dose Kichererbsen\n1 Dose stückige Tomaten\n1 Zwiebel\n2 Paprika\n2 Knoblauchzehen\n1 TL Kreuzkümmel\n1 TL Paprikapulver\nChiliflocken\n4 Eier\nPetersilie\nSauerteigbrot',
    steps: 'Zwiebel und Paprika in Öl in einer Pfanne weich dünsten.\nKnoblauch und Gewürze dazugeben, kurz mitrösten.\nTomaten und abgetropfte Kichererbsen einrühren, 10 Min. köcheln.\nMulden in die Sauce drücken, Eier hineinschlagen, mit Deckel 5–7 Min. garen, bis das Eiweiß stockt.\nMit Petersilie bestreuen, Brot dazu.',
    notes: 'Direkt aus der Pfanne essen — sieht aus wie im Restaurant.',
  },
];

const weekTitles = [
  'Linsen-Dal mit Kokos und Koriander',
  'Ofen-Halloumi mit Fenchel',
  'Edamame Tacos',
  'Chili-Aubergine mit Reissalat',
  'Miso-Lachs mit Sesam-Pak-Choi',
  'Gegrillte Aubergine mit Mango',
  'Burrata mit gerösteter Paprika und Basilikum',
];

function todayDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function weekKey(date) {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
function mondayOfWeek(wk) {
  const [yearStr, weekStr] = wk.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - jan4Day + 1);
  const target = new Date(week1Mon);
  target.setDate(week1Mon.getDate() + (week - 1) * 7);
  return target;
}

mkdirSync(IMAGES_DIR, { recursive: true });
const db = openDb(DB_PATH);
const storage = createStorage(db);

let recipesAdded = 0;
let imagesAdded = 0;
let dishesAdded = 0;

for (const r of recipes) {
  const existing = storage.findRecipeByTitle(r.title);
  let slug;
  if (existing) {
    slug = existing.slug;
  } else {
    const result = storage.saveRecipe(null, {
      title: r.title,
      ingredients: r.ingredients,
      steps: r.steps,
      notes: r.notes,
    });
    if (result.error) {
      console.warn(`Skip "${r.title}": ${result.error}`);
      continue;
    }
    slug = result.slug;
    recipesAdded++;
  }

  if (!r.image) continue;
  const recipe = storage.getRecipe(slug);
  if (recipe.images.length > 0) continue;

  try {
    const buf = await readFile(join(DEMO_DIR, r.image));
    const hash = createHash('sha256').update(buf).digest('hex');
    const ext = extname(r.image).toLowerCase();
    const filename = hash + ext;
    const dest = join(IMAGES_DIR, filename);
    const exists = await access(dest).then(() => true, () => false);
    if (!exists) await writeFile(dest, buf);
    const result = storage.addImage(slug, filename);
    if (result.ok) imagesAdded++;
  } catch (err) {
    console.warn(`Bild für "${r.title}" konnte nicht geladen werden: ${err.message}`);
  }
}

const wk = weekKey(todayDate());
const existingWeek = storage.loadWeek(wk);
if (Object.keys(existingWeek).length === 0) {
  const monday = mondayOfWeek(wk);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    storage.setDish(wk, isoDate(d), weekTitles[i]);
    dishesAdded++;
  }
}

console.log('Seed fertig.');
console.log(`  Rezepte: +${recipesAdded}`);
console.log(`  Bilder:  +${imagesAdded}`);
console.log(`  Tage:    +${dishesAdded}`);
db.close();
