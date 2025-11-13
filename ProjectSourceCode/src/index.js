const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgp = require('pg-promise')();

dotenv.config({ path: path.join(__dirname, '../.env') });

const useMemoryDb = process.env.USE_MEMORY_DB === 'true'
  || process.env.NODE_ENV === 'test';

const createMemoryDb = () => {
  const users = new Map();

  const clone = (record) => (record ? { ...record } : null);

  const matchesUsers = (query = '') =>
    typeof query === 'string' && query.toLowerCase().includes('from users');

  const matchesInsert = (query = '') =>
    typeof query === 'string' && query.toLowerCase().includes('insert into users');

  return {
    async none(query = '', params = []) {
      if (matchesInsert(query)) {
        const [email, password] = params;
        if (users.has(email)) {
          const error = new Error('duplicate email');
          error.code = '23505';
          throw error;
        }
        users.set(email, { email, password });
      }
      return null;
    },
    async oneOrNone(query = '', params = []) {
      if (matchesUsers(query)) {
        const [email] = params;
        return clone(users.get(email));
      }
      return null;
    },
    async any(query = '', params = []) {
      if (matchesUsers(query)) {
        if (params.length) {
          const record = users.get(params[0]);
          return record ? [clone(record)] : [];
        }
        return Array.from(users.values()).map((record) => clone(record));
      }
      return [];
    },
  };
};

const db = useMemoryDb ? createMemoryDb() : pgp({
  host: process.env.DB_HOST
    || process.env.POSTGRES_HOST
    || process.env.PGHOST
    || 'db',
  port: Number(process.env.DB_PORT
    || process.env.POSTGRES_PORT
    || process.env.PGPORT
    || 5432),
  database: process.env.POSTGRES_DB || 'users_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
  }),
);
app.locals.db = db;

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  return next();
};

const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const wantsJson = (req) =>
  req.accepts(['html', 'json']) === 'json' || req.is('application/json');

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'connect.sid';

// Serve static assets
app.use('/static', express.static(path.join(__dirname, '../static')));
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  return res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(204).end();
  }

  return req.session.destroy((err) => {
    if (err) {
      console.error('Logout failed:', err);
      return res.status(500).json({ error: 'logoutFailed' });
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(204).end();
  });
});

// Routes for HTML pages
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/homepage');
  }
  return res.redirect('/login');
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/homepage');
  }
  return res.sendFile(path.join(__dirname, '../templates/register.html'));
});

const wantsHtmlResponse = req => {
  const accepts = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  return (
    accepts.includes('text/html') || contentType.includes('application/x-www-form-urlencoded')
  );
};

app.post('/register', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();

  if (!isValidEmail(email)) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'invalidEmail' });
    }
    return res.redirect('/register?error=invalidEmail');
  }

  if (password.length < 8) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'weakPassword' });
    }
    return res.redirect('/register?error=weakPassword');
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.none(
      'INSERT INTO users(email, password) VALUES ($1, $2)',
      [email, hash],
    );
    if (wantsJson(req)) {
      return res.status(201).json({ message: 'registered' });
    }
    return res.redirect('/login?success=registered');
  } catch (error) {
    if (error.code === '23505') {
      if (wantsJson(req)) {
        return res.status(409).json({ error: 'exists' });
      }
      return res.redirect('/register?error=exists');
    }
    console.error('Registration failed:', error);
    if (wantsJson(req)) {
      return res.status(500).json({ error: 'server' });
    }
    return res.redirect('/register?error=server');
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/homepage');
  }
  return res.sendFile(path.join(__dirname, '../templates/login.html'));
});

app.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'missing' });
    }
    return res.redirect('/login?error=missing');
  }

  try {
    const user = await db.oneOrNone(
      'SELECT email, password FROM users WHERE email = $1',
      [email],
    );

    if (!user) {
      if (wantsJson(req)) {
        return res.status(401).json({ error: 'invalid' });
      }
      return res.redirect('/login?error=invalid');
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      if (wantsJson(req)) {
        return res.status(401).json({ error: 'invalid' });
      }
      return res.redirect('/login?error=invalid');
    }

    req.session.user = { email: user.email };
    if (wantsJson(req)) {
      return res.status(200).json({ message: 'authenticated' });
    }
    return res.redirect('/homepage');
  } catch (error) {
    console.error('Login failed:', error);
    if (wantsJson(req)) {
      return res.status(500).json({ error: 'server' });
    }
    return res.redirect('/login?error=server');
  }
});

app.get('/homepage', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/homepage.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect('/login');
  });
});

// Default route for testing
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

// Start server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
}

module.exports = app;
module.exports.db = db;
