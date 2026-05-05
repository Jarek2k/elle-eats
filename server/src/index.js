import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { openDb } from './db.js';
import { createStorage } from './storage.js';
import { createAuth } from './auth.js';

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || './data/elle-eats.db';
const IMAGES_DIR = process.env.IMAGES_DIR || './data/images';

mkdirSync(IMAGES_DIR, { recursive: true });

const db = openDb(DB_PATH);
const storage = createStorage(db);
const auth = createAuth(process.env);

const app = new Hono();
app.use('*', logger());

app.get('/healthz', (c) => c.json({ ok: true }));

app.get('/auth/google', (c) => {
  const { url, state, codeVerifier } = auth.startAuth();
  const opts = { httpOnly: true, sameSite: 'Lax', path: '/', secure: auth.cookieOptions.secure, maxAge: 600 };
  setCookie(c, 'oauth_state', state, opts);
  setCookie(c, 'oauth_verifier', codeVerifier, opts);
  return c.redirect(url);
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const storedVerifier = getCookie(c, 'oauth_verifier');
  deleteCookie(c, 'oauth_state', { path: '/' });
  deleteCookie(c, 'oauth_verifier', { path: '/' });

  if (!code || !state || !storedState || !storedVerifier || state !== storedState) {
    return c.text('Ungültiger Auth-Status. Bitte erneut einloggen.', 400);
  }

  let result;
  try {
    result = await auth.finishAuth(code, storedVerifier);
  } catch (err) {
    console.error('OAuth-Fehler:', err);
    return c.text('Anmeldung fehlgeschlagen.', 400);
  }

  if (!result.email || !auth.isAllowed(result.email)) {
    return c.text('Zugang nicht freigegeben.', 403);
  }

  setCookie(c, auth.SESSION_COOKIE, auth.signSession(result.email), auth.cookieOptions);
  return c.redirect('/');
});

app.post('/auth/logout', (c) => {
  deleteCookie(c, auth.SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

const authMiddleware = async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  if (path.startsWith('/auth/') || path === '/healthz') return next();

  const token = getCookie(c, auth.SESSION_COOKIE);
  const session = auth.verifySession(token);
  if (session) c.set('email', session.email);

  const isReadOnly = (method === 'GET' || method === 'HEAD') && path !== '/api/me';
  if (isReadOnly) return next();

  if (!session) {
    if (path.startsWith('/api/')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return c.redirect('/auth/google');
  }
  await next();
};

app.use('*', authMiddleware);

app.get('/api/me', (c) => c.json({ email: c.get('email') }));

app.get('/api/weeks', (c) => c.json(storage.listWeeks()));

app.get('/api/weeks/:key', (c) => c.json(storage.loadWeek(c.req.param('key'))));

app.put('/api/weeks/:key/:iso', async (c) => {
  const { key, iso } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  storage.setDish(key, iso, body.name);
  return c.json({ ok: true });
});

app.delete('/api/weeks/:key/:iso', (c) => {
  const { key, iso } = c.req.param();
  storage.setDish(key, iso, '');
  return c.json({ ok: true });
});

app.get('/api/recipes', (c) => c.json(storage.loadRecipes()));

app.get('/api/recipes/:slug', (c) => {
  const r = storage.getRecipe(c.req.param('slug'));
  if (!r) return c.json({ error: 'not-found' }, 404);
  return c.json(r);
});

app.post('/api/recipes', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = storage.saveRecipe(null, body);
  if (result.error === 'empty-title') return c.json(result, 400);
  if (result.error === 'collision') return c.json(result, 409);
  return c.json(result, 201);
});

app.put('/api/recipes/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json().catch(() => ({}));
  const result = storage.saveRecipe(slug, body);
  if (result.error === 'empty-title') return c.json(result, 400);
  if (result.error === 'collision') return c.json(result, 409);
  return c.json(result);
});

app.delete('/api/recipes/:slug', (c) => {
  storage.deleteRecipe(c.req.param('slug'));
  return c.json({ ok: true });
});

app.get('/api/recipes/:slug/usage', (c) => {
  return c.json({ count: storage.recipeUsageCount(c.req.param('slug')) });
});

app.get('/api/suggestions', (c) => c.json(storage.listSuggestions()));

app.post('/api/recipes/:slug/images', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.parseBody().catch(() => ({}));
  const file = body.image;
  if (!(file instanceof File)) return c.json({ error: 'no-file' }, 400);
  if (!file.type.startsWith('image/jpeg')) return c.json({ error: 'unsupported-type' }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');
  const filename = `${hash}.jpg`;
  const path = join(IMAGES_DIR, filename);

  const exists = await access(path).then(() => true, () => false);
  if (!exists) await writeFile(path, buffer);

  const result = storage.addImage(slug, filename);
  if (result.error === 'not-found') return c.json(result, 404);
  return c.json({ ok: true, filename, position: result.position }, 201);
});

app.delete('/api/recipes/:slug/images/:index', (c) => {
  const slug = c.req.param('slug');
  const index = Number(c.req.param('index'));
  if (!Number.isInteger(index) || index < 0) return c.json({ error: 'bad-index' }, 400);
  const result = storage.removeImage(slug, index);
  if (result.error === 'not-found') return c.json(result, 404);
  return c.json({ ok: true });
});

app.get('/images/:filename', async (c) => {
  const filename = c.req.param('filename');
  const m = filename.match(/^[a-f0-9]{64}\.(jpg|png)$/);
  if (!m) return c.notFound();
  try {
    const data = await readFile(join(IMAGES_DIR, filename));
    c.header('Content-Type', m[1] === 'png' ? 'image/png' : 'image/jpeg');
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.body(data);
  } catch {
    return c.notFound();
  }
});

app.use('*', serveStatic({ root: '../public' }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`elle-eats server läuft auf http://localhost:${info.port}`);
});
