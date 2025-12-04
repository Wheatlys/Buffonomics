document.addEventListener('DOMContentLoaded', async () => {
  const currentEmailInput = document.getElementById('currentEmail');
  const newEmailInput = document.getElementById('newEmail');
  const emailPasswordInput = document.getElementById('emailPassword');
  const updateEmailBtn = document.getElementById('updateEmailBtn');

  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const changePasswordBtn = document.getElementById('changePasswordBtn');

  // ✅ AUTO-FILL CURRENT EMAIL FROM SESSION
  try {
    const res = await fetch('/api/session', {
      headers: { Accept: 'application/json' }
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload?.user?.email && currentEmailInput) {
        currentEmailInput.value = payload.user.email;
      }
    }
  } catch (err) {
    console.error('Failed to load session email:', err);
  }

  // ✅ UPDATE EMAIL
  updateEmailBtn?.addEventListener('click', async () => {
    const newEmail = newEmailInput.value.trim();
    const password = emailPasswordInput.value.trim();

    if (!newEmail || !password) {
      alert('Please enter a new email and your current password.');
      return;
    }

    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ newEmail, password })
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const code = payload?.error;

        if (code === 'invalidPassword') {
          alert('Incorrect password. Please try again.');
        } else if (code === 'emailExists') {
          alert('That email is already in use.');
        } else if (code === 'invalidEmail') {
          alert('Please enter a valid email address.');
        } else if (code === 'missingFields') {
          alert('Please fill out all fields.');
        } else {
          alert('Failed to update email.');
        }
        return;
      }

      alert('Email updated successfully.');
      currentEmailInput.value = newEmail;
      newEmailInput.value = '';
      emailPasswordInput.value = '';
    } catch (err) {
      alert('Failed to update email.');
      console.error(err);
    }
  });

  // ✅ CHANGE PASSWORD
  changePasswordBtn?.addEventListener('click', async () => {
    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();

    if (!currentPassword || !newPassword) {
      alert('Please fill out both password fields.');
      return;
    }

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const code = payload?.error;

        if (code === 'invalidPassword') {
          alert('Incorrect current password.');
        } else if (code === 'weakPassword') {
          alert('Password must be at least 8 characters.');
        } else {
          alert('Failed to update password.');
        }
        return;
      }

      alert('Password updated successfully.');
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
    } catch (err) {
      alert('Failed to update password.');
      console.error(err);
    }
  });
});