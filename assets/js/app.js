/* =========================================================
   情绪色谱 · 静态页面交互
   不连接后端；主题与互动偏好保存在 localStorage。
   ========================================================= */

(() => {
  'use strict';

  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const currentTime = document.getElementById('currentTime');
  const toast = document.getElementById('toast');
  const starLayer = document.getElementById('starLayer');
  const wheelRotor = document.getElementById('wheelRotor');
  const secondaryPage = document.querySelector('.home-page-secondary');
  const supportPage = document.getElementById('supportPage');
  const supportResponsePanel = document.getElementById('supportResponsePanel');
  const supportMessage = document.getElementById('supportMessage');
  const supportResponseNote = document.getElementById('supportResponseNote');
  const copySupportMessageButton = document.getElementById('copySupportMessage');


  const modal = document.getElementById('emotionModal');
  const modalPanel = modal.querySelector('.modal-panel');
  const closeModalButton = document.getElementById('closeModal');
  const modalScroll = document.getElementById('modalScroll');
  const openWheelButton = document.getElementById('openWheel');
  const regulationModal = document.getElementById('regulationModal');
  const regulationModalPanel = regulationModal ? regulationModal.querySelector('.regulation-modal-panel') : null;
  const regulationModalTitle = document.getElementById('regulationModalTitle');
  const regulationModalSubtitle = document.getElementById('regulationModalSubtitle');
  const regulationModalBody = document.getElementById('regulationModalBody');
  const closeRegulationModalButton = document.getElementById('closeRegulationModal');
  const openRegulationOverviewButton = document.getElementById('openRegulationOverview');

  const homeNav = document.getElementById('homeNav');
  const musicButton = document.getElementById('musicButton');
  const scrollDownCue = document.getElementById('scrollDownCue');
  const secondaryScrollDownCue = document.getElementById('scrollDownCueSecondary');
  const musicVolumeWrap = document.getElementById('musicVolumeWrap');
  const musicVolumeTrigger = document.getElementById('musicVolumeTrigger');
  const musicVolumePanel = document.getElementById('musicVolumePanel');
  const musicVolumeRange = document.getElementById('musicVolume');
  const musicVolumeOutput = document.getElementById('musicVolumeOutput');
  const appSidebar = musicVolumeWrap.closest('.app-sidebar');

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

  /* ---------------- 支持与安全计划 ---------------- */
  const supportOptions = {
    listen: {
      message: '“我现在状态不太好，不需要你马上给建议，只希望你能听我说十分钟。”',
      note: '被听见不是要求对方立刻理解，而是让此刻的感受有地方安放。'
    },
    company: {
      message: '“我现在不想一个人待着，你能陪我一会儿吗？”',
      note: '陪伴本身就可以是一种支持，不必马上想出解决办法。'
    },
    advice: {
      message: '“我有点乱，想听听你的看法。可以先听我说完，再帮我一起理一理吗？”',
      note: '先让对方了解完整情况，再一起讨论下一步。'
    },
    professional: {
      message: '“我想联系学校心理中心或专业机构，你能陪我一起查联系方式吗？”',
      note: '如果困扰持续并明显影响生活，可以把专业支持作为一个选项，这不是给自己下诊断。'
    },
    unsafe: {
      message: '“我现在可能无法保证自己的安全，需要你马上联系我或来到我身边。请不要让我一个人待着。”',
      note: '请先移动到相对安全的地方，不要独处，并联系可信任的人、当地急救或报警。'
    }
  };
  let selectedSupportNeed = 'listen';

  const selectSupportNeed = (need) => {
    const option = supportOptions[need];
    if (!option || !supportMessage || !supportResponseNote) return;
    selectedSupportNeed = need;
    document.querySelectorAll('.support-need[data-support-need]').forEach((button) => {
      const active = button.dataset.supportNeed === need;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    supportMessage.textContent = option.message;
    supportResponseNote.textContent = option.note;
    if (supportResponsePanel) supportResponsePanel.classList.toggle('is-urgent', need === 'unsafe');
  };

  document.querySelectorAll('.support-need[data-support-need]').forEach((button) => {
    button.addEventListener('click', () => selectSupportNeed(button.dataset.supportNeed));
  });

  const copySupportText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      helper.remove();
      return copied;
    }
  };

  if (copySupportMessageButton && supportMessage) {
    copySupportMessageButton.addEventListener('click', async () => {
      const copied = await copySupportText(supportMessage.textContent.replace(/[“”]/g, ''));
      showToast(copied ? '求助话术已复制。' : '复制失败，请手动选择文字。');
    });
  }


  /* Full-page swipe navigation across the three home screens. */
  const firstPage = document.querySelector('.page-shell');
  const pageSections = [firstPage, secondaryPage, supportPage].filter(Boolean);
  let navigatingPage = false;
  let touchStartY = null;
  let touchBoundary = null;
  let touchDirection = null;

  const isInteractiveGestureTarget = (target) => Boolean(target.closest(
    '.daily-scratch, .emotion-feature, .regulation-science, .support-plan, .support-plan-body, .site-credits, .credits-panel, .scroll-down-cue, .app-sidebar, .topbar, .modal'
  ));

  const getCurrentPageIndex = () => {
    let current = 0;
    pageSections.forEach((section, index) => {
      if (window.scrollY >= section.offsetTop - 4) current = index;
    });
    return current;
  };

  const settlePage = (index) => {
    if (navigatingPage || !pageSections.length) return;
    const targetIndex = Math.max(0, Math.min(pageSections.length - 1, index));
    const pageTarget = pageSections[targetIndex];
    navigatingPage = true;
    document.documentElement.classList.add('is-page-transitioning');
    pageTarget.classList.remove('is-page-settling');
    void pageTarget.offsetWidth;
    pageTarget.classList.add('is-page-settling');
    window.scrollTo({ top: pageTarget.offsetTop, behavior: 'smooth' });
    window.setTimeout(() => {
      document.documentElement.classList.remove('is-page-transitioning');
      pageTarget.classList.remove('is-page-settling');
      navigatingPage = false;
    }, 720);
  };

  if (scrollDownCue) {
    scrollDownCue.addEventListener('click', () => settlePage(1));
  }
  if (secondaryScrollDownCue) {
    secondaryScrollDownCue.addEventListener('click', () => settlePage(2));
  }

  window.addEventListener('wheel', (event) => {
    if (navigatingPage || Math.abs(event.deltaY) < 4 || isInteractiveGestureTarget(event.target)) return;
    const currentIndex = getCurrentPageIndex();
    if (event.deltaY > 0 && currentIndex < pageSections.length - 1) {
      event.preventDefault();
      settlePage(currentIndex + 1);
    } else if (event.deltaY < 0 && currentIndex > 0) {
      event.preventDefault();
      settlePage(currentIndex - 1);
    }
  }, { passive: false });

  document.addEventListener('touchstart', (event) => {
    touchStartY = null;
    touchBoundary = null;
    touchDirection = null;
    if (navigatingPage || event.touches.length !== 1 || isInteractiveGestureTarget(event.target)) return;
    const currentIndex = getCurrentPageIndex();
    if (Math.abs(window.scrollY - pageSections[currentIndex].offsetTop) > 4) return;
    touchBoundary = currentIndex;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (touchStartY === null || touchBoundary === null || event.touches.length !== 1) return;
    const deltaY = event.touches[0].clientY - touchStartY;
    if (deltaY < -8 && touchBoundary < pageSections.length - 1) {
      touchDirection = 'next';
      event.preventDefault();
    } else if (deltaY > 8 && touchBoundary > 0) {
      touchDirection = 'previous';
      event.preventDefault();
    }
  }, { passive: false });

  const finishTouchNavigation = () => {
    if (touchDirection === 'next' && touchBoundary !== null) settlePage(touchBoundary + 1);
    if (touchDirection === 'previous' && touchBoundary !== null) settlePage(touchBoundary - 1);
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

  emotions.forEach((emotion, index) => {
    const startAngle = index * 45 - 22.5;
    const endAngle = startAngle + 45;
    const sector = document.createElementNS(SVG_NS, 'path');
    sector.setAttribute('d', createSectorPath(startAngle, endAngle));
    sector.setAttribute('fill', emotion.color);
    sector.setAttribute('class', 'emotion-sector');
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

  /* ---------------- 科学情绪调节 ---------------- */
  const regulationTopics = [
    {
      id: 'situation',
      index: '01',
      label: '情境',
      title: '先改变情绪发生的情境',
      short: '离开、靠近，或调整触发情绪的环境',
      summary: '情绪常由具体情境触发。暂时离开、降低刺激，或改变环境中的一小部分，可以降低情绪峰值。这类做法属于 Gross 过程模型中的“情境选择”和“情境修改”。',
      actions: [
        '离开触发源 3–10 分钟，给身体一点回落时间。',
        '关闭一个通知、换一个位置，或减少同时处理的任务。',
        '无法离开时，清楚说明：“我需要暂停一下，稍后再继续。”'
      ],
      caution: '短暂回避不等于解决问题。如果问题会持续存在，需要在情绪下降后重新安排一次面对。',
      source: 'Gross（1998）；Webb、Miles 与 Sheeran（2012）'
    },
    {
      id: 'attention',
      index: '02',
      label: '注意',
      title: '把注意从反刍中移开',
      short: '先把注意转向外部感官或具体任务',
      summary: '情绪高峰时，注意容易被反复的念头占满。把注意转向外部感官或一个具体任务，可以先把强度降下来，为后续判断留出空间。',
      actions: [
        '观察眼前 5 样东西、3 种声音和 1 处身体接触。',
        '选择一件两分钟内能完成的小事，只做这一件。',
        '暂时停止反复搜索和推演，把问题留到稍后处理。'
      ],
      caution: '转移注意适合应对高峰，不适合把所有问题永久搁置。状态缓和后，仍要回到需要处理的事情。',
      source: 'Gross（1998）；Webb、Miles 与 Sheeran（2012）'
    },
    {
      id: 'reappraisal',
      index: '03',
      label: '解释',
      title: '换一种更完整的解释',
      short: '检查当前判断是否有遗漏或过度概括',
      summary: '认知重评是重新理解事件的意义。它不是强迫自己积极，而是检查当前解释是否完整、是否符合现有事实，并形成更准确的判断。',
      actions: [
        '写下脑中出现的第一句判断。',
        '分别列出支持和不支持这句话的事实。',
        '把它改成更准确、但不过度美化的说法。'
      ],
      caution: '如果现实中的伤害、冲突或边界问题确实存在，不需要通过重新解释把它们合理化。',
      source: 'Gross 与 John（2003）；Webb、Miles 与 Sheeran（2012）'
    },
    {
      id: 'expression',
      index: '04',
      label: '表达',
      title: '把感受说清楚',
      short: '把笼统的难受拆成感受、原因和需要',
      summary: '把模糊的难受拆成具体感受，可能降低情绪反应的自动性。使用自己的名字进行第三人称自我对话，也可能帮助拉开一点心理距离。',
      actions: [
        '“我现在感到___，强度大约___/10。”',
        '“这可能和___有关，我现在需要的是___。”',
        '用名字称呼自己：“___现在最需要先做什么？”'
      ],
      caution: '表达不等于反复发泄。持续强化同一痛苦叙事，不一定带来缓解；表达后可以尝试转向一个具体需要或行动。',
      source: 'Lieberman 等（2007）；Kross 等（2014）'
    },
    {
      id: 'body',
      index: '05',
      label: '身体',
      title: '先从身体反应开始',
      short: '用低强度动作缓冲生理唤醒',
      summary: '情绪高峰会伴随生理唤醒，并影响注意和判断。延长呼气、放松下颌和肩膀，可以作为不依赖思考的即时缓冲。',
      actions: [
        '自然吸气，再轻轻补吸一点，然后缓慢呼气。',
        '让双脚踩地，松开下颌和肩膀。',
        '走动一分钟，不要求自己立刻平静。'
      ],
      caution: '呼吸练习不是治疗。如果出现头晕、胸闷或不适，应停止练习并恢复自然呼吸。',
      source: 'Balban 等（2023）'
    }
  ];

  let regulationLastFocused = null;

  const regulationReferences = `
    <section class="regulation-references">
      <h3>主要研究依据</h3>
      <ul>
        <li>Gross, J. J. (1998). The emerging field of emotion regulation: An integrative review. <em>Review of General Psychology, 2</em>(3), 271–299.</li>
        <li>Gross, J. J., &amp; John, O. P. (2003). Individual differences in two emotion regulation processes. <em>Journal of Personality and Social Psychology, 85</em>(2), 348–362.</li>
        <li>Webb, T. L., Miles, E., &amp; Sheeran, P. (2012). Dealing with feeling: A meta-analysis of emotion-regulation strategies. <em>Psychological Bulletin, 138</em>(4), 775–808.</li>
        <li>Lieberman, M. D., et al. (2007). Putting feelings into words: Affect labeling disrupts amygdala activity. <em>Psychological Science, 18</em>(5), 421–428.</li>
        <li>Kross, E., et al. (2014). Self-talk as a regulatory mechanism: How you do it matters. <em>Journal of Personality and Social Psychology, 106</em>(2), 304–324.</li>
        <li>Balban, M. Y., et al. (2023). Brief structured respiration practices enhance mood and reduce physiological arousal. <em>Cell Reports Medicine, 4</em>(1), 100895.</li>
      </ul>
      <p class="regulation-disclaimer">本模块用于日常自我觉察和放松教育，不替代医疗诊断、心理治疗或危机干预。研究结论反映群体趋势，不代表某一种方法适合所有人。</p>
    </section>
  `;

  const renderRegulationOverview = () => {
    if (!regulationModal) return;
    regulationModalTitle.textContent = '情绪调节的五个科学入口';
    regulationModalSubtitle.textContent = '情绪调节不是把感受压下去，而是在合适的环节改变它接下来的走向。';
    regulationModalBody.innerHTML = `
      <p class="regulation-overview-lead">Gross 的情绪调节过程模型把介入点分为情境选择、情境修改、注意分配、认知改变和反应调节。不同策略适用于不同阶段；长期压抑通常不是最理想的策略，但也不存在适合所有人的单一方法。</p>
      <div class="regulation-overview-grid">
        ${regulationTopics.map((topic) => `
          <button class="regulation-overview-card" type="button" data-regulation-topic="${topic.id}">
            <span>${topic.index}</span>
            <b>${topic.label}</b>
            <small>${topic.short}</small>
          </button>
        `).join('')}
      </div>
      ${regulationReferences}
    `;
    regulationModalBody.scrollTop = 0;
  };

  const renderRegulationDetail = (topicId) => {
    const topic = regulationTopics.find((item) => item.id === topicId);
    if (!topic || !regulationModal) return;
    regulationModalTitle.textContent = topic.index + ' · ' + topic.title;
    regulationModalSubtitle.textContent = topic.short;
    regulationModalBody.innerHTML = `
      <button class="regulation-back" type="button" data-regulation-overview>← 返回五个入口</button>
      <p class="regulation-detail-summary">${topic.summary}</p>
      <ul class="regulation-action-list">
        ${topic.actions.map((action, index) => `<li data-step="${index + 1}">${action}</li>`).join('')}
      </ul>
      <p class="regulation-caution"><strong>需要留意：</strong>${topic.caution}</p>
      <p class="regulation-source">依据：${topic.source}</p>
    `;
    regulationModalBody.scrollTop = 0;
  };

  const closeRegulationModal = () => {
    if (!regulationModal || !regulationModal.classList.contains('is-open')) return;
    regulationModal.classList.remove('is-open');
    regulationModal.setAttribute('aria-hidden', 'true');
    body.classList.remove('regulation-modal-open');
    if (regulationLastFocused && typeof regulationLastFocused.focus === 'function') {
      regulationLastFocused.focus({ preventScroll: true });
    }
  };

  const openRegulationModal = (topicId = null) => {
    if (!regulationModal) return;
    const wasOpen = regulationModal.classList.contains('is-open');
    if (!wasOpen) {
      regulationLastFocused = document.activeElement;
      regulationModal.classList.add('is-open');
      regulationModal.setAttribute('aria-hidden', 'false');
      body.classList.add('regulation-modal-open');
    }
    if (topicId) renderRegulationDetail(topicId);
    else renderRegulationOverview();
    window.setTimeout(() => regulationModalPanel.focus({ preventScroll: true }), 50);
  };

  if (regulationModal) {
    document.querySelectorAll('.regulation-entry[data-regulation-topic]').forEach((button) => {
      button.addEventListener('click', () => openRegulationModal(button.dataset.regulationTopic));
    });
    if (openRegulationOverviewButton) {
      openRegulationOverviewButton.addEventListener('click', () => openRegulationModal());
    }
    if (closeRegulationModalButton) {
      closeRegulationModalButton.addEventListener('click', closeRegulationModal);
    }
    const regulationBackdrop = regulationModal.querySelector('[data-close-regulation]');
    if (regulationBackdrop) regulationBackdrop.addEventListener('click', closeRegulationModal);
    regulationModalBody.addEventListener('click', (event) => {
      const topicButton = event.target.closest('[data-regulation-topic]');
      if (topicButton) {
        renderRegulationDetail(topicButton.dataset.regulationTopic);
        regulationModalPanel.focus({ preventScroll: true });
        return;
      }
      if (event.target.closest('[data-regulation-overview]')) {
        renderRegulationOverview();
        regulationModalPanel.focus({ preventScroll: true });
      }
    });
    regulationModal.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...regulationModalPanel.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        regulationModalPanel.focus();
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
  }

  /* ---------------- 侧边栏首页 ---------------- */
  if (homeNav) homeNav.addEventListener('click', () => settlePage(0));

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
    if (regulationModal && regulationModal.classList.contains('is-open')) closeRegulationModal();
  });

  /* ---------------- 背景音乐：全站共享状态 ---------------- */
  const setMusicUI = (playing) => {
    musicButton.classList.toggle('is-playing', playing);
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.setAttribute('aria-label', playing ? '关闭背景音乐' : '播放背景音乐');
    musicButton.dataset.tooltip = playing ? '关闭背景音乐' : '播放背景音乐';
  };

  const positionVolumePanel = () => {
    if (!window.matchMedia('(max-width: 900px)').matches) {
      musicVolumePanel.style.removeProperty('--volume-panel-top');
      return;
    }
    const triggerRect = musicVolumeTrigger.getBoundingClientRect();
    const top = Math.max(8, Math.min(triggerRect.bottom + 8, window.innerHeight - 86));
    musicVolumePanel.style.setProperty('--volume-panel-top', Math.round(top) + 'px');
  };

  const setVolumePanelOpen = (open) => {
    if (open) positionVolumePanel();
    musicVolumeWrap.classList.toggle('is-volume-open', open);
    appSidebar?.classList.toggle('music-volume-open', open);
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
    setMusicUI(backgroundMusic.isPlaying());

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
        setMusicUI(backgroundMusic.isPlaying());
        if (result.enabled && !result.started) {
          showToast('背景音乐已开启，轻触页面后开始播放。');
        }
      } catch (error) {
        console.warn('Background music could not be started:', error);
        showToast('背景音乐暂时无法播放，请稍后再试。');
        setMusicUI(backgroundMusic.isPlaying());
      } finally {
        musicButton.disabled = false;
      }
    });
    document.addEventListener('backgroundmusicchange', (event) => {
      setMusicUI(Boolean(event.detail && event.detail.playing));
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
