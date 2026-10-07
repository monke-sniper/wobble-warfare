// Entry point.
import { boot } from './game.js';

boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = `<div class="boot-logo">WOBBLE WARFARE</div><p style="color:#fff;max-width:420px;text-align:center;font-weight:800">Could not start the game: ${String(e && e.message || e)}. Try a browser with WebGL enabled.</p>`;
});
