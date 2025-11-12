// ********************** Initialize server **********************************

process.env.USE_MEMORY_DB = 'true';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';

const server = require('../src/index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

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

// ********************************************************************************

// *********************** AUTH TEST CASES ***************************************

describe('Registration API', () => {
  it('stores a valid user record when payload is correct', async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'ValidPass123!';

    const res = await chai
      .request(server)
      .post('/register')
      .set('Accept', 'application/json')
      .send({ email, password });

    res.should.have.status(201);
    expect(res.body.message).to.equal('registered');

    const stored = await server.locals.db.oneOrNone(
      'SELECT email, password FROM users WHERE email = $1',
      [email],
    );

    expect(stored).to.exist;
    expect(stored.email).to.equal(email);
    expect(stored.password).to.be.a('string');
    expect(stored.password).to.match(/^\$2[aby]\$/); // bcrypt hash prefix
  });

  it('rejects malformed email payloads with HTTP 400', async () => {
    const res = await chai
      .request(server)
      .post('/register')
      .set('Accept', 'application/json')
      .send({ email: 'not-an-email', password: 'short' });

    res.should.have.status(400);
    expect(res.body.error).to.equal('invalidEmail');
  });
});

// *********************** REDIRECT TEST CASE ***********************************

describe('Redirect testing', () => {
  it('/ route redirects anonymous users to /login', async () => {
    const res = await chai
      .request(server)
      .get('/')
      .redirects(0);

    res.should.have.status(302);
    res.should.redirectTo(/^.*\/login$/);
  });
});
