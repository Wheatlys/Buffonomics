const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgp = require('pg-promise')();
const { fetchExternalCongressMember, normalizeQuery } = require('./services/congress');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '../.env') });

const useMemoryDb = process.env.USE_MEMORY_DB === 'true'
  || process.env.NODE_ENV === 'test';

const createMemoryDb = () => {
  const users = new Map();
  const follows = new Map(); // email -> Set(queryKey)

  const clone = (record) => (record ? { ...record } : null);

  const matchesUsers = (query = '') =>
    typeof query === 'string' && query.toLowerCase().includes('from users');

  const matchesInsert = (query = '') =>
    typeof query === 'string' && query.toLowerCase().includes('insert into users');

  return {
    async none(query = '', params = []) {
      if (matchesInsert(query)) {
        const [email, password] = params;
        if (users.has(email)) {
          const error = new Error('duplicate email');
          error.code = '23505';
          throw error;
        }
        users.set(email, { email, password });
      }
      return null;
    },
    async oneOrNone(query = '', params = []) {
      if (matchesUsers(query)) {
        const [email] = params;
        return clone(users.get(email));
      }
      return null;
    },
    async any(query = '', params = []) {
      if (matchesUsers(query)) {
        if (params.length) {
          const record = users.get(params[0]);
          return record ? [clone(record)] : [];
        }
        return Array.from(users.values()).map((record) => clone(record));
      }
      return [];
    },
    async addFollow(email, queryKey) {
      if (!email || !queryKey) return;
      if (!follows.has(email)) {
        follows.set(email, new Set());
      }
      follows.get(email).add(queryKey);
    },
    async removeFollow(email, queryKey) {
      if (!email || !queryKey) return;
      const set = follows.get(email);
      if (set) set.delete(queryKey);
    },
    async listFollows(email) {
      const set = follows.get(email);
      return set ? Array.from(set) : [];
    },
  };
};

const createInMemoryCongressRepo = () => {
  const politicians = new Map();
  const queryIndex = new Map();
  const trades = new Map();
  let politicianSeq = 0;
  let tradeSeq = 0;

  const clone = (obj) => (obj ? JSON.parse(JSON.stringify(obj)) : null);

  const getTradesFor = (politicianId) => Array
    .from(trades.values())
    .filter((trade) => trade.politician_id === politicianId)
    .sort((a, b) => {
      const dateA = new Date(a.traded_date || a.filed_date || 0);
      const dateB = new Date(b.traded_date || b.filed_date || 0);
      return dateB - dateA;
    })
    .map((record) => clone(record));

  return {
    async getByQueryKey(queryKey) {
      const id = queryIndex.get(queryKey);
      if (!id) return null;
      if (!politicians.has(id)) return null;
      return {
        record: clone(politicians.get(id)),
        trades: getTradesFor(id),
      };
    },
    async upsert(queryKey, payload) {
      let politicianId = queryIndex.get(queryKey);
      if (!politicianId) {
        politicianSeq += 1;
        politicianId = politicianSeq;
        queryIndex.set(queryKey, politicianId);
      }

      const record = {
        id: politicianId,
        query_key: queryKey,
        name: payload.name,
        party: payload.party,
        position: payload.position,
        networth: payload.netWorth,
        trade_volume: payload.tradeVolume,
        total_trades: payload.totalTrades,
        last_traded: payload.lastTraded,
        years_active: payload.yearsActive,
        current_member: payload.currentMember,
        avatar_url: payload.avatarUrl,
        updated_at: new Date(),
      };
      politicians.set(politicianId, record);

      Array.from(trades.entries()).forEach(([id, trade]) => {
        if (trade.politician_id === politicianId) {
          trades.delete(id);
        }
      });

      (payload.trades || []).forEach((trade) => {
        tradeSeq += 1;
        const tradeRecord = {
          id: tradeSeq,
          politician_id: politicianId,
          stock_symbol: trade.stockSymbol,
          transaction_type: trade.transactionType,
          filed_date: trade.filedDate,
          traded_date: trade.tradedDate,
          amount_range: trade.amountRange,
          amount_value: trade.amountValue,
          description: trade.description,
          est_return: trade.estReturn,
          chamber: trade.chamber,
          district: trade.district,
          party: trade.party,
          ticker_type: trade.tickerType,
          excess_return: trade.excessReturn,
          price_change: trade.priceChange,
          spy_change: trade.spyChange,
          last_modified: trade.lastModified,
        };
        trades.set(tradeRecord.id, tradeRecord);
      });

      return {
        record: clone(record),
        trades: getTradesFor(politicianId),
      };
    },
  };
};

