'use strict';

/* =============================================================
 *  Storage — dual-mode: API (Server) oder Demo (localStorage).
 *  Modus wird beim Start ermittelt: /healthz erreichbar => api.
 *  loadWeek/saveRecipe/etc. sind in beiden Modi async.
 * ============================================================= */
const STORAGE_KEY = 'elle-eats:v1';
const BULLET = '• ';

function slugify(title) {
  return (title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function imageSrc(s) {
  if (!s) return '';
  if (s.startsWith('data:') || s.startsWith('assets/') || s.startsWith('/')) return s;
  return '/images/' + s;
}

async function apiGet(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    const err = new Error('http ' + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function apiSend(method, path, body, asForm = false) {
  const opts = { method, credentials: 'same-origin' };
  if (asForm) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = new Error('http ' + res.status);
    err.status = res.status;
    try { err.body = await res.json(); } catch { err.body = null; }
    throw err;
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

const Storage = {
  mode: 'demo',
  email: null,
  serverAvailable: false,

  async init() {
    try {
      const res = await fetch('/healthz', { cache: 'no-store' });
      if (res.ok) {
        this.mode = 'api';
        this.serverAvailable = true;
      }
    } catch { /* offline / kein Server -> demo */ }

    if (this.mode === 'api') {
      try {
        const me = await apiGet('/api/me');
        this.email = me?.email || null;
      } catch { this.email = null; }
    }
  },

  isApi()      { return this.mode === 'api'; },
  isLoggedIn() { return this.email !== null; },
  canEdit()    { return this.mode === 'demo' || this.isLoggedIn(); },

  /* ---- localStorage-Helfer (Demo) ---- */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      const safe = (data && typeof data === 'object') ? data : {};
      if (!safe.weeks) safe.weeks = {};
      if (!safe.recipes) safe.recipes = {};
      return safe;
    } catch {
      return { weeks: {}, recipes: {} };
    }
  },
  _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  migrateImagePaths() {
    if (this.isApi()) return;
    const data = this._load();
    let changed = false;
    const rewrite = (src) => {
      if (typeof src !== 'string') return src;
      if (src.startsWith('assets/images/')) {
        changed = true;
        return 'assets/demo/' + src.slice('assets/images/'.length);
      }
      if (src.startsWith('images/')) {
        changed = true;
        return 'assets/demo/' + src.slice('images/'.length);
      }
      return src;
    };
    for (const slug of Object.keys(data.recipes)) {
      const r = data.recipes[slug];
      if (!Array.isArray(r.images)) continue;
      r.images = r.images.map(rewrite);
    }
    if (changed) this._save(data);
  },

  /* ---- Wochen ---- */
  async loadWeek(weekKey) {
    if (this.isApi()) {
      try { return await apiGet('/api/weeks/' + encodeURIComponent(weekKey)); }
      catch { return {}; }
    }
    return { ...(this._load().weeks[weekKey] || {}) };
  },

  async setDish(weekKey, isoDate, name) {
    if (this.isApi()) {
      const trimmed = (name || '').trim();
      const url = '/api/weeks/' + encodeURIComponent(weekKey) + '/' + encodeURIComponent(isoDate);
      if (trimmed) await apiSend('PUT', url, { name: trimmed });
      else await apiSend('DELETE', url);
      return;
    }
    const data = this._load();
    if (!data.weeks[weekKey]) data.weeks[weekKey] = {};
    const trimmed = (name || '').trim();
    if (trimmed) {
      data.weeks[weekKey][isoDate] = trimmed;
    } else {
      delete data.weeks[weekKey][isoDate];
      if (Object.keys(data.weeks[weekKey]).length === 0) delete data.weeks[weekKey];
    }
    this._save(data);
  },

  async removeDish(weekKey, isoDate) {
    return this.setDish(weekKey, isoDate, '');
  },

  async saveWeek(weekKey, dayMap) {
    if (this.isApi()) {
      for (const [iso, name] of Object.entries(dayMap)) {
        await this.setDish(weekKey, iso, name);
      }
      return;
    }
    const data = this._load();
    data.weeks[weekKey] = dayMap;
    this._save(data);
  },

  /* ---- Rezepte ---- */
  async loadRecipes() {
    if (this.isApi()) {
      try { return await apiGet('/api/recipes'); }
      catch { return {}; }
    }
    return { ...this._load().recipes };
  },

  async getRecipe(slug) {
    if (!slug) return null;
    if (this.isApi()) {
      try { return await apiGet('/api/recipes/' + encodeURIComponent(slug)); }
      catch { return null; }
    }
    const r = this._load().recipes[slug];
    return r ? { slug, ...r } : null;
  },

  async findRecipeByTitle(title) {
    return this.getRecipe(slugify(title));
  },

  async saveRecipe(prevSlug, recipe) {
    if (this.isApi()) {
      try {
        if (prevSlug) {
          return await apiSend('PUT', '/api/recipes/' + encodeURIComponent(prevSlug), recipe);
        }
        return await apiSend('POST', '/api/recipes', recipe);
      } catch (err) {
        if (err.status === 409) return { error: 'collision' };
        if (err.status === 400) return { error: 'empty-title' };
        if (err.status === 401) return { error: 'auth' };
        throw err;
      }
    }
    /* --- demo --- */
    const data = this._load();
    const newTitle = (recipe.title || '').trim();
    if (!newTitle) return { error: 'empty-title' };
    const newSlug = slugify(newTitle);

    if (newSlug !== prevSlug && data.recipes[newSlug]) {
      return { error: 'collision' };
    }

    const carryImages = (prevSlug && data.recipes[prevSlug]?.images)
      || data.recipes[newSlug]?.images
      || [];

    if (prevSlug && prevSlug !== newSlug) {
      delete data.recipes[prevSlug];
      for (const wk of Object.keys(data.weeks)) {
        for (const iso of Object.keys(data.weeks[wk])) {
          if (slugify(data.weeks[wk][iso]) === prevSlug) {
            data.weeks[wk][iso] = newTitle;
          }
        }
      }
    }

    data.recipes[newSlug] = {
      title: newTitle,
      ingredients: recipe.ingredients || '',
      steps: recipe.steps || '',
      notes: recipe.notes || '',
      images: carryImages,
      updatedAt: new Date().toISOString(),
    };
    this._save(data);
    return { slug: newSlug };
  },

  async deleteRecipe(slug) {
    if (this.isApi()) {
      try { await apiSend('DELETE', '/api/recipes/' + encodeURIComponent(slug)); }
      catch { /* swallow */ }
      return;
    }
    const data = this._load();
    if (data.recipes[slug]) {
      delete data.recipes[slug];
      this._save(data);
    }
  },

  /* ---- Bilder ---- */
  async addRecipeImage(slug, blobOrDataUrl) {
    if (this.isApi()) {
      const blob = blobOrDataUrl instanceof Blob
        ? blobOrDataUrl
        : await dataUrlToBlob(blobOrDataUrl);
      const form = new FormData();
      form.append('image', blob, 'image.jpg');
      try {
        await apiSend('POST', '/api/recipes/' + encodeURIComponent(slug) + '/images', form, true);
        return { ok: true };
      } catch (err) {
        if (err.status === 401) return { error: 'auth' };
        if (err.status === 404) return { error: 'not-found' };
        return { error: 'upload' };
      }
    }
    /* --- demo --- */
    const dataUrl = blobOrDataUrl instanceof Blob
      ? await blobToDataUrl(blobOrDataUrl)
      : blobOrDataUrl;
    const data = this._load();
    const r = data.recipes[slug];
    if (!r) return { error: 'not-found' };
    if (!Array.isArray(r.images)) r.images = [];
    r.images.push(dataUrl);
    r.updatedAt = new Date().toISOString();
    try {
      this._save(data);
      return { ok: true };
    } catch {
      r.images.pop();
      return { error: 'quota' };
    }
  },

  async removeRecipeImage(slug, index) {
    if (this.isApi()) {
      try { await apiSend('DELETE', '/api/recipes/' + encodeURIComponent(slug) + '/images/' + index); }
      catch { /* swallow */ }
      return;
    }
    const data = this._load();
    const r = data.recipes[slug];
    if (!r || !Array.isArray(r.images)) return;
    r.images.splice(index, 1);
    r.updatedAt = new Date().toISOString();
    this._save(data);
  },

  async recipeUsageCount(slug) {
    if (this.isApi()) {
      try {
        const data = await apiGet('/api/recipes/' + encodeURIComponent(slug) + '/usage');
        return data.count || 0;
      } catch { return 0; }
    }
    const data = this._load();
    let n = 0;
    for (const wk of Object.values(data.weeks)) {
      for (const v of Object.values(wk)) {
        if (slugify(v) === slug) n++;
      }
    }
    return n;
  },

  async listSuggestions() {
    if (this.isApi()) {
      try { return await apiGet('/api/suggestions'); }
      catch { return []; }
    }
    /* --- demo --- */
    const data = this._load();
    const lastUse = new Map();
    for (const week of Object.values(data.weeks)) {
      for (const [iso, name] of Object.entries(week)) {
        if (!name) continue;
        const s = slugify(name);
        const prev = lastUse.get(s);
        if (!prev || iso > prev.iso) lastUse.set(s, { iso, name });
      }
    }
    const entries = [];
    for (const [slug, recipe] of Object.entries(data.recipes)) {
      const use = lastUse.get(slug);
      entries.push({ slug, title: recipe.title, isRecipe: true, lastIso: use ? use.iso : '' });
    }
    const recipeSlugs = new Set(Object.keys(data.recipes));
    for (const [slug, use] of lastUse.entries()) {
      if (recipeSlugs.has(slug)) continue;
      entries.push({ slug, title: use.name, isRecipe: false, lastIso: use.iso });
    }
    entries.sort((a, b) => {
      if (a.lastIso && b.lastIso) return b.lastIso.localeCompare(a.lastIso);
      if (a.lastIso) return -1;
      if (b.lastIso) return 1;
      return a.title.localeCompare(b.title, 'de');
    });
    return entries;
  },
};

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/* =============================================================
 *  Datums-Helfer (ISO-Wochen, Mo als Wochenstart)
 * ============================================================= */
const WEEKDAYS_LONG  = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const MONTHS_LONG    = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_SHORT   = ['Jan','Feb','März','Apr','Mai','Juni','Juli','Aug','Sep','Okt','Nov','Dez'];

const Dates = {
  today() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },

  isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  fromIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
  },

  weekKey(date) {
    const { year, week } = this.isoWeek(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
  },

  mondayOfWeek(weekKey) {
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const week1Mon = new Date(jan4);
    week1Mon.setDate(jan4.getDate() - jan4Day + 1);
    const target = new Date(week1Mon);
    target.setDate(week1Mon.getDate() + (week - 1) * 7);
    return target;
  },

  weekDays(weekKey) {
    const monday = this.mondayOfWeek(weekKey);
    return WEEKDAYS_LONG.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: d, iso: this.isoDate(d), weekday: name };
    });
  },

  formatWeekLabel(weekKey) {
    const monday = this.mondayOfWeek(weekKey);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const week = parseInt(weekKey.split('-W')[1], 10);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    const label = sameMonth
      ? `${MONTHS_LONG[monday.getMonth()]} ${sunday.getFullYear()}`
      : `${MONTHS_SHORT[monday.getMonth()]} / ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getFullYear()}`;
    return `KW ${week} · ${label}`;
  },

  formatDayLabel(iso) {
    const d = this.fromIso(iso);
    const wd = WEEKDAYS_LONG[(d.getDay() + 6) % 7];
    return `${wd} · ${d.getDate()}. ${MONTHS_LONG[d.getMonth()]}`;
  },

  shiftWeek(weekKey, delta) {
    const monday = this.mondayOfWeek(weekKey);
    monday.setDate(monday.getDate() + delta * 7);
    return this.weekKey(monday);
  },
};

