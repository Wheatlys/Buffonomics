// ====== Login / Register form UX ======
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const messageMap = {
    registered: 'Account created! Sign in below.',
    invalid: 'Email or password is incorrect.',
    missing: 'Please enter both email and password.',
    invalidEmail: 'Enter a valid email address (example@domain.com).',
    weakPassword: 'Passwords must be at least 8 characters long.',
    exists: 'Looks like you already have an account with that email.',
    server: 'Something went wrong. Please try again.',
  };

  const showAlert = (box, text, variant = 'error') => {
    if (!box || !text) return;
    box.textContent = text;
    box.dataset.variant = variant;
    box.hidden = false;
  };

  const clearAlert = (box) => {
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
    delete box.dataset.variant;
  };

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.querySelectorAll('.js-auth-form').forEach((form) => {
    const btn = form.querySelector('.js-signin-button');
    const emailInput = form.querySelector('input[name="email"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const alertBox = form.querySelector('[data-alert]');

    const successCode = params.get('success');
    const errorCode = params.get('error');
    if (successCode && messageMap[successCode]) {
      showAlert(alertBox, messageMap[successCode], 'success');
    } else if (errorCode && messageMap[errorCode]) {
      showAlert(alertBox, messageMap[errorCode], 'error');
    }

    [emailInput, passwordInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        input.classList.remove('input--invalid');
        clearAlert(alertBox);
      });
    });

    form.addEventListener('submit', (e) => {
      clearAlert(alertBox);

      const trimmedEmail = (emailInput?.value || '').trim();
      const trimmedPassword = (passwordInput?.value || '').trim();
      const invalidFields = [];

      if (!trimmedEmail || !emailPattern.test(trimmedEmail.toLowerCase())) {
        invalidFields.push(emailInput);
      }

      if (!trimmedPassword) {
        invalidFields.push(passwordInput);
      }

      if (invalidFields.length) {
        e.preventDefault();
        invalidFields.forEach((field) => field?.classList.add('input--invalid'));
        invalidFields[0]?.focus();
        showAlert(alertBox, 'Please enter a valid email and password.');
        return;
      }

      btn?.setAttribute('aria-busy', 'true');
    });
  });

  if ((params.get('success') || params.get('error')) && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ====== LED Panel Background (unchanged) ======
  const canvas = document.getElementById('ledBackdrop');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // LED parameters
  const GAP  = 12;    // px between LED centers
  const R    = 2.6;   // LED core radius
  const GLOW = R * 2.1;

  // Colors (gold + black)
  const RED      = { r:255, g:208, b:64 };  // bright gold
  const RED_DARK = { r:176, g:124, b:16 };  // deep gold for shaded core
  const RED_OFF  = { r:20,  g:16,  b:6  };  // faint “off” gold
  const BG       = '#0a0b0c';               // near-black background

  let dpr, W, H, COLS, ROWS;

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);

    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    COLS = Math.ceil(W / GAP);
    ROWS = Math.ceil(H / GAP);

    drawFrame(); // one static frame after resize
  }
  window.addEventListener('resize', () => {
    clearTimeout(resize._t);
    resize._t = setTimeout(resize, 100);
  });

  const TAU = Math.PI * 2;
  function lerp(a,b,t){ return a + (b-a)*t; }
  function clamp(v, mn, mx){ return Math.min(mx, Math.max(mn, v)); }
  function wrap01(v){ return v - Math.floor(v); }
  function wrapSym(v){ return v - Math.round(v); }
  function colorToRGBA(c, a){ return `rgba(${c.r},${c.g},${c.b},${a})`; }

  // Seamless diagonal wave (bottom-left -> top-right)
  let phase = 0;
  let breath = 0;

  const BAND_SPEED   = 0.085; // units/sec across normalized diagonal
  const BREATH_SPEED = 0.33;  // Hz
  const BAND_WIDTH   = 0.18;
  const BAND_SHARP   = 3.4;

  function waveBrightness(col, row) {
    if (!COLS || !ROWS) return 0;

    const xNorm = COLS > 1 ? col / (COLS - 1) : 0;
    const yNorm = ROWS > 1 ? row / (ROWS - 1) : 0;

    // torus-friendly diagonal coordinate: 0 at BL, 1 at TR
    const s = wrap01(xNorm + (1 - yNorm));
    const dist = wrapSym(s - phase); // [-0.5, 0.5]

    const ridge = Math.exp(-Math.pow(dist / BAND_WIDTH, 2) * BAND_SHARP);
    const wake  = Math.exp(-Math.pow((dist + BAND_WIDTH * 0.9) / (BAND_WIDTH * 1.65), 2) * 1.1);

    const slope = -(2 * dist / (BAND_WIDTH * BAND_WIDTH)) * ridge;
    const highlight = 0.28 * Math.max(0, slope);
    const shadow    = 0.22 * Math.max(0, -slope);

    // vertical vignette (kept for depth)
    const vshade = 0.55 + 0.45 * Math.pow(1 - Math.abs(yNorm - 0.5), 1.35);

    // periodic shimmer that tiles (integer cycles)
    const shimmerPhase = TAU * (7 * xNorm + 9 * yNorm) + phase * 20.0;
    const shimmer = 0.060 * (0.5 + 0.5 * Math.sin(shimmerPhase)) * (0.35 + 0.65 * ridge);

    // one vertical scan cycle (also tile-safe)
    const scan = 0.012 * (0.5 + 0.5 * Math.sin(TAU * yNorm + phase * 7.0));

    let b = 0.01
      + (ridge * (0.92 + highlight) + wake * 0.42 - shadow * 0.5) * vshade
      + shimmer
      + scan;

    b *= (0.7 + 0.3 * Math.sin(TAU * breath)); // breathing envelope
    return clamp(b, 0, 1);
  }

  function clearBG(){
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
  }

  function drawFrame() {
    clearBG();

    // Draw base OFF LEDs first (uniform lattice — prevents any visible seams)
    ctx.fillStyle = `rgb(${RED_OFF.r},${RED_OFF.g},${RED_OFF.b})`;
    for (let row = 0; row < ROWS; row++) {
      const y = row * GAP + GAP * 0.5;
      for (let col = 0; col < COLS; col++) {
        const x = col * GAP + GAP * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.fill();
      }
    }

    // Now add the animated glow + bright cores
    for (let row = 0; row < ROWS; row++) {
      const y = row * GAP + GAP * 0.5;
      for (let col = 0; col < COLS; col++) {
        const x = col * GAP + GAP * 0.5;

        const b = waveBrightness(col, row);
        if (b <= 0.004) continue;

        const eased = Math.pow(b, 0.92);

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, GLOW, 0, TAU);
        ctx.fillStyle = colorToRGBA(RED, 0.08 + 0.34 * Math.pow(eased, 1.28));
        ctx.fill();

        // Bright core (over the OFF dot)
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        const r = Math.round(lerp(RED_DARK.r, RED.r, eased));
        const g = Math.round(lerp(RED_DARK.g, RED.g, eased));
        const bl = Math.round(lerp(RED_DARK.b, RED.b, eased));
        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fill();

        // tiny highlight
        ctx.beginPath();
        ctx.arc(x - R*0.35, y - R*0.35, R*0.35, 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${0.16 * Math.pow(eased, 1.8)})`;
        ctx.fill();
      }
    }
  }

  // Animation loop (dt-clamped to avoid jumps)
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    phase   = (phase   + dt * BAND_SPEED)   % 1;
    breath  = (breath  + dt * BREATH_SPEED) % 1;

    drawFrame();
    requestAnimationFrame(tick);
  }

  // Start background
  resize();
  if (!prefersReduced) {
    requestAnimationFrame(tick);
  } else {
    drawFrame(); // static frame for reduced motion
  }

  // ====== Tagline: rotating words (previous animation style, de-clumped) ======
  const rotator = document.querySelector('.word-rotator');
  if (rotator){
    const words = [
      'BUFFONOMICS',
      'TRANSPARENT',
      'DATA DRIVEN',
      'PORTFOLIOS',
    ];

    // Ensure container has a sizer for width; create one if HTML doesn't have it
    let sizer = rotator.querySelector('.rotator-sizer');
    if (!sizer){
      sizer = document.createElement('span');
      sizer.className = 'rotator-sizer';
      rotator.prepend(sizer);
    }
    const longest = words.reduce((a,b) => (b.length > a.length ? b : a), 'BUFFONOMICS');
    sizer.textContent = longest;

    // Make sure there is an initial current word
    let current = rotator.querySelector('.word.current') || rotator.querySelector('.word');
    if (!current){
      current = document.createElement('span');
      current.className = 'word current';
      current.textContent = 'BUFFONOMICS';
      rotator.appendChild(current);
    } else {
      current.classList.add('current');
    }

    let i = 0;
    const DURATION = 1900; // ms each word visible
    const ANIM_MS  = 900;  // must match CSS keyframes
    let timer = null;

    function prune(){
      // Keep only one ".current"; remove everything else
      const cur = rotator.querySelector('.word.current');
      rotator.querySelectorAll('.word').forEach(node => {
        if (node !== cur) node.remove();
      });
    }

    function step(){
      if (prefersReduced || document.hidden) return; // paused while hidden

      const cur = rotator.querySelector('.word.current');
      const nextText = words[(i + 1) % words.length];

      const next = document.createElement('span');
      next.className = 'word';
      next.textContent = nextText;
      rotator.appendChild(next);

      // animate out current
      if (cur){
        cur.classList.remove('current');
        cur.classList.add('leave');

        // hard fallback in case animationend is throttled
        const killer = setTimeout(() => cur.remove(), ANIM_MS + 1200);
        cur.addEventListener('animationend', () => {
          clearTimeout(killer);
          cur.remove();
        }, { once:true });
      }

      // animate in next
      requestAnimationFrame(() => {
        next.classList.add('enter');
        setTimeout(() => {
          next.classList.remove('enter');
          next.classList.add('current');
        }, ANIM_MS);
      });

      i = (i + 1) % words.length;

      // guard: at most two words live at once
      const extras = rotator.querySelectorAll('.word:not(.current)');
      if (extras.length > 1){
        extras.forEach((el, idx) => { if (idx < extras.length - 1) el.remove(); });
      }
    }

    function schedule(){
      if (timer || prefersReduced) return;
      timer = setTimeout(function run(){
        timer = null;
        step();
        schedule();
      }, DURATION);
    }
    function stop(){
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    }
    function resume(){
      prune();
      schedule();
    }

    // Pause/resume on visibility/focus to prevent clumping
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else resume();
    });
    window.addEventListener('blur', stop);
    window.addEventListener('focus', resume);

    // Kick off
    schedule();
  }
});