const createPgCongressRepo = (dbInstance) => ({
  async getByQueryKey(queryKey) {
    const record = await dbInstance.oneOrNone('SELECT * FROM politicians WHERE query_key = $1', [queryKey]);
    if (!record) return null;
    const trades = await dbInstance.any(
      `SELECT id, politician_id, stock_symbol, transaction_type, filed_date,
        traded_date, amount_range, amount_value, description, est_return,
        chamber, district, party, ticker_type, excess_return, price_change,
        spy_change, last_modified
       FROM trades
       WHERE politician_id = $1
       ORDER BY traded_date DESC NULLS LAST, filed_date DESC NULLS LAST, id DESC`,
      [record.id],
    );
    return { record, trades };
  },
  async upsert(queryKey, payload) {
    return dbInstance.tx(async (t) => {
      let record = await t.oneOrNone('SELECT * FROM politicians WHERE query_key = $1', [queryKey]);
      if (record) {
        record = await t.one(
          `UPDATE politicians
             SET name=$1, party=$2, position=$3, networth=$4, trade_volume=$5,
                 total_trades=$6, last_traded=$7, years_active=$8, current_member=$9,
                 avatar_url=$10, updated_at=NOW()
           WHERE id=$11
           RETURNING *`,
          [
            payload.name,
            payload.party,
            payload.position,
            payload.netWorth,
            payload.tradeVolume,
            payload.totalTrades,
            payload.lastTraded,
            payload.yearsActive,
            payload.currentMember,
            payload.avatarUrl,
            record.id,
          ],
        );
        await t.none('DELETE FROM trades WHERE politician_id = $1', [record.id]);
      } else {
        record = await t.one(
          `INSERT INTO politicians(
             query_key, name, party, position, networth, trade_volume,
             total_trades, last_traded, years_active, current_member, avatar_url
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING *`,
          [
            queryKey,
            payload.name,
            payload.party,
            payload.position,
            payload.netWorth,
            payload.tradeVolume,
            payload.totalTrades,
            payload.lastTraded,
            payload.yearsActive,
            payload.currentMember,
            payload.avatarUrl,
          ],
        );
      }

      if (payload.trades?.length) {
        await t.batch(payload.trades.map((trade) => t.none(
          `INSERT INTO trades(
             politician_id, stock_symbol, transaction_type, filed_date,
             traded_date, amount_range, amount_value, description, est_return,
             chamber, district, party, ticker_type, excess_return, price_change,
             spy_change, last_modified
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            record.id,
            trade.stockSymbol,
            trade.transactionType,
            trade.filedDate,
            trade.tradedDate,
            trade.amountRange,
            trade.amountValue,
            trade.description,
            trade.estReturn,
            trade.chamber,
            trade.district,
            trade.party,
            trade.tickerType,
            trade.excessReturn,
            trade.priceChange,
            trade.spyChange,
            trade.lastModified,
          ],
        )));
      }

      const trades = await t.any(
        `SELECT id, politician_id, stock_symbol, transaction_type, filed_date,
          traded_date, amount_range, amount_value, description, est_return,
          chamber, district, party, ticker_type, excess_return, price_change,
          spy_change, last_modified
         FROM trades
         WHERE politician_id = $1
         ORDER BY traded_date DESC NULLS LAST, filed_date DESC NULLS LAST, id DESC`,
        [record.id],
      );

      return { record, trades };
    });
  },
});

const createCongressRepository = (dbInstance, inMemory) => (inMemory
  ? createInMemoryCongressRepo()
  : createPgCongressRepo(dbInstance));

const toIsoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0];
  }
  return value;
};

const formatTradeRecord = (trade) => ({
  id: trade.id,
  stockSymbol: trade.stock_symbol || trade.stockSymbol,
  transactionType: trade.transaction_type || trade.transactionType,
  filedDate: toIsoDate(trade.filed_date || trade.filedDate),
  tradedDate: toIsoDate(trade.traded_date || trade.tradedDate),
  amountRange: trade.amount_range || trade.amountRange,
  amountValue: trade.amount_value !== null && trade.amount_value !== undefined
    ? Number(trade.amount_value)
    : (trade.amountValue !== undefined ? trade.amountValue : null),
  description: trade.description,
  estReturn: trade.est_return || trade.estReturn,
  chamber: trade.chamber || trade.Chamber,
  district: trade.district || trade.District,
  party: trade.party,
  tickerType: trade.ticker_type || trade.tickerType,
  excessReturn: trade.excess_return !== null && trade.excess_return !== undefined
    ? Number(trade.excess_return)
    : (trade.excessReturn !== undefined ? trade.excessReturn : null),
  priceChange: trade.price_change !== null && trade.price_change !== undefined
    ? Number(trade.price_change)
    : (trade.priceChange !== undefined ? trade.priceChange : null),
  spyChange: trade.spy_change !== null && trade.spy_change !== undefined
    ? Number(trade.spy_change)
    : (trade.spyChange !== undefined ? trade.spyChange : null),
  lastModified: trade.last_modified || trade.lastModified,
  type: ((trade.transaction_type || trade.transactionType || '')).toLowerCase().includes('sale')
    ? 'sell'
    : 'buy',
});

const formatCongressResponse = (record, trades = []) => ({
  id: record.id,
  queryKey: record.query_key,
  name: record.name,
  party: record.party,
  position: record.position,
  netWorth: record.networth !== null && record.networth !== undefined
    ? Number(record.networth)
    : null,
  tradeVolume: record.trade_volume !== null && record.trade_volume !== undefined
    ? Number(record.trade_volume)
    : null,
  totalTrades: record.total_trades !== null && record.total_trades !== undefined
    ? Number(record.total_trades)
    : trades.length,
  lastTraded: toIsoDate(record.last_traded),
  yearsActive: record.years_active,
  currentMember: record.current_member,
  avatarUrl: record.avatar_url,
  updatedAt: record.updated_at instanceof Date
    ? record.updated_at.toISOString()
    : record.updated_at,
  trades: trades.map(formatTradeRecord),
});

const buildFollowEntry = (record = {}, trades = [], queryKey) => {
  const latest = trades?.[0] || {};
  return {
    queryKey: record.query_key || queryKey,
    name: record.name || queryKey,
    role: record.position || null,
    party: record.party || null,
    lastTraded: toIsoDate(record.last_traded || latest.traded_date || latest.filed_date),
    latestTicker: latest.stock_symbol || null,
    latestTransaction: latest.transaction_type || null,
  };
};

const db = useMemoryDb ? createMemoryDb() : pgp({
  host: process.env.DB_HOST
    || process.env.POSTGRES_HOST
    || process.env.PGHOST
    || 'db',
  port: Number(process.env.DB_PORT
    || process.env.POSTGRES_PORT
    || process.env.PGPORT
    || 5432),
  database: process.env.POSTGRES_DB || 'users_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const congressRepo = createCongressRepository(db, useMemoryDb);
const followsRepo = (() => {
  if (useMemoryDb) {
    return {
      async follow(email, queryKey) {
        return db.addFollow(email, queryKey);
      },
      async unfollow(email, queryKey) {
        return db.removeFollow(email, queryKey);
      },
      async list(email) {
        return db.listFollows(email);
      },
    };
  }
  return {
    async follow(email, queryKey) {
      await db.none(
        `INSERT INTO follows(user_email, politician_query_key)
         VALUES ($1, $2) ON CONFLICT (user_email, politician_query_key) DO NOTHING`,
        [email, queryKey],
      );
    },
    async unfollow(email, queryKey) {
      await db.none('DELETE FROM follows WHERE user_email = $1 AND politician_query_key = $2', [email, queryKey]);
    },
    async list(email) {
      const rows = await db.any(
        `SELECT f.politician_query_key AS query_key, p.name, p.position, p.last_traded
         FROM follows f
         LEFT JOIN politicians p ON p.query_key = f.politician_query_key
         WHERE f.user_email = $1
         ORDER BY f.created_at DESC`,
        [email],
      );
      return rows;
    },
  };
})();

const ensureCongressTables = async () => {
  if (useMemoryDb) return;
  try {
    await db.none(`CREATE TABLE IF NOT EXISTS politicians(
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
    );`);
    await db.none(`CREATE TABLE IF NOT EXISTS trades(
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
    );`);
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS amount_value NUMERIC;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS chamber TEXT;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS district TEXT;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS party TEXT;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS ticker_type TEXT;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS excess_return NUMERIC;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS price_change NUMERIC;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS spy_change NUMERIC;');
    await db.none('ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_modified TIMESTAMPTZ;');
    await db.none('CREATE INDEX IF NOT EXISTS idx_trades_politician_id ON trades(politician_id);');
    await db.none(`CREATE TABLE IF NOT EXISTS follows(
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(50) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      politician_query_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_email, politician_query_key)
    );`);
    await db.none('CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_email);');
  } catch (error) {
    console.error('Failed to ensure congress tables exist:', error);
  }
};

const ensureCongressTablesPromise = ensureCongressTables();

const loadCongressMemberForFollow = async (queryValue) => {
  const normalized = normalizeQuery(queryValue || '');
  if (!normalized) {
    const error = new Error('missingQuery');
    error.status = 400;
    throw error;
  }

  await ensureCongressTablesPromise;

  let cached = await congressRepo.getByQueryKey(normalized);
  try {
    const fresh = await fetchExternalCongressMember(queryValue);
    if (fresh) {
      const persisted = await congressRepo.upsert(normalized, fresh);
      return persisted;
    }
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }

  if (cached) {
    return cached;
  }

  const error = new Error('notFound');
  error.status = 404;
  throw error;
};

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
  }),
);
app.locals.db = db;

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  return next();
};

const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const wantsJson = (req) =>
  req.accepts(['html', 'json']) === 'json' || req.is('application/json');

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'connect.sid';
const QUIVER_API_KEY = process.env.QUIVER_API_KEY;
const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;

const parseAmountRange = (value = '') => {
  if (!value) return null;
  const clean = value.replace(/\$|,/g, '');
  const [min, max] = clean.split('-').map((part) => Number(part.trim()));
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return (min + max) / 2;
  }
  if (Number.isFinite(min)) return min;
  return null;
};

const fetchQuiverData = async (endpoint) => {
  if (!QUIVER_API_KEY) {
    throw new Error('missingQuiverKey');
  }

  const url = `https://api.quiverquant.com/beta/live/${endpoint}`;
  console.log('[Quiver] GET', url);
  const response = await axios.get(url, {
    headers: {
      Authorization: `Token ${QUIVER_API_KEY}`,
      Accept: 'application/json',
    },
    timeout: 8000,
  });
  console.log('[Quiver] Response', endpoint, response.status);

  return Array.isArray(response.data) ? response.data : [];
};

const fetchAlphaMovers = async () => {
  if (!ALPHAVANTAGE_API_KEY) {
    throw new Error('missingAlphaKey');
  }

  console.log('[AlphaVantage] Fetching top gainers/losers');
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: {
      function: 'TOP_GAINERS_LOSERS',
      apikey: ALPHAVANTAGE_API_KEY,
    },
    timeout: 8000,
  });
  console.log('[AlphaVantage] Response', response.status);

  return response.data || {};
};

// Serve static assets
app.use('/static', express.static(path.join(__dirname, '../static')));
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  return res.json({ user: req.session.user });
});

app.get('/api/stocks/movers', requireAuth, async (req, res) => {
  if (!ALPHAVANTAGE_API_KEY) {
    return res.status(501).json({ error: 'alphaKeyMissing' });
  }

  try {
    const payload = await fetchAlphaMovers();
    console.log('[API] /api/stocks/movers alpha response keys', Object.keys(payload || {}));
    const now = new Date();
    const formatChange = (value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const clean = value.replace('%', '').trim();
        const num = Number(clean);
        return Number.isFinite(num) ? num : null;
      }
      return null;
    };

    const mapEntry = (entry = {}, sentiment = 'positive') => {
      const pct = formatChange(entry.change_percentage);
      const amount = formatChange(entry.change_amount);
      const price = Number(entry.price);
      const label = sentiment === 'positive' ? 'Top Gainer' : 'Top Loser';
      const direction = sentiment === 'positive' ? 'up' : 'down';
      const changeLabel = pct !== null ? `${pct.toFixed(2)}%` : `${direction}`;
      return {
        ticker: entry.ticker,
        sentiment,
        role: label,
        person: entry.ticker,
        range: price && Number.isFinite(price) ? `$${price.toFixed(2)}` : '—',
        formattedDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        summary: `${entry.ticker} is ${direction} ${changeLabel} today.`,
        changePct: pct,
        changeAmount: amount,
        price: Number.isFinite(price) ? price : null,
      };
    };

    const gainers = Array.isArray(payload.top_gainers) ? payload.top_gainers.slice(0, 4).map((item) => mapEntry(item, 'positive')) : [];
    const losers = Array.isArray(payload.top_losers) ? payload.top_losers.slice(0, 4).map((item) => mapEntry(item, 'negative')) : [];
    const items = [...gainers, ...losers];

    return res.json({ items });
  } catch (error) {
    console.error('Failed to fetch AlphaVantage movers:', error?.message || error);
    const status = error.message === 'missingAlphaKey' ? 501 : 502;
    return res.status(status).json({ error: 'alphaUnavailable' });
  }
});

app.get('/api/congress/highlights', requireAuth, async (req, res) => {
  if (!QUIVER_API_KEY) {
    return res.status(501).json({ error: 'quiverKeyMissing' });
  }

  try {
    const [senateData, houseData] = await Promise.all([
      fetchQuiverData('senatetrading'),
      fetchQuiverData('housetrading'),
    ]);

    const group = new Map();
    const allRecords = [...senateData, ...houseData].filter(
      (entry) => entry && (entry.Senator || entry.Representative),
    );

    allRecords.forEach((record) => {
      const name = record.Senator || record.Representative || 'Unknown Member';
      const role = record.Senator ? 'Sen.' : 'Rep.';
      const chamber = record.Senator ? 'US Senate' : 'US House';
      const rawDate = record.Date || record.TransactionDate || record.TradeDate || null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const dateMs = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.getTime()
        : null;

      const amountRange = record.Range || record.AmountRange || null;
      const parsedAmount = (() => {
        const numericAmount = record.Amount ?? record.amount;
        if (numericAmount !== undefined && numericAmount !== null) {
          const num = Number(numericAmount);
          if (Number.isFinite(num)) return num;
        }
        return parseAmountRange(amountRange || '');
      })();

      const existing = group.get(name) || {
        name,
        role,
        chamber,
        party: record.Party || record.party || record.PoliticalParty || null,
        trades: [],
      };

      existing.trades.push({
        ticker: record.Ticker || null,
        transaction: record.Transaction || null,
        amountRange,
        amountValue: parsedAmount,
        rawDate,
        dateMs,
      });

      group.set(name, existing);
    });

    const highlights = Array.from(group.values())
      .map((entry) => {
        if (!entry.trades.length) return null;
        const trades = [...entry.trades].sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
        const latest = trades[0];
        const tickerSet = new Set(trades.map((trade) => trade.ticker).filter(Boolean));
        const dateLabel = latest.dateMs
          ? new Date(latest.dateMs).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          : 'Recent';
        const sentiment = /sale|sell|dispose/i.test(latest.transaction || '')
          ? 'negative'
          : 'positive';

        return {
          name: entry.name,
          role: entry.role,
          chamber: entry.chamber,
          party: entry.party || 'Unknown',
          lastActivity: latest.dateMs
            ? new Date(latest.dateMs).toISOString()
            : (latest.rawDate || null),
          formattedDate: dateLabel,
          latestTransaction: latest.transaction,
          latestTicker: latest.ticker,
          amountRange: latest.amountRange,
          amountValue: latest.amountValue,
          totalTrades: trades.length,
          topTickers: Array.from(tickerSet).slice(0, 3),
          sentiment,
          summary: `${entry.role} ${entry.name} reported a ${latest.transaction?.toLowerCase() || 'trade'} in ${latest.ticker || 'a security'} on ${dateLabel}.`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0))
      .slice(0, 12);

    return res.json({ items: highlights });
  } catch (error) {
    console.error('Failed to fetch congressional highlights:', error?.message || error);
    const status = error.message === 'missingQuiverKey' ? 501 : 502;
    return res.status(status).json({ error: 'quiverUnavailable' });
  }
});

app.get('/api/congress/search', requireAuth, async (req, res) => {
  if (!QUIVER_API_KEY) {
    return res.status(501).json({ error: 'quiverKeyMissing' });
  }

  const rawQuery = (req.query.q || '').trim();
  if (rawQuery.length < 2) {
    return res.status(400).json({ error: 'missingQuery' });
  }

  const tokens = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const matchesTokens = (name = '') => {
    const lower = name.toLowerCase();
    return tokens.every((token) => lower.includes(token));
  };

  try {
    const [senateData, houseData] = await Promise.all([
      fetchQuiverData('senatetrading'),
      fetchQuiverData('housetrading'),
    ]);

    const grouped = new Map();
    [...senateData, ...houseData].forEach((record) => {
      const name = record?.Senator || record?.Representative;
      if (!name || !matchesTokens(name)) return;

      const chamber = record.Senator ? 'Senate' : 'House';
      const party = record.Party || record.party || null;
      const rawDate = record.Date || record.TransactionDate || record.TradeDate || null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const dateMs = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.getTime()
        : 0;

      const existing = grouped.get(name) || {
        name,
        party,
        chamber,
        active: true,
        avatarUrl: null,
        lastActivity: null,
        latestTicker: record.Ticker || null,
      };

      if (!existing.lastActivity || dateMs > new Date(existing.lastActivity).getTime()) {
        existing.lastActivity = rawDate || null;
        existing.latestTicker = record.Ticker || existing.latestTicker || null;
      }

      grouped.set(name, existing);
    });

    const items = Array.from(grouped.values())
      .sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0))
      .slice(0, 12);

    return res.json({ items });
  } catch (error) {
    console.error('Failed to search congress members:', error?.message || error);
    const status = error.message === 'missingQuiverKey' ? 501 : 502;
    return res.status(status).json({ error: 'quiverUnavailable' });
  }
});

app.get('/api/follows', requireAuth, async (req, res) => {
  try {
    await ensureCongressTablesPromise;
    const rows = await followsRepo.list(req.session.user.email);
    const items = await Promise.all((rows || []).map(async (row) => {
      const queryKey = row.query_key || row.politician_query_key || row;
      const cached = await congressRepo.getByQueryKey(queryKey);
      if (cached) {
        return buildFollowEntry(cached.record, cached.trades, queryKey);
      }
      return {
        queryKey,
        name: row.name || queryKey,
        role: row.position || null,
        party: row.party || null,
        lastTraded: row.last_traded ? toIsoDate(row.last_traded) : null,
        latestTicker: null,
        latestTransaction: null,
      };
    }));
    return res.json({ items });
  } catch (error) {
    console.error('Failed to list follows:', error);
    return res.status(500).json({ error: 'server' });
  }
});

app.post('/api/follows', requireAuth, async (req, res) => {
  const rawQuery = (req.body.congress || req.body.politician || req.body.query || req.body.name || '').trim();
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) {
    return res.status(400).json({ error: 'missingCongressMember' });
  }

  try {
    const persisted = await loadCongressMemberForFollow(rawQuery);
    await followsRepo.follow(req.session.user.email, normalized);
    const item = buildFollowEntry(persisted.record, persisted.trades, normalized);
    return res.status(201).json({ item });
  } catch (error) {
    console.error('Failed to follow:', error);
    if (error.status === 404 || error.message === 'notFound') {
      return res.status(404).json({ error: 'notFound' });
    }
    if (error.message === 'missingQuery') {
      return res.status(400).json({ error: 'missingCongressMember' });
    }
    return res.status(500).json({ error: 'server' });
  }
});

