(() => {
  'use strict';
  const embeddedView = new URLSearchParams(window.location.search).get('embed') === '1' || window.self !== window.top;
  if (embeddedView) return;

  const pagePath = decodeURIComponent(window.location.pathname).replace(/\\/g, '/');
  const declaredPage = document.body?.dataset.page || '';
  const isGamePage = declaredPage === 'game' || /\/game\.html$/i.test(pagePath);
  const pageTrack = isGamePage
    ? { src: 'assets/audio/game-background-web.mp3', volume: 0.72, fadeIn: 3200 }
    : { src: 'assets/audio/main-background.mp3', volume: 0.72, fadeIn: 700 };

  const ENABLED_KEY = 'emotion-atlas-background-music';
  const POSITION_KEY = isGamePage
    ? 'emotion-atlas-game-music-position'
    : 'emotion-atlas-background-music-position';
  const UPDATED_AT_KEY = isGamePage
    ? 'emotion-atlas-game-music-updated-at'
    : 'emotion-atlas-background-music-updated-at';
  const VOLUME_KEY = 'emotion-atlas-music-volume';
  const OWNER_KEY = 'emotion-atlas-music-owner';
  const TAB_ID = 'music-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  const audio = new Audio(pageTrack.src);
  audio.loop = true;
  audio.preload = isGamePage ? 'metadata' : 'none';
  audio.volume = 0;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('aria-hidden', 'true');
  audio.style.display = 'none';

  let enabled = false;
  let timelineRestored = false;
  let resumeArmed = false;
  let metadataPromise = null;
  let fadeTimer = 0;
  let fadeToken = 0;

  const read = (key) => {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  };
  const write = (key, value) => {
    try { window.localStorage.setItem(key, value); } catch (_) { /* storage may be disabled */ }
  };
  const remove = (key) => {
    try { window.localStorage.removeItem(key); } catch (_) { /* storage may be disabled */ }
  };
  const readNumber = (key, fallback = 0) => {
    const raw = read(key);
    if (raw === null || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  try { enabled = read(ENABLED_KEY) === 'play'; } catch (_) { enabled = false; }
  let volumePercent = clamp(readNumber(VOLUME_KEY, 72), 0, 100);
  const getTargetVolume = () => {
    const master = volumePercent / 100;
    return Math.min(pageTrack.volume, master);
  };
  audio.volume = isGamePage ? 0 : getTargetVolume();
  audio.preload = isGamePage ? 'metadata' : 'none';

  const notify = () => {
    document.dispatchEvent(new CustomEvent('backgroundmusicchange', {
      detail: { enabled, playing: !audio.paused && !audio.muted, track: isGamePage ? 'game' : 'main', volume: volumePercent }
    }));
  };

  const mountAudio = () => {
    if (audio.parentNode || !document.body) return;
    document.body.appendChild(audio);
  };

  const waitForMetadata = () => {
    if (audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0) {
      return Promise.resolve(true);
    }
    if (metadataPromise) return metadataPromise;
    metadataPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        window.clearTimeout(timer);
        resolve(value);
      };
      const onLoaded = () => finish(true);
      const onError = () => finish(false);
      const timer = window.setTimeout(() => finish(audio.readyState >= 1), 3200);
      audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      audio.addEventListener('error', onError, { once: true });
    }).finally(() => { metadataPromise = null; });
    return metadataPromise;
  };

  const fadeTo = (target, duration) => {
    window.clearInterval(fadeTimer);
    const token = ++fadeToken;
    const startVolume = audio.volume;
    const destination = Math.max(0, Math.min(1, target));
    if (duration <= 0) {
      audio.volume = destination;
      return Promise.resolve();
    }
    const startedAt = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (token !== fadeToken) {
          resolve();
          return;
        }
        const progress = Math.min(1, (performance.now() - startedAt) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        audio.volume = startVolume + (destination - startVolume) * eased;
        if (progress >= 1) {
          window.clearInterval(fadeTimer);
          resolve();
        }
      };
      fadeTimer = window.setInterval(tick, 45);
      tick();
    });
  };

  const getTimelinePosition = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 60;
    const saved = readNumber(POSITION_KEY, 0);
    const updatedAt = readNumber(UPDATED_AT_KEY, 0);
    const elapsed = updatedAt > 0 ? Math.max(0, (Date.now() - updatedAt) / 1000) : 0;
    return ((saved + elapsed) % duration + duration) % duration;
  };

  const restoreTimeline = () => {
    if (timelineRestored || !enabled) return;
    timelineRestored = true;
    try { audio.currentTime = getTimelinePosition(); } catch (_) { /* metadata may still be loading */ }
  };

  const saveTimeline = () => {
    if (!enabled) return;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 60;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime % duration : 0;
    write(POSITION_KEY, String(position));
    write(UPDATED_AT_KEY, String(Date.now()));
  };

  const clearTimeline = () => {
    remove(POSITION_KEY);
    remove(UPDATED_AT_KEY);
  };

  const startPlayback = async (allowMutedAutoplay = false) => {
    if (!enabled || document.hidden) {
      if (enabled) armResumeAfterInteraction();
      return false;
    }
    write(OWNER_KEY, TAB_ID);
    if (audio.readyState === 0) {
      audio.preload = 'auto';
      try { audio.load(); } catch (_) { /* media may still be loading */ }
    }
    if (allowMutedAutoplay) audio.muted = false;
    if (audio.paused) audio.volume = 0;
    let playPromise;
    try {
      playPromise = audio.play();
    } catch (_) {
      if (allowMutedAutoplay) {
        audio.muted = true;
        try {
          await audio.play();
          notify();
          return true;
        } catch (_) { /* fall back to the next user gesture */ }
      }
      armResumeAfterInteraction();
      return false;
    }
    const ready = await waitForMetadata();
    if (!ready || !enabled) {
      try { audio.pause(); } catch (_) { /* audio may not be ready */ }
      return false;
    }
    restoreTimeline();
    try {
      await playPromise;
      const target = getTargetVolume();
      if (pageTrack.fadeIn > 0 && audio.volume < target * 0.98) {
        await fadeTo(target, pageTrack.fadeIn);
      } else {
        audio.volume = target;
      }
      return true;
    } catch (_) {
      if (allowMutedAutoplay) {
        audio.muted = true;
        try {
          await audio.play();
          notify();
          return true;
        } catch (_) { /* fall back to the next user gesture */ }
      }
      armResumeAfterInteraction();
      return false;
    }
  };

  const makeAudible = async () => {
    if (!enabled) return false;
    const wasMuted = audio.muted;
    audio.muted = false;
    if (audio.paused) {
      const started = await startPlayback(false);
      notify();
      return started;
    }
    const target = getTargetVolume();
    if (wasMuted) {
      audio.volume = 0;
      await fadeTo(target, isGamePage ? 900 : 450);
    } else if (audio.volume < target * 0.98) {
      await fadeTo(target, 300);
    }
    notify();
    return true;
  };

  const armResumeAfterInteraction = () => {
    if (resumeArmed) return;
    resumeArmed = true;
    const resume = async (event) => {
      if (event?.target?.closest?.('#musicButton, #sharedMusicButton')) return;
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      resumeArmed = false;
      if (enabled) await makeAudible();
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  };

  const enable = async () => {
    enabled = true;
    timelineRestored = true;
    write(ENABLED_KEY, 'play');
    clearTimeline();
    audio.muted = false;
    audio.volume = 0;
    try { audio.currentTime = 0; } catch (_) { /* media may not be ready */ }
    const started = await startPlayback(false);
    notify();
    return started;
  };

  const disable = () => {
    enabled = false;
    write(ENABLED_KEY, 'paused');
    clearTimeline();
    window.clearInterval(fadeTimer);
    fadeToken += 1;
    audio.pause();
    audio.muted = false;
    audio.volume = 0;
    try { audio.currentTime = 0; } catch (_) { /* media may not be ready */ }
    notify();
  };

  const toggle = async () => {
    if (enabled && !audio.paused && !audio.muted) {
      disable();
      return { enabled: false, started: false };
    }
    if (enabled) {
      const started = await makeAudible();
      return { enabled: true, started };
    }
    const started = await enable();
    return { enabled: true, started };
  };

  const setVolume = (value) => {
    volumePercent = clamp(Number(value) || 0, 0, 100);
    write(VOLUME_KEY, String(Math.round(volumePercent)));
    if (!audio.paused) {
      const target = getTargetVolume();
      if (isGamePage) fadeTo(target, 180);
      else audio.volume = target;
    }
    notify();
    return volumePercent;
  };

  const getVolume = () => volumePercent;

  audio.addEventListener('play', notify);
  audio.addEventListener('pause', () => {
    if (enabled) saveTimeline();
    notify();
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.paused && Math.floor(audio.currentTime * 2) % 4 === 0) saveTimeline();
  });

  document.addEventListener('click', async (event) => {
    if (isGamePage || !enabled || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const destination = new URL(link.href, window.location.href);
    if (!/\/game\.html$/i.test(decodeURIComponent(destination.pathname).replace(/\\/g, '/'))) return;
    if (audio.paused) return;
    event.preventDefault();
    saveTimeline();
    await fadeTo(0, 800);
    window.location.href = destination.href;
  }, true);

  window.addEventListener('pagehide', () => {
    saveTimeline();
    audio.pause();
    if (read(OWNER_KEY) === TAB_ID) write(OWNER_KEY, '');
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && enabled) startPlayback();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!audio.paused) {
        saveTimeline();
        audio.pause();
      }
      return;
    }
    if (enabled) startPlayback();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === OWNER_KEY) {
      if (event.newValue && event.newValue !== TAB_ID && !audio.paused) {
        saveTimeline();
        audio.pause();
        notify();
      }
      return;
    }
    if (event.key === VOLUME_KEY) {
      volumePercent = clamp(Number(event.newValue), 0, 100);
      if (!audio.paused) {
        const target = getTargetVolume();
        if (isGamePage) fadeTo(target, 180);
        else audio.volume = target;
      }
      notify();
      return;
    }
    if (event.key !== ENABLED_KEY) return;
    const nextEnabled = event.newValue === 'play';
    if (nextEnabled && !enabled) {
      enabled = true;
      timelineRestored = false;
      if (!document.hidden) startPlayback();
    } else if (!nextEnabled && enabled) {
      disable();
    }
  });

  window.BackgroundMusic = {
    isEnabled: () => enabled,
    isPlaying: () => !audio.paused && !audio.muted,
    isGamePage,
    toggle,
    enable,
    disable,
    setVolume,
    getVolume,
    audio
  };

  if (document.body) mountAudio();
  else document.addEventListener('DOMContentLoaded', mountAudio, { once: true });

  if (enabled) {
    armResumeAfterInteraction();
    const deferInitialPlayback = () => startPlayback(true);
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(deferInitialPlayback, { timeout: 1200 });
    } else {
      window.setTimeout(deferInitialPlayback, 650);
    }
  } else {
    notify();
  }
})();
