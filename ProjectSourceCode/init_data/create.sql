CREATE TABLE IF NOT EXISTS users (
    email VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(50) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    politician_query_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_email, politician_query_key)
);
