const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgp = require('pg-promise')();

dotenv.config({ path: path.join(__dirname, '../.env') });

const db = pgp({
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

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  return next();
};

const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

// Serve static assets
app.use('/static', express.static(path.join(__dirname, '../static')));
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));

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

app.post('/register', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();

  if (!isValidEmail(email)) {
    return res.redirect('/register?error=invalidEmail');
  }

  if (password.length < 8) {
    return res.redirect('/register?error=weakPassword');
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.none(
      'INSERT INTO users(email, password) VALUES ($1, $2)',
      [email, hash],
    );
    return res.redirect('/login?success=registered');
  } catch (error) {
    if (error.code === '23505') {
      return res.redirect('/register?error=exists');
    }
    console.error('Registration failed:', error);
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
    return res.redirect('/login?error=missing');
  }

  try {
    const user = await db.oneOrNone(
      'SELECT email, password FROM users WHERE email = $1',
      [email],
    );

    if (!user) {
      return res.redirect('/login?error=invalid');
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      return res.redirect('/login?error=invalid');
    }

    req.session.user = { email: user.email };
    return res.redirect('/homepage');
  } catch (error) {
    console.error('Login failed:', error);
    return res.redirect('/login?error=server');
  }
});

app.get('/homepage', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/homepage.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
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
