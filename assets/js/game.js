/* 治愈游戏屋 · 控制层与 WebGL 场景连接 */
(() => {
  'use strict';

  const modal = document.getElementById('gameModal');
  const modalPanel = modal.querySelector('.game-modal-panel');
  const closeButton = document.getElementById('closeGame');
  const title = document.getElementById('gameModalTitle');
  const kicker = document.getElementById('gameModalKicker');
  const panels = [...document.querySelectorAll('.play-panel')];
  const cards = [...document.querySelectorAll('.game-card')];
  const gameGrid = document.querySelector('.game-grid');
  const carouselPrev = document.getElementById('gameCarouselPrev');
  const carouselNext = document.getElementById('gameCarouselNext');
  const gameThemeToggle = document.getElementById('gameThemeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const applyGameTheme = (isNight, persist = true) => {
    document.body.classList.toggle('night-mode', isNight);
    gameThemeToggle.setAttribute('aria-pressed', String(isNight));
    gameThemeToggle.setAttribute('aria-label', isNight ? '切换到白天模式' : '切换到黑夜模式');
    themeMeta.setAttribute('content', isNight ? '#211944' : '#a9d8f2');
    if (persist) {
      try { localStorage.setItem('emotion-atlas-theme', isNight ? 'night' : 'day'); } catch (_) { /* storage disabled */ }
    }
  };

  let initialTheme = 'day';
  try { initialTheme = localStorage.getItem('emotion-atlas-theme') || 'day'; } catch (_) { /* storage disabled */ }
  applyGameTheme(initialTheme === 'night', false);
  gameThemeToggle.addEventListener('click', () => {
    applyGameTheme(!document.body.classList.contains('night-mode'));
  });
  const toast = document.getElementById('gameToast');
  let toastTimer = null;
  let activeGame = null;
  const controllers = { squishy: null, jelly: null, sand: null };

  const gameMeta = {
    squishy: { title: '3D 脆皮捏捏乐', kicker: 'PLAYROOM · 01 / WEBGL' },
    jelly: { title: '果冻工坊', kicker: '' },
    woodfish: { title: '敲木鱼', kicker: '' },
    sand: { title: '3D 静心流沙', kicker: '' },
    'squishy-ref': { title: '3D 脆皮捏捏乐 · 原版', kicker: 'PLAYROOM · 01 / ORIGINAL 3D' }
  };

  const loadedScripts = new Map();
  const loadScript = (src) => {
    if (loadedScripts.has(src)) return loadedScripts.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loadedScripts.delete(src);
        reject(new Error('Script failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
    return promise;
  };

  const ensure3DEngine = async () => {
    if (!window.THREE) await loadScript('assets/vendor/three.min.js');
    if (!window.Game3D) await loadScript('assets/js/game3d.js');
  };
  const ensureSandAudioData = () => window.SAND_CALM_LOOP_DATA
    ? Promise.resolve()
    : loadScript('assets/audio/sand-calm-loop-data.js');
  const ensureWoodfishAudioData = () => window.WOODFISH_HIT_DATA
    ? Promise.resolve()
    : loadScript('assets/audio/woodfish-hit-data.js');
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  let audioContext = null;
  const ensureAudio = () => {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  };

  const playTone = (frequency, duration = 0.12, type = 'sine', volume = 0.025) => {
    const context = ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  window.__audioStartUserGesture = ensureAudio;
  window.__playSquishyImpact = (frequency) => {
    playCrunch();
    playTone(frequency, 0.09, 'triangle', 0.018);
  };

  const playCrunch = () => {
    const context = ensureAudio();
    if (!context) return;
    const length = Math.floor(context.sampleRate * 0.11);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) * 0.45;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.032;
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.start();
  };

  const ensureController = (game) => {
    if (controllers[game]) return controllers[game];
    if (!window.Game3D || !window.THREE) {
      showToast('当前浏览器没有成功加载 WebGL 3D 引擎。');
      return null;
    }
    if (game === 'squishy') controllers.squishy = window.Game3D.createSquishy3D(document.getElementById('squishy3d'));
    if (game === 'jelly') controllers.jelly = window.Game3D.createJelly3D(document.getElementById('jelly3d'));
    if (game === 'sand') controllers.sand = window.Game3D.createSand3D(document.getElementById('sand3d'));
    return controllers[game];
  };

  const setPanel = (game) => {
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== game; });
    title.textContent = gameMeta[game].title;
    kicker.textContent = gameMeta[game].kicker;
  };

  const deactivateAll = () => {
    Object.values(controllers).forEach((controller) => { if (controller) controller.deactivate(); });
  };

  const openGame = async (game) => {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setPanel(game);
    activeGame = game;
    if (game === 'squishy-ref') {
      modal.classList.add('reference-mode');
      const frame = document.getElementById('squishyReferenceFrame');
      if (frame) {
        const url = new URL(frame.dataset.src, location.href);
        url.searchParams.set('lang', 'zh-hans');
        url.searchParams.set('theme', document.body.classList.contains('night-mode') ? 'night' : 'day');
        url.searchParams.set('v', String(Date.now()));
        frame.setAttribute('src', url.href);
      }
      deactivateAll();
      return;
    }

    modal.classList.remove('reference-mode');
    const usesWebGL = game !== 'woodfish';
    let loadingTimer = window.setTimeout(() => showToast('正在准备游戏…'), 260);
    try {
      if (game === 'sand') await ensureSandAudioData();
      if (game === 'woodfish') await ensureWoodfishAudioData();
      if (usesWebGL) await ensure3DEngine();
      if (activeGame !== game) return;
    } catch (error) {
      console.error('Game resources failed to load:', error);
      window.clearTimeout(loadingTimer);
      showToast('游戏资源加载失败，请检查网络后重试。');
      return;
    }
    window.clearTimeout(loadingTimer);

    const controller = usesWebGL ? ensureController(game) : null;
    if (usesWebGL && !controller) return;
    resetGame(game);
    deactivateAll();
    if (controller) {
      requestAnimationFrame(() => {
        controller.resize();
        controller.activate();
      });
    }
    window.setTimeout(() => modalPanel.focus({ preventScroll: true }), 50);
  };

  const closeGame = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    deactivateAll();
    stopSand();
    stopWoodfishAudio();
    modal.classList.remove('reference-mode');
    activeGame = null;
  };

  let suppressCardClickUntil = 0;

  const setupGameCarousel = () => {
    if (!gameGrid || !cards.length) return null;
    const count = cards.length;
    const visualOrder = count === 4 ? [0, 2, 1, 3] : cards.map((_, index) => index);
    let activePosition = 0;
    let drag = null;
    let wheelLocked = false;
    let shiftLocked = false;

    cards.forEach((card) => {
      const image = card.querySelector('img');
      if (image) image.draggable = false;
    });

    const positionCards = () => {
      const baseWidth = cards[0].offsetWidth || 190;
      cards.forEach((card, index) => {
        const position = visualOrder.indexOf(index);
        const offset = (position - activePosition + count) % count;
        let x = 0;
        let scale = 0.68;
        let opacity = 0.8;
        let order = 1;
        let kind = 'is-back';
        if (offset === 0) {
          x = 0;
          scale = 1.08;
          opacity = 1;
          order = 3;
          kind = 'is-center';
        } else if (offset === count - 1) {
          x = -baseWidth * 0.5;
          scale = 0.82;
          order = 2;
          kind = 'is-side';
        } else if (offset === 1) {
          x = baseWidth * 0.5;
          scale = 0.82;
          order = 2;
          kind = 'is-side';
        }
        card.style.setProperty('--carousel-x', x + 'px');
        card.style.setProperty('--carousel-scale', String(scale));
        card.style.setProperty('--carousel-opacity', String(opacity));
        card.style.setProperty('--carousel-order', String(order));
        card.classList.toggle('is-center', kind === 'is-center');
        card.classList.toggle('is-side', kind === 'is-side');
        card.classList.toggle('is-back', kind === 'is-back');
        card.setAttribute('aria-current', kind === 'is-center' ? 'true' : 'false');
        card.setAttribute('aria-hidden', kind === 'is-back' ? 'true' : 'false');
        card.tabIndex = kind === 'is-back' ? -1 : 0;
      });
      gameGrid.dataset.activeGame = String(visualOrder[activePosition]);
    };

    const applyShift = (direction, steps = 1) => {
      activePosition = (activePosition + direction * steps + count * count) % count;
      positionCards();
    };

    const shift = (direction, steps = 1) => {
      if (shiftLocked) return;
      const safeSteps = Math.min(count - 1, Math.max(1, Math.abs(steps)));
      if (safeSteps === 1) {
        shiftLocked = true;
        applyShift(direction, 1);
        window.setTimeout(() => { shiftLocked = false; }, 220);
        return;
      }
      shiftLocked = true;
      let remaining = safeSteps;
      const runStep = () => {
        applyShift(direction, 1);
        remaining -= 1;
        if (remaining > 0) window.setTimeout(runStep, 210);
        else shiftLocked = false;
      };
      runStep();
    };

    const focusCard = (index) => {
      const position = visualOrder.indexOf(index);
      if (!Number.isInteger(index) || position < 0 || position === activePosition) return;
      activePosition = position;
      positionCards();
    };

    const endGesture = (event, cancelled = false) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const gesture = drag;
      drag = null;
      try { gameGrid.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
      if (cancelled) return;

      const dx = gesture.lastX - gesture.startX;
      const dy = gesture.lastY - gesture.startY;
      const isHorizontal = Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.15;
      if (!isHorizontal) return;

      suppressCardClickUntil = performance.now() + 380;
      shift(dx < 0 ? 1 : -1, 1);
    };

    gameGrid.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || modal.classList.contains('is-open')) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        captured: false
      };
    });
    gameGrid.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.captured && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        drag.captured = true;
        try { gameGrid.setPointerCapture(event.pointerId); } catch (_) { /* pointer capture unavailable */ }
      }
    });
    gameGrid.addEventListener('pointerup', (event) => endGesture(event));
    gameGrid.addEventListener('pointercancel', (event) => endGesture(event, true));
    gameGrid.addEventListener('wheel', (event) => {
      if (modal.classList.contains('is-open') || wheelLocked) return;
      if (Math.abs(event.deltaX) < 8 || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 0.7) return;
      event.preventDefault();
      wheelLocked = true;
      shift(event.deltaX < 0 ? -1 : 1, 1);
      window.setTimeout(() => { wheelLocked = false; }, 360);
    }, { passive: false });

    carouselPrev.addEventListener('click', () => shift(-1, 1));
    carouselNext.addEventListener('click', () => shift(1, 1));
    window.addEventListener('resize', positionCards);
    positionCards();
    return { shift, focusCard, getActiveIndex: () => visualOrder[activePosition] };
  };

  const gameCarousel = setupGameCarousel();
  cards.forEach((card, index) => card.addEventListener('click', () => {
    if (performance.now() < suppressCardClickUntil) return;
    if (gameCarousel && index !== gameCarousel.getActiveIndex()) {
      gameCarousel.focusCard(index);
      return;
    }
    openGame(card.dataset.game);
  }));
  closeButton.addEventListener('click', closeGame);
  modal.querySelector('[data-close-game]').addEventListener('click', () => {
    if (activeGame !== 'squishy-ref') closeGame();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open') && activeGame !== 'squishy-ref') closeGame();
  });

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'squishy-back') closeGame();
  });

  /* ---------------- 3D 脆皮捏捏乐 ---------------- */
  const squishySteps = [...document.querySelectorAll('[data-squishy-step]')];
  const decorCount = document.getElementById('decorCount');
  const waxMeterFill = document.getElementById('waxMeterFill');
  const waxCount = document.getElementById('waxCount');
  const waxThickness = document.getElementById('waxThickness');
  const waxNote = document.getElementById('waxNote');
  const dipWax = document.getElementById('dipWax');
  const squishStart = document.getElementById('squishStart');
  const squishyReset = document.getElementById('squishyReset');
  const squishyCaption = document.getElementById('squishyCaption');
  const crackCountLabel = document.getElementById('crackCountLabel');
  const squishyState = { step: 1, shape: 'blob', color: '#f5c75c', sticker: '✿', decorations: 0, dips: 0, canSquish: false, damage: 0, chips: 0 };

  const squishyController = () => ensureController('squishy');
  const setupSquishyClick = () => {
    const controller = squishyController();
    if (!controller) return;
    controller.setStatusHandler((state) => {
      if (state.released) return;
      squishyState.damage = state.damage || squishyState.damage;
      squishyState.chips = state.chips || squishyState.chips;
      const damagePercent = Math.round(squishyState.damage * 100);
      if (crackCountLabel) crackCountLabel.textContent = '蜡壳完整度 ' + Math.max(0, 100 - damagePercent) + '%';
      if (state.broken) {
        squishyState.canSquish = false;
        squishyCaption.textContent = '蜡壳已经完全剥落，里面的软胶内芯还完好地留着。';
        showToast('蜡壳一点点碎完了，软胶内芯露出来了。');
        return;
      }
      if (state.detached) {
        squishyCaption.textContent = '这一小片蜡壳松脱掉落了。继续捏其它位置，会一点点剥落。';
      } else if (typeof state.stress === 'number') {
        squishyCaption.textContent = '这块蜡正在松动（' + Math.round(state.stress * 100) + '%）。不要换位置，继续捏或拉扯它。';
      }
    });
    controller.setClickHandler((point) => {
      if (squishyState.step === 2) {
        if (squishyState.decorations >= 12) {
          showToast('表面的装饰已经很多啦。');
          return;
        }
        controller.stamp(point, squishyState.sticker);
        squishyState.decorations += 1;
        decorCount.textContent = '已添加 ' + squishyState.decorations + ' 个 3D 装饰';
        playTone(660 + squishyState.decorations * 18, 0.07, 'sine', 0.012);
      }
    });
  };

  const showSquishyStep = (step) => {
    squishyState.step = step;
    squishySteps.forEach((panel) => { panel.hidden = Number(panel.dataset.squishyStep) !== step; });
    const controller = squishyController();
    if (controller) controller.setMode(step);
    if (step === 2) squishyCaption.textContent = '点击 3D 软胶表面，贴上立体装饰。';
    if (step === 3) squishyCaption.textContent = '在模型上按住并拖拽，弯折、拉伸或扭转蜡壳；拖动空白处可以旋转模型。';
  };

  document.querySelectorAll('.shape-row [data-shape]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.shape-row [data-shape]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      squishyState.shape = button.dataset.shape;
      const controller = squishyController();
      if (controller) controller.setShape(button.dataset.shape);
      playTone(420, 0.08, 'sine', 0.015);
    });
  });

  document.querySelectorAll('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-color]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      squishyState.color = button.dataset.color;
      const controller = squishyController();
      if (controller) controller.setColor(button.dataset.color);
      playTone(520, 0.08, 'sine', 0.015);
    });
  });

  document.querySelectorAll('[data-sticker]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-sticker]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      squishyState.sticker = button.dataset.sticker;
    });
  });

  document.querySelectorAll('[data-squishy-next]').forEach((button) => {
    button.addEventListener('click', () => showSquishyStep(Number(button.dataset.squishyNext)));
  });

  dipWax.addEventListener('click', () => {
    squishyState.dips += 1;
    const dips = squishyState.dips;
    const controller = squishyController();
    if (controller) controller.setDips(dips);
    const progress = Math.min(0.985, 1 - Math.exp(-dips / 2.6));
    waxMeterFill.style.width = (progress * 100).toFixed(1) + '%';
    waxCount.textContent = dips + ' 次';
    waxThickness.textContent = dips < 2 ? '薄蜡层' : dips < 6 ? '中等蜡层' : dips < 12 ? '厚蜡层' : '厚度趋于稳定';
    squishyCaption.textContent = '完成第 ' + dips + ' 次浸蜡。蜡层会继续变厚，但增幅越来越小。';
    playTone(300 + Math.min(dips, 12) * 18, 0.16, 'sine', 0.018);
    squishStart.hidden = false;
    dipWax.textContent = dips === 1 ? '继续浸蜡' : '再浸蜡一次';
    waxNote.textContent = dips < 8 ? '可以一直继续浸蜡；越往后，厚度变化越不明显。' : '厚度已接近稳定，继续浸蜡只会留下很小的差别。';
  });

  squishStart.addEventListener('click', () => {
    squishyState.canSquish = true;
    squishyState.damage = 0;
    squishyState.chips = 0;
    if (crackCountLabel) crackCountLabel.textContent = '蜡壳完整度 100%';
    const controller = squishyController();
    if (controller) controller.setCanSquish(true);
    squishyCaption.textContent = '点击或按住拖拽同一块蜡，持续用力后它才会慢慢松脱。';
    showToast('在同一处多捏几次，或者持续按住拖拽。');
  });

  function resetSquishy() {
    squishyState.step = 1;
    squishyState.shape = 'blob';
    squishyState.color = '#f5c75c';
    squishyState.sticker = '✿';
    squishyState.decorations = 0;
    squishyState.dips = 0;
    squishyState.canSquish = false;
    squishyState.damage = 0;
    squishyState.chips = 0;
    const controller = squishyController();
    if (controller) {
      setupSquishyClick();
      controller.reset();
      controller.setMode(1);
    }
    squishyCaption.textContent = '拖动画面旋转 3D 软胶；先挑一个内芯和颜色。';
    decorCount.textContent = '已添加 0 个 3D 装饰';
    waxNote.textContent = '可以反复浸很多次，但厚度会逐渐趋于稳定。';
    dipWax.disabled = false;
    dipWax.textContent = '浸蜡一次';
    squishStart.hidden = true;
    if (crackCountLabel) crackCountLabel.textContent = '蜡壳完整度 100%';
    waxMeterFill.style.width = '0%';
    waxCount.textContent = '0 次';
    waxThickness.textContent = '尚未浸蜡';
    squishySteps.forEach((panel) => { panel.hidden = Number(panel.dataset.squishyStep) !== 1; });
    document.querySelectorAll('.shape-row [data-shape]').forEach((button) => button.classList.toggle('is-active', button.dataset.shape === 'blob'));
    document.querySelectorAll('[data-color]').forEach((button) => button.classList.toggle('is-active', button.dataset.color === '#f5c75c'));
  }
  squishyReset.addEventListener('click', resetSquishy);

  /* ---------------- 3D Q 弹果冻 ---------------- */
  const jellySteps = [...document.querySelectorAll('[data-jelly-step]')];
  const jellyCaption = document.getElementById('jellyCaption');
  const jellyModeHint = document.getElementById('jellyModeHint');
  const jellyEatenFill = document.getElementById('jellyEatenFill');
  const jellyProgressText = document.getElementById('jellyProgressText');
  const jellyResetButton = document.getElementById('jellyReset');
  const finishJellyButton = document.getElementById('finishJelly');
  const jellyModeButtons = [...document.querySelectorAll('[data-jelly-mode]')];
  const JELLY_TOTAL_BITES = 52;
  const jellyState = { step: 1, mold: 'flower', color: '#ffb5db', mode: 'hand', bites: 0, complete: false, manuallyFinished: false };

  const playJellyBiteSound = () => {
    const context = ensureAudio();
    if (!context) return;
    const length = Math.floor(context.sampleRate * 0.11);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.pow(1 - i / length, 2.2);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.26;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1450;
    gain.gain.value = 0.05;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    playTone(185, 0.16, 'sine', 0.028);
    window.setTimeout(() => playTone(92, 0.2, 'sine', 0.018), 55);
  };

  const playJellyHandSound = () => {
    playTone(390, 0.11, 'sine', 0.018);
    window.setTimeout(() => playTone(285, 0.16, 'sine', 0.012), 55);
  };

  const jellyController = () => ensureController('jelly');

  const updateJellyProgress = () => {
    const progress = Math.min(1, jellyState.bites / JELLY_TOTAL_BITES);
    jellyEatenFill.style.width = (progress * 100).toFixed(1) + '%';
    if (jellyState.complete) {
      jellyProgressText.textContent = '52 / 52 口 · 果冻已经全部吃完';
    } else if (jellyState.bites > 0) {
      jellyProgressText.textContent = jellyState.bites + ' / 52 口 · 继续挖着吃';
    } else {
      jellyProgressText.textContent = '还没开始享用';
    }
  };

  const setJellyMode = (mode) => {
    jellyState.mode = mode;
    jellyModeButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.jellyMode === mode));
    const controller = jellyController();
    if (controller) {
      controller.setMode(mode);
      if (mode === 'hand') controller.squish();
    }
    if (mode === 'hand') {
      jellyModeHint.textContent = '用手轻轻按压果冻，它会 Q 弹地回弹。';
      if (jellyState.step === 2 && !jellyState.complete) jellyCaption.textContent = '用手戳一戳果冻，感受它的回弹。';
    } else {
      jellyModeHint.textContent = '选择勺子后，点击果冻表面，每点一次挖掉一口。';
      if (jellyState.step === 2 && !jellyState.complete) jellyCaption.textContent = '点击果冻表面，一勺一勺把它吃完。';
    }
  };

  const setupJellyClick = () => {
    const controller = jellyController();
    if (!controller) return;
    controller.setClickHandler((point, normal, result) => {
      if (jellyState.step !== 2 || jellyState.complete) return;
      if (jellyState.mode === 'hand') {
        playJellyHandSound();
        jellyCaption.textContent = result.pulled
          ? '你拽住的位置被拉长、弯曲，松手后整块果冻弹了回来。'
          : '手心按下去，果冻整块弹了回来。';
        return;
      }
      playJellyBiteSound();
      jellyState.bites = result.bites;
      jellyState.complete = result.complete;
      updateJellyProgress();
      if (result.complete) {
        jellyCaption.textContent = '最后一勺也吃完了，盘子里只剩下果冻的香气。';
        jellyModeHint.textContent = '已经全部吃完，可以重新制作一份。';
        showToast('果冻全部吃完啦。');
      } else {
        jellyCaption.textContent = '第 ' + result.bites + ' 口挖下去了，果冻轻轻颤了一下。';
      }
    });
    controller.setMode(jellyState.mode);
  };

  const showJellyStep = (step) => {
    jellyState.step = step;
    jellySteps.forEach((panel) => { panel.hidden = Number(panel.dataset.jellyStep) !== step; });
    if (step === 2) {
      jellyCaption.textContent = '果冻制作完成，选择用手捏一捏，或用勺子慢慢享用。';
      setJellyMode(jellyState.mode);
      const controller = jellyController();
      if (controller) controller.squish();
    }
  };

  document.querySelectorAll('[data-mold]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-mold]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      jellyState.mold = button.dataset.mold;
      const controller = jellyController();
      if (controller) controller.setMold(button.dataset.mold);
    });
  });

  document.querySelectorAll('[data-jelly-color]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-jelly-color]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      jellyState.color = button.dataset.jellyColor;
      const controller = jellyController();
      if (controller) controller.setColor(button.dataset.jellyColor);
    });
  });

  document.querySelectorAll('[data-jelly-next]').forEach((button) => {
    button.addEventListener('click', () => showJellyStep(Number(button.dataset.jellyNext)));
  });

  jellyModeButtons.forEach((button) => {
    button.addEventListener('click', () => setJellyMode(button.dataset.jellyMode));
  });

  function resetJelly() {
    jellyState.step = 1;
    jellyState.mold = 'flower';
    jellyState.color = '#ffb5db';
    jellyState.mode = 'hand';
    jellyState.bites = 0;
    jellyState.complete = false;
    jellyState.manuallyFinished = false;
    const controller = jellyController();
    if (controller) {
      setupJellyClick();
      controller.reset();
      controller.setMode('hand');
    }
    jellyCaption.textContent = '选择果冻形状和颜色，然后开始享用。';
    jellyModeHint.textContent = '用手轻轻按压果冻，它会弹回来。';
    updateJellyProgress();
    jellySteps.forEach((panel) => { panel.hidden = Number(panel.dataset.jellyStep) !== 1; });
    document.querySelectorAll('[data-mold]').forEach((button) => button.classList.toggle('is-active', button.dataset.mold === 'flower'));
    document.querySelectorAll('[data-jelly-color]').forEach((button) => button.classList.toggle('is-active', button.dataset.jellyColor === '#ffb5db'));
    jellyModeButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.jellyMode === 'hand'));
    jellyEatenFill.style.width = '0%';
  }
  finishJellyButton.addEventListener('click', () => {
    if (jellyState.step !== 2 || jellyState.complete) return;
    jellyState.complete = true;
    jellyState.manuallyFinished = true;
    const controller = jellyController();
    if (controller) controller.finish();
    jellyEatenFill.style.width = '100%';
    jellyProgressText.textContent = '已提前结束';
    jellyModeHint.textContent = '本次享用已结束，可以重新制作一份。';
    jellyCaption.textContent = '已提前结束享用，盘中果冻已经收起。';
    showToast('已提前结束享用。');
  });
  jellyResetButton.addEventListener('click', resetJelly);

  /* ---------------- 敲木鱼 ---------------- */
  const woodfishCount = document.getElementById('woodfishCount');
  const woodfishFloaters = document.getElementById('woodfishFloaters');
  const woodfishImage = document.getElementById('woodfishImage');
  const resetWoodfishButton = document.getElementById('resetWoodfish');
  const woodfishWords = [
    '平静 +1', '浮躁 -1', '松弛 +1', '焦虑 -1',
    '安心 +1', '杂念 -1', '自在 +1', '从容 +1',
    '轻盈 +1', '紧绷 -1', '清亮 +1', '烦闷 -1'
  ];
  let woodfishHits = 0;
  let woodfishAudioBuffer = null;
  let woodfishAudioPromise = null;
  const woodfishActiveSources = new Set();

  const decodeWoodfishAudio = (context) => {
    if (woodfishAudioBuffer) return Promise.resolve(woodfishAudioBuffer);
    if (woodfishAudioPromise) return woodfishAudioPromise;
    const encoded = window.WOODFISH_HIT_DATA;
    if (!encoded) return Promise.reject(new Error('木鱼音频数据不存在'));
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    woodfishAudioPromise = new Promise((resolve, reject) => {
      context.decodeAudioData(bytes.buffer, resolve, reject);
    }).then((buffer) => {
      woodfishAudioBuffer = buffer;
      return buffer;
    }).catch((error) => {
      woodfishAudioPromise = null;
      throw error;
    });
    return woodfishAudioPromise;
  };

  const stopWoodfishAudio = () => {
    woodfishActiveSources.forEach((source) => {
      try { source.stop(); } catch (_) { /* already stopped */ }
      try { source.disconnect(); } catch (_) { /* already disconnected */ }
    });
    woodfishActiveSources.clear();
  };

  const prepareWoodfishAudio = () => {
    const context = ensureAudio();
    if (!context) return;
    decodeWoodfishAudio(context).catch((error) => console.error('木鱼音频加载失败：', error));
  };

  const playWoodfishStrike = () => {
    const context = ensureAudio();
    if (!context) return;
    const playBuffer = (buffer) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.62;
      source.connect(gain).connect(context.destination);
      woodfishActiveSources.add(source);
      source.onended = () => {
        woodfishActiveSources.delete(source);
        try { source.disconnect(); } catch (_) { /* already disconnected */ }
        try { gain.disconnect(); } catch (_) { /* already disconnected */ }
      };
      source.start();
    };
    if (woodfishAudioBuffer) playBuffer(woodfishAudioBuffer);
    else {
      decodeWoodfishAudio(context)
        .then(playBuffer)
        .catch((error) => console.error('木鱼音频播放失败：', error));
    }
  };

  const spawnWoodfishWord = () => {
    if (!woodfishFloaters) return;
    const word = document.createElement('span');
    word.textContent = woodfishWords[Math.floor(Math.random() * woodfishWords.length)];
    word.style.left = 42 + Math.random() * 18 + '%';
    word.style.top = 5 + Math.random() * 8 + '%';
    word.style.setProperty('--woodfish-drift', -18 + Math.random() * 36 + 'px');
    woodfishFloaters.appendChild(word);
    word.addEventListener('animationend', () => word.remove(), { once: true });
  };

  const registerWoodfishHit = () => {
    woodfishHits += 1;
    woodfishCount.textContent = String(woodfishHits);
    woodfishImage.classList.remove('is-hit');
    void woodfishImage.offsetWidth;
    woodfishImage.classList.add('is-hit');
    playWoodfishStrike();
    spawnWoodfishWord();
  };

  woodfishImage.addEventListener('click', registerWoodfishHit);
  woodfishImage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      registerWoodfishHit();
    }
  });
  woodfishImage.addEventListener('animationend', () => woodfishImage.classList.remove('is-hit'));

  function resetWoodfish() {
    stopWoodfishAudio();
    woodfishHits = 0;
    woodfishCount.textContent = '0';
    woodfishFloaters.innerHTML = '';
    woodfishImage.classList.remove('is-hit');
    prepareWoodfishAudio();
  }
  resetWoodfishButton.addEventListener('click', resetWoodfish);

  /* ---------------- 3D 静心流沙 ---------------- */
  const sandTime = document.getElementById('sandTime');
  const startSandButton = document.getElementById('startSand');
  const resetSandButton = document.getElementById('resetSand');
  const sandDurationRange = document.getElementById('sandDurationRange');
  const sandDurationNumber = document.getElementById('sandDurationNumber');
  const sandDurationPrint = document.getElementById('sandDurationPrint');
  const sandStatus = document.getElementById('sandStatus');
  const sandMuteButton = document.getElementById('sandMute');
  const sandVolume = document.getElementById('sandVolume');
  const sandVolumeOutput = document.getElementById('sandVolumeOutput');
  const sandState = {
    running: false,
    completed: false,
    duration: 60,
    remaining: 60,
    interval: 0,
    audioBuffer: null,
    audioBufferPromise: null,
    audioSource: null,
    audioGain: null,
    audioOffset: 0,
    audioStartedAt: 0,
    audioStartOffset: 0,
    audioToken: 0,
    audioFadeTimer: 0,
    volume: 32,
    muted: false,
    lastTick: 0
  };

  const sandController = () => ensureController('sand');

  const applySandAudioSettings = () => {
    sandMuteButton.classList.toggle('is-muted', sandState.muted);
    sandMuteButton.setAttribute('aria-pressed', String(sandState.muted));
    sandMuteButton.setAttribute('aria-label', sandState.muted ? '取消静音' : '静音流沙声音');
    sandVolumeOutput.textContent = sandState.muted ? '静音' : sandState.volume + '%';
    if (sandState.audioGain && !sandState.audioFadeTimer) {
      const context = sandState.audioGain.context;
      const level = sandState.muted ? 0 : sandState.volume / 100;
      sandState.audioGain.gain.setTargetAtTime(level, context.currentTime, 0.025);
    }
  };

  const decodeSandLoop = (context) => {
    if (sandState.audioBuffer) return Promise.resolve(sandState.audioBuffer);
    if (sandState.audioBufferPromise) return sandState.audioBufferPromise;
    const encoded = window.SAND_CALM_LOOP_DATA;
    if (!encoded) return Promise.reject(new Error('流沙循环音频数据不存在'));
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    sandState.audioBufferPromise = new Promise((resolve, reject) => {
      context.decodeAudioData(bytes.buffer, resolve, reject);
    }).then((buffer) => {
      sandState.audioBuffer = buffer;
      return buffer;
    }).catch((error) => {
      sandState.audioBufferPromise = null;
      throw error;
    });
    return sandState.audioBufferPromise;
  };

  const startSandNoise = async () => {
    if (sandState.audioSource) return;
    const context = ensureAudio();
    if (!context) return;
    const token = ++sandState.audioToken;
    try {
      const buffer = await decodeSandLoop(context);
      if (!sandState.running || token !== sandState.audioToken || sandState.audioSource) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const offset = sandState.audioOffset % buffer.duration;
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      const targetLevel = sandState.muted ? 0 : sandState.volume / 100;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.linearRampToValueAtTime(targetLevel, context.currentTime + (offset > 0 ? 0.35 : 1.15));
      source.connect(gain).connect(context.destination);
      source.start(0, offset);
      sandState.audioSource = source;
      sandState.audioGain = gain;
      sandState.audioStartedAt = context.currentTime;
      sandState.audioStartOffset = offset;
      sandMuteButton.dataset.audioState = 'playing';
      source.onended = () => {
        if (sandState.audioSource === source) {
          sandState.audioSource = null;
          sandState.audioGain = null;
          sandMuteButton.dataset.audioState = 'ended';
        }
      };
    } catch (error) {
      sandMuteButton.dataset.audioState = 'error';
      console.error('流沙音频加载失败：', error);
    }
  };

  const stopSandNoise = (rewind = false) => {
    window.clearTimeout(sandState.audioFadeTimer);
    sandState.audioFadeTimer = 0;
    sandState.audioToken += 1;
    const source = sandState.audioSource;
    const gain = sandState.audioGain;
    if (source && sandState.audioBuffer) {
      const elapsed = Math.max(0, source.context.currentTime - sandState.audioStartedAt);
      sandState.audioOffset = rewind
        ? 0
        : (sandState.audioStartOffset + elapsed) % sandState.audioBuffer.duration;
      try { source.stop(); } catch (_) { /* already stopped */ }
      source.disconnect();
    } else if (rewind) {
      sandState.audioOffset = 0;
    }
    if (gain) {
      try { gain.disconnect(); } catch (_) { /* already disconnected */ }
    }
    sandState.audioSource = null;
    sandState.audioGain = null;
    sandMuteButton.dataset.audioState = 'stopped';
  };

  const fadeOutSandNoise = (rewind = false) => {
    const source = sandState.audioSource;
    const gain = sandState.audioGain;
    if (!source || !gain) {
      stopSandNoise(rewind);
      return;
    }
    window.clearTimeout(sandState.audioFadeTimer);
    sandState.audioToken += 1;
    const token = sandState.audioToken;
    const context = source.context;
    const now = context.currentTime;
    if (sandState.audioBuffer) {
      const elapsed = Math.max(0, now - sandState.audioStartedAt);
      sandState.audioOffset = rewind
        ? 0
        : (sandState.audioStartOffset + elapsed) % sandState.audioBuffer.duration;
    }
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.linearRampToValueAtTime(0, now + 1.1);
    try { source.stop(now + 1.16); } catch (_) { /* already stopped */ }
    sandMuteButton.dataset.audioState = 'fading';
    sandState.audioFadeTimer = window.setTimeout(() => {
      if (token !== sandState.audioToken) return;
      try { source.disconnect(); } catch (_) { /* already disconnected */ }
      try { gain.disconnect(); } catch (_) { /* already disconnected */ }
      sandState.audioFadeTimer = 0;
      sandState.audioSource = null;
      sandState.audioGain = null;
      sandMuteButton.dataset.audioState = 'stopped';
    }, 1200);
  };

  sandState.volume = Number(sandVolume.value) || 32;
  applySandAudioSettings();
  sandVolume.addEventListener('input', () => {
    sandState.volume = Number(sandVolume.value);
    applySandAudioSettings();
  });
  sandMuteButton.addEventListener('click', () => {
    sandState.muted = !sandState.muted;
    applySandAudioSettings();
  });

  const formatSandTime = (value) => {
    const seconds = Math.max(0, Math.ceil(value));
    const minutes = Math.floor(seconds / 60);
    return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  };

  const updateSandClock = () => {
    sandTime.textContent = formatSandTime(sandState.remaining);
  };

  const normalizeSandDuration = (value) => Math.round(Math.max(60, Math.min(600, Number(value) || 60)));

  const updateSandDurationUI = () => {
    if (sandDurationRange) sandDurationRange.value = String(sandState.duration);
    if (sandDurationNumber) sandDurationNumber.value = String(sandState.duration);
    if (sandDurationPrint) sandDurationPrint.textContent = sandState.duration + ' 秒';
  };

  const setSandSettingsDisabled = (disabled) => {
    if (sandDurationRange) sandDurationRange.disabled = disabled;
    if (sandDurationNumber) sandDurationNumber.disabled = disabled;
  };

  const stopSand = () => {
    sandState.running = false;
    if (sandState.interval) {
      clearInterval(sandState.interval);
      sandState.interval = 0;
    }
    stopSandNoise();
    const controller = sandController();
    if (controller) controller.setRunning(false);
    if (startSandButton && sandState.remaining > 0) startSandButton.textContent = '继续流沙';
    setSandSettingsDisabled(false);
  };

  const beginSandTimer = () => {
    sandState.lastTick = performance.now();
    if (sandState.interval) clearInterval(sandState.interval);
    sandState.interval = setInterval(() => {
      const now = performance.now();
      const delta = Math.min((now - sandState.lastTick) / 1000, 0.5);
      sandState.lastTick = now;
      if (!sandState.running) return;
      sandState.remaining = Math.max(0, sandState.remaining - delta);
      updateSandClock();
      if (sandState.remaining <= 0) {
        sandState.running = false;
        sandState.completed = true;
        if (sandState.interval) {
          clearInterval(sandState.interval);
          sandState.interval = 0;
        }
        fadeOutSandNoise(true);
        const controller = sandController();
        if (controller) controller.setRunning(false);
        startSandButton.textContent = '再来一次';
        sandTime.textContent = '00:00';
        sandStatus.textContent = '流沙已全部落到底部。';
        setSandSettingsDisabled(false);
        showToast('时间到了，细沙已经全部落进瓶底。');
      }
    }, 120);
  };

  startSandButton.addEventListener('click', () => {
    const controller = sandController();
    if (!controller) return;

    if (sandState.running) {
      stopSand();
      startSandButton.textContent = '继续流沙';
      sandStatus.textContent = '流沙已暂停，可以稍后继续。';
      return;
    }

    if (sandState.completed || sandState.remaining <= 0) {
      sandState.completed = false;
      sandState.remaining = sandState.duration;
      updateSandClock();
      controller.setDuration(sandState.duration);
      controller.reset();
    }

    sandState.running = true;
    controller.setDuration(sandState.duration);
    controller.setRunning(true);
    startSandButton.textContent = '暂停';
    sandStatus.textContent = '细沙正在缓缓落下。';
    setSandSettingsDisabled(true);
    startSandNoise();
    beginSandTimer();
  });

  const changeSandDuration = (value) => {
    stopSand();
    stopSandNoise(true);
    sandState.duration = normalizeSandDuration(value);
    sandState.remaining = sandState.duration;
    sandState.completed = false;
    updateSandDurationUI();
    updateSandClock();
    startSandButton.textContent = '开始流沙';
    sandStatus.textContent = '细沙会持续落进瓶中，结束时全部留在下层。';
    const controller = sandController();
    if (controller) {
      controller.setDuration(sandState.duration);
      controller.reset();
    }
  };

  const resetSand = () => changeSandDuration(sandState.duration);

  sandDurationRange.addEventListener('input', () => changeSandDuration(sandDurationRange.value));
  sandDurationNumber.addEventListener('change', () => changeSandDuration(sandDurationNumber.value));
  sandDurationNumber.addEventListener('blur', () => {
    if (Number(sandDurationNumber.value) !== sandState.duration) changeSandDuration(sandDurationNumber.value);
  });
  resetSandButton.addEventListener('click', resetSand);

  function resetGame(game) {
    if (game === 'squishy') resetSquishy();
    if (game === 'jelly') resetJelly();
    if (game === 'woodfish') resetWoodfish();
    if (game === 'sand') resetSand();
  }

  const warm3DEngine = () => {
    ensure3DEngine().catch(() => { /* loaded on demand if idle preload fails */ });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm3DEngine, { timeout: 3000 });
  } else {
    window.setTimeout(warm3DEngine, 1500);
  }

  const requestedGame = new URLSearchParams(window.location.search).get('game');
  if (requestedGame && gameMeta[requestedGame]) {
    window.setTimeout(() => openGame(requestedGame), 80);
  }
})();
