// ====== Login form UX (unchanged) ======
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.js-signin-form');
  const btn  = document.querySelector('.js-signin-button');
  const user = document.getElementById('username');
  const pass = document.getElementById('password');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      [user, pass].forEach(el => el.classList.remove('input--invalid'));
      const invalid = [user, pass].filter(el => !el.value.trim());
      if (invalid.length){
        invalid.forEach(el => el.classList.add('input--invalid'));
        invalid[0].focus();
        return;
      }

      btn.setAttribute('aria-busy', 'true');
      const label = btn.textContent;
      btn.textContent = 'Signing in…';

      setTimeout(() => {
        btn.removeAttribute('aria-busy');
        btn.textContent = label;
        form.reset();
        user.focus();
      }, 900);
    });
  }

  // ====== LED Panel Background ======
  const canvas = document.getElementById('ledBackdrop');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // LED parameters
  const GAP  = 12;    // px between LED centers
  const R    = 2.6;   // LED core radius
  const GLOW = R * 2.1;

  // Colors
  const RED      = { r:255, g:90,  b:78 };
  const RED_DARK = { r:185, g:64,  b:57 };
  const RED_OFF  = { r:18,  g:20,  b:22 };   // dim OFF LED
  const BG       = '#0a0b0c';

  // On/off behavior
  const THRESH_ON  = 0.25;  // turn ON when wave brightness > this + jitter
  const THRESH_OFF = 0.19;  // turn OFF when wave brightness < this + jitter (hysteresis)
  const JITTER     = 0.03;  // per-cell threshold variance (prevents uniform walls)
  const ON_SPEED   = 7.0;   // how quickly LEDs light up (units/sec)
  const OFF_SPEED  = 2.2;   // how slowly LEDs fade out (afterglow)

  let dpr, W, H, COLS, ROWS, COUNT;

  // Per-cell state
  let state;     // Uint8Array: 0=off, 1=on (target state)
  let intensity; // Float32Array: 0..1 smoothed brightness
  let jitter;    // Float32Array: 0..1 deterministic per-cell noise

  function hash2d(i, j){
    // Tiny, fast deterministic hash -> 0..1
    let n = (i * 374761393) ^ (j * 668265263);
    n = (n ^ (n >>> 13)) * 1274126177;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967295;
  }

  function initBuffers(){
    COUNT = COLS * ROWS;
    state     = new Uint8Array(COUNT);
    intensity = new Float32Array(COUNT);
    jitter    = new Float32Array(COUNT);
    for (let r=0; r<ROWS; r++){
      for (let c=0; c<COLS; c++){
        const k = r*COLS + c;
        jitter[k] = hash2d(c, r); // stable across frames/resizes
        intensity[k] = 0;         // start off
        state[k] = 0;
      }
    }
  }

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
    initBuffers();

    drawFrame(0); // one static frame after resize
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
  let phase = 0;            // keeps numbers tiny forever
  let breath = 0;

  const BAND_SPEED   = 0.085; // units/sec across normalized diagonal
  const BREATH_SPEED = 0.33;  // Hz
  const BAND_WIDTH   = 0.18;
  const BAND_SHARP   = 3.4;

  function waveCore(col, row) {
    if (!COLS || !ROWS) return 0;
    const xNorm = COLS > 1 ? col / (COLS - 1) : 0;
    const yNorm = ROWS > 1 ? row / (ROWS - 1) : 0;

    // torus-friendly coordinate: 0 at BL, 1 at TR
    const s = wrap01(xNorm + (1 - yNorm));
    const dist = wrapSym(s - phase); // [-0.5, 0.5]

    const ridge = Math.exp(-Math.pow(dist / BAND_WIDTH, 2) * BAND_SHARP);
    const wake  = Math.exp(-Math.pow((dist + BAND_WIDTH * 0.9) / (BAND_WIDTH * 1.65), 2) * 1.1);

    const slope = -(2 * dist / (BAND_WIDTH * BAND_WIDTH)) * ridge;
    const highlight = 0.28 * Math.max(0, slope);
    const shadow    = 0.22 * Math.max(0, -slope);

    // vertical vignette (depth)
    const vshade = 0.55 + 0.45 * Math.pow(1 - Math.abs(yNorm - 0.5), 1.35);

    // tile-safe shimmer & scan
    const shimmer = 0.060 * (0.5 + 0.5 * Math.sin(TAU * (7 * xNorm + 9 * yNorm) + phase * 20.0)) * (0.35 + 0.65 * ridge);
    const scan    = 0.012 * (0.5 + 0.5 * Math.sin(TAU * yNorm + phase * 7.0));

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

  function drawFrame(dt) {
    clearBG();

    // Pass 1: draw dim OFF LEDs (uniform lattice)
    ctx.fillStyle = `rgb(${RED_OFF.r},${RED_OFF.g},${RED_OFF.b})`;
    for (let r=0; r<ROWS; r++){
      const y = r * GAP + GAP * 0.5;
      for (let c=0; c<COLS; c++){
        const x = c * GAP + GAP * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.fill();
      }
    }

    // Pass 2: update per-cell ON/OFF state + eased intensity, then draw glow & bright cores
    const onAlpha = (k) => 1 - Math.exp(-(ON_SPEED)  * dt);   // framerate-independent easing
    const offAlpha= (k) => 1 - Math.exp(-(OFF_SPEED) * dt);

    for (let r=0; r<ROWS; r++){
      const y = r * GAP + GAP * 0.5;
      for (let c=0; c<COLS; c++){
        const x = c * GAP + GAP * 0.5;
        const k = r * COLS + c;

        const b = waveCore(c, r); // 0..1
        // Hysteresis with slight per-cell jitter (tile-safe)
        const onThr  = THRESH_ON  + (jitter[k] - 0.5) * JITTER;
        const offThr = THRESH_OFF + (jitter[k] - 0.5) * JITTER;

        if (state[k]) {
          if (b < offThr) state[k] = 0;
        } else {
          if (b > onThr)  state[k] = 1;
        }

        // Ease intensity toward target (fast on, slow off for afterglow)
        const target = state[k] ? 1 : 0;
        const a = state[k] ? onAlpha() : offAlpha();
        intensity[k] += (target - intensity[k]) * a;

        const e = Math.pow(intensity[k], 0.92);
        if (e <= 0.004) continue;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, GLOW, 0, TAU);
        ctx.fillStyle = colorToRGBA(RED, 0.08 + 0.34 * Math.pow(e, 1.28));
        ctx.fill();

        // Bright core over OFF dot
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        const rr = Math.round(lerp(RED_DARK.r, RED.r, e));
        const rg = Math.round(lerp(RED_DARK.g, RED.g, e));
        const rb = Math.round(lerp(RED_DARK.b, RED.b, e));
        ctx.fillStyle = `rgb(${rr},${rg},${rb})`;
        ctx.fill();

        // little highlight
        ctx.beginPath();
        ctx.arc(x - R*0.35, y - R*0.35, R*0.35, 0, TAU);
        ctx.fillStyle = `rgba(255,255,255,${0.16 * Math.pow(e, 1.8)})`;
        ctx.fill();
      }
    }
  }

  // Animation loop with dt clamp to avoid jumps
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); // <= 50ms/frame
    last = now;

    phase  = (phase  + dt * BAND_SPEED)   % 1;
    breath = (breath + dt * BREATH_SPEED) % 1;

    drawFrame(dt);
    requestAnimationFrame(tick);
  }

  // Start
  resize();
  if (!prefersReduced) {
    requestAnimationFrame(tick);
  } else {
    drawFrame(0); // static frame for reduced motion
  }
});
