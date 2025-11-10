// ====== Static LED Background for Homepage ======
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('ledBackdrop');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });

  const GAP = 12; // distance between LEDs
  const R = 2.6;  // LED radius
  const RED = { r: 255, g: 208, b: 64 };   // bright gold
  const RED_OFF = { r: 20, g: 16, b: 6 };  // faint off gold
  const BG = '#0a0b0c';                    // dark background
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function drawStaticGrid() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // solid background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // evenly spaced LED grid
    for (let y = GAP / 2; y < H; y += GAP) {
      for (let x = GAP / 2; x < W; x += GAP) {
        const brightness = Math.random() * 0.3 + 0.2; // small brightness variation for realism
        const r = Math.round(RED_OFF.r + (RED.r - RED_OFF.r) * brightness);
        const g = Math.round(RED_OFF.g + (RED.g - RED_OFF.g) * brightness);
        const b = Math.round(RED_OFF.b + (RED.b - RED_OFF.b) * brightness);
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }
    }
  }

  drawStaticGrid();
  window.addEventListener('resize', drawStaticGrid);
});