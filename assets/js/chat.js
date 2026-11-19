/* 风歇小筑 · 本地情绪日记与可拖动星星 */
(() => {
  'use strict';

  const MOOD_STORAGE_KEY = 'emotion-atlas-mood-records';
  const HISTORY_STORAGE_KEY = 'emotion-atlas-mood-history';
  const STAR_POSITION_KEY = 'emotion-atlas-star-position';
  const MAX_ACTIVE_RECORDS = 50;

  const emotions = {
    joy: { name: '喜悦', icon: '😊' },
    trust: { name: '信任', icon: '🤝' },
    fear: { name: '恐惧', icon: '😨' },
    surprise: { name: '惊讶', icon: '😲' },
    sadness: { name: '悲伤', icon: '😢' },
    disgust: { name: '厌恶', icon: '🤢' },
    anger: { name: '愤怒', icon: '😠' },
    anticipation: { name: '期待', icon: '🤩' }
  };
  const emotionAliases = {
    happy: 'joy',
    joy: 'joy',
    angry: 'anger',
    sad: 'sadness',
    blue: 'sadness'
  };
  const normalizeEmotionKey = (key) => emotions[key] ? key : (emotionAliases[key] || 'joy');

  const moodRecords = document.getElementById('moodRecords');
  const moodRecordsCanvas = document.getElementById('moodRecordsCanvas');
  const moodEmpty = document.getElementById('moodEmpty');
  const activeMoodCount = document.getElementById('activeMoodCount');
  const historyMoodCount = document.getElementById('historyMoodCount');
  const addMoodButton = document.getElementById('addMoodButton');
  const historyMoodButton = document.getElementById('historyMoodButton');
  const addMoodModal = document.getElementById('addMoodModal');
  const detailMoodModal = document.getElementById('detailMoodModal');
  const historyMoodModal = document.getElementById('historyMoodModal');
  const addMoodForm = document.getElementById('addMoodForm');
  const moodTimeInput = document.getElementById('moodTimeInput');
  const moodEmotionInput = document.getElementById('moodEmotionInput');
  const moodEventInput = document.getElementById('moodEventInput');
  const moodFormError = document.getElementById('moodFormError');
  const detailMoodTime = document.getElementById('detailMoodTime');
  const detailMoodEmotion = document.getElementById('detailMoodEmotion');
  const detailMoodEvent = document.getElementById('detailMoodEvent');
  const historyMoodList = document.getElementById('historyMoodList');
  const deleteMoodButton = document.getElementById('deleteMoodButton');
  const starWidget = document.getElementById('diaryStarWidget');
  const starSpeech = document.getElementById('diaryStarSpeech');

  const modalTriggers = {
    add: addMoodButton,
    detail: null,
    history: historyMoodButton
  };
  let activeModal = null;
  let modalReturnFocus = null;
  let currentMoodIndex = -1;
  let speechTimer = null;

  const safeStorage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (_) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (_) { /* storage disabled */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (_) { /* storage disabled */ }
    }
  };

  const readArray = (key) => {
    const raw = safeStorage.get(key);
    if (!raw) return [];
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    } catch (_) {
      return [];
    }
  };

  let moodList = readArray(MOOD_STORAGE_KEY).slice(-MAX_ACTIVE_RECORDS);
  let historyList = readArray(HISTORY_STORAGE_KEY);

  const nowLabel = () => {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  };

  const saveMoodState = () => {
    safeStorage.set(MOOD_STORAGE_KEY, JSON.stringify(moodList));
    safeStorage.set(HISTORY_STORAGE_KEY, JSON.stringify(historyList));
  };

  const updateCounts = () => {
    if (activeMoodCount) activeMoodCount.textContent = String(moodList.length);
    if (historyMoodCount) historyMoodCount.textContent = String(historyList.length);
    if (moodEmpty) moodEmpty.hidden = moodList.length > 0;
  };

  const getEmotion = (key) => emotions[normalizeEmotionKey(key)];

  const openDiaryModal = (dialog, returnFocus) => {
    if (!dialog) return;
    if (activeModal && activeModal !== dialog) {
      activeModal.classList.remove('is-open');
      activeModal.setAttribute('aria-hidden', 'true');
    }
    modalReturnFocus = returnFocus || document.activeElement;
    activeModal = dialog;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    const panel = dialog.querySelector('.diary-modal-panel');
    window.setTimeout(() => panel && panel.focus({ preventScroll: true }), 40);
  };

  const closeDiaryModal = () => {
    if (!activeModal) return;
    activeModal.classList.remove('is-open');
    activeModal.setAttribute('aria-hidden', 'true');
    activeModal = null;
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') {
      modalReturnFocus.focus({ preventScroll: true });
    }
  };

  const layoutMoodRecords = () => {
    if (!moodRecords || !moodRecordsCanvas) return;
    const buttons = [...moodRecordsCanvas.querySelectorAll('.mood-record')];
    if (!buttons.length) return;
    const width = moodRecords.clientWidth;
    const viewHeight = moodRecords.clientHeight;
    if (width < 20 || viewHeight < 20) return;

    const baseWidth = buttons[0].offsetWidth || (window.innerWidth <= 560 ? 46 : 68);
    const baseHeight = buttons[0].offsetHeight || baseWidth;
    const gap = 5;
    const columns = Math.max(1, Math.floor((width - gap) / (baseWidth + gap)));
    const availableRows = Math.max(1, Math.floor((viewHeight - gap) / (baseHeight + gap)));
    const rows = Math.max(Math.ceil(buttons.length / columns), availableRows);
    const canvasHeight = Math.max(viewHeight, rows * (baseHeight + gap) + gap);
    moodRecordsCanvas.style.height = canvasHeight + 'px';

    const slots = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        slots.push({
          x: ((column + 0.5) / columns) * 100,
          y: ((row + 0.5) / rows) * 100
        });
      }
    }

    buttons.forEach((button, index) => {
      const item = moodList[index] || {};
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex];
        const dx = slot.x - (Number(item.left) || 41);
        const dy = slot.y - (Number(item.top) || 36);
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = slotIndex;
        }
      }
      const chosen = slots.splice(bestIndex, 1)[0];
      if (!chosen) return;
      button.style.left = chosen.x + '%';
      button.style.top = chosen.y + '%';
      if (moodList[index]) {
        moodList[index].left = chosen.x;
        moodList[index].top = chosen.y;
      }
    });
    saveMoodState();
  };
  const renderMoodRecords = () => {
    if (!moodRecords) return;
    moodRecordsCanvas.innerHTML = '';
    moodList.forEach((item, index) => {
      const emotion = getEmotion(item.emo);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mood-record';
      button.textContent = emotion.icon;
      button.style.left = Number(item.left) + '%';
      button.style.top = Number(item.top) + '%';
      button.dataset.emotion = normalizeEmotionKey(item.emo);
      button.title = (item.time || '') + ' · ' + emotion.name;
      button.setAttribute('aria-label', (item.time || '') + '，' + emotion.name + '，' + (item.event || ''));
      let longPressTimer = 0;
      let clickTimer = 0;
      let longPressTriggered = false;
      let suppressClick = false;
      const clearLongPress = () => {
        window.clearTimeout(longPressTimer);
        button.classList.remove('is-long-press');
      };
      const burst = () => {
        button.classList.remove('is-bursting');
        void button.offsetWidth;
        button.classList.add('is-bursting');
        window.setTimeout(() => button.classList.remove('is-bursting'), 700);
      };
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        clearLongPress();
        longPressTriggered = false;
        longPressTimer = window.setTimeout(() => {
          longPressTriggered = true;
          suppressClick = true;
          button.classList.add('is-long-press');
          if (navigator.vibrate) navigator.vibrate(12);
        }, 420);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => {
        button.addEventListener(name, () => {
          clearLongPress();
          if (longPressTriggered) window.setTimeout(() => { suppressClick = false; }, 500);
        });
      });
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (clickTimer) {
          window.clearTimeout(clickTimer);
          clickTimer = 0;
          burst();
          return;
        }
        clickTimer = window.setTimeout(() => {
          clickTimer = 0;
          currentMoodIndex = index;
          if (detailMoodTime) detailMoodTime.textContent = item.time || '';
          if (detailMoodEmotion) detailMoodEmotion.textContent = emotion.name + ' ' + emotion.icon;
          if (detailMoodEvent) detailMoodEvent.textContent = item.event || '';
          openDiaryModal(detailMoodModal, button);
        }, 230);
      });
      moodRecordsCanvas.appendChild(button);
    });
    updateCounts();
    window.requestAnimationFrame(layoutMoodRecords);
  };

  const renderHistory = () => {
    if (!historyMoodList) return;
    historyMoodList.innerHTML = '';
    if (!historyList.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = '暂无历史记录。同屏记录超过 50 条后，更早的记录会出现在这里。';
      historyMoodList.appendChild(empty);
      return;
    }
    historyList.forEach((item) => {
      const emotion = getEmotion(item.emo);
      const article = document.createElement('article');
      article.className = 'history-mood-item';
      const header = document.createElement('header');
      const name = document.createElement('strong');
      const time = document.createElement('time');
      const event = document.createElement('p');
      name.textContent = emotion.icon + ' ' + emotion.name;
      time.textContent = item.time || '';
      event.textContent = item.event || '';
      header.append(name, time);
      article.append(header, event);
      historyMoodList.appendChild(article);
    });
  };

  const resetAddForm = () => {
    if (moodTimeInput) moodTimeInput.value = nowLabel();
    if (moodEmotionInput) moodEmotionInput.value = 'joy';
    if (moodEventInput) moodEventInput.value = '';
    if (moodFormError) moodFormError.textContent = '';
  };

  if (addMoodButton) {
    addMoodButton.addEventListener('click', () => {
      resetAddForm();
      openDiaryModal(addMoodModal, addMoodButton);
      window.setTimeout(() => moodEventInput && moodEventInput.focus(), 100);
    });
  }

  if (historyMoodButton) {
    historyMoodButton.addEventListener('click', () => {
      renderHistory();
      openDiaryModal(historyMoodModal, historyMoodButton);
    });
  }

  if (addMoodForm) {
    addMoodForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const time = moodTimeInput ? moodTimeInput.value.trim() : '';
      const emo = normalizeEmotionKey(moodEmotionInput ? moodEmotionInput.value : 'joy');
      const eventText = moodEventInput ? moodEventInput.value.trim() : '';
      if (!time || !eventText) {
        if (moodFormError) moodFormError.textContent = '时间和事件都需要填写。';
        return;
      }
      if (moodList.length >= MAX_ACTIVE_RECORDS) {
        historyList.push(moodList.shift());
      }
      moodList.push({
        time,
        emo,
        event: eventText,
        left: Math.random() * 82,
        top: Math.random() * 72
      });
      saveMoodState();
      renderMoodRecords();
      closeDiaryModal();
    });
  }

  if (deleteMoodButton) {
    deleteMoodButton.addEventListener('click', () => {
      if (currentMoodIndex < 0 || currentMoodIndex >= moodList.length) return;
      moodList.splice(currentMoodIndex, 1);
      currentMoodIndex = -1;
      saveMoodState();
      renderMoodRecords();
      closeDiaryModal();
    });
  }

  const bindClose = (selector) => {
    document.querySelectorAll(selector).forEach((button) => button.addEventListener('click', closeDiaryModal));
  };
  bindClose('[data-close-add-mood], #cancelAddMoodTop, #cancelAddMood');
  bindClose('[data-close-mood-detail], #closeMoodDetailTop, #closeMoodDetail');
  bindClose('[data-close-mood-history], #closeMoodHistoryTop, #closeMoodHistory');

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeModal) closeDiaryModal();
  });

  /* 星星挂件：保留拖动、悬挂和 Q 弹反馈，但不再承担智能体功能 */
  const placeSpeech = () => {
    if (!starWidget) return;
    const rect = starWidget.getBoundingClientRect();
    starWidget.classList.toggle('bubble-right', rect.left < 260);
  };

  const hideSpeech = () => {
    window.clearTimeout(speechTimer);
    if (starSpeech) starSpeech.classList.remove('is-visible');
  };

  const showSpeech = (text, duration = 2600) => {
    if (!starSpeech) return;
    window.clearTimeout(speechTimer);
    placeSpeech();
    starSpeech.textContent = text;
    starSpeech.classList.add('is-visible');
    if (duration > 0) {
      speechTimer = window.setTimeout(() => starSpeech.classList.remove('is-visible'), duration);
    }
  };

  const clampStar = (left, top) => {
    const width = starWidget.offsetWidth;
    const height = starWidget.offsetHeight;
    return {
      left: Math.max(8, Math.min(window.innerWidth - width - 8, left)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, top))
    };
  };

  const bounceStar = () => {
    starWidget.classList.remove('is-bouncing');
    void starWidget.offsetWidth;
    starWidget.classList.add('is-bouncing');
    window.setTimeout(() => starWidget.classList.remove('is-bouncing'), 850);
  };

  const pokeStar = () => {
    if (!starWidget) return;
    starWidget.classList.remove('is-poked');
    void starWidget.offsetWidth;
    starWidget.classList.add('is-poked');
    const phrases = ['写下一笔，给今天留个位置。', '只留一个表情，也算记录。', '不用写得完整，慢慢来。', '今天的感受，值得被看见。'];
    showSpeech(phrases[Math.floor(Math.random() * phrases.length)], 2100);
    window.setTimeout(() => starWidget.classList.remove('is-poked'), 650);
  };

  if (starWidget) {
    const savedPosition = safeStorage.get(STAR_POSITION_KEY);
    if (savedPosition) {
      try {
        const position = JSON.parse(savedPosition);
        if (Number.isFinite(position.left) && Number.isFinite(position.top)) {
          starWidget.style.left = position.left + 'px';
          starWidget.style.top = position.top + 'px';
          starWidget.style.right = 'auto';
        }
      } catch (_) {
        safeStorage.remove(STAR_POSITION_KEY);
      }
    }

    const drag = {
      active: false,
      moved: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originLeft: 0,
      originTop: 0
    };

    starWidget.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      const rect = starWidget.getBoundingClientRect();
      drag.active = true;
      drag.moved = false;
      drag.pointerId = event.pointerId;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.originLeft = rect.left;
      drag.originTop = rect.top;
      starWidget.style.left = rect.left + 'px';
      starWidget.style.top = rect.top + 'px';
      starWidget.style.right = 'auto';
      starWidget.classList.add('is-dragging');
      starWidget.setPointerCapture(event.pointerId);
      hideSpeech();
    });

    starWidget.addEventListener('pointermove', (event) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      const position = clampStar(drag.originLeft + dx, drag.originTop + dy);
      starWidget.style.left = position.left + 'px';
      starWidget.style.top = position.top + 'px';
    });

    const endDrag = (event) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      drag.active = false;
      starWidget.classList.remove('is-dragging');
      try { starWidget.releasePointerCapture(event.pointerId); } catch (_) { /* released */ }
      if (drag.moved) {
        const rect = starWidget.getBoundingClientRect();
        safeStorage.set(STAR_POSITION_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
        bounceStar();
        showSpeech('放我下来啦。', 1400);
      } else {
        pokeStar();
      }
      drag.pointerId = null;
    };

    starWidget.addEventListener('pointerup', endDrag);
    starWidget.addEventListener('pointercancel', endDrag);
    starWidget.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pokeStar();
      }
    });

    requestAnimationFrame(() => {
      const rect = starWidget.getBoundingClientRect();
      if (starWidget.style.left || starWidget.style.top) {
        const position = clampStar(rect.left, rect.top);
        starWidget.style.left = position.left + 'px';
        starWidget.style.top = position.top + 'px';
        starWidget.style.right = 'auto';
      }
      placeSpeech();
    });

    window.addEventListener('resize', () => {
      const rect = starWidget.getBoundingClientRect();
      const position = clampStar(rect.left, rect.top);
      starWidget.style.left = position.left + 'px';
      starWidget.style.top = position.top + 'px';
      starWidget.style.right = 'auto';
      placeSpeech();
    });

    window.setTimeout(() => showSpeech('写下一笔，给今天留个位置。', 3200), 500);
  }

  renderMoodRecords();
  if (window.ResizeObserver && moodRecords) {
    const moodLayoutObserver = new ResizeObserver(() => layoutMoodRecords());
    moodLayoutObserver.observe(moodRecords);
  } else {
    window.addEventListener('resize', layoutMoodRecords);
  }
})();