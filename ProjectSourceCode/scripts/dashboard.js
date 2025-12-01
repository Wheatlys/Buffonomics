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
  const normalizeKey = (value = '') => value.trim().toLowerCase();
  let followedKeys = new Set();

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

  const updateFollowButton = (btn, name) => {
    const key = normalizeKey(name);
    const isFollowing = followedKeys.has(key);
    btn.textContent = isFollowing ? 'Following' : 'Follow';
    btn.classList.toggle('btn--following', isFollowing);
    btn.setAttribute('aria-pressed', isFollowing ? 'true' : 'false');
  };

  const toggleFollow = async (name, button) => {
    if (!name) return;
    const key = normalizeKey(name);
    const isFollowing = followedKeys.has(key);
    button.disabled = true;
    button.dataset.loading = 'true';
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
      updateFollowButton(button, name);
      await fetchFollows();
    } catch (error) {
      console.error('Follow toggle failed:', error);
      alert('Unable to update following right now.');
    } finally {
      button.disabled = false;
      delete button.dataset.loading;
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
      const card = document.createElement('article');
      card.className = 'politician-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `View profile for ${item.name}`);
      card.addEventListener('click', () => {
        window.location.href = `/politician?politician=${encodeURIComponent(item.name)}`;
      });
      card.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          window.location.href = `/politician?politician=${encodeURIComponent(item.name)}`;
        }
      });

      const roleLine = document.createElement('div');
      roleLine.className = 'politician-card__role';
      const sentimentLabel = item.latestTransaction || 'Trade';
      const sentimentLower = sentimentLabel.toLowerCase();
      const sentimentClass = sentimentLower.includes('sale')
        ? 'label--sell'
        : sentimentLower.includes('partial')
          ? 'label--partial'
          : 'label--buy';

      const roleText = document.createElement('span');
      roleText.textContent = roleLabel;

      const sentimentChip = document.createElement('span');
      sentimentChip.className = `label ${sentimentClass}`;
      sentimentChip.textContent = sentimentLabel;

      roleLine.append(roleText, sentimentChip);

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

      const followBtn = document.createElement('button');
      followBtn.type = 'button';
      followBtn.className = 'ghost-btn';
      updateFollowButton(followBtn, item.name);
      followBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFollow(item.name, followBtn);
      });

      footer.append(date, amount, followBtn);

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

  const renderFollows = (items = []) => {
    if (!stocksList || !stocksStatus) {
      return;
    }

    stocksList.innerHTML = '';
    if (!items.length) {
      stocksStatus.textContent = 'You are not following any politicians yet.';
      return;
    }

    stocksStatus.textContent = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'stock-row';

      const ticker = document.createElement('div');
      ticker.className = 'stock-row__ticker';
      ticker.textContent = item.name || item.queryKey || '—';

      const change = document.createElement('div');
      change.className = 'stock-row__change';
      const sentimentLower = (item.latestTransaction || '').toLowerCase();
      const isSell = sentimentLower.includes('sale') || sentimentLower.includes('sell');
      change.classList.add(isSell ? 'is-negative' : 'is-positive');
      change.textContent = item.latestTicker || (isSell ? 'Sale' : 'Purchase');

      const summary = document.createElement('p');
      summary.className = 'stock-row__summary';
      summary.textContent = item.role || 'Recent trading activity';

      const meta = document.createElement('div');
      meta.className = 'stock-row__meta';
      const dateLabel = item.lastTraded ? formatDate(item.lastTraded) : 'Recent';
      meta.innerHTML = `<span>${item.party || ''}</span><span>${dateLabel} • ${item.latestTicker || ''}</span>`;

      li.append(ticker, change, summary, meta);
      stocksList.appendChild(li);
    });
  };

  const fetchFollows = async () => {
    if (!stocksStatus || !stocksList) {
      return;
    }

    stocksStatus.textContent = 'Loading who you follow…';
    try {
      const response = await fetch('/api/follows', { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error('Bad response');
      }
      const payload = await response.json();
      const keys = (payload.items || []).map((item) => normalizeKey(item.queryKey || item.name));
      followedKeys = new Set(keys);
      renderFollows(payload.items || []);
    } catch (error) {
      console.error('Unable to load following list:', error);
      stocksStatus.textContent = 'Unable to load following list right now.';
    }
  };

  const bootstrap = async () => {
    await fetchFollows();
    await fetchPoliticians();
  };

  bootstrap();
});
