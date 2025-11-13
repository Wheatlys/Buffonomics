document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('ledBackdrop');
    if (!canvas) return;
  
    const ctx = canvas.getContext('2d', { alpha: false });
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
    const GAP  = 12;
    const R    = 2.6;
    const GLOW = R * 2.1;
  
    const RED      = { r:255, g:208, b:64 };
    const RED_DARK = { r:176, g:124, b:16 };
    const RED_OFF  = { r:20,  g:16,  b:6  };
    const BG       = '#0a0b0c';
  
    let dpr, W, H, COLS, ROWS;
  
    function resize(){
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
  
      drawFrame();
    }
  
    window.addEventListener('resize', () => {
      clearTimeout(resize._t);
      resize._t = setTimeout(resize, 100);
    });
  
    const TAU = Math.PI * 2;
    const BAND_SPEED   = 0.085;
    const BREATH_SPEED = 0.33;
    const BAND_WIDTH   = 0.18;
    const BAND_SHARP   = 3.4;
  
    let phase = 0;
    let breath = 0;
  
    function lerp(a,b,t){ return a + (b-a)*t; }
    function clamp(v,mn,mx){ return Math.min(mx, Math.max(mn, v)); }
    function wrap01(v){ return v - Math.floor(v); }
    function wrapSym(v){ return v - Math.round(v); }
    function colorToRGBA(c,a){ return `rgba(${c.r},${c.g},${c.b},${a})`; }
  
    function waveBrightness(col, row){
      if (!COLS || !ROWS) return 0;
  
      const xNorm = COLS > 1 ? col / (COLS - 1) : 0;
      const yNorm = ROWS > 1 ? row / (ROWS - 1) : 0;
  
      const s = wrap01(xNorm + (1 - yNorm));
      const dist = wrapSym(s - phase);
  
      const ridge = Math.exp(-Math.pow(dist / BAND_WIDTH, 2) * BAND_SHARP);
      const wake  = Math.exp(-Math.pow((dist + BAND_WIDTH * 0.9) / (BAND_WIDTH * 1.65), 2) * 1.1);
  
      const slope = -(2 * dist / (BAND_WIDTH * BAND_WIDTH)) * ridge;
      const highlight = 0.28 * Math.max(0, slope);
      const shadow    = 0.22 * Math.max(0, -slope);
  
      const vshade = 0.55 + 0.45 * Math.pow(1 - Math.abs(yNorm - 0.5), 1.35);
  
      const shimmerPhase = TAU * (7 * xNorm + 9 * yNorm) + phase * 20.0;
      const shimmer = 0.060 * (0.5 + 0.5 * Math.sin(shimmerPhase)) * (0.35 + 0.65 * ridge);
  
      const scan = 0.012 * (0.5 + 0.5 * Math.sin(TAU * yNorm + phase * 7.0));
  
      let b = 0.01
        + (ridge * (0.92 + highlight) + wake * 0.42 - shadow * 0.5) * vshade
        + shimmer
        + scan;
  
      b *= (0.7 + 0.3 * Math.sin(TAU * breath));
      return clamp(b, 0, 1);
    }
  
    function clearBG(){
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
    }
  
    function drawFrame(){
      clearBG();
  
      // base OFF LEDs
      ctx.fillStyle = `rgb(${RED_OFF.r},${RED_OFF.g},${RED_OFF.b})`;
      for (let row = 0; row < ROWS; row++){
        const y = row * GAP + GAP * 0.5;
        for (let col = 0; col < COLS; col++){
          const x = col * GAP + GAP * 0.5;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, TAU);
          ctx.fill();
        }
      }
  
      // animated glow + cores
      for (let row = 0; row < ROWS; row++){
        const y = row * GAP + GAP * 0.5;
        for (let col = 0; col < COLS; col++){
          const x = col * GAP + GAP * 0.5;
  
          const b = waveBrightness(col, row);
          if (b <= 0.004) continue;
  
          const eased = Math.pow(b, 0.92);
  
          // glow
          ctx.beginPath();
          ctx.arc(x, y, GLOW, 0, TAU);
          ctx.fillStyle = colorToRGBA(RED, 0.08 + 0.34 * Math.pow(eased, 1.28));
          ctx.fill();
  
          // core
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
  
    let last = performance.now();
    function tick(now){
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
  
      phase  = (phase  + dt * BAND_SPEED)   % 1;
      breath = (breath + dt * BREATH_SPEED) % 1;
  
      drawFrame();
      requestAnimationFrame(tick);
    }
  
    // init
    resize();
    if (!prefersReduced){
      requestAnimationFrame(tick);
    } else {
      drawFrame();
    }
  });
  