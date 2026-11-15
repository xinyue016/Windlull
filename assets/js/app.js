/* =========================================================
   情绪色谱 · 静态页面交互
   不连接后端；主题、转盘颜色和智能体状态保存在 localStorage。
   ========================================================= */

(() => {
  'use strict';

  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const currentTime = document.getElementById('currentTime');
  const toast = document.getElementById('toast');
  const starLayer = document.getElementById('starLayer');
  const wheelStage = document.getElementById('moodWheelStage');
  const wheelRotor = document.getElementById('wheelRotor');
  const wheelEmotionPop = document.getElementById('wheelEmotionPop');
  const secondaryPage = document.querySelector('.home-page-secondary');

  const modal = document.getElementById('emotionModal');
  const modalPanel = modal.querySelector('.modal-panel');
  const closeModalButton = document.getElementById('closeModal');
  const modalScroll = document.getElementById('modalScroll');
  const openWheelButton = document.getElementById('openWheel');

  const agentWake = document.getElementById('agentWake');
  const agentPanel = document.getElementById('agentPanel');
  const agentClose = document.getElementById('agentClose');
  const musicButton = document.getElementById('musicButton');
  const musicVolumeWrap = document.getElementById('musicVolumeWrap');
  const musicVolumeTrigger = document.getElementById('musicVolumeTrigger');
  const musicVolumePanel = document.getElementById('musicVolumePanel');
  const musicVolumeRange = document.getElementById('musicVolume');
  const musicVolumeOutput = document.getElementById('musicVolumeOutput');

  let toastTimer = null;

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2800);
  };

  const safeStorage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (_) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (_) { /* 本地存储被浏览器禁用时静默处理 */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (_) { /* storage may be disabled */ }
    }
  };

  /* Full-page swipe navigation: decide on release instead of dragging through both pages. */
  let navigatingPage = false;
  let touchStartY = null;
  let touchBoundary = null;
  let touchDirection = null;

  const isInteractiveGestureTarget = (target) => Boolean(target.closest(
    '.daily-scratch, .emotion-feature, .side-rail, .topbar, .agent-panel, .modal'
  ));

  const settlePage = (index) => {
    if (navigatingPage || !secondaryPage) return;
    const pageTarget = index === 1 ? secondaryPage : document.querySelector('.page-shell');
    const top = index === 1 ? secondaryPage.offsetTop : 0;
    navigatingPage = true;
    document.documentElement.classList.add('is-page-transitioning');
    pageTarget.classList.remove('is-page-settling');
    void pageTarget.offsetWidth;
    pageTarget.classList.add('is-page-settling');
    window.scrollTo({ top, behavior: 'smooth' });
    window.setTimeout(() => {
      document.documentElement.classList.remove('is-page-transitioning');
      pageTarget.classList.remove('is-page-settling');
      navigatingPage = false;
    }, 720);
  };

  window.addEventListener('wheel', (event) => {
    if (navigatingPage || Math.abs(event.deltaY) < 4 || isInteractiveGestureTarget(event.target)) return;
    const secondTop = secondaryPage ? secondaryPage.offsetTop : window.innerHeight;
    if (window.scrollY < 4 && event.deltaY > 0) {
      event.preventDefault();
      settlePage(1);
    } else if (window.scrollY >= secondTop - 4 && event.deltaY < 0) {
      event.preventDefault();
      settlePage(0);
    }
  }, { passive: false });

  document.addEventListener('touchstart', (event) => {
    touchStartY = null;
    touchBoundary = null;
    touchDirection = null;
    if (navigatingPage || event.touches.length !== 1 || isInteractiveGestureTarget(event.target)) return;
    const secondTop = secondaryPage ? secondaryPage.offsetTop : window.innerHeight;
    if (window.scrollY < 4) touchBoundary = 0;
    else if (window.scrollY >= secondTop - 4) touchBoundary = 1;
    else return;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (touchStartY === null || event.touches.length !== 1) return;
    const deltaY = event.touches[0].clientY - touchStartY;
    if (touchBoundary === 0 && deltaY < -8) {
      touchDirection = 'next';
      event.preventDefault();
    } else if (touchBoundary === 1 && deltaY > 8) {
      touchDirection = 'previous';
      event.preventDefault();
    }
  }, { passive: false });

  const finishTouchNavigation = () => {
    if (touchDirection === 'next') settlePage(1);
    if (touchDirection === 'previous') settlePage(0);
    touchStartY = null;
    touchBoundary = null;
    touchDirection = null;
  };
  document.addEventListener('touchend', finishTouchNavigation);
  document.addEventListener('touchcancel', finishTouchNavigation);

  /* ---------------- 时间 ---------------- */
  const updateClock = () => {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    currentTime.textContent = hour + ':' + minute;
    currentTime.dateTime = now.toISOString();
  };
  updateClock();
  window.setInterval(updateClock, 1000);

  /* ---------------- 昼夜主题 ---------------- */
  const applyTheme = (isNight, persist = true) => {
    body.classList.toggle('night-mode', isNight);
    themeToggle.setAttribute('aria-pressed', String(isNight));
    themeToggle.setAttribute('aria-label', isNight ? '切换到白天模式' : '切换到黑夜模式');
    themeMeta.setAttribute('content', isNight ? '#1c1742' : '#a9d8f2');
    if (persist) safeStorage.set('emotion-atlas-theme', isNight ? 'night' : 'day');
  };

  applyTheme(safeStorage.get('emotion-atlas-theme') === 'night', false);
  themeToggle.addEventListener('click', () => {
    applyTheme(!body.classList.contains('night-mode'));
  });

  /* ---------------- 动态星星：从左向右漂移 ---------------- */
  for (let index = 0; index < 84; index += 1) {
    const star = document.createElement('span');
    const top = 7 + ((index * 31) % 76);
    const size = index % 7 === 0 ? 3.2 : 1.4 + (index % 3) * 0.55;
    const duration = 24 + ((index * 11) % 27);
    const delay = -((index * 3.7) % duration);
    const opacity = 0.35 + ((index * 13) % 60) / 100;

    star.className = 'sky-star';
    star.style.setProperty('--top', top + '%');
    star.style.setProperty('--size', size.toFixed(2) + 'px');
    star.style.setProperty('--duration', duration + 's');
    star.style.setProperty('--delay', delay.toFixed(2) + 's');
    star.style.setProperty('--opacity', opacity.toFixed(2));
    star.style.setProperty('--twinkle-duration', (2.2 + (index % 4) * 0.7).toFixed(2) + 's');
    star.style.setProperty('--twinkle-delay', (-(index % 8) * 0.43).toFixed(2) + 's');
    starLayer.appendChild(star);
  }

  /* ---------------- 八色交互转盘 ---------------- */
  const emotions = [
    { name: '喜悦', color: '#f5c75c' },
    { name: '信任', color: '#8fcf71' },
    { name: '恐惧', color: '#79d7c0' },
    { name: '惊讶', color: '#70baf3' },
    { name: '悲伤', color: '#7e8ee8' },
    { name: '厌恶', color: '#b082d8' },
    { name: '愤怒', color: '#f0776c' },
    { name: '期待', color: '#f5a25f' }
  ];

  const emotionColors = Object.fromEntries(emotions.map((emotion) => [emotion.name, emotion.color]));
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const wheelSvg = document.createElementNS(SVG_NS, 'svg');
  wheelSvg.setAttribute('viewBox', '0 0 400 400');
  wheelSvg.setAttribute('aria-label', '八种情绪颜色');

  const center = 200;
  const outerRadius = 194;
  const innerRadius = 82;

  const pointOnCircle = (angle, radius) => {
    const radians = angle * Math.PI / 180;
    return {
      x: center + Math.sin(radians) * radius,
      y: center - Math.cos(radians) * radius
    };
  };

  const createSectorPath = (startAngle, endAngle) => {
    const outerStart = pointOnCircle(startAngle, outerRadius);
    const outerEnd = pointOnCircle(endAngle, outerRadius);
    const innerEnd = pointOnCircle(endAngle, innerRadius);
    const innerStart = pointOnCircle(startAngle, innerRadius);
    return [
      'M', outerStart.x.toFixed(3), outerStart.y.toFixed(3),
      'A', outerRadius, outerRadius, 0, 0, 1, outerEnd.x.toFixed(3), outerEnd.y.toFixed(3),
      'L', innerEnd.x.toFixed(3), innerEnd.y.toFixed(3),
      'A', innerRadius, innerRadius, 0, 0, 0, innerStart.x.toFixed(3), innerStart.y.toFixed(3),
      'Z'
    ].join(' ');
  };

  const selectEmotion = (emotion, persist = true) => {
    wheelSvg.querySelectorAll('.emotion-sector').forEach((sector) => {
      const selected = sector.dataset.emotion === emotion.name;
      sector.classList.toggle('is-selected', selected);
      sector.setAttribute('aria-pressed', String(selected));
    });
    wheelStage.style.setProperty('--wheel-glow', emotion.color + '66');
    if (persist) {
      wheelEmotionPop.textContent = emotion.name;
      wheelEmotionPop.classList.add('is-visible');
      safeStorage.set('emotion-atlas-wheel-emotion', emotion.name);
    }
  };

  emotions.forEach((emotion, index) => {
    const startAngle = index * 45 - 22.5;
    const endAngle = startAngle + 45;
    const sector = document.createElementNS(SVG_NS, 'path');
    sector.setAttribute('d', createSectorPath(startAngle, endAngle));
    sector.setAttribute('fill', emotion.color);
    sector.setAttribute('class', 'emotion-sector');
    sector.setAttribute('tabindex', '0');
    sector.setAttribute('role', 'button');
    sector.setAttribute('aria-label', emotion.name + '颜色，点击加深');
    sector.setAttribute('aria-pressed', 'false');
    sector.dataset.emotion = emotion.name;

    const activate = () => selectEmotion(emotion);
    sector.addEventListener('click', activate);
    sector.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
    wheelSvg.appendChild(sector);
  });

  [150, 118].forEach((radius) => {
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', center);
    ring.setAttribute('cy', center);
    ring.setAttribute('r', radius);
    ring.setAttribute('class', 'wheel-gridline');
    wheelSvg.appendChild(ring);
  });

  wheelRotor.appendChild(wheelSvg);

  const savedEmotionName = safeStorage.get('emotion-atlas-wheel-emotion');
  const savedEmotion = emotions.find((emotion) => emotion.name === savedEmotionName);
  if (savedEmotion) selectEmotion(savedEmotion, false);

  /* ---------------- 24 情绪混合公式 ---------------- */
  const formulaGroups = [
    {
      index: '01',
      level: '初级混合',
      note: '相邻的两种基本情绪相遇',
      formulas: [
        { name: '爱', parts: ['喜悦', '信任'] },
        { name: '顺从', parts: ['信任', '恐惧'] },
        { name: '敬畏', parts: ['恐惧', '惊讶'] },
        { name: '反对', parts: ['惊讶', '悲伤'] },
        { name: '悔恨', parts: ['悲伤', '厌恶'] },
        { name: '轻蔑', parts: ['厌恶', '愤怒'] },
        { name: '好斗', parts: ['愤怒', '期待'] },
        { name: '乐观', parts: ['期待', '喜悦'] }
      ]
    },
    {
      index: '02',
      level: '次级混合',
      note: '隔一种情绪相遇，层次更细微',
      formulas: [
        { name: '内疚', parts: ['喜悦', '恐惧'] },
        { name: '好奇', parts: ['信任', '惊讶'] },
        { name: '绝望', parts: ['恐惧', '悲伤'] },
        { name: '震惊', parts: ['惊讶', '厌恶'] },
        { name: '嫉妒', parts: ['悲伤', '愤怒'] },
        { name: '愤世嫉俗', parts: ['厌恶', '期待'] },
        { name: '骄傲', parts: ['愤怒', '喜悦'] },
        { name: '希望', parts: ['期待', '信任'] }
      ]
    },
    {
      index: '03',
      level: '三级混合',
      note: '相隔更远的情绪，混合出复杂感受',
      formulas: [
        { name: '欣喜', parts: ['喜悦', '惊讶'] },
        { name: '接纳', parts: ['信任', '悲伤'] },
        { name: '羞耻', parts: ['恐惧', '厌恶'] },
        { name: '暴怒', parts: ['惊讶', '愤怒'] },
        { name: '悲观', parts: ['悲伤', '期待'] },
        { name: '病态', parts: ['厌恶', '喜悦'] },
        { name: '支配', parts: ['愤怒', '信任'] },
        { name: '焦虑', parts: ['期待', '恐惧'] }
      ]
    }
  ];

  const oppositions = [
    ['喜悦', '悲伤'],
    ['信任', '厌恶'],
    ['恐惧', '愤怒'],
    ['惊讶', '期待']
  ];

  const emotionKeyGrid = document.getElementById('emotionKeyGrid');
  const formulaGroupsRoot = document.getElementById('formulaGroups');
  const oppositionGrid = document.getElementById('oppositionGrid');

  emotionKeyGrid.innerHTML = emotions.map((emotion) => {
    return '<div class="emotion-key-item" style="--emotion-color:' + emotion.color + '">' +
      '<strong>' + emotion.name + '</strong>' +
    '</div>';
  }).join('');

  formulaGroupsRoot.innerHTML = formulaGroups.map((group) => {
    const cards = group.formulas.map((formula) => {
      const firstColor = emotionColors[formula.parts[0]];
      const secondColor = emotionColors[formula.parts[1]];
      return '<article class="formula-card" style="--formula-color:' + firstColor + '" ' +
        'aria-label="' + formula.name + ' 等于 ' + formula.parts[0] + ' 加 ' + formula.parts[1] + '">' +
        '<div class="formula-card-head">' +
          '<strong>' + formula.name + '</strong>' +
          '<span class="formula-equals">=</span>' +
        '</div>' +
        '<div class="formula-parts">' +
          '<span class="formula-part" style="--part-color:' + firstColor + '">' + formula.parts[0] + '</span>' +
          '<span class="formula-plus">+</span>' +
          '<span class="formula-part" style="--part-color:' + secondColor + '">' + formula.parts[1] + '</span>' +
        '</div>' +
      '</article>';
    }).join('');

    return '<section class="formula-section" aria-labelledby="formulaGroup' + group.index + '">' +
      '<div class="section-heading">' +
        '<span class="section-index">' + group.index + '</span>' +
        '<div><h3 id="formulaGroup' + group.index + '">' + group.level + '</h3></div>' +
        '<span class="section-note">' + group.note + '</span>' +
      '</div>' +
      '<div class="formula-grid">' + cards + '</div>' +
    '</section>';
  }).join('');

  oppositionGrid.innerHTML = oppositions.map((pair) => {
    const left = pair[0];
    const right = pair[1];
    return '<div class="opposition-card" aria-label="' + left + ' 与 ' + right + ' 互为对立情绪">' +
      '<span class="opposition-side" style="--emotion-color:' + emotionColors[left] + '">' +
        '<i aria-hidden="true"></i><strong>' + left + '</strong>' +
      '</span>' +
      '<span class="opposition-mark" aria-hidden="true">← VS →</span>' +
      '<span class="opposition-side" style="--emotion-color:' + emotionColors[right] + '">' +
        '<i aria-hidden="true"></i><strong>' + right + '</strong>' +
      '</span>' +
    '</div>';
  }).join('');

  /* ---------------- 弹窗 ---------------- */
  let lastFocusedElement = null;

  const getFocusable = () => [...modalPanel.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => element.offsetParent !== null);

  const openModal = () => {
    if (modal.classList.contains('is-open')) return;
    lastFocusedElement = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    body.classList.add('modal-open');
    modalScroll.scrollTop = 0;
    window.setTimeout(() => modalPanel.focus({ preventScroll: true }), 50);
  };

  const closeModal = () => {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    body.classList.remove('modal-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus({ preventScroll: true });
    }
  };

  openWheelButton.addEventListener('click', openModal);
  closeModalButton.addEventListener('click', closeModal);
  modal.querySelector('[data-close-modal]').addEventListener('click', closeModal);

  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = getFocusable();
    if (!focusable.length) {
      event.preventDefault();
      modalPanel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ---------------- 智能体：状态写入 localStorage ---------------- */
  const openAgent = (persist = true) => {
    agentPanel.classList.add('is-open');
    agentPanel.setAttribute('aria-hidden', 'false');
    agentWake.classList.add('is-awake');
    agentWake.setAttribute('aria-expanded', 'true');
    if (persist) safeStorage.set('emotion-atlas-agent-state', 'open');
  };

  const closeAgent = (persist = true) => {
    agentPanel.classList.remove('is-open');
    agentPanel.setAttribute('aria-hidden', 'true');
    agentWake.classList.remove('is-awake');
    agentWake.setAttribute('aria-expanded', 'false');
    if (persist) safeStorage.set('emotion-atlas-agent-state', 'closed');
  };

  if (safeStorage.get('emotion-atlas-agent-state') === 'open') {
    window.setTimeout(() => openAgent(false), 320);
  }

  agentWake.addEventListener('click', () => {
    if (agentPanel.classList.contains('is-open')) closeAgent();
    else openAgent();
  });

  agentClose.addEventListener('click', () => closeAgent());

  document.addEventListener('click', (event) => {
    if (!agentPanel.classList.contains('is-open')) return;
    if (!agentPanel.contains(event.target) && !agentWake.contains(event.target)) closeAgent();
  });

  /* ---------------- 预留页面与快捷键 ---------------- */
  document.querySelectorAll('[data-soon]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const route = link.dataset.route || '附加页面.html';
      showToast('页面已预留 · 后续接入后跳转至 ' + route);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modal.classList.contains('is-open')) closeModal();
    else if (agentPanel.classList.contains('is-open')) closeAgent();
  });

  /* ---------------- 背景音乐：全站共享状态 ---------------- */
  const setMusicUI = (playing) => {
    musicButton.classList.toggle('is-playing', playing);
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.setAttribute('aria-label', playing ? '关闭背景音乐' : '播放背景音乐');
    musicButton.dataset.tooltip = playing ? '关闭背景音乐' : '播放背景音乐';
  };

  const setVolumePanelOpen = (open) => {
    musicVolumeWrap.classList.toggle('is-volume-open', open);
    musicVolumeTrigger.setAttribute('aria-expanded', String(open));
  };

  const syncVolumeUI = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    musicVolumeRange.value = String(safeValue);
    musicVolumeOutput.value = safeValue + '%';
    musicVolumeOutput.textContent = safeValue + '%';
    musicVolumeRange.setAttribute('aria-valuetext', safeValue + '%');
  };

  const backgroundMusic = window.BackgroundMusic;
  if (backgroundMusic) {
    syncVolumeUI(backgroundMusic.getVolume());
    setMusicUI(backgroundMusic.isEnabled());

    musicVolumeTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      setVolumePanelOpen(!musicVolumeWrap.classList.contains('is-volume-open'));
    });
    musicVolumePanel.addEventListener('click', (event) => event.stopPropagation());
    musicVolumeRange.addEventListener('input', () => {
      const value = Number(musicVolumeRange.value);
      syncVolumeUI(value);
      backgroundMusic.setVolume(value);
    });
    document.addEventListener('click', () => setVolumePanelOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setVolumePanelOpen(false);
    });

    musicButton.addEventListener('click', async () => {
      musicButton.disabled = true;
      try {
        const result = await backgroundMusic.toggle();
        setMusicUI(result.enabled);
        if (result.enabled && !result.started) {
          showToast('背景音乐已开启，轻触页面后开始播放。');
        }
      } catch (error) {
        console.warn('Background music could not be started:', error);
        showToast('背景音乐暂时无法播放，请稍后再试。');
        setMusicUI(backgroundMusic.isEnabled());
      } finally {
        musicButton.disabled = false;
      }
    });
    document.addEventListener('backgroundmusicchange', (event) => {
      setMusicUI(Boolean(event.detail && event.detail.enabled));
      if (event.detail && Number.isFinite(Number(event.detail.volume))) {
        syncVolumeUI(event.detail.volume);
      }
    });
  } else {
    setMusicUI(false);
    musicVolumeRange.disabled = true;
    syncVolumeUI(0);
  }
})();
