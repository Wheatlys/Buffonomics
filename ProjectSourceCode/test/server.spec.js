// ********************** Initialize server **********************************

const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});
const server = require('../src/index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

const db = server.db;

before(async () => {
  await db.none(`CREATE TABLE IF NOT EXISTS users (
    email VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
  )`);
});

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

describe('Register API', () => {
  const removeUser = email =>
    db.none('DELETE FROM users WHERE email = $1', [email.toLowerCase()]);

  it('Positive: /register creates a new user record', async () => {
    const email = `tester_${Date.now()}@buffonomics.test`;
    const password = 'ValidPassword123!';

    try {
      const res = await chai.request(server).post('/register').send({email, password});
      expect(res).to.have.status(200);
      expect(res.body.status).to.equal('success');
      expect(res.body.message).to.equal('Registration successful');

      const storedUser = await db.oneOrNone(
        'SELECT email, password FROM users WHERE email = $1',
        [email],
      );
      expect(storedUser).to.not.be.null;
      expect(storedUser.email).to.equal(email);
      expect(storedUser.password).to.not.equal(password);
    } finally {
      await removeUser(email);
    }
  });

  it('Negative: /register rejects invalid email input', async () => {
    const email = 'invalid-email';
    const password = 'ValidPassword123!';

    const res = await chai.request(server).post('/register').send({email, password});
    expect(res).to.have.status(400);
    expect(res.body.status).to.equal('error');
    expect(res.body.message).to.equal('Invalid input');

    const storedUser = await db.oneOrNone(
      'SELECT email FROM users WHERE email = $1',
      [email],
    );
    expect(storedUser).to.be.null;
  });
});

// ********************************************************************************
