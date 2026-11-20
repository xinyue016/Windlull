(() => {
  'use strict';
  if (document.querySelector('.app-sidebar')) return;

  const isGamePage = /\/game\.html$/i.test(decodeURIComponent(location.pathname));
  const isDiaryPage = /\/chat\.html$/i.test(decodeURIComponent(location.pathname));
  document.body.classList.add('has-app-sidebar');

  const sidebar = document.createElement('aside');
  sidebar.className = 'app-sidebar';
  sidebar.setAttribute('aria-label', '主要导航');
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <img class="sidebar-brand-logo" src="图片/风歇小筑logo透明.webp" alt="风歇小筑" decoding="async" />
    </div>
    <nav class="sidebar-menu" aria-label="功能菜单">
      <a class="sidebar-nav-item" href="index.html?v=20261120-40" aria-label="返回首页">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.2V20h13V9.2"/><path d="M9.5 20v-6h5v6"/></svg><span>首页</span>
      </a>
      <a class="sidebar-nav-item${isGamePage ? ' is-active' : ''}" href="game.html?v=20261120-40" aria-label="打开解压小游戏">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 8.2h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.3a2.2 2.2 0 0 1-3.7 1l-2-2H9.9l-2 2a2.2 2.2 0 0 1-3.7-1l-1-3.3a4.5 4.5 0 0 1 4.3-5.8Z"/><path d="M8 11v4M6 13h4M16.5 12.2h.1M18.2 14h.1"/></svg><span>解压小游戏</span>
      </a>
      <a class="sidebar-nav-item${isDiaryPage ? ' is-active' : ''}" href="chat.html?v=20261120-40" aria-label="打开情绪日记">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.5h8.2l3.4 3.4v13.6H6.2z"/><path d="M14.2 3.6v3.6h3.6M9 11h6M9 14.2h6M9 17.4h4"/></svg><span>情绪日记</span>
      </a>
      <div class="sidebar-nav-item sidebar-music-item" id="sharedMusicWrap">
        <button class="sidebar-music-main music-button" id="sharedMusicButton" type="button" aria-label="播放背景音乐" aria-pressed="false">
          <svg class="music-icon music-icon--play" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.2V6.8l9-2v10.6"/><ellipse cx="6.5" cy="18.4" rx="2.8" ry="2.1"/><ellipse cx="15.5" cy="15.8" rx="2.8" ry="2.1"/></svg>
          <svg class="music-icon music-icon--pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>
          <span class="sidebar-music-label">音乐</span>
        </button>
        <button class="music-volume-trigger" id="sharedMusicVolumeTrigger" type="button" aria-label="调节背景音乐音量" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3l4-3v12l-4-3H4z"/><path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10"/></svg>
        </button>
        <div class="music-volume-panel" id="sharedMusicVolumePanel">
          <div class="music-volume-heading"><span>背景音乐音量</span><output id="sharedMusicVolumeOutput">72%</output></div>
          <input class="music-volume-range" id="sharedMusicVolume" type="range" min="0" max="100" step="1" value="72" aria-label="背景音乐音量" />
        </div>
      </div>
    </nav>
    <button class="sidebar-theme-switch" id="sharedThemeToggle" type="button" aria-label="切换白天与黑夜模式" aria-pressed="false">
      <span class="sidebar-theme-track" aria-hidden="true">
        <span class="sidebar-theme-sun"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.3"/><path d="M12 2v2.3M12 19.7V22M2 12h2.3M19.7 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/></svg></span>
        <span class="sidebar-theme-moon"><svg viewBox="0 0 24 24"><path d="M20 15.4A8.4 8.4 0 0 1 8.6 4a8.5 8.5 0 1 0 11.4 11.4Z"/></svg></span>
        <span class="sidebar-theme-knob"></span>
      </span>
      <span class="sidebar-theme-label">昼夜</span>
    </button>`;
  document.body.prepend(sidebar);

  const getTheme = () => {
    try { return localStorage.getItem('emotion-atlas-theme') === 'night'; } catch (_) { return false; }
  };
  const themeButton = sidebar.querySelector('#sharedThemeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const applyTheme = (night) => {
    document.documentElement.classList.toggle('night-mode', night);
    document.body.classList.toggle('night-mode', night);
    themeButton.setAttribute('aria-pressed', String(night));
    themeButton.setAttribute('aria-label', night ? '切换到白天模式' : '切换到黑夜模式');
    if (themeMeta) themeMeta.setAttribute('content', night ? '#211944' : '#a9d8f2');
    try { localStorage.setItem('emotion-atlas-theme', night ? 'night' : 'day'); } catch (_) { /* storage disabled */ }
  };
  applyTheme(getTheme());
  themeButton.addEventListener('click', () => applyTheme(!getTheme()));

  const wrap = sidebar.querySelector('#sharedMusicWrap');
  const musicButton = sidebar.querySelector('#sharedMusicButton');
  const volumeTrigger = sidebar.querySelector('#sharedMusicVolumeTrigger');
  const volumePanel = sidebar.querySelector('#sharedMusicVolumePanel');
  const volumeRange = sidebar.querySelector('#sharedMusicVolume');
  const volumeOutput = sidebar.querySelector('#sharedMusicVolumeOutput');
  const backgroundMusic = window.BackgroundMusic;
  const syncMusic = (enabled, volume) => {
    const value = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
    musicButton.classList.toggle('is-playing', Boolean(enabled));
    musicButton.setAttribute('aria-pressed', String(Boolean(enabled)));
    musicButton.setAttribute('aria-label', enabled ? '关闭背景音乐' : '播放背景音乐');
    volumeRange.value = String(value);
    volumeOutput.value = value + '%';
    volumeOutput.textContent = value + '%';
  };
  if (backgroundMusic) {
    syncMusic(backgroundMusic.isEnabled(), backgroundMusic.getVolume());
    musicButton.addEventListener('click', async () => {
      const result = await backgroundMusic.toggle();
      syncMusic(result.enabled, backgroundMusic.getVolume());
    });
    volumeRange.addEventListener('input', () => {
      backgroundMusic.setVolume(Number(volumeRange.value));
      syncMusic(backgroundMusic.isEnabled(), volumeRange.value);
    });
    document.addEventListener('backgroundmusicchange', (event) => {
      syncMusic(Boolean(event.detail?.enabled), event.detail?.volume ?? backgroundMusic.getVolume());
    });
  } else {
    musicButton.disabled = true;
    volumeRange.disabled = true;
  }
  const positionVolumePanel = () => {
    if (!window.matchMedia('(max-width: 900px)').matches) {
      volumePanel.style.removeProperty('--volume-panel-top');
      return;
    }
    const triggerRect = volumeTrigger.getBoundingClientRect();
    const top = Math.max(8, Math.min(triggerRect.bottom + 8, window.innerHeight - 86));
    volumePanel.style.setProperty('--volume-panel-top', Math.round(top) + 'px');
  };
  volumeTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = !wrap.classList.contains('is-volume-open');
    if (open) positionVolumePanel();
    wrap.classList.toggle('is-volume-open', open);
    sidebar.classList.toggle('music-volume-open', open);
    volumeTrigger.setAttribute('aria-expanded', String(open));
  });
  volumePanel.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => {
    wrap.classList.remove('is-volume-open');
    sidebar.classList.remove('music-volume-open');
    volumeTrigger.setAttribute('aria-expanded', 'false');
  });
})();