/* =============================================================
 *  State + Helpers
 * ============================================================= */
const State = {
  currentWeekKey: null,
  todayIso: null,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function recipeHash(slug) {
  return `#/rezept/${encodeURIComponent(slug)}`;
}

function resizeImage(file, maxSize = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}

function reloadAfter(promise) {
  return promise.then(() => location.reload(), () => location.reload());
}

/* =============================================================
 *  Auth-UI
 * ============================================================= */
const Auth = {
  render() {
    const el = document.getElementById('authStatus');
    if (!el) return;
    if (!Storage.serverAvailable) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const icon = `
      <svg class="auth-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="9" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5.5 19.2c1.4-3 4-4.4 6.5-4.4s5.1 1.4 6.5 4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
    if (Storage.isLoggedIn()) {
      el.innerHTML = `
        <button type="button" class="auth-btn is-active" id="logoutBtn" aria-label="Abmelden" title="Abmelden (${escapeHtml(Storage.email)})">
          ${icon}<span class="auth-dot" aria-hidden="true"></span>
        </button>`;
      document.getElementById('logoutBtn').addEventListener('click', () => Auth.confirmLogout());
    } else {
      el.innerHTML = `<a href="/auth/google" class="auth-btn" aria-label="Anmelden" title="Anmelden">${icon}</a>`;
    }
  },

  confirmLogout() {
    const dialog = document.getElementById('logoutConfirm');
    if (!dialog) { Auth.logout(); return; }
    const cancel = document.getElementById('logoutCancelBtn');
    const confirm = document.getElementById('logoutConfirmBtn');
    const onCancel = () => dialog.close();
    const onConfirm = () => { dialog.close(); Auth.logout(); };
    cancel.addEventListener('click', onCancel, { once: true });
    confirm.addEventListener('click', onConfirm, { once: true });
    dialog.addEventListener('close', () => {
      cancel.removeEventListener('click', onCancel);
      confirm.removeEventListener('click', onConfirm);
    }, { once: true });
    dialog.showModal();
  },

  async logout() {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
    finally { location.reload(); }
  },

  showAuthErrorFromUrl() {
    const params = new URLSearchParams(location.search);
    const code = params.get('auth_error');
    if (!code) return;

    params.delete('auth_error');
    const cleaned = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', cleaned);

    const dialog = document.getElementById('authErrorDialog');
    if (!dialog) return;

    const messages = {
      'not-allowed': 'Diese E-Mail-Adresse ist nicht freigeschaltet.',
      'state':       'Die Anmeldung ist abgelaufen. Bitte erneut versuchen.',
      'failed':      'Die Anmeldung bei Google ist fehlgeschlagen. Bitte erneut versuchen.',
    };
    document.getElementById('authErrorText').textContent = messages[code] || 'Anmeldung fehlgeschlagen.';

    const ok = document.getElementById('authErrorOkBtn');
    const onOk = () => dialog.close();
    ok.addEventListener('click', onOk, { once: true });
    dialog.addEventListener('close', () => {
      ok.removeEventListener('click', onOk);
    }, { once: true });
    dialog.showModal();
  },
};

/* =============================================================
 *  Board — Wochenansicht (Tafel)
 * ============================================================= */
const Board = {
  async render() {
    document.getElementById('weekLabel').textContent = Dates.formatWeekLabel(State.currentWeekKey);

    const todayWeek = Dates.weekKey(Dates.today());
    document.getElementById('todayBtn').classList.toggle('hidden', State.currentWeekKey === todayWeek);

    const dayMap = await Storage.loadWeek(State.currentWeekKey);
    const days = Dates.weekDays(State.currentWeekKey);
    const ol = document.getElementById('days');
    ol.innerHTML = '';

    for (const day of days) {
      const li = document.createElement('li');
      li.className = 'day';
      li.dataset.iso = day.iso;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');

      const dish = dayMap[day.iso] || '';
      const isToday = day.iso === State.todayIso;
      const dot = isToday ? '<span class="today-dot" aria-hidden="true"></span>' : '';
      const ariaLabel = dish
        ? (Storage.canEdit() ? `${day.weekday}, ${dish} — bearbeiten` : `${day.weekday}, ${dish}`)
        : (Storage.canEdit() ? `${day.weekday}, leer — Gericht eintragen` : `${day.weekday}, leer`);
      li.setAttribute('aria-label', ariaLabel);

      li.innerHTML = `
        <h2 class="weekday">${dot}${day.weekday.toUpperCase()}</h2>
        <p class="dish">${escapeHtml(dish)}</p>
      `;
      ol.appendChild(li);
    }
  },
};

/* =============================================================
 *  Recipes — Liste & Detail
 * ============================================================= */
const Recipes = {
  currentSlug: null,
  origin: 'list',
  _saveTimer: null,

  initDetailListeners() {
    // Bullet-Verhalten für Zutaten muss vor dem generischen Save-Handler laufen,
    // damit der beim Blur normalisierte Wert gespeichert wird.
    const ingrEl = document.getElementById('recipeIngredients');
    ingrEl.addEventListener('focus', () => this.handleIngredientsFocus());
    ingrEl.addEventListener('keydown', (e) => this.handleIngredientsKeydown(e));
    ingrEl.addEventListener('blur', () => this.normalizeIngredientsField());
    ingrEl.addEventListener('paste', (e) => this.handleIngredientsPaste(e));

    const ids = ['recipeTitle', 'recipeIngredients', 'recipeSteps', 'recipeNotes'];
    for (const id of ids) {
      const el = document.getElementById(id);
      el.addEventListener('blur', () => this.saveCurrent());
      el.addEventListener('input', () => this.scheduleSave());
    }

    for (const id of ['recipeIngredients', 'recipeSteps', 'recipeNotes']) {
      const el = document.getElementById(id);
      el.addEventListener('input', () => this.autosize(el));
    }
    window.addEventListener('resize', () => this.autosizeAll());

    const titleEl = document.getElementById('recipeTitle');
    titleEl.addEventListener('input', () => this.fitTitleSize());
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
    });
    window.addEventListener('resize', () => this.fitTitleSize());
    document.getElementById('recipeDeleteBtn').addEventListener('click', () => this.deleteCurrent());
    document.getElementById('recipeNewBtn').addEventListener('click', () => this.newRecipe());
    document.getElementById('recipeSearch').addEventListener('input', () => this.renderList());

    for (const id of ['recipeImageFile', 'recipeImageCamera']) {
      const el = document.getElementById(id);
      el.addEventListener('change', (e) => this.handleImagePick(e.target.files, e.target));
    }

    const lightbox = document.getElementById('imageLightbox');
    document.getElementById('lightboxClose').addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.close();
    });
  },

  async renderList() {
    const search = document.getElementById('recipeSearch').value.trim().toLowerCase();
    const recipes = await Storage.loadRecipes();
    const list = document.getElementById('recipeList');
    list.innerHTML = '';

    const items = Object.entries(recipes)
      .map(([slug, r]) => ({ slug, ...r }))
      .filter(r => !search || r.title.toLowerCase().includes(search))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'recipe-empty';
      li.textContent = search
        ? 'Keine Rezepte gefunden.'
        : (Storage.canEdit()
            ? 'Noch keine Rezepte. Lege eines über „+ Neu" an oder beim Eintragen eines Gerichts auf der Tafel.'
            : 'Noch keine Rezepte vorhanden.');
      list.appendChild(li);
      return;
    }

    for (const r of items) {
      const li = document.createElement('li');
      li.className = 'recipe-item';
      const a = document.createElement('a');
      a.href = recipeHash(r.slug);
      a.className = 'recipe-link';
      a.textContent = r.title;
      li.appendChild(a);
      list.appendChild(li);
    }
  },

  openList() {
    this.origin = 'list';
    document.getElementById('recipeSearch').value = '';
    this.renderList();
  },

  async openDetail(slug) {
    const recipe = await Storage.getRecipe(slug);
    if (!recipe) {
      location.hash = '#/rezepte';
      return;
    }
    this.currentSlug = slug;

    const editable = Storage.canEdit();
    const titleEl  = document.getElementById('recipeTitle');
    const ingrEl   = document.getElementById('recipeIngredients');
    const stepsEl  = document.getElementById('recipeSteps');
    const notesEl  = document.getElementById('recipeNotes');

    titleEl.value = recipe.title;
    ingrEl.value  = this.normalizeIngredientsText(recipe.ingredients || '');
    stepsEl.value = recipe.steps || '';
    notesEl.value = recipe.notes || '';

    for (const el of [titleEl, ingrEl, stepsEl, notesEl]) {
      el.readOnly = !editable;
    }

    this.renderImages(recipe);
    requestAnimationFrame(() => {
      this.fitTitleSize();
      this.autosizeAll();
    });

    const back = document.querySelector('.view-recipe .back-link');
    if (this.origin === 'board') {
      back.href = '#/';
      back.textContent = '‹ Wochenkarte';
    } else {
      back.href = '#/rezepte';
      back.textContent = '‹ Rezepte';
    }
  },

  fitTitleSize() {
    const el = document.getElementById('recipeTitle');
    const max = window.innerWidth >= 720 ? 44 : 32;
    const min = 18;
    const text = el.value || el.placeholder || '';

    let mirror = this._titleMirror;
    if (!mirror) {
      mirror = document.createElement('span');
      mirror.style.position = 'absolute';
      mirror.style.visibility = 'hidden';
      mirror.style.whiteSpace = 'pre';
      mirror.style.top = '-9999px';
      mirror.style.left = '0';
      document.body.appendChild(mirror);
      this._titleMirror = mirror;
    }
    const cs = getComputedStyle(el);
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontWeight = cs.fontWeight;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.textContent = text;

    const available = el.clientWidth || el.parentElement.clientWidth;
    let size = max;
    let fits = false;
    while (size >= min) {
      mirror.style.fontSize = size + 'px';
      if (mirror.offsetWidth <= available) { fits = true; break; }
      size -= 1;
    }
    el.style.fontSize = size + 'px';
    el.style.whiteSpace = fits ? 'nowrap' : 'normal';
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  },

  autosize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  },

  normalizeIngredientsText(text) {
    if (!text) return '';
    return text.split('\n').map(line => {
      if (line === '') return '';
      if (line.startsWith(BULLET)) return line;
      return BULLET + line.replace(/^[\s•\-–·*]+/, '');
    }).join('\n');
  },

  normalizeIngredientsField() {
    const el = document.getElementById('recipeIngredients');
    if (!Storage.canEdit()) return;
    const normalized = this.normalizeIngredientsText(el.value);
    if (normalized !== el.value) {
      el.value = normalized;
      this.autosize(el);
    }
  },

  handleIngredientsFocus() {
    if (!Storage.canEdit()) return;
    const el = document.getElementById('recipeIngredients');
    if (el.value === '') {
      el.value = BULLET;
      el.selectionStart = el.selectionEnd = BULLET.length;
    }
  },

  handleIngredientsKeydown(e) {
    if (!Storage.canEdit()) return;
    if (e.isComposing) return;
    const el = e.currentTarget;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      const insert = '\n' + BULLET;
      el.value = el.value.slice(0, start) + insert + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + insert.length;
      el.dispatchEvent(new Event('input'));
    } else if (e.key === 'Backspace') {
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      if (start !== end) return;
      const before = el.value.slice(0, start);
      const lineStart = before.lastIndexOf('\n') + 1;
      const linePrefix = before.slice(lineStart);
      if (linePrefix === BULLET) {
        e.preventDefault();
        const removeFrom = lineStart === 0 ? 0 : lineStart - 1;
        el.value = el.value.slice(0, removeFrom) + el.value.slice(start);
        el.selectionStart = el.selectionEnd = removeFrom;
        el.dispatchEvent(new Event('input'));
      }
    }
  },

  handleIngredientsPaste(e) {
    if (!Storage.canEdit()) return;
    const data = e.clipboardData && e.clipboardData.getData('text');
    if (!data || !data.includes('\n')) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    const lineStart = before.lastIndexOf('\n') + 1;
    const linePrefix = before.slice(lineStart);
    const atLineStart = linePrefix === '' || linePrefix === BULLET;
    const normalized = this.normalizeIngredientsText(data);
    const insert = atLineStart ? normalized : '\n' + normalized;
    el.value = before + insert + after;
    el.selectionStart = el.selectionEnd = (before + insert).length;
    el.dispatchEvent(new Event('input'));
  },

  autosizeAll() {
    for (const id of ['recipeIngredients', 'recipeSteps', 'recipeNotes']) {
      this.autosize(document.getElementById(id));
    }
  },

  scheduleSave() {
    if (!Storage.canEdit()) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveCurrent(), 600);
  },

  async saveCurrent() {
    clearTimeout(this._saveTimer);
    if (!Storage.canEdit() || !this.currentSlug) return;
    const old = await Storage.getRecipe(this.currentSlug);
    if (!old) return;

    const titleEl = document.getElementById('recipeTitle');
    const newTitle = titleEl.value.trim();

    if (!newTitle) {
      titleEl.value = old.title;
      return;
    }

    const recipe = {
      title: newTitle,
      ingredients: document.getElementById('recipeIngredients').value,
      steps: document.getElementById('recipeSteps').value,
      notes: document.getElementById('recipeNotes').value,
    };
    const result = await Storage.saveRecipe(this.currentSlug, recipe);
    if (result.error === 'collision') {
      alert('Es gibt bereits ein Rezept mit diesem Titel.');
      titleEl.value = old.title;
      return;
    }
    if (result.error === 'auth') {
      alert('Sitzung abgelaufen. Bitte erneut anmelden.');
      location.reload();
      return;
    }
    if (result.slug && result.slug !== this.currentSlug) {
      this.currentSlug = result.slug;
      history.replaceState(null, '', recipeHash(result.slug));
    }
  },

  async newRecipe() {
    if (!Storage.canEdit()) return;
    const title = (prompt('Titel für neues Rezept') || '').trim();
    if (!title) return;
    if (await Storage.findRecipeByTitle(title)) {
      alert('Ein Rezept mit diesem Titel existiert bereits.');
      return;
    }
    const result = await Storage.saveRecipe(null, { title, ingredients: '', steps: '', notes: '' });
    if (result.error) {
      alert(result.error === 'auth' ? 'Bitte anmelden.' : 'Konnte nicht angelegt werden.');
      return;
    }
    if (result.slug) location.hash = recipeHash(result.slug);
  },

  async deleteCurrent() {
    if (!Storage.canEdit() || !this.currentSlug) return;
    const used = await Storage.recipeUsageCount(this.currentSlug);
    const recipe = await Storage.getRecipe(this.currentSlug);
    const name = recipe ? recipe.title : 'dieses Rezept';
    const msg = used > 0
      ? `„${name}" ist in ${used} Tag${used === 1 ? '' : 'en'} eingetragen. Trotzdem löschen?`
      : `„${name}" wirklich löschen?`;
    if (!confirm(msg)) return;
    await Storage.deleteRecipe(this.currentSlug);
    this.currentSlug = null;
    location.hash = '#/rezepte';
  },

  async renderImages(recipe) {
    const ul = document.getElementById('recipeImages');
    ul.innerHTML = '';
    if (!recipe && this.currentSlug) recipe = await Storage.getRecipe(this.currentSlug);
    const images = (recipe && Array.isArray(recipe.images)) ? recipe.images : [];
    const editable = Storage.canEdit();

    images.forEach((src, idx) => {
      const li = document.createElement('li');
      li.className = 'image-thumb';

      const img = document.createElement('img');
      img.src = imageSrc(src);
      img.alt = `Bild ${idx + 1}`;
      img.addEventListener('click', () => this.openLightbox(imageSrc(src)));

      li.appendChild(img);

      if (editable) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'image-delete';
        del.setAttribute('aria-label', 'Bild entfernen');
        del.innerHTML = '&times;';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Bild entfernen?')) this.removeImage(idx);
        });
        li.appendChild(del);
      }

      ul.appendChild(li);
    });

    if (editable) {
      ul.appendChild(this._addTile('pick', 'Bild auswählen',
        '<rect x="3" y="5" width="18" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8.5" cy="10" r="1.4" fill="currentColor"/><path d="M3.5 17l5-5 4 4 3-3 5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'));
      ul.appendChild(this._addTile('camera', 'Foto aufnehmen',
        '<path d="M4 8h3.2l1.4-2h6.8l1.4 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/>'));
    }
  },

  _addTile(kind, label, svgInner) {
    const li = document.createElement('li');
    li.className = 'image-add';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-add-btn';
    btn.setAttribute('aria-label', label);
    btn.innerHTML = `
      <svg class="image-add-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${svgInner}</svg>
      <span class="image-add-label">${label}</span>
    `;
    btn.addEventListener('click', () => {
      const inputId = kind === 'camera' ? 'recipeImageCamera' : 'recipeImageFile';
      document.getElementById(inputId).click();
    });
    li.appendChild(btn);
    return li;
  },

  async handleImagePick(files, inputEl) {
    if (!Storage.canEdit() || !this.currentSlug || !files || files.length === 0) return;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const blob = await resizeImage(file);
        const result = await Storage.addRecipeImage(this.currentSlug, blob);
        if (result.error === 'quota') {
          alert('Speicher voll. Bitte ein anderes Bild entfernen, bevor neue hinzukommen.');
          break;
        }
        if (result.error === 'auth') {
          alert('Sitzung abgelaufen. Bitte erneut anmelden.');
          location.reload();
          return;
        }
        if (result.error) {
          alert('Bild konnte nicht hochgeladen werden.');
          break;
        }
      } catch (err) {
        console.error(err);
        alert('Ein Bild konnte nicht verarbeitet werden.');
      }
    }
    if (inputEl) inputEl.value = '';
    this.renderImages();
  },

  async removeImage(index) {
    if (!Storage.canEdit() || !this.currentSlug) return;
    await Storage.removeRecipeImage(this.currentSlug, index);
    this.renderImages();
  },

  openLightbox(src) {
    const dlg = document.getElementById('imageLightbox');
    document.getElementById('lightboxImage').src = src;
    dlg.showModal();
  },
};

