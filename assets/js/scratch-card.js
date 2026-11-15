/* 每日治愈签：每天一张，刮开后当天保持一致 */
(() => {
  'use strict';

  const card = document.getElementById('dailyScratch');
  const surface = document.getElementById('scratchSurface');
  const canvas = document.getElementById('scratchCanvas');
  const quote = document.getElementById('scratchQuote');
  const status = document.getElementById('scratchStatus');
  const themeToggle = document.getElementById('themeToggle');
  const phrases = Array.isArray(window.HEALING_QUOTES) ? window.HEALING_QUOTES : [];
  if (!card || !surface || !canvas || !quote || !status || !phrases.length) return;

  const STORAGE_KEY = 'emotion-atlas-daily-scratch';
  const context = canvas.getContext('2d');
  let drawing = false;
  let lastPoint = null;
  let moveCount = 0;
  let state = loadState();

  function dateKey() {
    const date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* storage disabled */ }
  }

  function loadState() {
    const today = dateKey();
    const saved = readStorage();
    if (saved && saved.date === today && Number.isInteger(saved.index) && phasesValid(saved.index)) {
      return { date: today, index: saved.index, revealed: Boolean(saved.revealed) };
    }
    let index = Math.floor(Math.random() * phrases.length);
    if (saved && Number.isInteger(saved.index) && saved.index === index && phrases.length > 1) {
      index = (index + 1) % phrases.length;
    }
    const next = { date: today, index, revealed: false };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) { /* storage disabled */ }
    return next;
  }

  function phasesValid(index) {
    return index >= 0 && index < phrases.length;
  }

  function drawCoat() {
    const rect = surface.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, rect.width, rect.height);

    const night = document.body.classList.contains('night-mode');
    const gradient = context.createLinearGradient(0, 0, rect.width, rect.height);
    if (night) {
      gradient.addColorStop(0, '#efe9ff');
      gradient.addColorStop(0.52, '#d4c7f4');
      gradient.addColorStop(1, '#e8ddff');
    } else {
      gradient.addColorStop(0, '#dff5ff');
      gradient.addColorStop(0.52, '#b9e4f8');
      gradient.addColorStop(1, '#d8f0fa');
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, rect.width, rect.height);

    context.fillStyle = night ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.34)';
    context.beginPath();
    context.arc(rect.width * 0.18, rect.height * 0.2, Math.min(rect.width, rect.height) * 0.22, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(rect.width * 0.84, rect.height * 0.82, Math.min(rect.width, rect.height) * 0.27, 0, Math.PI * 2);
    context.fill();

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = night ? 'rgba(248,243,255,.62)' : 'rgba(21,56,77,.46)';
    context.font = '600 20px "Songti SC", "STSong", Georgia, serif';
    context.fillText('刮开', rect.width / 2, rect.height / 2 - 8);
    context.fillStyle = night ? 'rgba(248,243,255,.42)' : 'rgba(21,56,77,.32)';
    context.font = '10px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.fillText('用鼠标或手指轻轻刮开', rect.width / 2, rect.height / 2 + 18);
  }

  function markRevealed(persist = true) {
    state.revealed = true;
    if (persist) saveState();
    card.classList.add('is-revealed');
    status.textContent = '今日已刮开';
    surface.setAttribute('aria-label', '今日治愈语已刮开：' + quote.textContent);
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawing = false;
    lastPoint = null;
  }

  function clearScratch(x, y) {
    context.globalCompositeOperation = 'destination-out';
    context.lineWidth = 34;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (lastPoint) {
      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(x, y);
      context.stroke();
    }
    context.beginPath();
    context.arc(x, y, 17, 0, Math.PI * 2);
    context.fill();
    lastPoint = { x, y };
  }

  function scratchedProgress() {
    const width = canvas.width;
    const height = canvas.height;
    if (!width || !height) return 0;
    const data = context.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let total = 0;
    for (let index = 3; index < data.length; index += 32) {
      total += 1;
      if (data[index] < 36) cleared += 1;
    }
    return total ? cleared / total : 0;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginScratch(event) {
    if (state.revealed) return;
    event.preventDefault();
    drawing = true;
    moveCount = 0;
    lastPoint = null;
    surface.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    clearScratch(point.x, point.y);
  }

  function moveScratch(event) {
    if (!drawing || state.revealed) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    clearScratch(point.x, point.y);
    moveCount += 1;
    if (moveCount % 14 === 0 && scratchedProgress() >= 0.36) markRevealed();
  }

  function endScratch(event) {
    if (!drawing) return;
    drawing = false;
    lastPoint = null;
    try { surface.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
    if (scratchedProgress() >= 0.36) markRevealed();
  }

  const todayPhrase = phrases[state.index] || phrases[0];
  quote.textContent = todayPhrase;
  if (state.revealed) markRevealed(false);
  else requestAnimationFrame(drawCoat);

  surface.addEventListener('pointerdown', beginScratch);
  surface.addEventListener('pointermove', moveScratch);
  surface.addEventListener('pointerup', endScratch);
  surface.addEventListener('pointercancel', endScratch);
  surface.addEventListener('keydown', (event) => {
    if (state.revealed) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      markRevealed();
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (state.revealed) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawCoat, 120);
  });
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (state.revealed) return;
      window.setTimeout(drawCoat, 60);
    });
  }
})();
