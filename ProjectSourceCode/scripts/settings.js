// ====== Simple Solid Black Background for Settings ======
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('ledBackdrop');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function drawSolidBlack() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Just solid black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }

  drawSolidBlack();
  window.addEventListener('resize', drawSolidBlack);
});

// ====== Settings Logic (localStorage) ======
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'buffonomicsUserSettings';

  const form = document.getElementById('settingsForm');
  const saveStatus = document.getElementById('saveStatus');
  const resetBtn = document.getElementById('resetSettings');

  if (!form) return;

  const displayNameInput = document.getElementById('displayName');
  const handleInput = document.getElementById('handle');
  const emailInput = document.getElementById('email');
  const regionSelect = document.getElementById('newsRegion');
  const intensitySelect = document.getElementById('newsIntensity');
  const topicMarkets = document.getElementById('topic-markets');
  const topicPolicy = document.getElementById('topic-policy');
  const topicEarnings = document.getElementById('topic-earnings');
  const topicEnergy = document.getElementById('topic-energy');
  const notifyEmail = document.getElementById('notifyEmail');
  const notifyInApp = document.getElementById('notifyInApp');

  function showStatus(msg) {
    if (!saveStatus) return;
    saveStatus.textContent = msg;
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (data.displayName && displayNameInput) displayNameInput.value = data.displayName;
      if (data.handle && handleInput) handleInput.value = data.handle;
      if (data.email && emailInput) emailInput.value = data.email;
      if (data.newsRegion && regionSelect) regionSelect.value = data.newsRegion;
      if (data.newsIntensity && intensitySelect) intensitySelect.value = data.newsIntensity;

      if (topicMarkets) topicMarkets.checked = !!data.topicMarkets;
      if (topicPolicy) topicPolicy.checked = !!data.topicPolicy;
      if (topicEarnings) topicEarnings.checked = !!data.topicEarnings;
      if (topicEnergy) topicEnergy.checked = !!data.topicEnergy;

      if (notifyEmail) notifyEmail.checked = !!data.notifyEmail;
      if (notifyInApp) notifyInApp.checked = !!data.notifyInApp;
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }

  function saveSettings(evt) {
    evt.preventDefault();

    const data = {
      displayName: displayNameInput?.value.trim() || 'Buffonomics User',
      handle: handleInput?.value.trim() || 'you',
      email: emailInput?.value.trim() || '',
      newsRegion: regionSelect?.value || 'us',
      newsIntensity: intensitySelect?.value || 'normal',
      topicMarkets: !!topicMarkets?.checked,
      topicPolicy: !!topicPolicy?.checked,
      topicEarnings: !!topicEarnings?.checked,
      topicEnergy: !!topicEnergy?.checked,
      notifyEmail: !!notifyEmail?.checked,
      notifyInApp: !!notifyInApp?.checked
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      showStatus('Settings saved.');
    } catch (e) {
      console.error('Failed to save settings', e);
      showStatus('Could not save settings (storage error).');
    }
  }

  function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);

    if (displayNameInput) displayNameInput.value = 'Buffonomics User';
    if (handleInput) handleInput.value = 'you';
    if (emailInput) emailInput.value = '';
    if (regionSelect) regionSelect.value = 'us';
    if (intensitySelect) intensitySelect.value = 'normal';

    if (topicMarkets) topicMarkets.checked = true;
    if (topicPolicy) topicPolicy.checked = true;
    if (topicEarnings) topicEarnings.checked = false;
    if (topicEnergy) topicEnergy.checked = false;

    if (notifyEmail) notifyEmail.checked = false;
    if (notifyInApp) notifyInApp.checked = true;

    showStatus('Defaults restored. Remember to save.');
  }

  form.addEventListener('submit', saveSettings);
  resetBtn?.addEventListener('click', resetToDefaults);

  // Load settings if they exist
  loadSettings();

  // If no stored settings, initialize defaults silently
  if (!localStorage.getItem(STORAGE_KEY)) {
    resetToDefaults();
    showStatus('');
  }
});