/* =============================================================
 *  Sheet — Editor für einen Tag
 * ============================================================= */
const Sheet = {
  dialog: null,
  input: null,
  list: null,
  action: null,
  deleteBtn: null,
  currentIso: null,

  init() {
    this.dialog    = document.getElementById('dishSheet');
    this.input     = document.getElementById('dishInput');
    this.list      = document.getElementById('suggestionList');
    this.action    = document.getElementById('dishAction');
    this.deleteBtn = document.getElementById('deleteBtn');

    document.getElementById('sheetClose').addEventListener('click', () => this.close());
    document.getElementById('sheetForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
    this.deleteBtn.addEventListener('click', () => this.removeEntry());
    this.input.addEventListener('input', () => {
      this.renderSuggestions();
      this.renderAction();
    });
    this.action.addEventListener('click', (e) => this.handleAction(e));

    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close();
    });
  },

  async open(iso) {
    if (!Storage.canEdit()) return;
    this.currentIso = iso;
    document.getElementById('sheetDay').textContent = Dates.formatDayLabel(iso);
    const week = await Storage.loadWeek(State.currentWeekKey);
    const current = week[iso] || '';
    this.input.value = current;
    this.deleteBtn.classList.toggle('hidden', !current);
    await this.renderSuggestions();
    await this.renderAction();
    this.dialog.showModal();
    setTimeout(() => this.input.focus(), 60);
  },

  close() {
    if (this.dialog.open) this.dialog.close();
  },

  async save() {
    await Storage.setDish(State.currentWeekKey, this.currentIso, this.input.value);
    this.close();
    Board.render();
  },

  async removeEntry() {
    await Storage.removeDish(State.currentWeekKey, this.currentIso);
    this.close();
    Board.render();
  },

  async renderAction() {
    const text = this.input.value.trim();
    if (!text) { this.action.innerHTML = ''; return; }
    const recipe = await Storage.findRecipeByTitle(text);
    if (recipe) {
      this.action.innerHTML =
        `<button type="button" class="btn-link" data-action="open">→ Rezept öffnen</button>`;
    } else {
      this.action.innerHTML =
        `<button type="button" class="btn-link" data-action="create">+ Rezept zu „${escapeHtml(text)}" anlegen</button>`;
    }
  },

  async handleAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const text = this.input.value.trim();
    if (!text) return;

    await Storage.setDish(State.currentWeekKey, this.currentIso, text);

    if (btn.dataset.action === 'create') {
      const result = await Storage.saveRecipe(null, { title: text, ingredients: '', steps: '', notes: '' });
      if (result.error) return;
    }

    this.close();
    Board.render();
    Recipes.origin = 'board';
    location.hash = recipeHash(slugify(text));
  },

  async renderSuggestions() {
    const all = await Storage.listSuggestions();
    const q = this.input.value.trim().toLowerCase();

    const filtered = all
      .filter(s => {
        const lower = s.title.toLowerCase();
        if (lower === q) return false;
        return q === '' || lower.includes(q);
      })
      .slice(0, 12);

    this.list.innerHTML = '';

    if (filtered.length === 0) {
      const li = document.createElement('li');
      li.className = 'suggestion-empty';
      li.textContent = all.length === 0
        ? 'Noch keine Vorschläge. Schreib oben eins auf.'
        : (q ? 'Keine Treffer.' : 'Schon eingetragen.');
      this.list.appendChild(li);
      return;
    }

    for (const s of filtered) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion';
      btn.textContent = s.title;
      btn.addEventListener('click', () => {
        this.input.value = s.title;
        this.deleteBtn.classList.remove('hidden');
        this.renderSuggestions();
        this.renderAction();
        this.input.focus();
      });
      li.appendChild(btn);
      this.list.appendChild(li);
    }
  },
};

