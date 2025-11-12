const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());

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

app.post('/register', async (req, res) => {
    //send user and pass registration
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        await db.none(
            `INSERT INTO USERS (email, password)
            VALUES ($1, $2)`, [req.body.email, hash]
        );
        res.redirect('/login');
        const users = await db.any(`SELECT * FROM users;`);
        console.log(users);
    }

    catch (error) {
        console.error(error)
        res.redirect('/register');
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
