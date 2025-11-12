// ====== Simple Solid Black Background for Homepage ======
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

    // just a solid black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  }

  drawSolidBlack();
  window.addEventListener('resize', drawSolidBlack);
});

// ====== Right Panel Toggle (hamburger) ======
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleRight');
  const body = document.body;

  // restore previous state
  const saved = localStorage.getItem('rightCollapsed');
  if (saved === '1') {
    body.classList.add('right-collapsed');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  // toggle on click
  toggle?.addEventListener('click', () => {
    const collapsed = body.classList.toggle('right-collapsed');
    localStorage.setItem('rightCollapsed', collapsed ? '1' : '0');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });

  // keep aria-expanded sensible across breakpoint changes
  const mq = window.matchMedia('(max-width: 980px)');
  const syncWithMedia = () => {
    if (mq.matches) {
      toggle?.setAttribute('aria-expanded', 'false');
    } else {
      const isCollapsed = body.classList.contains('right-collapsed');
      toggle?.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    }
  };
  mq.addEventListener?.('change', syncWithMedia);
  syncWithMedia();
});