app.delete('/api/follows', requireAuth, async (req, res) => {
  const rawQuery = (req.query.congress
    || req.query.politician
    || req.query.query
    || req.query.name
    || req.body?.congress
    || req.body?.politician
    || '').trim();
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) {
    return res.status(400).json({ error: 'missingCongressMember' });
  }

  try {
    await followsRepo.unfollow(req.session.user.email, normalized);
    return res.status(204).end();
  } catch (error) {
    console.error('Failed to unfollow:', error);
    return res.status(500).json({ error: 'server' });
  }
});

app.post('/api/logout', (req, res) => {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(204).end();
  }

  return req.session.destroy((err) => {
    if (err) {
      console.error('Logout failed:', err);
      return res.status(500).json({ error: 'logoutFailed' });
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(204).end();
  });
});

// Routes for HTML pages
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.sendFile(path.join(__dirname, '../templates/register.html'));
});

const wantsHtmlResponse = req => {
  const accepts = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  return (
    accepts.includes('text/html') || contentType.includes('application/x-www-form-urlencoded')
  );
};

app.post('/register', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();

  if (!isValidEmail(email)) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'invalidEmail' });
    }
    return res.redirect('/register?error=invalidEmail');
  }

  if (password.length < 8) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'weakPassword' });
    }
    return res.redirect('/register?error=weakPassword');
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.none(
      'INSERT INTO users(email, password) VALUES ($1, $2)',
      [email, hash],
    );
    if (wantsJson(req)) {
      return res.status(201).json({ message: 'registered' });
    }
    return res.redirect('/login?success=registered');
  } catch (error) {
    if (error.code === '23505') {
      if (wantsJson(req)) {
        return res.status(409).json({ error: 'exists' });
      }
      return res.redirect('/register?error=exists');
    }
    console.error('Registration failed:', error);
    if (wantsJson(req)) {
      return res.status(500).json({ error: 'server' });
    }
    return res.redirect('/register?error=server');
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.sendFile(path.join(__dirname, '../templates/login.html'));
});