/* =============================================================
 *  Router — Hash-basiert
 * ============================================================= */
const Router = {
  init() {
    window.addEventListener('hashchange', () => this.handle());
    this.handle();
  },

  async handle() {
    const hash = location.hash || '#/';

    const m = hash.match(/^#\/rezept\/(.+)$/);
    if (m) {
      const slug = decodeURIComponent(m[1]);
      this.show('recipe');
      await Recipes.openDetail(slug);
      return;
    }
    if (hash === '#/rezepte') {
      this.show('recipes');
      Recipes.openList();
      return;
    }

    this.show('board');
    await Board.render();
  },

  show(name) {
    document.body.dataset.section = name;
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('hidden', v.dataset.view !== name);
    });
  },
};

/* =============================================================
 *  Seed — Dummy-Daten beim ersten Start im Demo-Modus
 * ============================================================= */
const Seed = {
  recipes: [
    {
      title: 'Gegrillte Aubergine mit Mango',
      image: 'assets/demo/auberginemango.png',
      ingredients: '1 große Aubergine\n1 reife Mango\n1 rote Chili\n1 Limette\n2 EL Olivenöl\nSalz\nfrischer Koriander\n1 EL gerösteter Sesam',
      steps: 'Aubergine in 1 cm dicke Scheiben schneiden, leicht salzen, 10 Min. ziehen lassen, abtupfen.\nMit Olivenöl bestreichen und auf der heißen Grillpfanne von beiden Seiten dunkel grillen.\nMango würfeln, mit fein gehackter Chili, Limettensaft und einer Prise Salz mischen.\nAubergine anrichten, Mango-Salsa darüber, Koriander und Sesam drüber.',
      notes: 'Mit Naan oder Reis als Hauptgang, ohne Beilage als Vorspeise.',
    },
    {
      title: 'Ofen-Halloumi mit Fenchel',
      image: 'assets/demo/halumifenchel.png',
      ingredients: '1 große Knolle Fenchel\n250 g Halloumi\n1 Zitrone\n2 EL Olivenöl\n1 EL Honig\n1 TL Thymian\nschwarzer Pfeffer\nSalz',
      steps: 'Ofen auf 220 °C vorheizen.\nFenchel in dünne Spalten schneiden, mit Olivenöl, Salz und Thymian in einer Auflaufform vermengen, 15 Min. backen.\nHalloumi in Scheiben schneiden, auf den Fenchel legen, mit Honig beträufeln, weitere 10 Min. backen bis goldbraun.\nMit Zitronensaft und frisch gemahlenem Pfeffer servieren.',
      notes: 'Schmeckt warm wie kalt. Reste am nächsten Tag in den Salat.',
    },
    {
      title: 'Edamame Tacos',
      image: 'assets/demo/edamametacco.png',
      ingredients: '200 g Edamame, geschält\n6 kleine Maistortillas\n1 reife Avocado\n1 Limette\n2 EL Sojasoße\n1 TL Sriracha\n2 Frühlingszwiebeln\n1 EL Sesam\neingelegter Rotkohl',
      steps: 'Edamame kurz blanchieren, abschrecken.\nAvocado zerdrücken, mit Limettensaft und Salz abschmecken.\nTortillas in einer trockenen Pfanne anwärmen.\nAvocado aufstreichen, Edamame, Frühlingszwiebeln und Rotkohl drauf, mit Sojasoße und Sriracha beträufeln, Sesam drüber.',
      notes: 'Glutenfrei. Edamame am Vortag enthülsen spart Zeit.',
    },
    {
      title: 'Chili-Aubergine mit Reissalat',
      image: 'assets/demo/chilliaubergine.png',
      ingredients: '2 kleine Auberginen\n3 EL Sojasoße\n2 EL Reisessig\n1 EL brauner Zucker\n1 Knoblauchzehe\n1 daumengroßes Stück Ingwer\n1 rote Chili\n200 g Basmati\n1 Gurke\nfrische Minze\nÖl zum Braten',
      steps: 'Aubergine in dicke Stücke schneiden, in reichlich Öl scharf anbraten bis weich.\nSojasoße, Essig, Zucker, fein gehackten Knoblauch, Ingwer und Chili dazugeben, alles glasieren.\nReis kochen, abkühlen lassen, mit gewürfelter Gurke und Minze mischen.\nAubergine auf dem Reissalat anrichten.',
      notes: 'Aubergine braucht viel Öl — nicht sparen, sonst wird sie trocken.',
    },
    {
      title: 'Miso-Lachs mit Sesam-Pak-Choi',
      image: 'assets/demo/misolachs.png',
      ingredients: '2 Lachsfilets\n2 EL helles Miso\n1 EL Mirin\n1 EL Sojasoße\n1 TL Honig\n2 Pak Choi\n1 EL Sesamöl\n1 EL gerösteter Sesam',
      steps: 'Miso, Mirin, Sojasoße und Honig verrühren, Lachs 15 Min. darin marinieren.\nBei 200 °C 10–12 Min. backen, bis das Miso karamellisiert.\nPak Choi halbieren, in Sesamöl scharf anbraten, salzen.\nLachs auf Pak Choi anrichten, mit Sesam bestreuen.',
      notes: 'Miso brennt schnell an — die letzten 2 Min. nicht aus den Augen lassen.',
    },
    {
      title: 'Linsen-Dal mit Kokos und Koriander',
      image: 'assets/demo/linsendal.png',
      ingredients: '200 g rote Linsen\n1 Zwiebel\n2 Knoblauchzehen\n1 daumengroßes Stück Ingwer\n1 Dose Kokosmilch\n1 TL Kurkuma\n1 TL Garam Masala\n1 TL Kreuzkümmel\nfrischer Koriander\n1 Limette',
      steps: 'Zwiebel, Knoblauch und Ingwer fein hacken, in Öl andünsten, Gewürze kurz mitrösten.\nLinsen unterrühren, mit Kokosmilch und 300 ml Wasser auffüllen.\n20 Min. köcheln bis cremig, ggf. Wasser nachgießen.\nMit Salz und Limettensaft abschmecken, Koriander drüber.',
      notes: 'Mit Reis oder Naan. Hält 3 Tage im Kühlschrank, am zweiten Tag oft besser.',
    },
    {
      title: 'Burrata mit gerösteter Paprika und Basilikum',
      image: 'assets/demo/burrata.png',
      ingredients: '2 rote Paprika\n1 Burrata\n1 Knoblauchzehe\ngutes Olivenöl\nAceto Balsamico\n1 Bund Basilikum\n1 EL Pinienkerne\nSauerteigbrot',
      steps: 'Paprika ganz bei 220 °C 25 Min. im Ofen rösten, bis die Haut schwarz wird.\nIn einer Schüssel mit Deckel abkühlen lassen, Haut abziehen, in Streifen schneiden.\nMit gepresstem Knoblauch, Olivenöl und Salz marinieren.\nBurrata mittig anrichten, Paprika drumherum, Pinienkerne und Basilikum drüber, mit Balsamico beträufeln. Brot dazu.',
      notes: 'Burrata unbedingt zimmerwarm servieren — kalt schmeckt sie nach nichts.',
    },
    {
      title: 'Süßkartoffel-Curry mit Erdnuss',
      image: 'assets/demo/sueskartoffelcurry.png',
      ingredients: '600 g Süßkartoffel\n1 Zwiebel\n2 Knoblauchzehen\n1 EL rote Currypaste\n3 EL Erdnussbutter\n400 ml Kokosmilch\n1 Limette\n2 Hände voll Babyspinat\n2 EL geröstete Erdnüsse',
      steps: 'Süßkartoffel in Würfel schneiden.\nZwiebel und Knoblauch in Öl andünsten, Currypaste kurz anrösten, Erdnussbutter und Kokosmilch einrühren.\nSüßkartoffel dazugeben, 20 Min. köcheln, bis sie weich ist.\nSpinat unterheben, mit Limettensaft und Salz abschmecken, Erdnüsse drüber.',
      notes: 'Mit Jasminreis. Ein Schuss Sojasoße am Ende rundet ab.',
    },
    {
      title: 'Zucchini-Frittata mit Feta und Minze',
      image: 'assets/demo/zuchinifritatta.png',
      ingredients: '2 mittlere Zucchini\n6 Eier\n100 g Feta\n1 Bund Minze\n1 Zitrone\n2 EL Olivenöl\nSalz\nPfeffer',
      steps: 'Zucchini grob raspeln, salzen, 10 Min. ziehen lassen, ordentlich ausdrücken.\nEier mit Pfeffer verquirlen, Zucchini, zerbröselten Feta und gehackte Minze unterrühren.\nIn ofenfester Pfanne in Olivenöl 3 Min. anbraten, dann bei 180 °C 15 Min. fertig backen.\nMit Zitronenspalten servieren.',
      notes: 'Am nächsten Tag kalt aus der Hand fast besser als frisch.',
    },
    {
      title: 'Kichererbsen-Shakshuka',
      image: 'assets/demo/kichererbsenshakshuka.png',
      ingredients: '1 Dose Kichererbsen\n1 Dose stückige Tomaten\n1 Zwiebel\n2 Paprika\n2 Knoblauchzehen\n1 TL Kreuzkümmel\n1 TL Paprikapulver\nChiliflocken\n4 Eier\nPetersilie\nSauerteigbrot',
      steps: 'Zwiebel und Paprika in Öl in einer Pfanne weich dünsten.\nKnoblauch und Gewürze dazugeben, kurz mitrösten.\nTomaten und abgetropfte Kichererbsen einrühren, 10 Min. köcheln.\nMulden in die Sauce drücken, Eier hineinschlagen, mit Deckel 5–7 Min. garen, bis das Eiweiß stockt.\nMit Petersilie bestreuen, Brot dazu.',
      notes: 'Direkt aus der Pfanne essen — sieht aus wie im Restaurant.',
    },
  ],

  weekTitles: [
    'Linsen-Dal mit Kokos und Koriander',
    'Ofen-Halloumi mit Fenchel',
    'Edamame Tacos',
    'Chili-Aubergine mit Reissalat',
    'Miso-Lachs mit Sesam-Pak-Choi',
    'Gegrillte Aubergine mit Mango',
    'Burrata mit gerösteter Paprika und Basilikum',
  ],

  async runIfEmpty() {
    if (Storage.isApi()) return;
    const data = Storage._load();
    const fresh = !Object.keys(data.weeks).length && !Object.keys(data.recipes).length;

    if (fresh) {
      for (const r of this.recipes) {
        await Storage.saveRecipe(null, r);
      }
      const wk = Dates.weekKey(Dates.today());
      const days = Dates.weekDays(wk);
      const dayMap = {};
      days.forEach((day, i) => { dayMap[day.iso] = this.weekTitles[i]; });
      await Storage.saveWeek(wk, dayMap);
    }

    await this.ensureImages();
  },

  async ensureImages() {
    if (Storage.isApi()) return;
    for (const r of this.recipes) {
      if (!r.image) continue;
      const existing = await Storage.findRecipeByTitle(r.title);
      if (!existing) continue;
      if (Array.isArray(existing.images) && existing.images.length > 0) continue;
      await Storage.addRecipeImage(existing.slug, r.image);
    }
  },
};

