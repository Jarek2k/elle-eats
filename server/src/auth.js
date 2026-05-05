import { Google, generateState, generateCodeVerifier } from 'arctic';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createAuth(env) {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'SESSION_SECRET'];
  for (const key of required) {
    if (!env[key]) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  }

  const allowed = new Set(
    (env.ALLOWED_EMAILS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (allowed.size === 0) {
    console.warn('WARNUNG: ALLOWED_EMAILS ist leer — niemand kann sich einloggen.');
  }

  const google = new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );

  const secret = env.SESSION_SECRET;
  const cookieSecure = env.COOKIE_SECURE !== 'false';

  return {
    SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: cookieSecure,
      maxAge: SESSION_TTL_MS / 1000,
    },

    isAllowed(email) {
      return allowed.has(email.toLowerCase());
    },

    startAuth() {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
      return { url: url.toString(), state, codeVerifier };
    },

    async finishAuth(code, codeVerifier) {
      const tokens = await google.validateAuthorizationCode(code, codeVerifier);
      const idToken = tokens.idToken();
      const claims = decodeIdToken(idToken);
      return { email: String(claims.email || '').toLowerCase(), name: claims.name || '' };
    },

    signSession(email) {
      const expiry = Date.now() + SESSION_TTL_MS;
      const payload = `${email}|${expiry}`;
      const sig = createHmac('sha256', secret).update(payload).digest('base64url');
      return `${b64(payload)}.${sig}`;
    },

    verifySession(token) {
      if (!token || typeof token !== 'string') return null;
      const [encPayload, sig] = token.split('.');
      if (!encPayload || !sig) return null;

      let payload;
      try { payload = unb64(encPayload); } catch { return null; }
      const expected = createHmac('sha256', secret).update(payload).digest('base64url');

      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

      const [email, expiryStr] = payload.split('|');
      const expiry = Number(expiryStr);
      if (!email || !Number.isFinite(expiry) || Date.now() > expiry) return null;
      return { email, expiry };
    },
  };
}

function decodeIdToken(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('id_token: ungültiges Format');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

function b64(s) { return Buffer.from(s, 'utf8').toString('base64url'); }
function unb64(s) { return Buffer.from(s, 'base64url').toString('utf8'); }
