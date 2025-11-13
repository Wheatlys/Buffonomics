# Buffonomics — User Acceptance Test Plan

This plan defines the UAT scope for Week 4. Actual outcomes should be captured in the **Status/Actual Result** column immediately after execution.

## Test Environment
- **Target build:** `main` branch deployed via `docker-compose` in the project root.
- **Runtime:** Node.js service (`web`) hitting PostgreSQL (`db`) containers on localhost.
- **Seed data:** `src/init_data/create.sql` auto-creates the `users` table. Additional seed scripts for watchlists/politician trades should be loaded via SQL files or manual inserts before testing Feature 3.

## UAT Testers
| Role | Owner | Responsibilities |
| --- | --- | --- |
| Product Owner Proxy | Elijah Boyer | Approve overall user experience & messaging |
| QA Lead | Stephen Le | Drive UAT execution logistics and evidence capture |
| Domain Expert | Ali Siddiqui | Validate politician trade insights and data accuracy |

## Feature 1 — User Registration & Onboarding
| Test ID | Scenario | Test Data | User Steps | Expected Result | Tester | Status / Actual Result |
| --- | --- | --- | --- | --- | --- | --- |
| REG-01 | Happy path registration inserts a user | Email: `uat.reg+1@buffonomics.test`<br>Password: `ValidPass!234` | 1. Navigate to `/register`.<br>2. Submit the form with the above credentials.<br>3. Observe post-submission navigation. | HTTP 200/redirect to `/login`, confirmation messaging, and row created in `users` table (email stored lowercase, hashed password). | Elijah Boyer | Pending — execute Week 4 |
| REG-02 | Duplicate email is rejected | Reuse email from REG-01 | 1. Repeat REG-01 with same email.<br>2. Observe server response. | Browser shows validation error, API responds 409 with `User already exists`, no new DB row. | Stephen Le | Pending — execute Week 4 |
| REG-03 | Invalid email cannot be submitted | Email: `invalid-email`<br>Password: `ValidPass!234` | 1. Submit registration form with invalid email pattern.<br>2. Observe validation feedback. | UI highlights invalid input, API returns 400 `Invalid input`, DB untouched. | Ali Siddiqui | Pending — execute Week 4 |

## Feature 2 — Login & Session Access Control
| Test ID | Scenario | Test Data | User Steps | Expected Result | Tester | Status / Actual Result |
| --- | --- | --- | --- | --- | --- | --- |
| LOG-01 | Registered user can log in and reach dashboard | Use credentials created in REG-01 | 1. Navigate to `/login`.<br>2. Submit valid credentials.<br>3. Inspect landing dashboard. | HTTP 200 with HTML render, session cookie issued, dashboard widgets load without console errors. | Sutchin Somanathan | Pending — execute Week 4 |
| LOG-02 | Incorrect password receives feedback and blocks session | Email: `uat.reg+1@buffonomics.test`<br>Password: `WrongPass!999` | 1. Attempt login with wrong password.<br>2. Attempt to access any authenticated route directly. | API returns 401 with descriptive message, page shows inline error, no session cookie, authenticated routes redirect back to `/login`. | Pranav Meka | Pending — execute Week 4 |
| LOG-03 | Session timeout logs user out | Existing logged-in session | 1. Log in successfully.<br>2. Stay idle for configured session duration (set to 15 min for test).<br>3. Perform a protected action after timeout. | Application redirects to `/login` with message about expired session; new login required before continuing. | Kai Janipalli | Pending — execute Week 4 |

## Feature 3 — Politician Trade Discovery & Watchlist
| Test ID | Scenario | Test Data | User Steps | Expected Result | Tester | Status / Actual Result |
| --- | --- | --- | --- | --- | --- | --- |
| TRADE-01 | User filters politician trades by name | Search term: `"Nancy Pelosi"` | 1. Log in.<br>2. Navigate to trades dashboard.<br>3. Enter the politician name filter and apply. | API call to Financial Modeling Prep succeeds, table renders trades that match the filter, timestamps use user’s timezone. | Elijah Boyer | Pending — execute Week 4 |
| TRADE-02 | Adding a trade to the watchlist persists selection | Chosen trade ID seeded in test data | 1. Select a trade row.<br>2. Click “Add to Watchlist”.<br>3. Refresh dashboard. | Toast/snackbar confirms success, trade appears in user-specific watchlist table after refresh (data read from PostgreSQL). | Stephen Le | Pending — execute Week 4 |
| TRADE-03 | Invalid ticker input returns actionable error | Ticker: `BAD$$` | 1. Use ticker search widget with malformed ticker.<br>2. Submit request. | API returns 400, UI shows “Ticker not found” without crashing, no network retries beyond 1 attempt. | Ali Siddiqui | Pending — execute Week 4 |

## Result Documentation & Sign-off
- Capture screenshots of each pass/fail condition and attach them to the Week 4 report.
- Update the **Status / Actual Result** column with `Pass`, `Fail`, or `Blocked` plus defect IDs if applicable.
- Product Owner proxy (Elijah) provides final sign-off once all critical UAT cases pass or have approved workarounds.
