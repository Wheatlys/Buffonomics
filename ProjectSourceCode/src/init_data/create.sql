CREATE TABLE IF NOT EXISTS users(
    email VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS politicians(
    id SERIAL PRIMARY KEY,
    query_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    party TEXT,
    position TEXT,
    networth NUMERIC,
    trade_volume NUMERIC,
    total_trades INTEGER,
    last_traded DATE,
    years_active TEXT,
    current_member BOOLEAN,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades(
    id SERIAL PRIMARY KEY,
    politician_id INTEGER NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    stock_symbol TEXT NOT NULL,
    transaction_type TEXT,
    filed_date DATE,
    traded_date DATE,
    amount_range TEXT,
    amount_value NUMERIC,
    description TEXT,
    est_return TEXT,
    chamber TEXT,
    district TEXT,
    party TEXT,
    ticker_type TEXT,
    excess_return NUMERIC,
    price_change NUMERIC,
    spy_change NUMERIC,
    last_modified TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_politician_id ON trades(politician_id);
