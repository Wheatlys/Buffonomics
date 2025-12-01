const axios = require('axios');

const normalizeQuery = (value = '') => value.trim().toLowerCase();

const quiverClient = axios.create({
  baseURL: process.env.QUIVER_API_BASE_URL || 'https://api.quiverquant.com',
  timeout: 12000,
});

const sanitizeParty = (raw = '') => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === 'd' || value.startsWith('dem')) return 'Democratic Party';
  if (value === 'r' || value.startsWith('rep')) return 'Republican Party';
  if (value === 'i') return 'Independent';
  return raw;
};

const toTitle = (text = '') => text.replace(/\w\S*/g, (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase());

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

const lowerBoundFromRange = (value = '') => {
  if (!value) return null;
  const clean = value.replace(/\$|,/g, '');
  const [min] = clean.split('-').map((part) => Number(part.trim()));
  return Number.isFinite(min) ? min : null;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0];
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
};

const buildTradeFromRecord = (record = {}) => {
  const rawRange = record.Range
    || record.range
    || record.AmountRange
    || record.Trade_Size_USD
    || record.TradeSizeUSD
    || null;

  const parsedLowerBound = (() => {
    const value = record.Amount ?? record.amount ?? null;
    if (value !== null && value !== undefined) return Number(value);
    if (record.Trade_Size_USD) {
      const clean = String(record.Trade_Size_USD).replace(/[^\d.-]/g, '');
      const num = Number(clean);
      if (Number.isFinite(num)) return num;
    }
    return lowerBoundFromRange(rawRange);
  })();

  const description = (record.Description
    || record.description
    || record.Comments
    || record.comments
    || record.Subholding
    || record.asset_description
    || record.AssetDescription
    || '').trim();

  return {
    stockSymbol: record.Ticker || record.ticker || record.asset || record.asset_symbol || null,
    transactionType: record.Transaction || record.transaction || record.type || record.Owner || null,
    filedDate: normalizeDate(
      record.ReportDate
      || record.report_date
      || record.Report_Date
      || record.DisclosureDate
      || record.disclosure_date
      || record.FilingDate
      || record.filing_date
      || record.Filed,
    ),
    tradedDate: normalizeDate(
      record.TransactionDate
      || record.transaction_date
      || record.Transaction_Date
      || record.TradeDate
      || record.trade_date
      || record.Date
      || record.Traded,
    ),
    amountRange: rawRange,
    amountValue: parsedLowerBound,
    description,
    estReturn: record.Return ?? record.return ?? record.excess_return ?? null,
    chamber: record.House || record.Chamber || record.branch || null,
    district: (record.District || record.district || record.State || record.state || '').trim() || null,
    party: sanitizeParty(record.Party || record.party || ''),
    tickerType: record.TickerType || record.ticker_type || null,
    excessReturn: record.ExcessReturn ?? record.excess_return ?? null,
    priceChange: record.PriceChange ?? record.price_change ?? null,
    spyChange: record.SPYChange ?? record.spy_change ?? record.spy_delta ?? null,
    lastModified: record.last_modified
      || record.uploaded
      ? new Date(record.last_modified || record.uploaded).toISOString()
      : null,
  };
};

const formatExternalPayload = (queryKey, payload = {}) => {
  if (!payload || !payload.name) {
    return null;
  }

  return {
    queryKey,
    name: payload.name,
    party: payload.party || null,
    position: payload.position || null,
    netWorth: payload.netWorth ?? null,
    tradeVolume: payload.tradeVolume ?? null,
    totalTrades: payload.totalTrades ?? (payload.trades ? payload.trades.length : null),
    lastTraded: payload.lastTraded || null,
    yearsActive: payload.yearsActive || null,
    currentMember: payload.currentMember ?? null,
    avatarUrl: payload.avatarUrl || null,
    trades: (payload.trades || []).map((trade) => ({
      stockSymbol: trade.stockSymbol,
      transactionType: trade.transactionType,
      filedDate: trade.filedDate || null,
      tradedDate: trade.tradedDate || null,
      amountRange: trade.amountRange || null,
      amountValue: trade.amountValue ?? null,
      description: trade.description || '',
      estReturn: trade.estReturn || null,
      chamber: trade.chamber || null,
      district: trade.district || null,
      party: trade.party || null,
      tickerType: trade.tickerType || null,
      excessReturn: trade.excessReturn ?? null,
      priceChange: trade.priceChange ?? null,
      spyChange: trade.spyChange ?? null,
      lastModified: trade.lastModified || null,
    })),
  };
};

const buildPayloadFromQuiver = (queryKey, records = []) => {
  if (!records.length) return null;
  const ordered = [...records].sort((a, b) => {
    const dateA = new Date(a.TransactionDate || a.transaction_date || a.ReportDate || 0);
    const dateB = new Date(b.TransactionDate || b.transaction_date || b.ReportDate || 0);
    return dateB - dateA;
  });
  const template = ordered[0];
  const chamber = template.Chamber || template.House || template.branch || '';
  const state = template.State || template.state || template.District || '';
  const party = sanitizeParty(template.Party || template.party || '');
  const trades = ordered.map(buildTradeFromRecord);
  const volume = trades.reduce((sum, trade) => {
    if (Number.isFinite(trade.amountValue)) {
      return sum + Number(trade.amountValue);
    }
    const approx = parseAmountRange(trade.amountRange);
    return approx ? sum + approx : sum;
  }, 0);

  return {
    queryKey,
    name: template.Representative || template.Politician || template.Name || queryKey,
    party,
    position: chamber
      ? `${toTitle(chamber)}${state ? ` · ${state}` : ''}`
      : state || null,
    netWorth: null,
    tradeVolume: volume || null,
    totalTrades: trades.length,
	    lastTraded: trades[0]?.tradedDate || trades[0]?.filedDate || null,
    yearsActive: null,
    currentMember: true,
    avatarUrl: null,
    trades,
  };
};

