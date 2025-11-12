const path = require('path');
const crypto = require('crypto');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'ps_session';
const TOKEN_TTL_MS = getPositiveInt(process.env.AUTH_TOKEN_TTL_MS, 1000 * 60 * 60 * 4);
const COOKIE_SECURE = (process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true'
  || process.env.NODE_ENV === 'production';

const USERS = buildUserStore(process.env.AUTH_USERS);
if (USERS.size === 0) {
  console.warn('AUTH_USERS was not configured; using fallback credentials demo:demo');
  USERS.set('demo', 'demo');
}
const SESSIONS = new Map();

const projectRoot = path.join(__dirname, 'ProjectSourceCode');
const templatesDir = path.join(projectRoot, 'templates');
const staticDir = path.join(projectRoot, 'static');
const scriptsDir = path.join(projectRoot, 'scripts');

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/static', express.static(staticDir, { maxAge: '1d' }));
app.use('/scripts', express.static(scriptsDir, { maxAge: '1h' }));

app.use((req, _res, next) => {
  const token = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!token) {
    return next();
  }

  const session = SESSIONS.get(token);
  if (!session) {
    return next();
  }

  if (session.expiresAt <= Date.now()) {
    SESSIONS.delete(token);
    return next();
  }

  req.user = { username: session.username };
  req.authToken = token;
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get(['/', '/login'], (req, res) => {
  if (req.user) {
    return res.redirect('/home');
  }
  return res.sendFile(path.join(templatesDir, 'login.html'));
});

app.get('/home', requireAuth, (_req, res) => {
  return res.sendFile(path.join(templatesDir, 'homepage.html'));
});

app.get('/api/session', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'UNAUTHENTICATED' });
  }
  return res.json({ ok: true, user: req.user });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'MISSING_CREDENTIALS' });
  }

  const normalizedUsername = String(username).trim();
  if (!verifyCredentials(normalizedUsername, String(password))) {
    return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
  }

  const token = issueSession(normalizedUsername);
  res.cookie(COOKIE_NAME, token, buildCookieOptions());
  return res.json({ ok: true, user: { username: normalizedUsername } });
});

app.post('/api/logout', (req, res) => {
  if (req.authToken) {
    SESSIONS.delete(req.authToken);
  }
  res.clearCookie(COOKIE_NAME, buildCookieOptions(true));
  return res.status(204).end();
});

app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(templatesDir, 'login.html'));
  }
  return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
});

const cleanupTimer = setInterval(cleanExpiredSessions, 5 * 60 * 1000);
cleanupTimer.unref();

app.listen(PORT, () => {
  console.log(`Buffonomics server listening on http://localhost:${PORT}`);
});

function verifyCredentials(username, password) {
  if (!username || typeof password !== 'string') {
    return false;
  }
  const expected = USERS.get(username);
  return expected === password;
}

function issueSession(username) {
  const token = crypto.randomBytes(48).toString('hex');
  SESSIONS.set(token, {
    username,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }
  if (req.accepts('html')) {
    return res.redirect('/login');
  }
  return res.status(401).json({ ok: false, error: 'UNAUTHENTICATED' });
}

function buildCookieOptions(isClear = false) {
  const base = {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
  };
  if (!isClear) {
    base.maxAge = TOKEN_TTL_MS;
  }
  return base;
}

function readCookie(header, name) {
  if (!header || !name) {
    return null;
  }
  const pairs = header.split(';');
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey || rest.length === 0) continue;
    if (rawKey.trim() === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function buildUserStore(raw) {
  const map = new Map();
  if (!raw) {
    return map;
  }

  raw.split(',').map((chunk) => chunk.trim()).filter(Boolean).forEach((entry) => {
    const [username, ...passwordParts] = entry.split(':');
    if (!username || passwordParts.length === 0) {
      return;
    }
    map.set(username.trim(), passwordParts.join(':'));
  });
  return map;
}

function getPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of SESSIONS.entries()) {
    if (session.expiresAt <= now) {
      SESSIONS.delete(token);
    }
  }
}

module.exports = app;
