(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.js-signin-form');
    if (!form) return;

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitButton = form.querySelector('.js-signin-button');
    const buttonLabel = submitButton?.querySelector('.btn__label');
    const alertBox = document.querySelector('.js-auth-alert');
    const defaultLabel = buttonLabel?.textContent?.trim() || 'Sign In';

    const setBusy = (state) => {
      if (!submitButton) return;
      submitButton.toggleAttribute('aria-busy', state);
      submitButton.disabled = Boolean(state);
      if (buttonLabel) {
        buttonLabel.textContent = state ? 'Signing in…' : defaultLabel;
      }
    };

    const clearAlert = () => {
      if (!alertBox) return;
      alertBox.textContent = '';
      alertBox.hidden = true;
      alertBox.classList.remove('alert--error', 'alert--success');
    };

    const showAlert = (message, variant = 'error') => {
      if (!alertBox) return;
      alertBox.textContent = message;
      alertBox.hidden = false;
      alertBox.classList.remove('alert--error', 'alert--success');
      alertBox.classList.add(variant === 'success' ? 'alert--success' : 'alert--error');
    };

    const markInvalid = (input) => {
      if (!input) return;
      input.classList.add('input--invalid');
      input.addEventListener('input', () => input.classList.remove('input--invalid'), { once: true });
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearAlert();

      [usernameInput, passwordInput].forEach((input) => input?.classList.remove('input--invalid'));

      const username = usernameInput?.value.trim();
      const password = passwordInput?.value ?? '';

      if (!username || !password) {
        if (!username) markInvalid(usernameInput);
        if (!password) markInvalid(passwordInput);
        (username ? passwordInput : usernameInput)?.focus();
        return;
      }

      try {
        setBusy(true);
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
          let errorCode = 'UNKNOWN';
          try {
            const payload = await response.json();
            errorCode = payload?.error || errorCode;
          } catch (_) {
            // non-JSON response, leave as default
          }

          if (errorCode === 'INVALID_CREDENTIALS') {
            showAlert('Invalid username or password.', 'error');
            markInvalid(passwordInput);
            passwordInput?.focus();
          } else if (errorCode === 'MISSING_CREDENTIALS') {
            showAlert('Please provide both username and password.', 'error');
          } else {
            showAlert('Unable to sign in right now. Please retry.', 'error');
          }
          return;
        }

        showAlert('Signed in! Redirecting…', 'success');
        window.location.assign('/home');
      } catch (err) {
        console.error('Login request failed', err);
        showAlert('Network error. Check your connection and try again.', 'error');
      } finally {
        setBusy(false);
      }
    }, { capture: true });
  });
})();
