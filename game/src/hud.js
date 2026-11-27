// hud.js — the 2D canvas overlay: altitude, speed and heading on glowing
// instruments, throttle and fuel gauges, score, objective and warnings.
// Drawn every frame from the live flight state, so the instruments look flown.
export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function panel(x, y, pw, ph) {
    // Nearly opaque: a bright cloud or sunlit sky behind a panel must not
    // wash the instruments out — the HUD has to read at a glance.
    ctx.fillStyle = 'rgba(6, 20, 32, 0.85)';
    ctx.strokeStyle = 'rgba(140, 210, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 10);
    ctx.fill();
    ctx.stroke();
  }

  function glowText(text, x, y, size, color, align = 'left') {
    ctx.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function label(text, x, y) {
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8fc8e8';
    ctx.fillText(text, x, y);
  }

  // s: { altFt, spdKt, hdgDeg, throttle, fuel, damage, score, time,
  //      objective, warnings[], stalled, message }
  function draw(s, time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Top-left: altitude and speed, big and lit.
    panel(18, 16, 196, 122);
    label('ALTITUDE', 32, 32);
    glowText(`${Math.round(s.altFt)}`, 32, 60, 30, '#bfefff');
    glowText('FT', 158, 64, 14, '#8fc8e8');
    label('SPEED', 32, 88);
    glowText(`${Math.round(s.spdKt)}`, 32, 112, 30, '#bfefff');
    glowText('KT', 158, 116, 14, '#8fc8e8');

    // Top-centre: compass ribbon with the heading under the lubber line.
    // Hidden once the mission is over (complete/crashed): the end screen's
    // own title sits there, and the two would print over each other.
    const cx = w / 2;
    if (!s.hideCompass) {
      panel(cx - 170, 16, 340, 78);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 160, 22, 320, 44);
    ctx.clip();
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Sweep absolute headings so a cardinal or 30-degree label is always
    // in view, whatever the exact heading is.
    const centre = Math.round(s.hdgDeg);
    for (let h = Math.floor((centre - 62) / 5) * 5; h <= centre + 62; h += 5) {
      const hdg = ((h % 360) + 360) % 360;
      const d = ((hdg - centre + 540) % 360) - 180;
      const x = cx + d * 2.4;
      const major = hdg % 30 === 0;
      ctx.strokeStyle = major ? '#bfefff' : 'rgba(140, 210, 255, 0.5)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, major ? 24 : 30);
      ctx.lineTo(x, 38);
      ctx.stroke();
      if (major) {
        const name = hdg === 0 ? 'N' : hdg === 90 ? 'E' : hdg === 180 ? 'S' : hdg === 270 ? 'W' : String(hdg).padStart(3, '0');
        ctx.fillStyle = '#bfefff';
        ctx.fillText(name, x, 52);
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx, 30);
    ctx.stroke();
    glowText(`${String(Math.round(s.hdgDeg)).padStart(3, '0')}°`, cx, 70, 15, '#ffd76a', 'center');
    }

    // Top-right: score and mission time.
    panel(w - 214, 16, 196, 122);
    label('SCORE', w - 200, 32);
    glowText(`${s.score}`, w - 200, 60, 30, '#ffd76a');
    label('TIME', w - 200, 88);
    const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60);
    glowText(`${mm}:${String(ss).padStart(2, '0')}`, w - 200, 112, 30, '#bfefff');

    // Bottom-left: throttle bar and fuel gauge.
    panel(18, h - 146, 196, 128);
    label('THROTTLE', 32, h - 128);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(32, h - 114, 168, 12);
    const thrW = 168 * s.throttle;
    const grad = ctx.createLinearGradient(32, 0, 200, 0);
    grad.addColorStop(0, '#2fae5f');
    grad.addColorStop(1, '#ffd76a');
    ctx.fillStyle = grad;
    ctx.fillRect(32, h - 114, thrW, 12);
    glowText(`${Math.round(s.throttle * 100)}%`, 32, h - 92, 16, '#bfefff');
    label('FUEL', 32, h - 72);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(32, h - 62, 168, 12);
    const fuelColor = s.fuel > 30 ? '#2fae5f' : s.fuel > 15 ? '#ff9f2a' : '#ff3b30';
    ctx.fillStyle = fuelColor;
    ctx.fillRect(32, h - 62, 168 * Math.max(0, s.fuel / 100), 12);
    glowText(`${Math.round(s.fuel)}%`, 32, h - 40, 13, fuelColor);

    // Bottom-centre: the current objective.
    if (s.objective) {
      ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(s.objective).width;
      panel(cx - tw / 2 - 18, h - 52, tw + 36, 34);
      glowText(s.objective, cx, h - 34, 16, '#eaf6ff', 'center');
    }

    // Centre crosshair: the flight-path marker.
    ctx.strokeStyle = 'rgba(191, 239, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, h / 2, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 18, h / 2);
    ctx.lineTo(cx - 7, h / 2);
    ctx.moveTo(cx + 7, h / 2);
    ctx.lineTo(cx + 18, h / 2);
    ctx.moveTo(cx, h / 2 - 18);
    ctx.lineTo(cx, h / 2 - 7);
    ctx.moveTo(cx, h / 2 + 7);
    ctx.lineTo(cx, h / 2 + 18);
    ctx.stroke();

    // Warnings, flashing when they matter.
    const warns = s.warnings || [];
    if (warns.length) {
      const blink = Math.floor(time * 3) % 2 === 0;
      warns.forEach((warn, i) => {
        glowText(warn, cx, 112 + i * 26, 20, blink ? '#ff3b30' : '#ff8a80', 'center');
      });
    }

    // A one-line message under the crosshair.
    if (s.message) {
      glowText(s.message, cx, h / 2 + 52, 19, '#ffd76a', 'center');
    }
  }

  return { draw, resize };
}
