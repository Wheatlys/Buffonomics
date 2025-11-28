document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.nav-link');
  const title = document.querySelector('.panel__title');
  const description = document.querySelector('.panel--highlight .muted');
  const logoutBtn = document.getElementById('dashboardLogout');
  const stocksList = document.querySelector('.stocks-list');
  const stocksStatus = document.querySelector('.stocks-status');

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

  const renderStocks = (items = []) => {
    if (!stocksList || !stocksStatus) {
      return;
    }

    stocksList.innerHTML = '';
    if (!items.length) {
      stocksStatus.textContent = 'No recent congressional trades available.';
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
      change.textContent = item.sentiment === 'negative' ? 'Sale activity' : 'Purchase activity';

      const summary = document.createElement('p');
      summary.className = 'stock-row__summary';
      summary.textContent = item.summary;

      const meta = document.createElement('div');
      meta.className = 'stock-row__meta';
      meta.innerHTML = `<span>${item.role} ${item.person}</span><span>${item.formattedDate} • ${item.range || 'Range N/A'}</span>`;

      li.append(ticker, change, summary, meta);
      stocksList.appendChild(li);
    });
  };

  const fetchStocks = async () => {
    if (!stocksStatus || !stocksList) {
      return;
    }

    stocksStatus.textContent = 'Fetching congressional trade data…';
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
});
