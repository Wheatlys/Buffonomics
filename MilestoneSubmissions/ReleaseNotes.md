## Nov 12:

### Added
- Registration flow: polished `/register` page, bcrypt-backed API, and persisted users table enable account creation with proper redirects and alerts.
- Login experience: revamped `/login` UI, credential verification against Postgres, and friendly error messaging on invalid attempts.
- Session lifecycle: homepage splash placeholder gated behind auth plus a `/logout` route that clears the session and returns visitors to the login screen.

### Improved
- Consistent styling between register/login plus placeholder homepage ensures users see a cohesive interface across the onboarding journey.
