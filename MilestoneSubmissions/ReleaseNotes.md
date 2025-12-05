## Nov 12:

### Added
- Registration flow: polished `/register` page, bcrypt-backed API, and persisted users table enable account creation with proper redirects and alerts.
- Login experience: revamped `/login` UI, credential verification against Postgres, and friendly error messaging on invalid attempts.
- Session lifecycle: homepage splash placeholder gated behind auth plus a `/logout` route that clears the session and returns visitors to the login screen.

### Improved
- Consistent styling between register/login plus placeholder homepage ensures users see a cohesive interface across the onboarding journey.

## Nov 20:

### Added
- Congress member profile experience: `/congress` pages now surface Quiver API data with trade history, metadata (party, chamber, district), and a follow CTA wired into the session.
- Dashboard card framework: interactive Congress member cards now hook into the search bar and settings actions, letting users jump from spotlight tiles or queries directly into the detailed `/congress` profiles.

## Dec 4:

### Added
- Dashboard overhaul: new `/dashboard` summarizes recent congressional trades, highlights a rotating spotlight, and shows the list of lawmakers a user follows.
- Settings page: delivered a fully functional settings experience that shares the same shell UI as `/congress` and wires into the backend form handlers.

### Improved
- Follow management: backend and client changes ensure duplicate names collapse into a single canonical entry and follow/unfollow actions update the UI instantly.
- Auth resiliency: registration now blocks duplicate emails gracefully, and login surfaces clearer feedback when credentials already exist or conflict.
- Performance & UX: removed the animated background on the dashboard to reduce layout thrash and improve responsiveness across devices.
- Dashboard follow state: unfollowing a member from the watchlist now immediately updates the button state on the dashboard list without requiring a refresh.
