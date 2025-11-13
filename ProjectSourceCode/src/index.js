const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const pgp = require('pg-promise')();
require('dotenv').config();

const db = pgp({
  host: process.env.POSTGRES_HOST || 'db',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Serve static assets
app.use('/static', express.static(path.join(__dirname, '../static')));
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));

// Routes for HTML pages
app.get('/', (req, res) => {
    res.redirect('/login'); //this will call the /login route in the API
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/register.html'));
});

const wantsHtmlResponse = req => {
  const accepts = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  return (
    accepts.includes('text/html') || contentType.includes('application/x-www-form-urlencoded')
  );
};

app.post('/register', async (req, res) => {
  const {email, password} = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !password || !emailRegex.test(email)) {
    if (wantsHtmlResponse(req)) {
      return res.redirect('/register');
    }
    return res.status(400).json({status: 'error', message: 'Invalid input'});
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.none(
      `INSERT INTO users (email, password)
       VALUES ($1, $2)`,
      [email.toLowerCase(), hash],
    );

    if (wantsHtmlResponse(req)) {
      return res.redirect('/login');
    }
    return res
      .status(200)
      .json({status: 'success', message: 'Registration successful'});
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      if (wantsHtmlResponse(req)) {
        return res.redirect('/register');
      }
      return res
        .status(409)
        .json({status: 'error', message: 'User already exists'});
    }
    if (wantsHtmlResponse(req)) {
      return res.redirect('/register');
    }
    return res
      .status(500)
      .json({status: 'error', message: 'Unable to register user'});
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/login.html'));
});

// Default route for testing
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

// Start server
if (require.main === module) {
  app.listen(3000, () => console.log('Server is listening on port 3000'));
}

module.exports = app;
module.exports.db = db;
