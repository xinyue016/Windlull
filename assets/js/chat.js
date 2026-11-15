/* 情绪搭子 · 本地聊天与拖拽星星 */
(() => {
  'use strict';

  const thread = document.getElementById('chatThread');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const quickPrompts = document.getElementById('quickPrompts');
  const newChatButton = document.getElementById('newChat');
  const clearChatButton = document.getElementById('clearChat');
  const conversationTime = document.getElementById('conversationTime');
  const starWidget = document.getElementById('agentStarWidget');
  const starSpeech = document.getElementById('starSpeech');
  const emotionInsight = document.getElementById('emotionInsight');
  const emotionLabel = document.getElementById('emotionLabel');
  const emotionTrend = document.getElementById('emotionTrend');
  const emotionDot = document.getElementById('emotionDot');
  const emotionMeterFill = document.getElementById('emotionMeterFill');
  const emotionHint = document.getElementById('emotionHint');
  const moodCheck = document.getElementById('moodCheck');
  const recommendedGame = document.getElementById('recommendedGame');
  const taxonomyMap = new Map(window.EMOTION_AGENT_DATA.taxonomy.categories.map((item) => [item.id, item]));

  const STORAGE_KEY = 'emotion-atlas-chat-history';
  const STAR_POSITION_KEY = 'emotion-atlas-star-position';
  let messages = [];
  let sending = false;
  let speechTimer = null;
  let replyTimers = [];

  const safeStorage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (_) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (_) { /* static local fallback */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (_) { /* storage disabled */ }
    }
  };

  const chatThemeMeta = document.querySelector('meta[name="theme-color"]');
  const applyChatTheme = () => {
    const isNight = safeStorage.get('emotion-atlas-theme') === 'night';
    document.documentElement.classList.toggle('night-mode', isNight);
    if (chatThemeMeta) chatThemeMeta.setAttribute('content', isNight ? '#211944' : '#a9d8f2');
  };
  applyChatTheme();
  window.addEventListener('storage', (event) => {
    if (event.key === 'emotion-atlas-theme') applyChatTheme();
  });
  window.addEventListener('pageshow', applyChatTheme);

  const nowLabel = () => {
    const date = new Date();
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  };

  const welcomeMessages = () => [
    { role: 'star', text: '嗨，我在这里。今天想从哪里开始聊？', time: nowLabel() },
    { role: 'star', text: '你不需要把情绪整理得很完美，慢慢说就好。', time: nowLabel() }
  ];

  const loadMessages = () => {
    const raw = safeStorage.get(STORAGE_KEY);
    if (!raw) return welcomeMessages();
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : welcomeMessages();
    } catch (_) {
      return welcomeMessages();
    }
  };

  const saveMessages = () => {
    messages = messages.slice(-80);
    safeStorage.set(STORAGE_KEY, JSON.stringify(messages));
    if (messages.length) conversationTime.textContent = messages[messages.length - 1].time || '刚刚';
  };

  const scrollToBottom = (smooth = true) => {
    thread.scrollTo({ top: thread.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const createMessageRow = (message) => {
    const row = document.createElement('div');
    row.className = 'message-row ' + (message.role === 'user' ? 'user' : 'star');

    if (message.role !== 'user') {
      const avatar = document.createElement('span');
      avatar.className = 'message-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = '✦';
      row.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message.text;
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = message.time || '';
    bubble.appendChild(time);
    row.appendChild(bubble);
    return row;
  };

  const renderMessages = () => {
    thread.innerHTML = '';
    messages.forEach((message) => thread.appendChild(createMessageRow(message)));
    quickPrompts.hidden = messages.length > 2;
    saveMessages();
    requestAnimationFrame(() => scrollToBottom(false));
  };

  const showTyping = () => {
    const row = document.createElement('div');
    row.className = 'message-row star';
    row.id = 'typingMessage';
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = '✦';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble typing-bubble';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    row.appendChild(avatar);
    row.appendChild(bubble);
    thread.appendChild(row);
    scrollToBottom();
  };

  const removeTyping = () => {
    const typing = document.getElementById('typingMessage');
    if (typing) typing.remove();
  };

  const placeSpeech = () => {
    const rect = starWidget.getBoundingClientRect();
    starWidget.classList.toggle('bubble-right', rect.left < 250);
  };

  const showSpeech = (text, duration = 3000) => {
    window.clearTimeout(speechTimer);
    placeSpeech();
    starSpeech.textContent = text;
    starSpeech.classList.add('is-visible');
    if (duration > 0) {
      speechTimer = window.setTimeout(() => {
        starSpeech.classList.remove('is-visible');
      }, duration);
    }
  };

  const hideSpeech = () => {
    window.clearTimeout(speechTimer);
    starSpeech.classList.remove('is-visible');
  };

  const trendText = (trend) => ({
    improved: '明显缓和',
    slightly_improved: '稍微缓和',
    stable: '暂时平稳',
    slightly_worse: '略微变重',
    worse: '明显变重'
  })[trend] || '正在记录';

  const renderEmotionInsight = (result) => {
    if (!result || !result.analysis) return;
    const analysis = result.analysis;
    const category = taxonomyMap.get(analysis.primary);
    const group = category ? category.group : 'mixed';
    emotionInsight.hidden = false;
    emotionLabel.textContent = analysis.primaryName + (analysis.secondaryName ? ' / ' + analysis.secondaryName : '') + ' · 强度 ' + analysis.intensity + '/10';
    emotionHint.textContent = result.knowledge.length
      ? '我参考了本地知识：' + result.knowledge[0].title + '。'
      : '本地分析，不连接服务器。';
    emotionMeterFill.style.width = analysis.intensity * 10 + '%';
    const color = group === 'positive' ? '#65a77c' : group === 'negative' ? '#b47b73' : '#7b9fb2';
    emotionDot.style.background = color;
    emotionDot.style.boxShadow = '0 0 0 4px ' + color + '22';
    emotionMeterFill.style.background = 'linear-gradient(90deg, ' + color + '88, ' + color + ')';
    emotionTrend.textContent = trendText(result.trend.trend);
    emotionTrend.classList.toggle('is-improved', result.trend.trend.includes('improved'));
    emotionTrend.classList.toggle('is-worse', result.trend.trend.includes('worse'));
    moodCheck.hidden = result.turnCount < 2;
    moodCheck.querySelectorAll('[data-self-report]').forEach((button) => button.classList.remove('is-selected'));
    if (result.recommendation) {
      recommendedGame.hidden = false;
      recommendedGame.textContent = '去' + result.recommendation.name;
      recommendedGame.dataset.page = result.recommendation.page;
    } else {
      recommendedGame.hidden = true;
      recommendedGame.dataset.page = '';
    }
  };

  const shortThought = () => {
    const phrases = ['确实是有点棘手呢…', '让我慢慢想一下…', '嗯，我听见了…'];
    return phrases[Math.floor(Math.random() * phrases.length)];
  };

  const finishSending = () => {
    sending = false;
    sendButton.disabled = false;
    input.focus();
  };

  const sendMessage = (rawText) => {
    const text = rawText.trim();
    if (!text || sending) return;
    sending = true;
    sendButton.disabled = true;
    quickPrompts.hidden = true;

    const userMessage = { role: 'user', text, time: nowLabel() };
    messages.push(userMessage);
    thread.appendChild(createMessageRow(userMessage));
    saveMessages();
    scrollToBottom();

    input.value = '';
    input.style.height = 'auto';
    window.clearTimeout(speechTimer);
    replyTimers.forEach((timer) => window.clearTimeout(timer));
    replyTimers = [];

    starWidget.classList.add('is-thinking');
    showSpeech('正在思考…', 0);
    showTyping();

    replyTimers.push(window.setTimeout(() => {
      showSpeech(shortThought(), 0);
    }, 780));

    replyTimers.push(window.setTimeout(() => {
      removeTyping();
      let result = null;
      let replyText = '';
      try {
        result = window.AgentEngine.process(text);
        replyText = result.reply;
        renderEmotionInsight(result);
      } catch (error) {
        console.error('本地情绪分析失败：', error);
        replyText = '我听见了。刚才的本地分析没有顺利运行，但你不需要因此停下来。可以先告诉我，现在最让你难受的是哪一部分？';
      }
      const starMessage = { role: 'star', text: replyText, time: nowLabel() };
      messages.push(starMessage);
      thread.appendChild(createMessageRow(starMessage));
      saveMessages();
      scrollToBottom();
      starWidget.classList.remove('is-thinking');
      starWidget.classList.remove('is-poked');
      void starWidget.offsetWidth;
      starWidget.classList.add('is-poked');
      showSpeech(shortThought(), 2800);
      window.setTimeout(() => starWidget.classList.remove('is-poked'), 650);
      finishSending();
    }, 1900));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input.value);
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  });

  document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      input.value = button.dataset.prompt;
      input.focus();
      input.dispatchEvent(new Event('input'));
    });
  });

  moodCheck.querySelectorAll('[data-self-report]').forEach((button) => {
    button.addEventListener('click', () => {
      const result = window.AgentEngine.applySelfReport(Number(button.dataset.selfReport));
      if (!result) return;
      moodCheck.querySelectorAll('[data-self-report]').forEach((item) => item.classList.remove('is-selected'));
      renderEmotionInsight(result);
      button.classList.add('is-selected');
      showSpeech('已经记下现在的变化。', 1800);
    });
  });

  recommendedGame.addEventListener('click', () => {
    const page = recommendedGame.dataset.page;
    if (page) window.location.href = page;
  });

  const resetConversation = () => {
    replyTimers.forEach((timer) => window.clearTimeout(timer));
    replyTimers = [];
    sending = false;
    sendButton.disabled = false;
    messages = welcomeMessages();
    removeTyping();
    hideSpeech();
    starWidget.classList.remove('is-thinking');
    window.AgentEngine.reset();
    emotionInsight.hidden = true;
    moodCheck.querySelectorAll('[data-self-report]').forEach((button) => button.classList.remove('is-selected'));
    renderMessages();
    showSpeech('新的对话，慢慢来。', 2200);
  };

  newChatButton.addEventListener('click', resetConversation);
  clearChatButton.addEventListener('click', () => {
    if (window.confirm('要清空保存在这台设备上的聊天记录吗？')) resetConversation();
  });

  /* ---------------- 拖动与 Q 弹互动 ---------------- */
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

  const clampStar = (left, top) => {
    const width = starWidget.offsetWidth;
    const height = starWidget.offsetHeight;
    return {
      left: Math.max(8, Math.min(window.innerWidth - width - 8, left)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, top))
    };
  };

  requestAnimationFrame(() => {
    const initialRect = starWidget.getBoundingClientRect();
    if (starWidget.style.left || starWidget.style.top) {
      const initial = clampStar(initialRect.left, initialRect.top);
      starWidget.style.left = initial.left + 'px';
      starWidget.style.top = initial.top + 'px';
      starWidget.style.right = 'auto';
    }
    placeSpeech();
  });

  let drag = {
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0
  };

  const bounceStar = () => {
    starWidget.classList.remove('is-bouncing');
    void starWidget.offsetWidth;
    starWidget.classList.add('is-bouncing');
    window.setTimeout(() => starWidget.classList.remove('is-bouncing'), 850);
  };

  const pokeStar = () => {
    starWidget.classList.remove('is-poked');
    void starWidget.offsetWidth;
    starWidget.classList.add('is-poked');
    const phrases = ['唔，好痒呀！', '再戳一下试试？', '我在呢。', '嘿嘿，被你发现啦。'];
    showSpeech(phrases[Math.floor(Math.random() * phrases.length)], 1600);
    window.setTimeout(() => starWidget.classList.remove('is-poked'), 650);
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
    try { starWidget.releasePointerCapture(event.pointerId); } catch (_) { /* capture already released */ }
    if (drag.moved) {
      const rect = starWidget.getBoundingClientRect();
      safeStorage.set(STAR_POSITION_KEY, JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      }));
      bounceStar();
      showSpeech('放我下来啦～', 1500);
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

  window.addEventListener('resize', () => {
    const rect = starWidget.getBoundingClientRect();
    const position = clampStar(rect.left, rect.top);
    starWidget.style.left = position.left + 'px';
    starWidget.style.top = position.top + 'px';
    starWidget.style.right = 'auto';
    placeSpeech();
  });

  messages = loadMessages();
  renderMessages();
  const restoredResult = window.AgentEngine.getLastResult();
  if (restoredResult && messages.some((message) => message.role === 'user')) renderEmotionInsight(restoredResult);
  window.setTimeout(() => showSpeech('我在这里，慢慢说。', 2600), 500);
})();