app.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'missing' });
    }
    return res.redirect('/login?error=missing');
  }

  try {
    const user = await db.oneOrNone(
      'SELECT email, password FROM users WHERE email = $1',
      [email],
    );

    if (!user) {
      if (wantsJson(req)) {
        return res.status(401).json({ error: 'invalid' });
      }
      return res.redirect('/login?error=invalid');
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      if (wantsJson(req)) {
        return res.status(401).json({ error: 'invalid' });
      }
      return res.redirect('/login?error=invalid');
    }

    req.session.user = { email: user.email };
    if (wantsJson(req)) {
      return res.status(200).json({ message: 'authenticated' });
    }
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Login failed:', error);
    if (wantsJson(req)) {
      return res.status(500).json({ error: 'server' });
    }
    return res.redirect('/login?error=server');
  }
});

app.get('/homepage', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/homepage.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/dashboard.html'));
});

app.get('/congress', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/congress.html'));
});

app.get('/api/congress', requireAuth, async (req, res) => {
  const queryValue = req.query.name || req.query.q || '';
  const normalized = normalizeQuery(queryValue);

  if (!normalized) {
    return res.status(400).json({ error: 'missingQuery' });
  }

  try {
    await ensureCongressTablesPromise;
    const cached = await congressRepo.getByQueryKey(normalized);

    try {
      const fresh = await fetchExternalCongressMember(queryValue);
      if (fresh) {
        const persisted = await congressRepo.upsert(normalized, fresh);
        return res.json({
          source: 'api',
          congress: formatCongressResponse(persisted.record, persisted.trades),
        });
      }
    } catch (error) {
      console.error('Failed to load congress data from API:', error);
      if (error.message === 'apiUnauthorized') {
        return res.status(502).json({ error: 'apiUnauthorized' });
      }
      if (error.message === 'apiFetchFailed' && !cached) {
        return res.status(502).json({ error: 'apiUnavailable' });
      }
    }

    if (cached) {
      return res.json({
        source: 'cache',
        congress: formatCongressResponse(cached.record, cached.trades),
      });
    }

    return res.status(404).json({ error: 'notFound' });
  } catch (error) {
    console.error('Failed to load congress data:', error);
    return res.status(500).json({ error: 'server' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect('/login');
  });
});

// Default route for testing
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

// Start server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
}

module.exports = app;
module.exports.db = db;
