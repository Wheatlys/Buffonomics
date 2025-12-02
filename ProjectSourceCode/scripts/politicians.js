/* eslint-disable no-console */
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  notation: 'compact',
});

const numberFormatter = new Intl.NumberFormat('en-US');
const normalizeKey = (value = '') => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
let followedKeys = new Set();

const HERO_DEFAULT_TITLE = 'No data yet';
const HERO_DEFAULT_SUB =
  'Connect your preferred data source to see performance, positions, and alerts.';

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  return `${num.toFixed(2)}%`;
};

const elements = {
  form: document.getElementById('politicianSearch'),
  input: document.getElementById('searchInput'),
  heroHeadline: document.getElementById('heroHeadline'),
  heroSubline: document.getElementById('heroSubline'),
  name: document.getElementById('politicianName'),
  position: document.getElementById('politicianPosition'),
  party: document.getElementById('politicianParty'),
  tradeVolume: document.getElementById('statTradeVolume'),
  totalTrades: document.getElementById('statTotalTrades'),
  lastTraded: document.getElementById('statLastTraded'),
  currentMember: document.getElementById('statCurrentMember'),
  tradeVolumeTotal: document.getElementById('tradeVolumeTotal'),
  tradeCountTotal: document.getElementById('tradeCountTotal'),
  tradesTable: document.getElementById('tradesTableBody'),
  rawPayload: document.getElementById('rawApiPayload'),
  followBtn: document.querySelector('.profile__follow'),
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch (error) {
    return value;
  }
};

const setLoadingState = (isLoading) => {
  if (!elements.form) return;
  const button = elements.form.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Searching…' : 'Search';
    button.classList.toggle('btn--loading', isLoading);
  }
};

const showStatus = (title = HERO_DEFAULT_TITLE, subline = HERO_DEFAULT_SUB) => {
  if (elements.heroHeadline) elements.heroHeadline.textContent = title;
  if (elements.heroSubline) elements.heroSubline.textContent = subline;
};

const clearProfile = () => {
  showStatus();
  [
    'name',
    'position',
    'party',
    'tradeVolume',
    'totalTrades',
    'lastTraded',
    'currentMember',
    'tradeVolumeTotal',
    'tradeCountTotal',
  ].forEach((key) => {
    if (elements[key]) elements[key].textContent = '—';
  });
  if (elements.tradesTable) {
    elements.tradesTable.innerHTML = '<tr><td colspan="10">No trades available.</td></tr>';
  }
  if (elements.rawPayload) {
    elements.rawPayload.textContent = 'No data loaded yet.';
  }
  if (elements.followBtn) {
    elements.followBtn.classList.remove('profile__follow--active');
    elements.followBtn.textContent = 'Follow Trading Activity';
    elements.followBtn.setAttribute('aria-pressed', 'false');
  }
};

const renderTrades = (trades = []) => {
  const renderPercentValue = (value) => {
    if (value === null || value === undefined) return '—';
    return formatPercent(value);
  };

  if (!elements.tradesTable) return;
  if (!trades.length) {
    elements.tradesTable.innerHTML = '<tr><td colspan="8">No trades available.</td></tr>';
    return;
  }

  elements.tradesTable.innerHTML = trades.map((trade) => {
    const badgeClass = (trade.type || '').toLowerCase() === 'sell' ? 'badge--sell' : 'badge--buy';
    const amountNumber = Number(trade.amountValue);
    const amountValue = Number.isFinite(amountNumber) ? currencyFormatter.format(amountNumber) : '—';
    return `
      <tr>
        <td>
          <div class="stock-cell">
            <span class="stock-symbol">${trade.stockSymbol || '—'}</span>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${trade.transactionType || '—'}</span>
        </td>
        <td>${trade.filedDate ? formatDate(trade.filedDate) : '—'}</td>
        <td>${trade.tradedDate ? formatDate(trade.tradedDate) : '—'}</td>
        <td>${trade.amountRange || '—'}</td>
        <td>${amountValue}</td>
        <td>${trade.description || '—'}</td>
        <td>${renderPercentValue(trade.excessReturn)}</td>
      </tr>
    `;
  }).join('');
};