/* =============================================================
 *  Init
 * ============================================================= */
document.addEventListener('DOMContentLoaded', async () => {
  State.todayIso       = Dates.isoDate(Dates.today());
  State.currentWeekKey = Dates.weekKey(Dates.today());

  await Storage.init();
  document.body.dataset.canEdit = Storage.canEdit() ? 'yes' : 'no';
  document.body.dataset.mode    = Storage.mode;

  Storage.migrateImagePaths();

  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const wantsDemo = new URLSearchParams(location.search).has('demo');
  if (Storage.mode === 'demo' && (isLocal || wantsDemo)) {
    await Seed.runIfEmpty();
  }

  Auth.render();
  Auth.showAuthErrorFromUrl();
  Sheet.init();
  Recipes.initDetailListeners();

  document.querySelector('[data-nav="prev"]').addEventListener('click', () => {
    State.currentWeekKey = Dates.shiftWeek(State.currentWeekKey, -1);
    Board.render();
  });
  document.querySelector('[data-nav="next"]').addEventListener('click', () => {
    State.currentWeekKey = Dates.shiftWeek(State.currentWeekKey, +1);
    Board.render();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    State.currentWeekKey = Dates.weekKey(Dates.today());
    Board.render();
  });

  async function openDay(iso) {
    if (Storage.canEdit()) {
      Sheet.open(iso);
      return;
    }
    const week = await Storage.loadWeek(State.currentWeekKey);
    const dish = week[iso];
    if (!dish) return;
    const recipe = await Storage.findRecipeByTitle(dish);
    if (recipe) {
      Recipes.origin = 'board';
      location.hash = recipeHash(recipe.slug);
    }
  }

  const daysEl = document.getElementById('days');
  daysEl.addEventListener('click', (e) => {
    const li = e.target.closest('.day');
    if (li) openDay(li.dataset.iso);
  });
  daysEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.day');
    if (!li) return;
    e.preventDefault();
    openDay(li.dataset.iso);
  });

  Router.init();
});
