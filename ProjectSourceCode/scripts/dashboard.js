document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.nav-link');
  const title = document.querySelector('.panel__title');
  const description = document.querySelector('.panel--highlight .muted');
  const logoutBtn = document.getElementById('dashboardLogout');
  const stocksList = document.querySelector('.stocks-list');
  const stocksStatus = document.querySelector('.stocks-status');
  const politicianGrid = document.querySelector('[data-politicians-grid]');
  const politicianStatus = document.querySelector('[data-politicians-status]');
  const politicianRefresh = document.querySelector('[data-politicians-refresh]');
  const searchForm = document.getElementById('memberSearch');
  const searchInput = document.getElementById('memberSearchInput');
  const searchStatus = document.querySelector('[data-search-status]');
  const searchDropdown = document.querySelector('[data-search-dropdown]');
  const searchResults = document.querySelector('[data-search-results]');

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const label = btn.textContent.trim();
      if (title) {
        title.textContent = `${label} coming soon`;
      }
      if (description) {
        description.textContent = 'Hook up APIs, data feeds, or widgets to populate this panel once the feature is ready.';
      }
    });
  });

  logoutBtn?.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    logoutBtn.dataset.loading = 'true';

    try {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Logout failed');
      }
      window.location.href = '/login';
    } catch (error) {
      console.error(error);
      alert('Unable to log out right now. Please try again.');
      logoutBtn.disabled = false;
      delete logoutBtn.dataset.loading;
    }
  });

  const updateSearchStatus = (text = '') => {
    if (searchStatus) {
      searchStatus.textContent = text;
    }
  };

  const openSearchDropdown = () => {
    searchDropdown?.classList.add('is-open');
  };

  const closeSearchDropdown = () => {
    searchDropdown?.classList.remove('is-open');
  };

  const renderSearchResults = (items = []) => {
    if (!searchResults || !searchStatus) return;

    searchResults.innerHTML = '';
    if (!items.length) {
      updateSearchStatus('No matches found.');
      return;
    }

    updateSearchStatus('');
    items.forEach((item) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = `/politician?politician=${encodeURIComponent(item.name)}`;
      link.setAttribute('aria-label', `View profile for ${item.name}`);

      const avatar = document.createElement('div');
      avatar.className = 'search-result__avatar';
      if (item.avatarUrl) {
        const img = document.createElement('img');
        img.src = item.avatarUrl;
        img.alt = `${item.name}`;
        avatar.appendChild(img);
      } else {
        avatar.textContent = (item.name || '??').charAt(0).toUpperCase();
      }

      const name = document.createElement('p');
      name.className = 'search-result__name';
      name.textContent = item.name || '—';

      const meta = document.createElement('p');
      meta.className = 'search-result__meta';
      const metaText = item.latestTicker
        ? `Latest: ${item.latestTicker}`
        : 'Recent activity';
      meta.textContent = metaText;

      link.append(avatar, name, meta);
      li.appendChild(link);
      searchResults.appendChild(li);
    });
  };

  let searchDebounce;
  const performSearch = async (query) => {
    if (!searchResults || !searchStatus) return;
    if (!query || query.length < 2) {
      updateSearchStatus('Start typing a name…');
      searchResults.innerHTML = '';
      return;
    }

    updateSearchStatus('Searching…');
    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`/api/politicians/search?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('searchFailed');
      const payload = await response.json();
      renderSearchResults(payload.items || []);
    } catch (error) {
      console.error('Search failed:', error);
      updateSearchStatus('Unable to search right now.');
      searchResults.innerHTML = '';
    }
  };

  searchInput?.addEventListener('input', (event) => {
    const value = event.target.value || '';
    openSearchDropdown();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(value.trim()), 220);
  });

  document.addEventListener('click', (event) => {
    if (!searchDropdown || searchDropdown.contains(event.target) || searchForm?.contains(event.target)) {
      return;
    }
    closeSearchDropdown();
  });

  searchInput?.addEventListener('focus', () => {
    openSearchDropdown();
  });

  searchForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = (searchInput?.value || '').trim();
    if (!query) {
      updateSearchStatus('Enter a name to search.');
      return;
    }

    updateSearchStatus('Searching…');
    const submitBtn = searchForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const params = new URLSearchParams({ name: query });
      const response = await fetch(`/api/politicians?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error('notFound');
      }
      const payload = await response.json();
      const targetName = payload?.politician?.name || query;
      window.location.href = `/politician?politician=${encodeURIComponent(targetName)}`;
    } catch (error) {
      console.error('Search failed:', error);
      updateSearchStatus('No results found. Try another name.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  const formatDate = (value) => {
    if (!value) return 'Recent activity';
    try {
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      return value;
    }
  };

  const renderPoliticians = (items = []) => {
    if (!politicianGrid || !politicianStatus) return;

    politicianGrid.innerHTML = '';
    if (!items.length) {
      politicianStatus.textContent = 'No recent politician trades available.';
      return;
    }

    politicianStatus.textContent = '';
    items.forEach((item) => {
      const roleLabel = [item.role, item.chamber].filter(Boolean).join(' · ') || 'Member';
      const sentimentClass = item.sentiment === 'negative'
        ? 'pill--sentiment-negative'
        : 'pill--sentiment-positive';
      const card = document.createElement('a');
      card.className = 'politician-card';
      card.href = `/politician?politician=${encodeURIComponent(item.name)}`;
      card.setAttribute('aria-label', `View profile for ${item.name}`);

      const roleLine = document.createElement('div');
      roleLine.className = 'politician-card__role';
      const sentimentLabel = item.latestTransaction || 'Trade';
      roleLine.textContent = [roleLabel, sentimentLabel].filter(Boolean).join(' • ');

      const name = document.createElement('h3');
      name.className = 'politician-card__name';
      name.textContent = item.name || '—';

      const summary = document.createElement('p');
      summary.className = 'politician-card__summary';
      summary.textContent = item.summary || 'Recent trading activity.';

      const tags = document.createElement('div');
      tags.className = 'politician-card__tags';
      if (Array.isArray(item.topTickers) && item.topTickers.length) {
        item.topTickers.forEach((ticker) => {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = ticker;
          tags.appendChild(tag);
        });
      } else {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = item.latestTicker || 'Ticker N/A';
        tags.appendChild(tag);
      }

      const footer = document.createElement('div');
      footer.className = 'politician-card__footer';
      const date = document.createElement('span');
      date.textContent = `Last trade: ${item.formattedDate || formatDate(item.lastActivity)}`;

      const amountLabel = (() => {
        if (Number.isFinite(item.amountValue)) return currencyFormatter.format(item.amountValue);
        if (item.amountRange) return item.amountRange;
        return 'Amount N/A';
      })();
      const amount = document.createElement('span');
      amount.textContent = `${item.latestTicker || '—'} • ${amountLabel}`;

      footer.append(date, amount);

      card.append(roleLine, name, summary, tags, footer);
      politicianGrid.appendChild(card);
    });
  };

  const fetchPoliticians = async () => {
    if (!politicianGrid || !politicianStatus) return;

    politicianStatus.textContent = 'Fetching latest highlights…';
    politicianRefresh?.setAttribute('disabled', 'true');

    try {
      const response = await fetch('/api/politicians/highlights');
      if (!response.ok) {
        throw new Error('Bad response');
      }
      const payload = await response.json();
      renderPoliticians(payload.items || []);
    } catch (error) {
      console.error('Unable to load politician highlights:', error);
      politicianStatus.textContent = 'Unable to load highlights right now.';
      politicianGrid.innerHTML = '';
    } finally {
      politicianRefresh?.removeAttribute('disabled');
    }
  };

  politicianRefresh?.addEventListener('click', () => fetchPoliticians());

  const renderStocks = (items = []) => {
    if (!stocksList || !stocksStatus) {
      return;
    }

    stocksList.innerHTML = '';
    if (!items.length) {
      stocksStatus.textContent = 'No market movers available.';
      return;
    }

    stocksStatus.textContent = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'stock-row';

      const ticker = document.createElement('div');
      ticker.className = 'stock-row__ticker';
      ticker.textContent = item.ticker || '—';

      const change = document.createElement('div');
      change.className = `stock-row__change ${item.sentiment === 'negative' ? 'is-negative' : 'is-positive'}`;
      const pctLabel = Number.isFinite(item.changePct)
        ? `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%`
        : null;
      const amtLabel = Number.isFinite(item.changeAmount)
        ? `${item.changeAmount > 0 ? '+' : ''}$${item.changeAmount.toFixed(2)}`
        : null;
      change.textContent = pctLabel || amtLabel || (item.sentiment === 'negative' ? 'Down' : 'Up');

      const summary = document.createElement('p');
      summary.className = 'stock-row__summary';
      summary.textContent = item.summary;

      const meta = document.createElement('div');
      meta.className = 'stock-row__meta';
      const priceLabel = item.price && Number.isFinite(item.price)
        ? `$${item.price.toFixed(2)}`
        : item.range || 'Price N/A';
      meta.innerHTML = `<span>${item.role || ''}</span><span>${item.formattedDate} • ${priceLabel}</span>`;

      li.append(ticker, change, summary, meta);
      stocksList.appendChild(li);
    });
  };

  const fetchStocks = async () => {
    if (!stocksStatus || !stocksList) {
      return;
    }

    stocksStatus.textContent = 'Fetching daily market movers…';
    try {
      const response = await fetch('/api/stocks/movers');
      if (!response.ok) {
        throw new Error('Bad response');
      }
      const payload = await response.json();
      renderStocks(payload.items || []);
    } catch (error) {
      console.error('Unable to load stocks:', error);
      stocksStatus.textContent = 'Unable to load market data right now.';
    }
  };

  fetchStocks();
  fetchPoliticians();
});