const renderProfile = (profile) => {
  if (!profile) {
    clearProfile();
    return;
  }

  if (elements.name) elements.name.textContent = profile.name || '—';
  if (elements.position) elements.position.textContent = profile.position || '—';
  if (elements.party) elements.party.textContent = profile.party || '—';
  if (elements.tradeVolume) {
    elements.tradeVolume.textContent = profile.tradeVolume
      ? currencyFormatter.format(profile.tradeVolume)
      : '—';
  }
  if (elements.totalTrades) {
    elements.totalTrades.textContent = profile.totalTrades
      ? numberFormatter.format(profile.totalTrades)
      : '—';
  }
  if (elements.lastTraded) elements.lastTraded.textContent = profile.lastTraded
    ? formatDate(profile.lastTraded)
    : '—';
  if (elements.currentMember) elements.currentMember.textContent = profile.currentMember ? 'Yes' : 'No';
  if (elements.tradeVolumeTotal) {
    elements.tradeVolumeTotal.textContent = profile.tradeVolume
      ? currencyFormatter.format(profile.tradeVolume)
      : '—';
  }
  if (elements.tradeCountTotal) {
    elements.tradeCountTotal.textContent = profile.totalTrades
      ? numberFormatter.format(profile.totalTrades)
      : '—';
  }

  showStatus(`${profile.name}`, `${profile.position || ''} • ${profile.party || ''}`.trim());
  document.title = `Buffonomics · ${profile.name}`;
  renderTrades(profile.trades);
  if (elements.followBtn) {
    const isFollowing = followedKeys.has(normalizeKey(profile.name || ''));
    elements.followBtn.classList.toggle('profile__follow--active', isFollowing);
    elements.followBtn.textContent = isFollowing ? 'Following' : 'Follow Trading Activity';
    elements.followBtn.setAttribute('aria-pressed', isFollowing ? 'true' : 'false');
    elements.followBtn.dataset.targetName = profile.name || '';
  }
};

const renderRawPayload = (payload) => {
  if (!elements.rawPayload) return;
  if (!payload) {
    elements.rawPayload.textContent = 'No data loaded yet.';
    return;
  }
  elements.rawPayload.textContent = JSON.stringify(payload, null, 2);
};

const loadPolitician = async (query) => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    clearProfile();
    showStatus('Enter a name', 'Please provide a politician name to begin.');
    return;
  }

  setLoadingState(true);
  try {
    const params = new URLSearchParams({ name: trimmed, fresh: 'true' });
    const response = await fetch(`/api/politicians?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const errorMessage = payload?.error === 'notFound'
        ? `No data found for "${trimmed}".`
        : 'Unable to load data right now.';
      clearProfile();
      showStatus('No data yet', errorMessage);
      renderRawPayload(payload);
      return;
    }

    const payload = await response.json();
    if (payload?.politician) {
      renderProfile(payload.politician);
      renderRawPayload(payload);
      if (window.history && window.history.replaceState) {
        const paramsObj = new URLSearchParams(window.location.search);
        paramsObj.set('politician', trimmed);
        window.history.replaceState({}, document.title, `${window.location.pathname}?${paramsObj.toString()}`);
      }
    } else {
      clearProfile();
    }
  } catch (error) {
    console.error('Failed to load politician', error);
    clearProfile();
    showStatus('No data yet', 'Unable to reach the server. Please try again later.');
    renderRawPayload({ error: error?.message || 'unknown' });
  } finally {
    setLoadingState(false);
  }
};

const fetchFollows = async () => {
  try {
    const res = await fetch('/api/follows', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const payload = await res.json();
    const keys = (payload.items || []).map((item) => normalizeKey(item.queryKey || item.name));
    followedKeys = new Set(keys);
  } catch (error) {
    console.error('Failed to load follows list', error);
  }
};

const toggleFollow = async () => {
  if (!elements.followBtn) return;
  const name = elements.followBtn.dataset.targetName || elements.name?.textContent || '';
  if (!name) return;
  const key = normalizeKey(name);
  const isFollowing = followedKeys.has(key);
  elements.followBtn.disabled = true;
  elements.followBtn.classList.add('btn--loading');
  try {
    if (isFollowing) {
      const params = new URLSearchParams({ politician: name });
      const res = await fetch(`/api/follows?${params.toString()}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('unfollowFailed');
      followedKeys.delete(key);
    } else {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ politician: name }),
      });
      if (!res.ok) throw new Error('followFailed');
      followedKeys.add(key);
    }
    const active = !isFollowing;
    elements.followBtn.classList.toggle('profile__follow--active', active);
    elements.followBtn.textContent = active ? 'Following' : 'Follow Trading Activity';
    elements.followBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  } catch (error) {
    console.error('Follow toggle failed', error);
    alert('Unable to update follow right now.');
  } finally {
    elements.followBtn.disabled = false;
    elements.followBtn.classList.remove('btn--loading');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  fetchFollows();

  if (elements.form) {
    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadPolitician(elements.input?.value);
    });
  }

  if (elements.followBtn) {
    elements.followBtn.addEventListener('click', toggleFollow);
  }

  const params = new URLSearchParams(window.location.search);
  const initial = params.get('politician');
  if (initial && elements.input) {
    elements.input.value = initial;
    loadPolitician(initial);
  } else {
    clearProfile();
  }
});
