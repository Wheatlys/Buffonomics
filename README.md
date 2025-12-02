# Buffonomics
Buffonomics tracks the stock-trading disclosures of U.S. Congress members so students can explore which lawmakers are buying or selling specific equities.

## Contributors
- [Elijah Boyer](https://github.com/spell-bound)  
- [Stephen Le](https://github.com/Wheatlys)  
- [Ali Siddiqui](https://github.com/Ali-Sidd11)
- [Sutchin Somanathan](https://github.com/chaisoma)
- [Pranav Meka](https://github.com/PranavM06)
- [Kai Janipalli](https://github.com/kaja4447)

## Technology Stack
Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Node.js
- Express.js

Database:
- PostgreSQL

Containerization:
- Docker

External APIs:
- [Quiver Quant](https://api.quiverquant.com/docs/#/) – congressional trading history
- [Alpha Vantage](https://www.alphavantage.co/documentation/) – daily market movers reference data

## Prerequisites to run the application
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Modern web browser (Chrome, Edge, Firefox, Safari)
- Quiver Quant + Alpha Vantage API keys (free tiers work for our needs)

## Instructions on running the application locally
1. **Clone & enter the repo**
   ```bash
   git clone https://github.com/Wheatlys/Buffonomics.git
   cd Buffonomics/ProjectSourceCode
   ```
2. **Configure environment variables** – copy `.env` and update with your own secrets if needed.
   ```dotenv
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=pwd
   POSTGRES_DB=users_db
   SESSION_SECRET=change-me
   QUIVER_API_KEY=your-quiver-key
   ALPHAVANTAGE_API_KEY=your-alpha-key
   ```
3. **Start the full stack with Docker Compose**
   ```bash
   docker compose up --build
   ```
   This launches PostgreSQL (`db`) and the Node.js web service (`web`) and automatically runs migrations plus the Mocha test suite before the server starts.
4. **Visit the app** at [http://localhost:3000](http://localhost:3000) and log in or register to explore the dashboard and `/congress` profile pages.

## How to run the tests
All automated tests live in `ProjectSourceCode/test/server.spec.js` (Mocha + Chai). To execute them:
```bash
cd ProjectSourceCode
npm test
```
or, if Docker is already running:
```bash
docker compose run --rm web npm test
```
These cases validate the `/welcome` health endpoint and the registration flow (success + invalid input). Add new unit tests alongside `server.spec.js` to expand coverage.

## Link to the Deployed Application
https://buffonomics.onrender.com
