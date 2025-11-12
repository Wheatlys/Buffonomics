(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const userEl = document.querySelector('.js-user');
    const alertEl = document.querySelector('.js-session-alert');
    const logoutBtn = document.querySelector('.js-logout');

    const showAlert = (message, variant = 'error') => {
      if (!alertEl) return;
      alertEl.textContent = message;
      alertEl.hidden = false;
      alertEl.classList.remove('alert--error', 'alert--success');
      alertEl.classList.add(variant === 'success' ? 'alert--success' : 'alert--error');
    };

    const clearAlert = () => {
      if (!alertEl) return;
      alertEl.hidden = true;
    };

    const loadSession = async () => {
      try {
        const response = await fetch('/api/session', {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error('UNAUTHENTICATED');
        }
        const payload = await response.json();
        const username = payload?.user?.username;
        if (username) {
          if (userEl) userEl.textContent = username;
          showAlert('Session verified. Enjoy exploring Buffonomics!', 'success');
          setTimeout(clearAlert, 2500);
        }
      } catch (err) {
        console.error('Session lookup failed', err);
        showAlert('Session expired. Redirecting to login…');
        setTimeout(() => {
          window.location.assign('/login');
        }, 1500);
      }
    };

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        logoutBtn.textContent = 'Signing out…';
        try {
          await fetch('/api/logout', { method: 'POST' });
        } catch (err) {
          console.error('Logout failed', err);
        } finally {
          window.location.assign('/login');
        }
      });
    }

    loadSession();
  });
})();