const tokenizeName = (value = '') => value
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

const fiveYearsAgo = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 5);
  return date.toISOString().split('T')[0];
};

const fetchDataset = async (path, apiKey, query) => {
  if (!path) return [];
  const aggregated = [];
  let page = 1;
  const isCongress = /congresstrading/i.test(path);
  const pageSize = Number(process.env.QUIVER_PAGE_SIZE || 500);

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params = {};
      if (!isCongress) {
        params.startDate = fiveYearsAgo();
      }
      if (/alltransactions/i.test(path)) {
        params.name = query;
        params.representative = query;
      }
      if (isCongress) {
        params.representative = query;
        params.normalized = true;
        params.version = 'V2';
        params.nonstock = false;
        params.page = page;
        params.page_size = pageSize;
      }

      console.log('[Quiver] Request', path, params);
      const response = await quiverClient.get(path, {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        params,
      });
      console.log('[Quiver] Response', path, response.status, Array.isArray(response.data) ? response.data.length : response.data?.data?.length);

      const data = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];

      aggregated.push(...data.map((item) => ({ ...item, __source: path })));

      if (!isCongress || data.length < pageSize) {
        break;
      }

      page += 1;
    }
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      throw new Error('apiUnauthorized');
    }
    if (status && status !== 404) {
      console.error(`Quiver API fetch failed for ${path}:`, error.message);
      throw new Error('apiFetchFailed');
    }
  }

  return aggregated;
};

const isMeaningful = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
};

const mergeRawRecords = (primary = {}, fallback = {}) => {
  const merged = { ...fallback };
  Object.keys(primary).forEach((key) => {
    if (isMeaningful(primary[key])) {
      merged[key] = primary[key];
    }
  });
  return merged;
};

const tradeQualityScore = (trade, source = '') => {
  let score = 0;
  if (trade.description) score += 3;
  if (trade.amountValue !== null && trade.amountValue !== undefined) score += 2;
  if (trade.excessReturn !== null && trade.excessReturn !== undefined) score += 2;
  if (trade.party) score += 1;
  if (trade.chamber) score += 0.5;
  if (trade.filedDate) score += 0.5;
  if (trade.tickerType) score += 0.3;
  if (source && /congresstrading/i.test(source)) score += 1.5;
  return score;
};

const dedupeRecords = (records = []) => {
  const map = new Map();
  records.forEach((record) => {
    const trade = buildTradeFromRecord(record);
    const key = [
      trade.stockSymbol || '',
      (trade.transactionType || '').toLowerCase(),
      trade.tradedDate || trade.filedDate || '',
      trade.amountRange || '',
    ].join('|');
    const score = tradeQualityScore(trade, record.__source || '');
    const current = map.get(key);
    if (!current || score > current.score) {
      map.set(key, { record, trade, score });
    } else {
      const mergedRecord = mergeRawRecords(current.record, record);
      const mergedTrade = buildTradeFromRecord(mergedRecord);
      const mergedScore = tradeQualityScore(mergedTrade, mergedRecord.__source || current.record.__source || '');
      map.set(key, {
        record: mergedRecord,
        trade: mergedTrade,
        score: mergedScore,
      });
    }
  });
  return Array.from(map.values()).map((item) => item.record);
};

const fetchQuiverPolitician = async (query) => {
  const apiKey = process.env.QUIVER_API_KEY;
  if (!apiKey) return null;

  const configuredPath = process.env.QUIVER_TRADES_PATH;
  const extraPaths = (process.env.QUIVER_EXTRA_PATHS || '')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);
  const fallbackPaths = [
    '/beta/bulk/congresstrading',
    '/beta/congresstrading',
    '/beta/alltransactions',
    '/beta/housetrading',
    '/beta/senatetrading',
    '/beta/live/housetrading',
    '/beta/live/senatetrading',
    '/beta/lawmakers/trades',
    '/beta/live/lawmakers/trades',
    ...extraPaths,
  ];

  const endpoints = [configuredPath, ...fallbackPaths].filter(Boolean);
  const normalized = normalizeQuery(query);
  const queryTokens = tokenizeName(query);
  let aggregated = [];

  for (const endpoint of endpoints) {
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchDataset(endpoint, apiKey, query);
    if (data.length) {
      aggregated = aggregated.concat(data);
    }
  }

  if (!aggregated.length) {
    return null;
  }

  const matching = aggregated.filter((record) => {
    const rawName = record.Representative
      || record.Politician
      || record.Name
      || [record.FirstName, record.LastName].filter(Boolean).join(' ');
    const recordTokens = tokenizeName(rawName);
    return recordTokens.length
      && queryTokens.every((token) => recordTokens.includes(token));
  });

  if (!matching.length) {
    return null;
  }
  const uniqueRecords = dedupeRecords(matching);
  return buildPayloadFromQuiver(normalized, uniqueRecords);
};

const fetchExternalPolitician = async (query) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const quiverResult = await fetchQuiverPolitician(query);
  if (quiverResult) {
    return quiverResult;
  }

  const apiUrl = process.env.POLITICIAN_API_URL;
  if (apiUrl) {
    try {
      const response = await axios.get(apiUrl, { params: { name: query } });
      const payload = formatExternalPayload(normalized, response.data);
      if (payload) return payload;
    } catch (error) {
      console.error('External API fetch failed:', error.message);
      throw new Error('apiFetchFailed');
    }
  }

  return null;
};

module.exports = {
  fetchExternalPolitician,
  normalizeQuery,
};
