// UG Play 共通：計測・保存・シェア・演出・PWA
window.UG = (function () {
  const slug = document.documentElement.dataset.slug;
  const BETA = !!window.UG_BETA; // build.py --beta で組み立てたベータ版（/shota-cooking/beta/<slug>/）
  const url = window.UG_SITE_URL || ('https://ugstudio.ooo/shota-cooking/' + (BETA ? 'beta/' : '') + slug + '/');
  // build.py が称号→結果ページのキーの表を入れる（window.UG_RESULTS）
  const results = window.UG_RESULTS || {};

  // ---------- ボタンの文字などをダブルタップしても画面が寄らないように（2026-11-06 持ち主の指摘）。iOS は viewport の user-scalable=no を無視するので、
  // touch-action:manipulation（ダブルタップの拡大だけを止める。つまむ・なぞるは各ゲームの指定のまま）を全部の要素に、いちばん弱い指定（:where）で付ける。
  // ゲームが canvas などに付けた touch-action:none はそのまま勝つ。ボタンの文字は選ばれないように ----------
  { const st = document.createElement('style'); st.textContent = ':where(html,body,*){touch-action:manipulation}:where(button,[role=button],.btn,.b){-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}'; document.head.appendChild(st);
    document.addEventListener('gesturestart', e => e.preventDefault()); }

  // ---------- 言語（2026-10-31〜 英語、2026-11-03〜 韓国語・タイ語。記録は plans/2026-10-31-localize/ と plans/2026-11-03-ko-th/ の ExecPlan.md） ----------
  // ゲームの中の文は日本語のまま（称号は図鑑・結果ページのキー・GA に使う）。表示する直前に、build.py が入れた辞書で置き換える
  // （英語 window.UG_I18N・韓国語 UG_I18N_KO・タイ語 UG_I18N_TH・中国語の簡体字 UG_I18N_ZHS・繁体字 UG_I18N_ZHT）。
  // 言語：?lang=ja|en|ko|th|zh-hans|zh-hant|id（localStorage の ug:lang に覚える）→ 覚えた値 → ブラウザの言語（ja→日本語、ko→韓国語、th→タイ語、
  // 台湾・香港・マカオと zh-Hant→繁体字、ほかの zh→簡体字、ほかは英語。plans/2026-11-06-zh/ExecPlan.md）。
  // その言語の辞書がなければ英語、英語の辞書もないゲームは日本語のまま
  const DICTS = { en: window.UG_I18N, ko: window.UG_I18N_KO, th: window.UG_I18N_TH, 'zh-hans': window.UG_I18N_ZHS, 'zh-hant': window.UG_I18N_ZHT, id: window.UG_I18N_ID };
  const has = l => l === 'ja' || !!DICTS[l];
  const NAV = (navigator.language || 'ja').toLowerCase(), NAVL = /^ja\b/.test(NAV) ? 'ja' : /^ko\b/.test(NAV) ? 'ko' : /^th\b/.test(NAV) ? 'th' : /^zh-(tw|hk|mo|hant)\b/.test(NAV) ? 'zh-hant' : /^zh\b/.test(NAV) ? 'zh-hans' : /^(id|in)\b/.test(NAV) ? 'id' : 'en';
  const lang = (() => {
    if (!DICTS.en) return 'ja';
    const AL = { zh: 'zh-hans', zht: 'zh-hant' }; // 花火が先に使った名前（zh・zht）も受ける。覚える値は zh-hans・zh-hant にそろえる
    let l = new URLSearchParams(location.search).get('lang'); l = AL[l] || l;
    if (l && has(l)) { try { localStorage.setItem('ug:lang', l); } catch (e) {} return l; }
    try { l = localStorage.getItem('ug:lang'); } catch (e) {} l = AL[l] || l;
    if (l && has(l)) return l;
    // 検索エンジンのロボット（Googlebot などはブラウザの言語が英語）には日本語のページとして見せる
    if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent)) return 'ja';
    return has(NAVL) ? NAVL : 'en';
  })();
  // EN は「日本語ではない」。common.js の中で直接書いた英語の文は、韓国語・タイ語・中国語のときは辞書（見出しが英語の文）でさらに置き換える
  const DICT = DICTS[lang] || null, EN = lang !== 'ja', ZH = /^zh/.test(lang), XL = lang === 'ko' || lang === 'th' || ZH || lang === 'id';
  // 中国語の訳は漢字だけなので、日本語の文と見分けられない。訳の値と同じ文は引き直さない（別の見出しと偶然同じ字だと二重に訳される）。
  // インドネシア語もラテン文字で、英語の見出し（common.js が書く英語の文）と見分けられないので同じにする（plans/2026-11-06-id/）
  const OUTS = (ZH || lang === 'id') && DICT ? new Set(Object.values(DICT)) : null, KANA = /[぀-ヿ]/, SEP = ZH ? '' : ' ';
  const JA = /[぀-ヿ㐀-鿿]/, LAT = /[A-Za-z]{2}/, miss = new Set(), memo = new Map();
  const need = s => JA.test(s) || (XL && LAT.test(s)); // 置き換えの対象か
  // 辞書の引き方：①そのまま ②「{0}」の型（{n} に入った所も訳す）③「・」区切りを 1 つずつ ④辞書の言葉 2 つのつなぎ（一般の称号「マヨネーズ好きの」＋「画家」）
  const PATS = EN ? Object.keys(DICT).filter(k => /\{\d\}/.test(k)).sort((a, b) => b.length - a.length).map(k => {
    const ord = []; const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d)\}/g, (_, n) => { ord.push(+n); return '(.+?)'; }) + '$');
    return [re, ord, DICT[k]];
  }) : [];
  function tr(s) {
    if (DICT[s] != null) return DICT[s];
    for (const [re, ord, out] of PATS) { const m = re.exec(s); if (m) return out.replace(/\{(\d)\}/g, (_, n) => t(m[ord.indexOf(+n) + 1])); }
    if (s.includes('・')) { const p = s.split('・').map(x => x.trim()); if (p.every(x => x)) return p.map(t).join(ZH ? '·' : ' · '); }
    for (let i = 1; i < s.length; i++) { const a = DICT[s.slice(0, i)], b = DICT[s.slice(i)]; if (a != null && b != null) return a + SEP + b; }
    return null;
  }
  function t(s) {
    if (!EN || typeof s !== 'string' || !need(s)) return s;
    if (memo.has(s)) return memo.get(s);
    const core = s.trim(); if (OUTS && OUTS.has(core)) { memo.set(s, s); return s; } let r = tr(core);
    if (r == null) { if (ZH ? KANA.test(core) : JA.test(core)) miss.add(core); r = s; } else r = s.slice(0, s.indexOf(core)) + r + s.slice(s.indexOf(core) + core.length); // 辞書にない英語（名前など）はそのまま
    if (OUTS && r !== s) OUTS.add(r.trim()); // 中国語：訳した結果（型から作った文も）は二度と引かない（書き換えの見張りで訳が回り続けないように）
    memo.set(s, r); return r;
  }
  if (EN) {
    document.documentElement.lang = lang === 'zh-hans' ? 'zh-Hans' : lang === 'zh-hant' ? 'zh-Hant' : lang;
    // 日本語だけの解説ページ（guide/）へのリンクは出さない。韓国語は語の途中で折らない（keep-all。日本語には効かない）
    { const st = document.createElement('style'); st.textContent = 'a[href*="guide/"]{display:none!important}html:lang(ko){word-break:keep-all}'; document.head.appendChild(st); }
    // 中国語：ゲームは日本語の字体（Hiragino）を名指ししているので、日本語の字体にない簡体字だけが別の字体で細く出る。
    // 同じ名前の字体を、中国語の字体（PingFang・宋体）に差し替える。canvas の結果カードも同じ名前で描くので、先に読み込んでおく
    if (ZH) {
      const S = lang === 'zh-hant' ? 'TC' : 'SC', ff = (n, w, src) => `@font-face{font-family:"${n}";font-weight:${w};src:${src.map(x => `local("${x}")`).join(',')}}`;
      const sans = [['100 400', [`PingFang${S}-Regular`, `PingFang ${S}`]], ['500', [`PingFang${S}-Medium`]], ['600 900', [`PingFang${S}-Semibold`]]];
      const serif = [['100 500', [`STSongti-${S}-Regular`, `Songti ${S}`]], ['600 900', [`STSongti-${S}-Bold`, `STSongti-${S}-Black`]]];
      const st = document.createElement('style');
      st.textContent = ['Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Hiragino Maru Gothic ProN'].flatMap(n => sans.map(([w, src]) => ff(n, w, src))).join('')
        + ['Hiragino Mincho ProN', 'Yu Mincho'].flatMap(n => serif.map(([w, src]) => ff(n, w, src))).join('');
      document.head.appendChild(st);
      try { for (const f of ['400 16px "Hiragino Sans"', '700 16px "Hiragino Sans"', '900 16px "Hiragino Sans"', '900 16px "Hiragino Mincho ProN"']) document.fonts.load(f, '中文'); } catch (e) {}
    }
    // 画面の文字：日本語を含む文字と属性を置き換える。あとから書き換わった所も MutationObserver で追う。translate="no" の中は触らない
    const ATTRS = ['alt', 'aria-label', 'title', 'placeholder'];
    const trNode = n => {
      if (n.nodeType === 3) { const p = n.parentNode; if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return; const v = n.nodeValue; if (p.closest && p.closest('[translate=no]') && (!XL || JA.test(v))) return; if (need(v)) { const r = t(v); if (r !== v) n.nodeValue = r; } return; }
      if (n.nodeType !== 1 || n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE' || (n.getAttribute('translate') === 'no' && !XL)) return; // 韓国語・タイ語では translate="no" の中も、common.js が書いた英語の文は訳す（日本語の名前などは訳さない）
      for (const a of ATTRS) { const v = n.getAttribute(a); if (v && need(v)) { const r = t(v); if (r !== v) n.setAttribute(a, r); } }
      for (const c of n.childNodes) trNode(c);
    };
    const run = () => {
      document.title = t(document.title); trNode(document.body);
      new MutationObserver(ms => { for (const m of ms) m.type === 'childList' ? m.addedNodes.forEach(trNode) : trNode(m.target); })
        .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    document.body ? run() : addEventListener('DOMContentLoaded', run);
    // canvas（結果カード・3D の中の札）：描く文と測る文を同じに置き換える（幅合わせが英語で正しく動く）
    const C2 = CanvasRenderingContext2D.prototype;
    for (const k of ['fillText', 'strokeText', 'measureText']) { const f = C2[k]; C2[k] = function (s, ...a) { return f.call(this, typeof s === 'string' ? t(s) : s, ...a); }; }
  }
  const tLines = s => String(s).split('\n').map(t).join('\n');
  // 称号を囲むかぎ括弧（繁体字は「」、ほかの言語は “ ”）
  const Q = s => lang === 'zh-hant' ? '「' + s + '」' : '“' + s + '”';

  // 手元（localhost）で試したときは GA にイベントを送らない（自動プレイや動作確認が本番の数字に混ざらないように）
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname); // 同じ Wi-Fi のスマホで試すとき（192.168.x.x）も送らない
  // 手元（LOCAL）では GA に送らず、確かめられるように window.__ugev に残す
  function ev(name, params) { if (name === 'game_end' && (REC_ON || (LOCAL && Q0.has('ugc')))) ugcEarn(); /* UG コイン +1（2026-11-07：部屋の版の common.js にしか無く、ゲームでは増えていなかった） */ if (name === 'game_start' || name === 'game_end' || name === 'replay') recEv(name, params); if (LOCAL) { (window.__ugev = window.__ugev || []).push([name, params || {}]); return; } try { gtag('event', name, Object.assign({ game: slug, lang }, params || {})); } catch (e) {} }
  // ---------- 遊んだ記録（plans/2026-11-03-accounts/ExecPlan.md。見る場所は games/mypage/） ----------
  // 端末の中：ug:hist（新しい順に 200 件）・ug:stats（累計）・ug:thumbs（結果の小さい画像、新しい 30 枚）。全部 try の中で動き、失敗してもゲームは止めない。
  // 登録した人（ug:acct がある人）だけ、game_end のあとで Firebase を読み込んでサーバーに送る。未登録の人には Firebase を読み込まない
  const Q0 = new URLSearchParams(location.search);
  const REC_ON = !Q0.has('auto') && !!slug && !/^(requests|mypage)$/.test(slug);
  const RFB = { apiKey: 'AIzaSyATlLzLGeknckMnIIQP4QpejgVXZtJnKfQ', authDomain: 'ug-kitchen-1kwq.firebaseapp.com', databaseURL: 'https://ug-kitchen-1kwq-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'ug-kitchen-1kwq', appId: '1:335332834359:web:2d13a19937cfe67195d3b2' };
  // 手元のエミュレーターのポート。既定は firebase/kitchen/firebase.json と同じ。ほかの作業とぶつかる時は ?emu=<auth>,<database>,<storage> で変える（端末に覚える。手元だけ）
  const EMUP = (() => { const d = { auth: 9099, db: 9000, st: 9199 }; if (!LOCAL) return d; try { const q = Q0.get('emu'); if (q) { const [a, b, c] = q.split(',').map(Number); localStorage.setItem('ug:emu', JSON.stringify({ auth: a || d.auth, db: b || d.db, st: c || d.st })); } return Object.assign(d, JSON.parse(localStorage.getItem('ug:emu') || '{}')); } catch (e) { return d; } })();
  // 手元（LOCAL）は、いつも試験用の場所（users_test・myroom_test）に書く。?paths=live を一度付けると、この端末の手元だけ、出した後と同じ分け方（ベータだけ試験用）にする。
  // エミュレーターで「ベータでも本番の場所に書くゲーム」（_template/work_games.js の live）を確かめる時に使う。戻す時は ?paths=test（2026-11-08）
  const LOCALT = LOCAL && (() => { try { const q = Q0.get('paths'); if (q) localStorage.setItem('ug:paths', q); return localStorage.getItem('ug:paths') !== 'live'; } catch (e) { return true; } })();
  // UG_LIVE：ベータ版でも本番の場所に書くゲーム（_template/work_games.js の live: true。build.py --beta が window.UG_LIVE=1 を入れる）。記録・小さい画像・累計・UG コイン・作品・持ち物を全部 users に送る（2026-11-08 持ち主「UG コインも記録も本番に」）
  const LIVE = BETA && !!window.UG_LIVE;
  const RBASE = LOCALT || (BETA && !LIVE) ? 'users_test' : 'users', THUMB_MAX = 10000; // 文字数。保存の費用のほとんどは画像なので、20KB から減らした。ルールの上限は 20000 のまま（前の画像が残っている）
  // 新しい登録の入口は米国以外（端末の時間帯が米国とその領土の時だけ出さない。COPPA を避ける。持ち主の決定 2026-11-07。前は日本だけ）
  // 名前の RJP と record().jp は前のまま（ほかのページが使っている）。意味は「登録を勧めてよい地域」
  const US_TZ = /^(America\/(New_York|Detroit|Kentucky\/.+|Indiana\/.+|Indianapolis|Fort_Wayne|Knox_IN|Louisville|Chicago|Menominee|North_Dakota\/.+|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Atka|Shiprock|Puerto_Rico|St_Thomas|Virgin)|US\/.+|Navajo|Pacific\/(Honolulu|Johnston|Guam|Saipan|Pago_Pago|Samoa|Midway|Wake)|EST5EDT|CST6CDT|MST7MDT|PST8PDT|EST|MST|HST)$/;
  const RJP = (() => { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; return !US_TZ.test(z); } catch (e) { return false; } })();
  const rget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) || d); } catch (e) { return d; } };
  const rset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const rstats = () => Object.assign({ sec: 0, plays: 0, ends: 0, games: {}, first: 0, last: 0 }, rget('ug:stats', null));
  const rgame = s => s.games[slug] || (s.games[slug] = { plays: 0, ends: 0, best: 0, sec: 0 });
  // 別の端末の累計と合わせる：ゲームごとに大きい方。全体は、ゲームごとの合計とそれぞれの全体のうちの大きい方
  function rmerge(a, b) {
    const o = rstatsOf(a), r = rstatsOf(b), gs = {};
    for (const k of new Set([...Object.keys(o.games), ...Object.keys(r.games)])) {
      const x = o.games[k] || {}, y = r.games[k] || {}; gs[k] = {};
      for (const f of ['plays', 'ends', 'best', 'sec']) gs[k][f] = Math.max(+x[f] || 0, +y[f] || 0);
      if (x.name || y.name) gs[k].name = x.name || y.name;
    }
    const sum = f => Object.values(gs).reduce((n, g) => n + g[f], 0), firsts = [o.first, r.first].filter(v => v > 0);
    return { sec: Math.max(o.sec, r.sec, sum('sec')), plays: Math.max(o.plays, r.plays, sum('plays')), ends: Math.max(o.ends, r.ends, sum('ends')), games: gs, first: firsts.length ? Math.min(...firsts) : 0, last: Math.max(o.last, r.last) };
  }
  const rstatsOf = v => Object.assign({ sec: 0, plays: 0, ends: 0, first: 0, last: 0 }, v || {}, { games: (v && v.games) || {} });
  let recPend = 0, recCur = 0, recTouch = 0, recCard = '', recGiven = null, recRoute = '', recEnded = false, recReplayed = false, recPhoto = null, recPhotoA = 0;
  const recMyUrl = LOCAL ? (BETA && !LIVE ? '/beta/mypage/' : '/mypage/') : (BETA && !LIVE ? '/shota-cooking/beta/mypage/' : '/mypage/'); // LIVE のゲームは記録が本番にあるので本番のマイページ
  // マイページへの入口に、どのゲームのどの入口から来たかの印 ?mp=<slug>.<入口> を付ける（?from はシェアの印 share_landing なので使わない。マイページが覚えて、登録とアバターのイベントに from・via として付ける）
  const myUrl = (via, hash) => recMyUrl + (slug && slug !== 'mypage' ? `?mp=${encodeURIComponent(slug)}.${via}` : '') + (hash || '');
  // UG レベル（結果画面の入口に出すだけ。式は games/mypage/level.js と同じにする）
  const recLv = st => { const x = Math.floor(st.sec / 60) + st.ends * 5 + Object.keys(st.games).length * 10; let n = 1; while (10 * (n + 1) * n <= x) n++; return { n, left: 10 * (n + 1) * n - x }; };
  function recFlush() { if (!recPend) return; const s = rstats(), g = rgame(s); s.sec += recPend; g.sec += recPend; s.last = Date.now(); recPend = 0; rset('ug:stats', s); }
  const cardEl = () => document.getElementById('cardimg');
  function recEv(name, p) {
    if (!REC_ON) return;
    try {
      // 「もう一回」は replay しか送らないゲームが多い。前の game_end のあとの replay も 1 回と数え、秒数も戻す。
      // replay のあと次の game_end までの game_start は数えない（nendo はすぐ続けて、bread はタイトルを挟んで送る）。秒数だけ戻す
      if (name === 'replay' && !recEnded) return;
      if (name !== 'game_end') recNavLv(false);
      if (name === 'game_start' && recReplayed) { recCur = 0; recPend && recFlush(); return; }
      recReplayed = name === 'replay'; recEnded = name === 'game_end';
      const lvBefore = recLv(rstats());
      recFlush(); const s = rstats(), g = rgame(s), now = Date.now(), m = document.querySelector('meta[property="og:title"]'), gname = String(m ? m.content : slug).slice(0, 40);
      g.name = gname; s.first = s.first || now; s.last = now;
      if (name !== 'game_end') { s.plays++; g.plays++; recCur = 0; recGiven = null; recPhoto = null; recPhotoA = 0; const c = cardEl(); recCard = c ? c.src : ''; rset('ug:stats', s); return; }
      const raw = p && p.score, hasScore = typeof raw === 'number' && isFinite(raw), score = hasScore ? Math.max(0, Math.round(raw * 10) / 10) : null, item = { id: now.toString(36) + Math.random().toString(36).slice(2, 7), game: slug, name: gname, ...(hasScore ? { score } : {}), title: String((p && p.title) || '').slice(0, 40), ts: now, sec: recCur, v: 1 };
      if (BETA) item.b = 1;
      s.ends++; g.ends++; if (hasScore) g.best = Math.max(g.best, score); rset('ug:stats', s); recEntry(lvBefore, s); recNavLv(!document.querySelector('.ugmpc'));
      const h = rget('ug:hist', []); h.unshift(item); rset('ug:hist', h.slice(0, 200));
      if (rget('ug:acct', null)) { const q = rget('ug:syncq', []); q.push(item.id); rset('ug:syncq', q.slice(-200)); }
      recThumb(item.id, 0);
    } catch (e) {}
  }
  // 左上の入口：タイトルで今のレベルが見える。遊んでいる間は隠す（操作のボタンに重ねないため）。結果画面は「もう一回」の下の入口があるので、それがないゲームだけ出す
  function recNavLv(on) { try { const e = document.getElementById('ug-lv'); if (!e) return; if (on) e.textContent = `📒 Lv.${recLv(rstats()).n}`; e.style.display = on ? '' : 'none'; } catch (e) {} }
  // 結果画面の入口：「もう一回」のすぐ下に、レベルと一緒に小さく出す（シェアと「もう一回」は押しやすいまま）。もう一回のないゲームは宣伝の一覧の下（promoList）
  function recEntry(before, s) {
    try {
      if (EN) return; const at = document.getElementById('again'); if (!at || !at.parentNode) return;
      if (!document.getElementById('ugmpc-css')) { const st = document.createElement('style'); st.id = 'ugmpc-css'; st.textContent = '.ugmpc{display:block;box-sizing:border-box;width:max-content;max-width:100%;margin:10px auto 2px;padding:13.5px 14px;border-radius:99px;background:#fff;color:#2a1d15;box-shadow:0 2px 8px #0002;text-decoration:none;text-align:center;font:800 13.5px/1.35 "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif}.ugmpc b{color:#b83a1a}.ugmpc.save{border-radius:18px;padding:11px 16px;font-weight:700}.ugmpc.save b{display:block;font-weight:900}'; document.head.appendChild(st); }
      const acct = !!rget('ug:acct', null); if (!acct && !RJP) return; // 登録の案内を出さない環境では、未登録の人に入口を出さない
      document.querySelectorAll('.ugmpc,.ugmp').forEach(e => e.remove()); // jiro は宣伝の一覧を先に作るので、下の入口が残らないように消す
      const now = recLv(s), a = document.createElement('a'), box = at.parentNode, row = getComputedStyle(box).display.includes('flex') || getComputedStyle(box).display.includes('grid');
      // 登録していない人が 2 回目からは、記録がこの端末にしかないことを見せる（plans/2026-11-06-signup-push/ExecPlan.md）。1 回目の人には出さない（邪魔なので）
      const save = !acct && s.ends >= 2, place = save ? 'save' : 'result';
      a.className = save ? 'ugmpc save' : 'ugmpc'; a.href = myUrl(place); a.addEventListener('click', () => ev('mypage_entry', { place, up: now.n > before.n ? 1 : 0 }));
      const b = document.createElement('b'); b.textContent = now.n > before.n ? `🎉 Lv.${now.n} に上がった！` : `📒 Lv.${now.n}`; a.append(b, now.n > before.n ? ' 記録を見る ›' : ` あと ${now.left} で Lv.${now.n + 1}・記録を見る ›`);
      if (save) { a.textContent = ''; const h = document.createElement('b'); h.textContent = `📒 記録 ${s.ends} 回分は、この端末だけに保存中`; a.append(h, '無料の登録で、別の端末でも消えない ›'); ev('signup_hint_view', { n: Math.min(s.ends, 50) }); }
      else if (!acct) { a.textContent = '📒 記録を残す ›'; } // マイページは登録してから見るものなので、未登録の人にはレベルを見せない
      (row ? box : at).after(a);
    } catch (e) {}
  }
  // 結果カードに貼られた料理の写真を覚える（カードの紙より、料理だけのほうが履歴で大きく見える）。ゲームに手を入れず、#cv に drawImage された大きい絵を見る。
  // 背景のようにカードいっぱいの絵と、小さな飾りは除く。WebGL の絵はあとで読めないことがあるので、その場で小さく写し取る
  if (REC_ON) try {
    const CP = CanvasRenderingContext2D.prototype, di = CP.drawImage;
    CP.drawImage = function (im, ...a) {
      const r = di.call(this, im, ...a);
      try {
        const cv = this.canvas;
        if (cv && cv.id === 'cv' && a.length >= 4 && (im.tagName === 'CANVAS' || im.tagName === 'IMG')) {
          const dw = a.length >= 8 ? a[6] : a[2], dh = a.length >= 8 ? a[7] : a[3], A = Math.abs(dw * dh) / (cv.width * cv.height), sw = im.naturalWidth || im.width, sh = im.naturalHeight || im.height;
          if (A >= .1 && A < .85 && sw >= 200 && A >= recPhotoA) {
            const w = 480, h = Math.round(Math.abs(dh / dw) * w), c = document.createElement('canvas'); c.width = w; c.height = h;
            const x = c.getContext('2d'); if (a.length >= 8) di.call(x, im, a[0], a[1], a[2], a[3], 0, 0, w, h); else di.call(x, im, 0, 0, w, h);
            recPhoto = c; recPhotoA = A;
          }
        }
      } catch (e) {}
      return r;
    };
  } catch (e) {}
  // 結果の小さい画像。ゲームに手を入れず作る。game_end より遅れてカードを作るゲームがあるので少し待つ（前の回と同じカードは使わない）。
  // 順番：UG.resultImage で渡された画像 → カードに貼られた料理の写真 → #cardimg → 最後の回に #cv（2D のとき）。どれもなければ、シェア・保存を押した時の画像。それもなければ画像なし（マイページはアイコンを出す）
  function recThumb(id, n) {
    setTimeout(() => {
      let src = null, how = '';
      try {
        const c = cardEl();
        if (recGiven) { src = recGiven; how = 'resultImage'; }
        else if (c && c.src && c.src !== recCard && c.complete && c.naturalWidth) { src = recPhoto || c; how = recPhoto ? 'photo' : 'cardimg'; recCard = c.src; recPhoto = null; recPhotoA = 0; }
        else if (n >= 13) { const v = document.getElementById('cv'), x = v && v.tagName === 'CANVAS' && v.getContext('2d'); if (x && x.getImageData(v.width >> 1, v.height >> 1, 1, 1).data[3]) { src = v; how = 'cv'; } }
      } catch (e) {}
      if (!src && n < 13) return recThumb(id, n + 1);
      if (!src) { recRoute = 'none'; recSync(); return; }
      recGiven = null; recRoute = how; recShrink(src).then(d => recPutThumb(id, d)).catch(() => {}).then(recSync);
    }, n ? 500 : 900);
  }
  // 幅 320 の JPEG（品質 .6）。文字列で 20KB をこえたら品質を下げ、それでもこえたら小さくする
  async function recShrink(src) {
    let im = src;
    if (typeof src === 'string') { im = new Image(); await new Promise((ok, ng) => { im.onload = ok; im.onerror = ng; im.src = src; }); }
    const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; if (!W || !H) throw 0;
    for (const [w, qs] of [[320, [.5, .4]], [280, [.5, .4]], [240, [.5, .4]], [180, [.5, .3]]]) { // 実物を並べて、大きく見ても見劣りしない線で決めた（plans/2026-11-03-accounts/ExecPlan.md）
      const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = w; c.height = Math.round(H / W * w); x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      for (const q of qs) { const d = c.toDataURL('image/jpeg', q); if (d.startsWith('data:image/jpeg') && d.length <= THUMB_MAX) return d; }
    }
    throw 0;
  }
  function recPutThumb(id, d) {
    const a = rget('ug:thumbs', []).filter(t => t.id !== id); a.unshift({ id, d }); let b = a.slice(0, 30);
    while (b.length && !rset('ug:thumbs', b)) b = b.slice(0, -1); // 容量があふれたら古いものから消す
    // 押し出した画像は、次の送信でサーバーからも消す（マイページを開かずに遊び続けても、サーバーの画像が 30 枚ほどで止まるように）
    if (rget('ug:acct', null)) { const keep = new Set(b.map(t => t.id)), gone = a.filter(t => !keep.has(t.id)).map(t => t.id); if (gone.length) { const dq = rget('ug:thumbdel', []).filter(x => !keep.has(x)); for (const x of gone) if (!dq.includes(x)) dq.push(x); rset('ug:thumbdel', dq.slice(-100)); } }
    if (!b.some(t => t.id === id)) return;
    const h = rget('ug:hist', []), it = h.find(x => x.id === id); if (it) { it.t = 1; rset('ug:hist', h); }
  }
  // シェア・保存のときに渡された画像。カードから取れなかった回だけ、あとから足す
  function recLate(c) {
    if (!REC_ON) return;
    setTimeout(() => { try { const h = rget('ug:hist', [])[0]; if (!h || h.t || h.game !== slug || Date.now() - h.ts > 600000) return; recRoute = 'share'; recShrink(c).then(d => { recPutThumb(h.id, d); const q = rget('ug:syncq', []); if (rget('ug:acct', null) && !q.includes(h.id)) { q.push(h.id); rset('ug:syncq', q); } }).then(recSync).catch(() => {}); } catch (e) {} }, 400);
  }
  // Firebase は登録した人のときだけ、ここで初めて読み込む。匿名の票・作品と同じ uid を保つため、料理リスト・美術館と同じ既定のアプリを使う
  let recFbP = null;
  const recFb = () => recFbP || (recFbP = (async () => {
    const [A, Au] = await Promise.all(['app', 'auth'].map(m => import(`https://www.gstatic.com/firebasejs/10.14.1/firebase-${m}.js`)));
    const app = A.initializeApp(RFB), auth = Au.getAuth(app);
    if (LOCAL) Au.connectAuthEmulator(auth, `http://${location.hostname}:${EMUP.auth}`, { disableWarnings: true }); // 手元は必ずエミュレーター
    await auth.authStateReady(); return { Au, auth, base: RBASE, api: recApi };
  })().catch(e => { recFbP = null; throw e; }));
  // データベースは REST で 1 回ずつ読み書きする（つなぎっぱなしにしない。Blaze では転送と同時接続が費用になる。Decision Log）。
  // 書き込みは print=silent：書いた内容をそのまま返させない（返事も転送量に入るので、画像を送るたびに同じ量を読むことになる）
  // 1 回だけやり直す。401・403 はログインの札（ID トークン）を新しくしてから、通信の失敗は少し待ってから。どちらが起きたかは db_retry で数える（状態の番号だけ）
  async function recApi(u, path, o = {}, again = false) {
    const tok = await u.getIdToken(), c = new AbortController(), tm = setTimeout(() => c.abort(), 15000);
    try {
      const r = await fetch((LOCAL ? `http://${location.hostname}:${EMUP.db}/` : RFB.databaseURL + '/') + path + '.json?' + (LOCAL ? 'ns=ug-kitchen-1kwq-default-rtdb&' : '') + (o.method ? 'print=silent&' : '') + (o.query ? o.query + '&' : '') + 'auth=' + encodeURIComponent(tok),
        { method: o.method || 'GET', signal: c.signal, ...(o.body ? { body: JSON.stringify(o.body) } : {}) });
      if (!r.ok) throw Object.assign(new Error('db'), { status: r.status });
      return o.method ? null : await r.json();
    } catch (e) {
      if (again || e.name === 'AbortError' || (e.status && e.status !== 401 && e.status !== 403)) throw e;
      ev('db_retry', { status: e.status || 0 });
      if (e.status) await u.getIdToken(true); else await new Promise(r => setTimeout(r, 800));
      return recApi(u, path, o, true);
    } finally { clearTimeout(tm); }
  }
  // ---------- UG コイン（全ゲーム共通。plans/2026-11-05-myroom/ExecPlan.md のマイルストーン 6） ----------
  // 登録した人が 1 回遊び終えるたびに +1。前から 60 秒あけて、24 時間で 35 回まで（ルール users/<uid>/ugc と同じ決まり。端末の時計がずれていると断られるが、遊びは止めない）。
  // 残りは users/<uid>/ugc から部屋のページで計算する。ここでは 1 回読んで 1 回書くだけ
  const UGC = { earn: 1, gap: 60000, day: 86400000, max: 35 }; // 2026-11-06 持ち主「コイン 1、1 日 35 回まで」。ルール（make_rules.py の UGC_EARN_N・UGC_DAY_MAX）と同じ
  async function ugcEarn() {
    try {
      if (!rget('ug:acct', null)) return;
      const { auth } = await recFb(), u = auth.currentUser; if (!u || u.isAnonymous) return;
      const P = RBASE + '/' + u.uid + '/ugc', c = await recApi(u, P), now = Date.now(), SV = { '.sv': 'timestamp' }; let up;
      if (!c) up = { v: 1, earned: UGC.earn, gift: 0, refund: 0, bonus: 0, nsets: 0, spins: 0, spent: 0, last: SV, dayStart: SV, dayN: 1 }; // 入居記念（gift 9）は部屋に入った時に
      else if (now - c.last < UGC.gap + 3000) return;
      else if (now - c.dayStart > UGC.day + 60000) up = { earned: c.earned + UGC.earn, last: SV, dayStart: SV, dayN: 1 };
      else if (c.dayN < UGC.max && now - c.dayStart < UGC.day - 60000) up = { earned: c.earned + UGC.earn, last: SV, dayN: c.dayN + 1 };
      else { ev('ugc_cap', {}); return; }
      await recApi(u, P, { method: c ? 'PATCH' : 'PUT', body: up });
      ev('ugc_earn', { first: c ? 0 : 1 });
      setTimeout(() => toast(`🪙 UG コイン +${UGC.earn}`, 3600), 2600);
    } catch (e) { ev('ugc_err', { status: (e && e.status) || 0 }); }
  }
  let recBusy = false;
  async function recSync() {
    if (recBusy) return;
    try {
      const a = rget('ug:acct', null), q = rget('ug:syncq', []), dq = rget('ug:thumbdel', []); if (!a || (!q.length && !dq.length)) return;
      recBusy = true; const { auth } = await recFb(), u = auth.currentUser;
      if (!u || u.isAnonymous || u.uid !== a.uid) return; // ログインが外れている。記録は端末に残し、マイページで入り直してもらう
      // 遊ぶたびには履歴と画像を書くだけで、何も読まない。累計はマイページを開いた時にまとめる（別の端末の累計を減らさないため、ここでは書かない）
      const P = RBASE + '/' + u.uid, hist = rget('ug:hist', []), th = rget('ug:thumbs', []), up = {};
      for (const id of q) { const it = hist.find(x => x.id === id); if (!it) continue; const { id: _, ...rest } = it, t = th.find(x => x.id === id); up['hist/' + id] = rest; if (t) up['thumbs/' + id] = t.d; }
      const dels = dq.filter(id => !th.some(x => x.id === id)); for (const id of dels) up['thumbs/' + id] = null; // 端末の 30 枚から押し出した画像
      if (Object.keys(up).length) await recApi(u, P, { method: 'PATCH', body: up });
      rset('ug:syncq', rget('ug:syncq', []).filter(id => !q.includes(id)));
      if (dq.length) rset('ug:thumbdel', rget('ug:thumbdel', []).filter(id => !dq.includes(id)));
      ev('hist_sync', { n: q.length, place: 'game' });
    } catch (e) { ev('hist_sync_err', { status: (e && e.status) || 0, place: 'game' }); } finally { recBusy = false; } // 通信に失敗したら ug:syncq に残り、次に開いた時に送り直す
  }
  if (REC_ON) {
    try {
      const touch = () => { recTouch = Date.now(); };
      document.addEventListener('touchstart', touch, { capture: true, passive: true }); document.addEventListener('pointerdown', touch, { capture: true, passive: true });
      // 遊んだ時間：見えていて、直近 60 秒以内に触った間だけ 1 秒ずつ数える（放置では増えない）
      setInterval(() => { if (document.hidden || !recTouch || Date.now() - recTouch > 60000) return; recCur++; if (++recPend >= 10) recFlush(); }, 1000);
      addEventListener('pagehide', recFlush); document.addEventListener('visibilitychange', () => { if (document.hidden) recFlush(); });
      if (rget('ug:acct', null) && (rget('ug:syncq', []).length || rget('ug:thumbdel', []).length)) setTimeout(recSync, 8000); // 前に送れなかった分。読み込みの邪魔をしないよう少し待つ
    } catch (e) {}
  }
  function resultImage(x) { recGiven = x; }
  function record() { return { hist: rget('ug:hist', []), stats: rstats(), thumbs: rget('ug:thumbs', []), acct: rget('ug:acct', null), jp: RJP, route: recRoute, merge: rmerge, fb: recFb, get: rget, set: rset }; }

  // ---------- 3D が描けなくなったとき（WebGL のコンテキスト喪失） ----------
  // 一部の Android（Google Pixel で報告）では、3D の絵を描く GPU の場所（WebGL のコンテキスト）がゲームの途中で失われ、
  // 画面が白くなって左上に Chrome の「困り顔」アイコンが出たまま戻らない。ここで見張って、
  // ①裏に回ったせいで失われた時は戻るのを待つ ②戻らなければ「軽い描画」（画素を減らす・ふちのなめらか処理を切る）で読み直す
  // ③軽い描画でもだめならお知らせを出す。three.js の WebGLRenderer より先に getContext をくるむため、ゲーム本体より前（common.js）で行う
  // 起きるたびに、直すための手がかり（GPU の名前・機種・ゲームのどの工程か・開いてから何秒か など）を
  // Firebase の Realtime Database の gpu_reports に 1 件ずつ残す（読むのは管理者だけ。読み方は specs/webgl-lost.md）
  const GPU_KEY = 'ug:gpu-lite';
  const gpuLite = (() => { if (/[?&]gpu=lite\b/.test(location.search)) return true; try { return sessionStorage.getItem(GPU_KEY) === '1'; } catch (e) { return false; } })();
  const realDpr = window.devicePixelRatio || 1;
  if (gpuLite) { try { const d = 1; Object.defineProperty(window, 'devicePixelRatio', { get: () => d, configurable: true }); } catch (e) {} }
  {
    const T0 = performance.now(), sec = t => Math.round((t - T0) / 100) / 10;
    // 全体で 1 秒に 1 件まで（firebase/kitchen/make_rules.py の gpu_reports_last）。ログインなしで送るので、ルールで全体の上限をかける
    const REPORT_BASE = LOCAL ? 'gpu_reports_test' : 'gpu_reports', REPORT = 'https://ug-kitchen-1kwq-default-rtdb.asia-southeast1.firebasedatabase.app/.json?x-http-method-override=PATCH';
    let gpuName = '', model = '', canvasEl = null, lostAt = 0, hiddenAtLoss = false, lostCount = 0;
    try { navigator.userAgentData && navigator.userAgentData.getHighEntropyValues(['model']).then(v => { model = v.model || ''; }, () => {}); } catch (e) {}
    const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
    function report(step) {
      const ui = document.querySelector('#step') || document.querySelector('.step');
      const rec = {
        game: cut(slug, 20), step, ts: { '.sv': 'timestamp' }, lite: gpuLite, hidden: hiddenAtLoss, n: lostCount,
        gpu: cut(gpuName, 120), model: cut(model, 60), ua: cut(navigator.userAgent, 400), ui: cut(ui && ui.textContent.trim(), 80),
        dpr: Math.round(realDpr * 100) / 100, sw: screen.width | 0, sh: screen.height | 0,
        cw: canvasEl ? canvasEl.width | 0 : 0, ch: canvasEl ? canvasEl.height | 0 : 0,
        t: sec(performance.now()), lostT: lostAt ? sec(lostAt) : 0, mem: +navigator.deviceMemory || 0, cores: navigator.hardwareConcurrency | 0,
      };
      // keepalive：すぐ読み直しても送り切る。text/plain のまま送ると CORS の事前問い合わせがいらない
      try { fetch(REPORT, { method: 'POST', body: JSON.stringify({ [REPORT_BASE + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)]: rec, [REPORT_BASE + '_last']: { '.sv': 'timestamp' } }), keepalive: true }).catch(() => {}); } catch (e) {}
      ev('webgl_lost', { step, gpu: cut(gpuName, 90) });
    }
    // PowerVR（Pixel 10 など）では影を切る。Pixel 10 の実機で、影ありだと開いて数秒で 3D が落ち、影なしでは落ちなかった（specs/webgl-lost.md）。
    // ゲームごとの renderer.shadowMap.enabled = true を変えずに効かせるため、three.js が renderer.shadowMap を入れる所で enabled を false に固定する。?gpu=noshadow でも試せる
    if ((() => {
      if (/[?&]gpu=noshadow\b/.test(location.search)) return true;
      if (!/Android/i.test(navigator.userAgent)) return false;
      let name = ''; try { name = localStorage.getItem('ug:gpu-name') || ''; } catch (e) {}
      if (!name) try {
        const c = document.createElement('canvas').getContext('webgl2'), x = c && c.getExtension('WEBGL_debug_renderer_info');
        if (c) name = c.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : c.RENDERER) || '';
        const l = c && c.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
        if (name) localStorage.setItem('ug:gpu-name', name);
      } catch (e) {}
      return /PowerVR|Imagination/i.test(name);
    })()) Object.defineProperty(Object.prototype, 'shadowMap', { configurable: true, set(v) {
      try { Object.defineProperty(v, 'enabled', { get: () => false, set() {} }); } catch (e) {}
      Object.defineProperty(this, 'shadowMap', { value: v, writable: true, configurable: true, enumerable: true });
    } });
    const getCtx = HTMLCanvasElement.prototype.getContext;
    let restoreTimer = 0, gone = false;
    const giveUp = () => {
      if (gone) return; gone = true;
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;background:#f2e4ccf2;font:700 16px/1.7 system-ui,sans-serif;color:#3a2010;text-align:center';
      el.innerHTML = '<div>この端末では 3D の絵を表示できませんでした。<br>ほかのアプリを閉じてから、もう一度開いてください。<br><button style="margin-top:14px;padding:12px 22px;border:0;border-radius:14px;font:900 17px system-ui;background:#c8501e;color:#fff">もう一度読み込む</button></div>';
      el.querySelector('button').onclick = () => { try { sessionStorage.removeItem(GPU_KEY); } catch (e) {} location.reload(); };
      document.body.appendChild(el);
    };
    const recover = () => {
      if (!gpuLite) { report('reload_lite'); try { sessionStorage.setItem(GPU_KEY, '1'); setTimeout(() => location.reload(), 150); return; } catch (e) {} }
      report('give_up'); giveUp();
    };
    // 見えている間に 3 秒たっても戻らなければ recover。裏にいる間は数えない（Android は裏のタブの GPU を取り上げることがある）
    const waitRestore = () => { clearTimeout(restoreTimer); if (document.hidden) return; restoreTimer = setTimeout(recover, 3000); };
    let lost = false;
    document.addEventListener('visibilitychange', () => { if (lost) waitRestore(); });
    // 軽い描画で読み直したあと 60 秒止まらなければ「軽い描画で直った」と残す（タブごとに 1 回）
    if (gpuLite) setTimeout(() => { try { if (lostCount || sessionStorage.getItem('ug:gpu-lite-ok')) return; sessionStorage.setItem('ug:gpu-lite-ok', '1'); } catch (e) { return; } report('lite_ok'); }, 60000);
    // 光を受ける材質（Lambert・Phong・Standard・Physical・Toon）の色のシェーダーを、GPU が受け付けない端末がある。
    // 602SO（Adreno 530・Chrome 119）では、エラー文なしで「Fragment shader is not compiled」になり、炎などの光を受けない物しか映らなかった（2026-11-09、specs/webgl-lost.md）。
    // Android では色のシェーダーを組み立てるたびに通ったかを見て、通らなければ、基本の色・模様・頂点色・霧だけの簡単な陰影に差し替えて組み立て直す。
    // 通る端末では何も変わらない。?gpu=fallback で、光を受ける材質を全部差し替えた見た目を試せる
    const FB_FORCE = /[?&]gpu=fallback\b/.test(location.search), FB_ON = FB_FORCE || /Android/i.test(navigator.userAgent);
    const FB_BODY = `
uniform vec3 diffuse;
uniform float opacity;
#ifndef MATCAP
uniform vec3 emissive;
#endif
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
varying vec3 vNormal;
#endif
#ifdef USE_MAP
uniform sampler2D map;
varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
uniform sampler2D alphaMap;
varying vec2 vAlphaMapUv;
#endif
#ifdef USE_EMISSIVEMAP
uniform sampler2D emissiveMap;
varying vec2 vEmissiveMapUv;
#endif
#if defined( USE_COLOR_ALPHA )
varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
varying vec3 vColor;
#endif
#ifdef USE_ALPHATEST
uniform float alphaTest;
#endif
#ifdef USE_FOG
uniform vec3 fogColor;
varying float vFogDepth;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#endif
void main() {
  vec4 c = vec4( diffuse, opacity );
#ifdef USE_MAP
  c *= texture2D( map, vMapUv );
#endif
#if defined( USE_COLOR_ALPHA )
  c *= vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  c.rgb *= vColor;
#endif
#ifdef USE_ALPHAMAP
  c.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif
#ifdef USE_ALPHATEST
  if ( c.a < alphaTest ) discard;
#endif
#ifdef FLAT_SHADED
  vec3 n = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );
#else
  vec3 n = normalize( vNormal );
#endif
  float l = abs( dot( n, normalize( vec3( .35, .8, .6 ) ) ) );
  vec3 col = c.rgb * ( .7 + .8 * l );
#ifndef MATCAP
  vec3 em = emissive;
#ifdef USE_EMISSIVEMAP
  em *= texture2D( emissiveMap, vEmissiveMapUv ).rgb;
#endif
  col += em;
#endif
  gl_FragColor = vec4( col, c.a );
#if defined( TONE_MAPPING )
  gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif
  gl_FragColor = linearToOutputTexel( gl_FragColor );
#ifdef USE_FOG
#ifdef FOG_EXP2
  float f = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
#else
  float f = smoothstep( fogNear, fogFar, vFogDepth );
#endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, f );
#endif
#ifdef PREMULTIPLIED_ALPHA
  gl_FragColor.rgb *= gl_FragColor.a;
#endif
}`;
    let fbSent = false;
    const shaderFallback = g => {
      if (g._ugFb) return; g._ugFb = 1;
      const FS = g.FRAGMENT_SHADER, src = new WeakMap(), kind = new WeakMap();
      const cS = g.createShader, sS = g.shaderSource, cC = g.compileShader;
      g.createShader = function (t) { const s = cS.call(this, t); if (s) kind.set(s, t); return s; };
      g.shaderSource = function (s, code) { src.set(s, code); return sS.call(this, s, code); };
      g.compileShader = function (s) {
        cC.call(this, s);
        try {
          if (kind.get(s) !== FS || this.isContextLost()) return; // 失われている間は「通らなかった」に見えるので、何もしない
          const code = src.get(s) || '', m = /\n#define (LAMBERT|PHONG|STANDARD|TOON|MATCAP)\n/.exec(code);
          if (!m || (!FB_FORCE && this.getShaderParameter(s, this.COMPILE_STATUS))) return;
          sS.call(this, s, code.slice(0, m.index + 1) + (m[1] === 'MATCAP' ? '#define MATCAP\n' : '') + FB_BODY); cC.call(this, s);
          if (!fbSent && !FB_FORCE) { fbSent = true; const ok = this.getShaderParameter(s, this.COMPILE_STATUS); ev('webgl_fallback', { kind: m[1], ok: ok ? 1 : 0, gpu: cut(gpuName, 90) }); }
        } catch (e) {}
      };
    };
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      const gl = /webgl/i.test(type);
      if (gl && gpuLite) attrs = Object.assign({}, attrs, { antialias: false });
      const c = getCtx.call(this, type, attrs);
      if (gl && c && FB_ON) shaderFallback(c);
      if (gl && c && !this._ugGpu) {
        this._ugGpu = 1; canvasEl = this;
        try { const x = c.getExtension('WEBGL_debug_renderer_info'); gpuName = c.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : c.RENDERER) || ''; } catch (e) {}
        this.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; lostCount++; lostAt = performance.now(); hiddenAtLoss = document.hidden; waitRestore(); }); // preventDefault で「戻してよい」と伝える
        this.addEventListener('webglcontextrestored', () => { lost = false; clearTimeout(restoreTimer); if (!hiddenAtLoss) report('restored'); });
      }
      // 作れなかった（Chrome が何度も失われたサイトの 3D を止めた時など）。three.js はここで止まるので、お知らせを出す
      if (gl && !c && /webgl2/i.test(type)) setTimeout(() => { report('no_context'); giveUp(); }, 0);
      return c;
    };
  }
  function load(key, def) { try { const v = localStorage.getItem(slug + ':' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(slug + ':' + key, JSON.stringify(val)); } catch (e) {} }
  // 結果ごとのページ。X に貼るとその称号の画像がプレビューに出る
  function resultUrl(title) { const k = results[title]; return k ? url + 'r/' + k + '/' + (EN ? lang + '/' : '') : url + (EN ? '?lang=' + lang : ''); } // 日本語以外の結果ページは r/<キー>/<言語>/
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));

  // ---------- 演出 ----------
  let ac;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function tone(f, t0, dur, type, vol, f2) {
    const a = audio(); if (!a) return; const o = a.createOscillator(), gn = a.createGain(), t = a.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol || .15, t + .01); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  function noise(t0, dur, vol) {
    const a = audio(); if (!a) return; const n = a.createBufferSource(), b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const gn = a.createGain(); gn.gain.value = vol || .2; n.buffer = b; n.connect(gn).connect(a.destination); n.start(a.currentTime + t0);
  }
  const SFX = {
    tap: () => tone(660, 0, .06, 'triangle', .08),
    pop: () => tone(520, 0, .12, 'sine', .15, 980),
    flip: () => { noise(0, .08, .12); tone(800, 0, .08, 'triangle', .06, 1200); },
    drum: () => { for (let i = 0; i < 18; i++) noise(i * .06, .05, .05 + i * .006); },
    tick: () => tone(1200, 0, .03, 'square', .03),
    stamp: () => { tone(140, 0, .25, 'sine', .4, 60); noise(0, .12, .25); },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .1, .35, 'triangle', .14)); [1047, 1319, 1568].forEach(f => tone(f, .42, .7, 'triangle', .1)); },
    shine: () => { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * .07, .5, 'sine', .07)); },
    good: () => { [659, 784, 988].forEach((f, i) => tone(f, i * .09, .3, 'triangle', .13)); },
    sad: () => { [392, 370, 349, 330].forEach((f, i) => tone(f, i * .28, .32, 'sawtooth', .06)); }
  };
  function sfx(name) { try { SFX[name] && SFX[name](); } catch (e) {} }
  function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  // 画面いっぱいの重ね（紙吹雪・光・トースト）
  const css = document.createElement('style');
  css.textContent = `
.ugfx{position:fixed;inset:0;pointer-events:none;z-index:9998}
.ugflash{position:fixed;inset:0;pointer-events:none;z-index:9997;opacity:0;transition:opacity .5s}
.ugshake{animation:ugshake .45s}
@keyframes ugshake{20%{transform:translate(-10px,4px)}40%{transform:translate(9px,-5px)}60%{transform:translate(-7px,3px)}80%{transform:translate(5px,-2px)}}
.ugtoast{pointer-events:none;position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);background:#111d;color:#fff;padding:12px 18px;border-radius:14px;font:700 15px/1.5 system-ui,sans-serif;z-index:9999;opacity:0;transition:.3s;max-width:90vw;text-align:center}
.ugtoast.on{opacity:1;transform:translateX(-50%)}
.ugrev{position:fixed;inset:0;z-index:9996;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#2a2238,#0b0912);color:#fff;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;text-align:center;padding:24px;opacity:0;transition:opacity .3s}
.ugrev.on{opacity:1}
.ugrev .lb{font-size:16px;font-weight:700;opacity:.75;letter-spacing:.2em}
.ugrev .sc{font-size:min(30vw,150px);font-weight:900;line-height:1;margin:8px 0;white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:0 6px 30px #0008}
.ugrev .sc small{font-size:.35em;margin-left:4px}
.ugrev .tt{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:min(9vw,40px);font-weight:900;margin-top:14px;opacity:0;transform:scale(2.6) rotate(-6deg)}
.ugrev .tt.on{animation:ugstamp .38s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes ugstamp{to{opacity:1;transform:scale(1) rotate(-3deg)}}
.ugrev .ln{font-size:16px;font-weight:700;opacity:0;margin-top:10px;transition:opacity .5s .2s}
.ugrev .ln.on{opacity:.9}
.ugrev .nx{margin-top:28px;font-size:14px;opacity:0;transition:opacity .4s;animation:ugblink 1.4s infinite}
.ugrev .nx.on{opacity:.8}
@keyframes ugblink{50%{opacity:.35}}
.ugrev.gold .sc,.ugrev.gold .tt{background:linear-gradient(90deg,#fff2a8,#ffd23f,#fff8d0,#e0a800);-webkit-background-clip:text;background-clip:text;color:transparent}
.ugrev.gold{background:radial-gradient(circle at 50% 45%,#5a4300,#120d00)}
.ugrev .rays{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,#ffe58a22 0 10deg,transparent 10deg 20deg);animation:ugspin 14s linear infinite;opacity:0;transition:opacity .6s}
.ugrev.gold .rays.on{opacity:1}
@keyframes ugspin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(css);
  const fxc = document.createElement('canvas'); fxc.className = 'ugfx';
  const flashEl = document.createElement('div'); flashEl.className = 'ugflash';
  const toastEl = document.createElement('div'); toastEl.className = 'ugtoast';
  addEventListener('DOMContentLoaded', () => { document.body.append(fxc, flashEl, toastEl); });
  let parts = [], fxOn = false;
  function confetti(n, colors) {
    const W = fxc.width = innerWidth * devicePixelRatio, H = fxc.height = innerHeight * devicePixelRatio;
    colors = colors || ['#ff5f6d', '#ffc371', '#47e2a0', '#4ab1ff', '#c38bff', '#ffe066'];
    for (let i = 0; i < (n || 120); i++) parts.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .45, vx: (Math.random() - .5) * 26 * devicePixelRatio, vy: (-Math.random() * 26 - 8) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: (6 + Math.random() * 8) * devicePixelRatio, c: colors[i % colors.length], life: 1 });
    if (!fxOn) { fxOn = true; requestAnimationFrame(fxLoop); }
  }
  function fxLoop() {
    const x = fxc.getContext('2d'); x.clearRect(0, 0, fxc.width, fxc.height);
    parts.forEach(p => { p.vy += .9 * devicePixelRatio; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .006;
      x.save(); x.globalAlpha = Math.max(0, p.life); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    parts = parts.filter(p => p.life > 0 && p.y < fxc.height + 50);
    if (parts.length) requestAnimationFrame(fxLoop); else { fxOn = false; x.clearRect(0, 0, fxc.width, fxc.height); }
  }
  function flash(color, ms) { flashEl.style.transition = 'none'; flashEl.style.background = color || '#fff'; flashEl.style.opacity = .9; requestAnimationFrame(() => { flashEl.style.transition = `opacity ${ms || 600}ms`; flashEl.style.opacity = 0; }); }
  function shake(el) { el = el || document.body; el.classList.remove('ugshake'); void el.offsetWidth; el.classList.add('ugshake'); }
  let toastT; function toast(msg, ms) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 3200); }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // 採点発表：暗転 → ドラムロール → 点数カウントアップ → 称号のハンコ → 段階に応じた演出。タップで閉じる
  // o: { score, unit('点'|'%'), digits, title, line, tier('gold'|'good'|'mid'|'bad'), label }
  async function reveal(o) {
    const el = document.createElement('div'); el.className = 'ugrev' + (o.tier === 'gold' ? ' gold' : '');
    el.innerHTML = `<div class="rays"></div><div class="lb">${t(o.label || '採点結果')}</div><div class="sc">0<small>${t(o.unit || '点')}</small></div><div class="tt"></div><div class="ln"></div><div class="nx">${t('タップで結果カードへ')}</div>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
    const sc = el.querySelector('.sc'), d = o.digits || 0;
    { // 点数と単位（訳したあとの単位。英語 pts・タイ語 แต้ม は長い）を 1 行で画面の幅に収める。幅は字の大きさ（em）で見積もる（Hiragino の太字で測った値）：数字 1、単位は漢字・ハングル .36、それ以外 .27
      const u = t(o.unit || '点'), w = o.score.toFixed(d).length + [...u].reduce((a, c) => a + (/[\u2E80-\u9FFF\uAC00-\uD7AF]/.test(c) ? .36 : .27), .1);
      sc.style.fontSize = `min(30vw, 150px, ${Math.floor(88 / w * 10) / 10}vw)`; }
    sfx('drum'); await wait(1150);
    const dur = 900, t0 = performance.now();
    await new Promise(res => { let lastTick = 0; (function f(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = o.score * e;
      sc.firstChild.nodeValue = v.toFixed(d); if (now - lastTick > 55 && k < 1) { sfx('tick'); lastTick = now; }
      k < 1 ? requestAnimationFrame(f) : res(); })(t0); });
    const tt = el.querySelector('.tt'), ttl = t(o.title); tt.textContent = EN ? Q(ttl) : '『' + o.title + '』';
    // 長い称号は1行に収まるよう文字を小さくする（英字は和文のおよそ半分の幅）
    tt.style.fontSize = `min(${Math.floor(86 / (ttl.length * ({ en: .52, th: .55, ko: .95, 'zh-hans': 1, 'zh-hant': 1, id: .52 }[lang] || 1) + 2))}vw, 40px)`; tt.style.whiteSpace = 'nowrap'; tt.classList.add('on');
    sfx('stamp'); vibrate(40); shake(el);
    await wait(300); el.querySelector('.ln').textContent = t(o.line || ''); el.querySelector('.ln').classList.add('on');
    if (o.tier === 'gold') { el.querySelector('.rays').classList.add('on'); flash('#fff6c8', 900); sfx('fanfare'); setTimeout(() => sfx('shine'), 500); confetti(220, ['#ffe066', '#fff2a8', '#ffd23f', '#ffffff', '#e0a800']); vibrate([60, 40, 120]); }
    else if (o.tier === 'good') { sfx('good'); confetti(110); }
    else if (o.tier === 'bad') { sfx('sad'); setTimeout(() => shake(el), 200); vibrate([30, 60, 30]); }
    else sfx('pop');
    await wait(700); el.querySelector('.nx').classList.add('on');
    await new Promise(res => { el.addEventListener('pointerdown', res, { once: true }); setTimeout(res, 6000); });
    el.classList.remove('on'); await wait(300); el.remove();
    if (BETA) betaAfter(o);
  }

  // ---------- シェア ----------
  function fileOf(canvas) { const b = atob(canvas.toDataURL('image/png').split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new File([u], slug + '.png', { type: 'image/png' }); }
  async function blobOf(canvas) { return await new Promise(r => canvas.toBlob(r, 'image/png')); }
  function openIntent(text, link) { const u = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(link); const w = window.open(u, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } else location.href = u; } // 新しいタブが開けないときは同じタブで（noopener を指定すると戻り値が null になって見分けられないので、あとで opener を外す）
  // X でポスト。PC は画像をコピーしてから X の投稿画面を開く（貼り付けで画像が入る）
  // X アプリで開く：iPhone はアプリの URL（twitter://post）で X アプリの投稿画面を開く。アプリがなくてページに残ったままなら、1.5 秒後に Web の投稿画面へ。
  // Android は同じタブで x.com を開く（App Links で X アプリが開く）。window.open の新しいタブだと、どちらも Web の X が開いてしまう
  function openXApp(text, link) {
    const web = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(link);
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      let gone = false; const off = () => { gone = true; };
      document.addEventListener('visibilitychange', off, { once: true }); addEventListener('pagehide', off, { once: true });
      location.href = 'twitter://post?message=' + encodeURIComponent(text + '\n' + link);
      setTimeout(() => { if (!gone && document.visibilityState === 'visible') location.href = web; }, 1500);
    } else location.href = web;
  }
  // X の投稿画面を開いたあと、このページに戻ってくるまでの秒数（X からは投稿したかを教えてもらえないので、離れていた時間を目安に記録する）
  function watchAway(method, extra) { let t0 = 0; const on = () => { if (document.hidden) { if (!t0) t0 = Date.now(); } else if (t0) { document.removeEventListener('visibilitychange', on); const sec = Math.round((Date.now() - t0) / 1000); ev('share_back', Object.assign({ method, away_sec: sec, away: sec < 5 ? '0-4s' : sec < 15 ? '5-14s' : sec < 60 ? '15-59s' : '60s+' }, extra)); } };
    document.addEventListener('visibilitychange', on); setTimeout(() => document.removeEventListener('visibilitychange', on), 30 * 60 * 1000); }
  // extra.url：結果ページの代わりに付けるリンク（スクイーズの対戦の募集など）。その時は記録の小さい画像にしない
  async function share(canvas, text, title, extra) {
    extra = Object.assign({}, extra || {}); const own = extra.url; delete extra.url;
    if (!own) recLate(canvas);
    const link = own || resultUrl(title); extra = Object.assign({ title }, extra); text = tLines(text);
    // スマホ：結果画像つきで共有メニューを開く（X を選ぶと画像つきでポストできる。2026-10-29 ユーザーの判断で、X アプリを直接開くのをやめて戻した）。
    // 共有メニューが使えない端末だけ、X アプリ（なければ Web）の投稿画面を開く
    if (isMobile) {
      if (navigator.canShare) {
        try {
          // iPhone は「タップの直後」でないと共有メニューが開けない。画像を待つ（await）とその間に切れるので、画像はその場で（同期で）作る
          const file = fileOf(canvas);
          if (navigator.canShare({ files: [file], text })) { ev('share_click', Object.assign({ method: 'image' }, extra));
            // 共有メニューの結果：iPhone は投稿し終えたとき、Android はアプリを選んだときに shared。閉じたりやめたりすると canceled
            try { await navigator.share({ files: [file], text: text + '\n' + link }); ev('share_result', Object.assign({ method: 'image', result: 'shared' }, extra)); }
            catch (e) { ev('share_result', Object.assign({ method: 'image', result: e && e.name === 'AbortError' ? 'canceled' : 'error' }, extra)); }
            return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      ev('share_click', Object.assign({ method: 'x' }, extra)); watchAway('x', extra); openXApp(text, link); return;
    }
    let copied = false;
    try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobOf(canvas) })]); copied = true; } } catch (e) {}
    ev('share_click', Object.assign({ method: copied ? 'x_paste' : 'x' }, extra)); watchAway(copied ? 'x_paste' : 'x', extra);
    openIntent(text, link);
    if (copied) toast('結果画像をコピーしました。投稿画面で貼り付け（⌘V / Ctrl+V）すると画像つきになります', 5000);
  }
  // スマホ：画像だけを共有メニューに渡す（iPhone は「画像を保存」で写真アプリに入る。Android は保存先やアプリを選べる）。PC：ファイルとしてダウンロード
  async function saveImage(canvas, title) {
    recLate(canvas);
    if (isMobile && navigator.canShare) {
      try {
        const file = fileOf(canvas);
        if (navigator.canShare({ files: [file] })) { ev('save_image', { title, method: 'share' }); await navigator.share({ files: [file] }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    ev('save_image', { title, method: 'download' });
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = slug + '.png'; a.click();
    toast(isMobile ? '画像を保存しました（ダウンロード／ファイルに入ります）' : '画像を保存しました');
  }
  // 旧 API（互換）
  const shareX = (text, extra) => { ev('share_click', Object.assign({ method: 'x' }, extra || {})); openIntent(tLines(text), resultUrl()); };
  const shareImage = (canvas, text, extra) => share(canvas, text, extra && extra.title, extra);

  // ---------- ベータ版の不具合報告（plans/2026-10-31-requests/ExecPlan.md、運用は specs/requests.md） ----------
  // ベータ版だけ、左上に「β 🐞」を出す（押すと報告の画面）。送ると Firebase の requests/bugs/<slug> に 1 件足す
  // （手元では requests_test。手元はエミュレーター、?live=1 で本番の requests_test）。読めるのは管理者だけ。1 人 1 分に 1 件（ルール）
  // Firebase は押して送るときだけ読み込む（遊ぶ間は重くしない）
  let lastResult = null;
  let betaT = 0;
  function betaAfter(o) { lastResult = { title: String(o.title || '').slice(0, 40), score: Math.max(0, Math.min(99999, Math.round(+o.score || 0))) }; const b = document.querySelector('.ugbeta-big'); clearTimeout(betaT); if (b) betaT = setTimeout(() => b.classList.add('on'), 1200); }
  // 採点のあとにまた遊びが続くゲーム（次の日へ進む など）は、続きを始めるときに呼んで、大きな報告ボタンを下げる。左上の「β 🐞」からはいつでも送れる
  function betaHide() { clearTimeout(betaT); const b = document.querySelector('.ugbeta-big'); if (b) b.classList.remove('on'); }
  if (BETA) {
    const FB = { apiKey: 'AIzaSyATlLzLGeknckMnIIQP4QpejgVXZtJnKfQ', authDomain: 'ug-kitchen-1kwq.firebaseapp.com', databaseURL: 'https://ug-kitchen-1kwq-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'ug-kitchen-1kwq', appId: '1:335332834359:web:2d13a19937cfe67195d3b2' };
    const live = /[?&]live=1\b/.test(location.search), EMU = LOCAL && !live, BASE = LOCAL ? 'requests_test' : 'requests';
    const css = document.createElement('style');
    css.textContent = `.ugbeta{position:fixed;left:8px;top:calc(8px + env(safe-area-inset-top));z-index:99990;font:800 12px/1 "Hiragino Sans",system-ui,sans-serif;background:#2f8a4a;color:#fff;border:0;border-radius:999px;padding:7px 10px;box-shadow:0 2px 8px #0003;opacity:.9}
.ugbeta-big{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translate(-50%,140%);z-index:99990;font:800 16px/1 "Hiragino Sans",system-ui,sans-serif;background:#2f8a4a;color:#fff;border:0;border-radius:999px;padding:14px 20px;box-shadow:0 6px 20px #0004;transition:transform .35s cubic-bezier(.2,1.4,.4,1);white-space:nowrap}
.ugbeta-big.on{transform:translate(-50%,0)}
.ugbug{position:fixed;inset:0;z-index:99995;background:#0008;display:grid;place-items:center;padding:16px;font-family:"Hiragino Sans",system-ui,sans-serif}
.ugbug .bx{background:#fff;color:#222;border-radius:18px;padding:18px;width:min(420px,100%);max-height:90vh;overflow:auto}
.ugbug h3{margin:0 0 6px;font-size:18px}.ugbug p{margin:0 0 10px;font-size:13px;line-height:1.6;color:#555}
.ugbug textarea{width:100%;box-sizing:border-box;height:120px;font:inherit;font-size:16px;padding:10px;border:2px solid #ddd;border-radius:12px;resize:vertical}
.ugbug .ct{text-align:right;font-size:12px;color:#888;margin:2px 0 8px}.ugbug .ms{min-height:1.3em;font-size:14px;color:#b83a1a;margin:0 0 8px}.ugbug .ms.ok{color:#2f8a4a}
.ugbug .rw{display:flex;gap:8px;justify-content:flex-end}.ugbug button{font:800 15px "Hiragino Sans",system-ui,sans-serif;border:0;border-radius:12px;padding:12px 16px}
.ugbug .sd{background:#2f8a4a;color:#fff}.ugbug .sd:disabled{opacity:.5}.ugbug .cl{background:#eee;color:#333}.ugbug small{display:block;margin-top:10px;font-size:11px;color:#888;line-height:1.5}`;
    document.head.appendChild(css);
    const mk = () => {
      const s = document.createElement('button'); s.className = 'ugbeta'; s.textContent = 'β ベータ版 🐞'; s.onclick = openBug;
      document.body.append(s);  // 採点のあとの大きな「🐞 おかしな所を知らせる」は出さない（ユーザーの判断。操作のボタンに重なるため）。報告は左上の「β 🐞」から
    };
    document.body ? mk() : addEventListener('DOMContentLoaded', mk);
    let dbP = null;
    const fb = () => dbP || (dbP = (async () => {
      const v = '10.14.1', [A, Au, D] = await Promise.all(['app', 'auth', 'database'].map(m => import(`https://www.gstatic.com/firebasejs/${v}/firebase-${m}.js`)));
      const app = A.initializeApp(FB, 'ugbug'), auth = Au.getAuth(app), db = D.getDatabase(app);
      if (EMU) { Au.connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true }); D.connectDatabaseEmulator(db, location.hostname, 9000); }
      const uid = (await Au.signInAnonymously(auth)).user.uid;
      return rec => { const R = D.ref(db, BASE), id = D.push(D.child(R, 'bugs/' + slug)).key;
        return D.update(R, { [`bugs/${slug}/${id}`]: Object.assign({ uid, ts: D.serverTimestamp() }, rec), ['lastbug/' + uid]: D.serverTimestamp() }); };
    })().catch(e => { dbP = null; throw e; }));
    function openBug() {
      if (document.querySelector('.ugbug')) return;
      const w = document.createElement('div'); w.className = 'ugbug';
      w.innerHTML = '<div class="bx"><h3>🐞 おかしな所を知らせる</h3><p>どの画面で、何をしたら、どうなったか。どうなってほしかったかも書いてもらえると直しやすいです。</p><textarea maxlength="400" placeholder="例：水を注ぐところで、指を動かしてもカップが傾かない"></textarea><div class="ct">0 / 400</div><div class="ms"></div><div class="rw"><button class="cl">閉じる</button><button class="sd">送る</button></div><small>書いた文のほかに、どの画面だったか・端末とブラウザの種類・画面の大きさ・点数を送ります。直すためだけに使い、公開しません。</small></div>';
      document.body.appendChild(w);
      const ta = w.querySelector('textarea'), ms = w.querySelector('.ms'), sd = w.querySelector('.sd'), close = () => w.remove();
      ta.oninput = () => { w.querySelector('.ct').textContent = ta.value.length + ' / 400'; };
      w.querySelector('.cl').onclick = close; w.onclick = e => { if (e.target === w) close(); };
      sd.onclick = async () => {
        const text = ta.value.trim(); if (!text) { ms.textContent = '何が起きたかを書いてね'; return; }
        sd.disabled = true; ms.className = 'ms ok'; ms.textContent = '送っています…';
        const ui = document.querySelector('#step') || document.querySelector('.step');
        const rec = { text: text.slice(0, 400), ui: (ui ? ui.textContent.trim() : '').slice(0, 80), ua: navigator.userAgent.slice(0, 400), sw: screen.width | 0, sh: screen.height | 0 };
        if (lastResult) Object.assign(rec, lastResult);
        try {
          const send = await Promise.race([fb(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000))]);
          await Promise.race([send(rec), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000))]);
          ms.textContent = 'ありがとう！直したら「作ってほしい料理リスト」に出します'; ev('beta_bug', {}); setTimeout(close, 2200);
        } catch (e) {
          ms.className = 'ms'; ms.textContent = /PERMISSION/i.test(e.message) ? '報告は 1 分に 1 件までです。少し待ってからもう一度送ってね' : '送れませんでした。電波のよい所でもう一度試してね'; sd.disabled = false;
        }
      };
      setTimeout(() => ta.focus(), 50);
    }
  }

  // ---------- 自社広告（UG Studio のほかのゲーム） ----------
  // 結果画面が出たあとに 1 本を全画面で見せ、閉じたあとも結果画面の下に一覧を残す。
  // 2026-11-01 から、よく遊ばれている料理ゲーム（GA の表示回数の上位）から、いま遊んでいるゲーム以外をランダムに出す（回遊を増やす）。
  // アイコン（<id>.png）・動画（<id>.mp4、ないゲームは OGP 画像 <id>-og.jpg）は build.py が promo/ に入れる。
  // 押された数は GA の promo_click（app＝行き先）、着いた数は行き先の promo_landing（from＝来たゲーム、place＝full|list）で見る
  // 広告の素材は、GitHub Pages の転送量を抑えるため Cloudflare（ug-unity.pages.dev/promo/）から読む（tools/promo_cdn.sh で上げる）。
  // そこにある素材の一覧（files.txt）を読めたときだけ使い、一覧に無い素材や ugstudio.ooo 以外では今までどおり自分の promo/ を読む
  const PROMO_CDN = 'https://ug-unity.pages.dev/promo/'; let promoCdn = new Set();
  if (/(^|\.)ugstudio\.ooo$/.test(location.hostname)) fetch(PROMO_CDN + 'files.txt').then(r => r.ok ? r.text() : '').then(t => { promoCdn = new Set(t.split('\n').filter(Boolean)); }).catch(() => {});
  const pf = n => (promoCdn.has(n) ? PROMO_CDN : 'promo/') + n;
  const PROMO = [
    { id: 'donut', name: '揚げたてドーナツ', line: '油の上に指で輪を描いて揚げ、チョコとスプレーで好きにデコる', bg: '#f6e3d0', ink: '#3a2a10', en: 1 },
    { id: 'frappe', name: 'ホイップ盛りフラッペ', line: '好きな材料をミキサーへ。注いで、ホイップを好きな形に絞って盛る', bg: '#f4e9dc', ink: '#3a2a10', video: 1, en: 1 },
    { id: 'chahan', name: '黄金チャーハン', line: '中華鍋をリズムよくあおってパラパラに。本物の10工程でつくる', bg: '#f6ead8', ink: '#3a2a10', video: 1, en: 1 },
    { id: 'tonkatsu', name: 'とんかつ', line: '衣をつけて油の温度を合わせて揚げる。包丁で切ると断面に火の通りが出る', bg: '#f2e4cc', ink: '#3a2a10' },
    { id: 'sushi', name: '握り寿司', line: '柵を柳刃で引いて切り、シャリを握ってネタをのせる。軍艦も', bg: '#efe6d6', ink: '#3a2a10', en: 1 },
    { id: 'nikujaga', name: 'おふくろの肉じゃが', line: 'じゃがいもをむいて切って、だしと調味料で味を決めて、落とし蓋で煮る', bg: '#f3e7d3', ink: '#3a2a10', en: 1 },
    { id: 'beer', name: '神泡の生ビール', line: 'グラスを45度に傾けて注ぐ。泡は3割、ふちから少しこんもり', bg: '#1e140d', ink: '#fff', en: 1 },
    { id: 'omurice', name: 'ふわとろオムライス', line: '火加減、混ぜ方、包むタイミング。ナイフを入れた瞬間にすべてがバレる', bg: '#fdf3e1', ink: '#3a2a10', video: 1, play: 1 },
    { id: 'maratang', name: '麻辣湯', line: '22種類の具材から選んでボウルへ。調味料の組み合わせでスープが決まる', bg: '#f4e2cc', ink: '#3a2a10' },
    { id: 'pizza', name: '窯焼きピッツァ', line: '生地を伸ばして具をのせ、薪の窯で回しながら焦がさずに焼く', bg: '#efe3cf', ink: '#3a2a10' },
    { id: 'karaage', name: '鶏の唐揚げ', line: '鶏もも肉を指で切って、粉をつけて揚げる。泡が小さくなったら引き上げる', bg: '#f4e6cc', ink: '#3a2010', en: 1, ja: 0 },
    { id: 'jiro', name: '二郎系ラーメン', line: '麺で土台を作って、コールして、ヤサイを天まで積む', bg: '#1e140d', ink: '#fff', en: 1, ja: 0 }
  ].filter(p => p.id !== slug && (EN ? p.en : p.ja !== 0)); // 英語のときは英語で遊べるゲーム（en: 1）だけ。ja: 0 は英語のときだけ出す
  // 並べかえ（毎回ちがう順に）。全画面は前回と同じゲームを続けて出さない
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pcss = document.createElement('style');
  pcss.textContent = `
.ugpl{margin:22px 0 6px;padding:14px;border-radius:18px;background:#fff;color:#222;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;box-shadow:0 4px 16px #0002;text-align:left}
.ugpl .h{font-size:13px;font-weight:800;opacity:.6;margin:0 0 10px;letter-spacing:.05em}
.ugpl .it{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid #0001}
.ugpl .it:first-of-type{border-top:0;padding-top:0}
.ugp-ic{flex:none;width:64px;height:64px;border-radius:15px;background-size:cover;box-shadow:0 2px 8px #0003}
.ugpl .tx{flex:1;min-width:0}
.ugpl .nm{font-size:16px;font-weight:900}
.ugpl .ds{font-size:12px;line-height:1.45;opacity:.7;margin:2px 0 8px}
.ugpl .bs{display:flex;gap:6px}
.ugp-b{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:800;text-decoration:none;white-space:nowrap}
.ugp-b{background:#111;color:#fff}
.ugpo{position:fixed;inset:0;z-index:9995;display:flex;align-items:center;justify-content:center;padding:24px;background:#000b;opacity:0;transition:opacity .25s;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif}
.ugpo.on{opacity:1}
.ugpo .cd{position:relative;width:min(100%,360px);max-height:100%;overflow:auto;box-sizing:border-box;border-radius:26px;padding:34px 22px 18px;text-align:center;box-shadow:0 20px 60px #0008;transform:translateY(16px) scale(.96);transition:transform .3s cubic-bezier(.2,1.4,.4,1)}
.ugpo.on .cd{transform:none}
.ugpo .pr{position:absolute;left:16px;top:14px;font-size:11px;font-weight:800;opacity:.6;letter-spacing:.08em}
.ugpo .x{position:absolute;right:8px;top:6px;width:40px;height:40px;border:0;border-radius:50%;background:#0002;color:inherit;font-size:22px;line-height:40px;cursor:pointer}
.ugpo .vd{display:block;height:min(44vh,380px);aspect-ratio:9/16;margin:4px auto 14px;border-radius:16px;object-fit:cover;background:#0003;box-shadow:0 6px 20px #0004}
.ugpo .hd{display:flex;align-items:center;justify-content:center;gap:10px}
.ugpo .ugp-ic{width:48px;height:48px;border-radius:12px}
.ugpo .nm{font-size:24px;font-weight:900}
.ugpo .ds{font-size:14px;line-height:1.6;opacity:.85;margin:6px 0 4px}
.ugpo .fr{font-size:12px;opacity:.65;margin-bottom:12px}
.ugpo .ugp-b{display:flex;width:100%;padding:15px;font-size:17px;margin-top:10px;box-sizing:border-box}
.ugpo .ugp-b{background:#ff7a1a;color:#fff;box-shadow:0 5px 0 #b44f05}
.ugpo .og{display:block;width:100%;aspect-ratio:1200/630;object-fit:cover;margin:4px auto 14px;border-radius:16px;box-shadow:0 6px 20px #0004}
.ugmp{display:block;margin:10px 0 6px;padding:13px 10px;border-radius:14px;background:#fff;color:#2a1d15;box-shadow:0 2px 10px #0002;text-align:center;text-decoration:none;font:800 15px "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif}
.ugp-m{color:inherit;text-decoration:none;display:block}
.ugpl .ugp-m{display:contents}
.ugpo .cl{margin-top:14px;font-size:13px;opacity:.6;background:none;border:0;color:inherit;cursor:pointer;padding:6px}
.ugad{min-height:1px;margin:14px 0 6px;overflow:hidden}
.ugad-c{display:flex;justify-content:center;line-height:0}
.ugad-l{font:600 11px "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;opacity:.55;margin:0 0 4px;text-align:left}
.ugad-n{display:flex;align-items:center;justify-content:space-between;gap:8px;font:500 11px/1.5 "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;opacity:.75;margin:0 0 6px}
.ugad-n a{color:inherit;text-decoration:underline}
.ugad-n button{flex:none;width:32px;height:32px;margin:-6px -6px -6px 0;border:0;background:none;color:inherit;font-size:16px;cursor:pointer}
.ugad:has(.ugad-c:empty) .ugad-l,.ugad:has(.ugad-c:empty) .ugad-n{display:none}`;
  document.head.appendChild(pcss);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 2026-10-28〜29 の A/B テスト（a 1.4%・b 6.2%・c 8.5%、記録は specs/promo-ab.md）で決めた c（4 秒後に出す）のまま。
  // variant は出しているものの区別：w＝ugstudio.ooo/play/ の 4 本（2026-10-30〜）、p＝人気の料理ゲームからランダム（2026-11-01〜）
  const PV = 'p';
  // 料理ゲームは同じタブで移る（そのまま次を遊んでもらう）。行き先で promo_landing を送るための印 ?promo=<来たゲーム>.<場所> をつける
  const promoUrl = (p, place) => p.play ? 'https://ugstudio.ooo/play/' + p.id + '/?ref=shota-' + slug + '-' + place : '/shota-cooking/' + p.id + '/?promo=' + slug + '.' + place;
  const promoBtns = (p, place) => `<a class="ugp-b" href="${esc(promoUrl(p, place))}" data-app="${p.id}" data-act="play" data-place="${place}">今すぐ遊ぶ</a>`;
  const promoWrap = (p, place, html) => `<a class="ugp-m" href="${esc(promoUrl(p, place))}" data-app="${p.id}" data-act="media" data-place="${place}">${html}</a>`;
  function promoTrack(root) {
    root.addEventListener('click', e => { const a = e.target.closest('a[data-app]'); if (a) ev('promo_click', { app: a.dataset.app, action: a.dataset.act, place: a.dataset.place, variant: PV }); });
  }
  // fluct のレクタングル 300×250（他社の広告）。全員の結果画面で、自社広告の一覧の下に 1 本出す（2026-11-06 の持ち主の依頼。株式会社LinQ 様の共有シートの置き場所「ゲームの結果画面」）。
  // 遊んでいる間と全画面には出さない。タグは fluct の Tag Viewer の値のまま（スマホとパソコンでタグが違う。[グループ, ユニット]）。止めるときは ON を false にする。
  // （2026-11-04〜05 はここに Adsterra のネイティブバナーを出していた。計画は plans/2026-11-04-adsterra/ExecPlan.md）
  const FLUCT = { ON: true, sp: ['1000198948', '1000314555'], pc: ['1000198943', '1000314550'], ovSp: ['1000198952', '1000314559'], ovPc: ['1000198947', '1000314554'] };
  const FLUCT_SP = /iPhone|iPod|iPad|Android|Mobile/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // 広告の数え方（GA のイベント。1 ページで各 1 回まで）：fluct_slot 結果画面に枠を出した → fluct_load タグを読んだ → fluct_fill 広告が描かれた（ms＝読んでから描かれるまで）
  // → fluct_view 広告の半分以上が 1 秒続けて画面に見えた（IAB の見えた広告の基準。全画面の自社広告が上に重なっている間は数えない）→ fluct_click 広告を押した。
  // 10 秒たっても描かれなければ fluct_nofill。どれも page: 'result' を付ける（トップは page: 'top'）。
  // 読むのは結果画面を出して 1.5 秒後（結果の演出が終わってから）。スクロールを待たないので、下まで見ない人でも Impression が出る。遊んでいる間は読まない。
  let adstEl = null;
  const adstOnce = {};
  const adstEv = (n, p) => { if (adstOnce[n]) return; adstOnce[n] = 1; ev(n.replace(/^adst_/, 'fluct_'), Object.assign({ page: 'result', sp: FLUCT_SP ? 1 : 0 }, p)); };
  function adstWatch(el, c, t0, k = '') {
    // 描かれたか：枠の中に高さのある中身が入ったら
    const filled = () => c.offsetHeight > 30;
    const onFill = () => {
      adstEv('adst_' + k + 'fill', { ms: Math.round(performance.now() - t0) });
      // 見えたか：半分以上が 1 秒続けて画面に出ていたら（全画面の自社広告が開いている間は数えない）
      let tm = 0;
      const vo = new IntersectionObserver(es => {
        const on = es[es.length - 1].intersectionRatio >= 0.5;
        clearTimeout(tm);
        if (on) tm = setTimeout(function chk() {
          if (document.querySelector('.ugpo')) { tm = setTimeout(chk, 500); return; }
          adstEv('adst_' + k + 'view', {}); vo.disconnect();
        }, 1000);
      }, { threshold: [0, 0.5] });
      vo.observe(c);
    };
    if (filled()) return onFill();
    const mo = new MutationObserver(() => { if (filled()) { mo.disconnect(); clearTimeout(nf); onFill(); } });
    mo.observe(c, { childList: true, subtree: true, attributes: true });
    const nf = setTimeout(() => { mo.disconnect(); if (filled()) onFill(); else adstEv('adst_' + k + 'nofill', {}); }, 10000);
    // 押したか：広告が自分の要素なら押した時（click。スクロールで触れただけの指は数えない）、iframe ならページから iframe へ移った時
    el.addEventListener('click', e => { if (c.contains(e.target)) adstEv('adst_' + k + 'click', { how: 'tap' }); }, true);
    addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME' && c.contains(a)) adstEv('adst_' + k + 'click', { how: 'frame' }); }, 0));
  }
  function adstSlot(el) {
    const test = LOCAL && new URLSearchParams(location.search).has('adtest'); // 手元の確認用：?adtest で仮の広告を出す
    if (!test && (!FLUCT.ON || BETA || new URLSearchParams(location.search).has('auto') || !/(^|\.)ugstudio\.ooo$/.test(location.hostname))) return;
    const u = FLUCT_SP ? FLUCT.sp : FLUCT.pc;
    if (!adstEl) {
      adstEl = document.createElement('div'); adstEl.className = 'ugad';
      const note = rget('ug:adst-n', 0) ? '' : `<p class="ugad-n"><span>${EN ? 'Ads on this site may use cookies.' : 'この広告は Cookie を使うことがあります。'} <a href="/privacy.html" target="_blank" rel="noopener">${EN ? 'Details' : 'くわしく'}</a></span><button aria-label="${EN ? 'Close' : '閉じる'}">×</button></p>`;
      adstEl.innerHTML = `<p class="ugad-l">${EN ? 'Ad' : '広告'}</p>${note}<div class="ugad-c fluct-unit-${u[1]}-1"></div>`;
      const nb = adstEl.querySelector('.ugad-n button');
      if (nb) nb.onclick = () => { rset('ug:adst-n', 1); nb.parentElement.remove(); };
      const go = () => {
        if (adstOnce.adst_load || !adstEl.isConnected || !adstEl.getClientRects().length) return; // 結果画面を閉じていたら、次に出した時に読む
        const c = adstEl.querySelector('.ugad-c');
        if (test) setTimeout(() => { c.innerHTML = '<iframe width="300" height="250" style="border:0" srcdoc="<body style=&quot;margin:0;background:#cde;font:700 14px sans-serif;display:grid;place-items:center&quot;>仮の広告 300×250</body>"></iframe>'; }, 600);
        else {
          // fluct の注意：タグは <head> ではなく <body> に置く
          if (!window.__fluctLib) { window.__fluctLib = 1; const sc = document.createElement('script'); sc.async = true; sc.src = 'https://pdn.adingo.jp/p.js'; document.body.appendChild(sc); }
          // ここから下は fluct のタグのまま
          var fluctAdScript = window.fluctAdScript = window.fluctAdScript || {};
          fluctAdScript.cmd = fluctAdScript.cmd || [];
          fluctAdScript.cmd.push(function (cmd) {
            cmd.setGamTargetingMap('%%PATTERN:TARGETINGMAP%%');
            cmd.requestAdByGroup(u[0])
              .setGpid('%%ADUNIT%%')
              .display('.fluct-unit-' + u[1] + '-1', u[1]);
          });
        }
        adstEv('adst_load', {});
        adstWatch(adstEl, adstEl.querySelector('.ugad-c'), performance.now());
        adstOverlay(test);
      };
      adstEl.go = go;
    }
    // 置き場所：LinQ 様の図のとおり「ポスト・画像を保存」の下、「もう一回」（#again）の上（2026-11-06 持ち主「結果のところに入ってない」。一覧の下だとスクロールしないと見えなかった）。
    // 花火は #eAgain（.row の中なので、その .row の前）、バーガー屋は「仕入れへ」（#toshop）。同じ結果画面に無いゲームは、今までどおり一覧の下。一覧を描き直しても、読み込み済みの枠を使い回す
    let ag = el.parentElement && el.parentElement.querySelector('#again, #eAgain, #toshop');
    while (ag && ag.parentElement && !ag.parentElement.contains(el)) ag = ag.parentElement;
    if (ag && ag.parentElement) ag.parentElement.insertBefore(adstEl, ag);
    else el.appendChild(adstEl);
    adstEv('adst_slot', {});
    setTimeout(adstEl.go, 1500);
  }
  // fluct のオーバーレイ（画面の下に固定の 320×100、パソコンは 728×90）。結果画面が出ている間だけ見せる（2026-11-08 持ち主の依頼。
  // トップの下に固定の広告は 1,000 回あたり 49 円で、結果画面の 300×250 の約 8 倍だった）。タグはトップの下に固定の広告と同じ（別のページなので 1 ページ 1 か所は守れる）。
  // 遊んでいる間（結果画面を閉じた後）と、全画面の自社広告（.ugpo）が開いている間は隠す。fluct は × で閉じる時にタグの div の親を隠すので、
  // 外の箱（見せる・隠すはこちら）＞ 内の箱（fluct が隠す）＞ タグの div にする（トップで <body> に直に置いたらページ全体が消えた。2026-11-07）。
  // 広告の高さぶん、結果画面の最後に余白（.ugad-sp）を入れて、いちばん下のボタンが広告に隠れないようにする。GA は fluct_ov_fill・fluct_ov_view・fluct_ov_nofill・fluct_ov_click
  let ovEl = null;
  function adstOverlay(test) {
    if (ovEl) return;
    const u = FLUCT_SP ? FLUCT.ovSp : FLUCT.ovPc, W = FLUCT_SP ? 320 : 728, H = FLUCT_SP ? 100 : 90;
    ovEl = document.createElement('div'); ovEl.className = 'ugadov';
    const inner = document.createElement('div'), c = document.createElement('div');
    c.className = 'fluct-unit-' + u[1] + '-1'; inner.appendChild(c); ovEl.appendChild(inner); document.body.prepend(ovEl);
    const sp = document.createElement('div'); sp.className = 'ugad-sp';
    const frames = () => [...c.querySelectorAll('iframe')].filter(f => f.offsetHeight > 20);
    // 余白を入れる所：結果画面を縦にスクロールさせている箱の最後。無ければ <body> の下の余白
    const scroller = () => { for (let e = adstEl && adstEl.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) return e; return null; };
    let lastH = -1;
    const tick = () => {
      const on = !!(adstEl && adstEl.isConnected && adstEl.getClientRects().length && !document.querySelector('.ugpo'));
      ovEl.style.display = on ? '' : 'none';
      let h = 0;
      if (on) for (const f of frames()) { const r = f.getBoundingClientRect(); if (r.height && r.bottom > innerHeight - 4) h = Math.max(h, innerHeight - r.top); }
      h = h ? Math.min(h, 160) + 8 : 0;
      const box = scroller();
      if (h && box) { if (sp.parentElement !== box || box.lastElementChild !== sp) box.appendChild(sp); }
      else if (sp.parentElement) sp.remove();
      if (h === lastH) return; lastH = h;
      sp.style.height = h + 'px';
      document.body.style.paddingBottom = h && !box ? h + 'px' : '';
    };
    setInterval(tick, 400); tick();
    if (test) {
      c.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;line-height:0;background:#fff;border-top:1px solid #ddd';
      setTimeout(() => { c.innerHTML = `<iframe width="${W}" height="${H}" style="border:0" srcdoc="<body style=&quot;margin:0;background:#fdc;font:700 14px sans-serif;display:grid;place-items:center&quot;>仮の広告 ${W}×${H}</body>"></iframe>`; }, 600);
    } else {
      var fluctAdScript = window.fluctAdScript = window.fluctAdScript || {};
      fluctAdScript.cmd = fluctAdScript.cmd || [];
      // ここから下は fluct のタグのまま
      fluctAdScript.cmd.push(function (cmd) {
        cmd.setGamTargetingMap('%%PATTERN:TARGETINGMAP%%');
        cmd.requestAdByGroup(u[0])
          .setGpid('%%ADUNIT%%')
          .display('.fluct-unit-' + u[1] + '-1', u[1]);
      });
    }
    adstWatch(ovEl, c, performance.now(), 'ov_');
  }
  function promoList(el) {
    el.innerHTML = `<div class="ugpl"><p class="h">人気の料理ゲーム（無料・ブラウザですぐ遊べる）</p>` + shuffle(PROMO).slice(0, 4).map(p =>
      `<div class="it">${promoWrap(p, 'list', `<div class="ugp-ic" style="background-image:url(${pf(p.id + '.png')})"></div>`)}<div class="tx">${promoWrap(p, 'list', `<div class="nm">${esc(p.name)}</div>`)}<div class="ds">${esc(p.line)}</div><div class="bs">${promoBtns(p, 'list')}</div></div></div>`).join('') + `</div>` + (REC_ON && !EN && !document.querySelector('.ugmpc') && (RJP || rget('ug:acct', null)) ? `<a class="ugmp" href="${recMyUrl}">${rget('ug:acct', null) ? '📒 遊んだ記録を見る（マイページ）' : '📒 記録を残す ›'}</a>` : ''); // もう一回のボタンがないゲームの入口
    if (!el.dataset.ugp) { el.dataset.ugp = 1; promoTrack(el); }
    adstSlot(el);
  }
  function promoFull() {
    // 上にゲームの実際の画面の短い動画（promo/<アプリ>.mp4、音なし・くり返し）。読めないときは最初のコマの画像のまま
    // 人気のゲームからランダムに 1 本（前回と同じものは避ける）
    let last = ''; try { last = localStorage.getItem('ugpromo:last') || ''; } catch (e) {}
    const pool = PROMO.filter(q => q.id !== last), p = pool[Math.floor(Math.random() * pool.length)] || PROMO[0];
    try { localStorage.setItem('ugpromo:last', p.id); } catch (e) {}
    const el = document.createElement('div'); el.className = 'ugpo';
    el.innerHTML = `<div class="cd" style="background:${p.bg};color:${p.ink}"><div class="pr">PR・UG Studio</div><button class="x" aria-label="閉じる">×</button>`
      + promoWrap(p, 'full', (p.video ? `<video class="vd" src="${pf(p.id + '.mp4')}" poster="${pf(p.id + '.jpg')}" autoplay muted loop playsinline disablepictureinpicture></video>` : `<img class="og" src="${pf(p.id + '-og.jpg')}" alt="">`)
      + `<div class="hd"><div class="ugp-ic" style="background-image:url(${pf(p.id + '.png')})"></div><div class="nm">${esc(p.name)}</div></div>`) + `<div class="ds">${esc(p.line)}</div>`
      + `<div class="fr">無料・インストール不要</div>${promoBtns(p, 'full')}<button class="cl">閉じて結果を見る</button></div>`;
    const close = how => { ev('promo_close', { app: p.id, how, variant: PV }); const v = el.querySelector('.vd'); if (v) v.pause(); el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
    el.querySelector('.x').onclick = () => close('x');
    el.querySelector('.cl').onclick = () => close('button');
    el.addEventListener('click', e => { if (e.target === el) close('outside'); });
    promoTrack(el);
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
    ev('promo_view', { app: p.id, place: 'full', variant: PV });
  }
  // 結果画面を出した直後に呼ぶ。el に一覧を描き、少し待ってから全画面の広告を出す（?auto= の自動プレイ・録画では出さない）
  function promo(el, delay) {
    if (el) promoList(el);
    if (new URLSearchParams(location.search).has('auto')) return;
    // 待っている間に結果画面を閉じて作り直していたら出さない（2026-11-03 工程の途中に全画面の宣伝が開いていた）
    setTimeout(() => { if (!el || (el.isConnected && el.getClientRects().length)) promoFull(); }, delay != null ? delay : 4000);
  }

  // ---------- 挑戦状リンク（plans/2026-11-02-growth/ExecPlan.md のマイルストーン 1） ----------
  // 結果画面の「友達に挑戦状を送る」で、お題（乱数の種）・点数・称号のキー・名前を入れたリンクを、端末の共有の画面（なければコピー）で送る。
  // リンク：<ゲーム>/r/<称号のキー>/c/?c=<種>_<点>_<キー>_<返事>_<名前>（返事：送り返したときの、相手が出した挑戦状の点。新しい挑戦状は空）。r/<キー>/c/ は build.py が作る静的なページで、その称号の画像と「挑戦状」の題がプレビューに出て、開くとゲームの ?c= へ移る。
  // 開いた人：タイトルに「○○さんからの挑戦状：92 点に勝てる？」、結果画面に「○○さん 92 点 vs あなた 88 点」と「送り返す」。
  // URL に c= がない人には、結果画面の「友達に挑戦状を送る」が増えるだけ（ほかは変えない）。
  // ゲームがすること：お題のあるゲームは、遊び始めに UG.challenge.rng() で乱数を作ってお題を決める（挑戦状から来た人は送った人と同じ種になる）。
  // 結果画面を出したら UG.challenge.result({ score, title, at }) を呼ぶ（at：送るボタンを入れる場所。この前に入る。比べるカードは at の親の先頭に入る）
  const challenge = (() => {
    // 名前：文字・数字と少しの記号だけ、10 文字まで（見えない文字・向きを変える文字・絵文字は落とす）
    // タイ語の母音・声調の記号（\p{M}）は通す。1 文字に重ねられるのは 2 つまで（Zalgo のように積み上げた記号は落とす）
    // 長さは 10 文字ぶん。記号を重ねた 1 文字を 1 と数え、幅の細いタイ文字は 0.6（タイ語の名前は 16 文字まで）。切った時は最後に「…」
    const norm = s => String(s || '').split('…').map(x => x.normalize('NFKC')).join('…').replace(/\u0E4D\u0E32/g, '\u0E33'); // NFKC はタイ語の「ำ」を 2 字に、「…」を「...」に分けるので、分けさせない・戻す
    const clip = (s, n = 10) => { let w = 0, o = ''; for (const g of s.match(/\P{M}\p{M}*/gu) || []) { w += /[\u0E00-\u0E7F]/.test(g) ? .6 : 1; if (w > n + .001) break; o += g; } return o.trim(); };
    const filt = s => norm(s).replace(/[^\p{L}\p{M}\p{N} ー・._!?☆★♪〜~…-]/gu, '').replace(/(^|\s)\p{M}+/gu, '$1').replace(/(\p{M}{2})\p{M}+/gu, '$1').replace(/\s+/g, ' ').trim();
    // 「…」は最後の 1 つだけ（切った名前を受け取った人の所でも「…」が残る。数には入れない）
    const cleanName = s => { const x = filt(s), b = x.replace(/…/g, '').trim(), r = clip(b); return r && (r !== b || /…$/.test(x)) ? r + '…' : r; };
    // 点数は 0〜満点（どのゲームも 100 点満点。違うゲームは window.UG_CH_MAX で変える）。URL を書きかえて「99999 点」の挑戦状を作れないように
    const MAX = +window.UG_CH_MAX || 100, num = v => Math.round(Math.max(0, Math.min(MAX, +v || 0)) * 10) / 10;
    const IN = (() => {
      const s = new URLSearchParams(location.search).get('c'); if (!s || window.UG_NO_CH) return null; // UG_NO_CH：挑戦状を使わないゲーム（和菓子作り）
      const p = s.split('_'); if (p.length < 3 || p[1] === '' || !isFinite(+p[1]) || +p[1] < 0 || +p[1] > MAX) return null;
      const key = /^r\d{1,4}$/.test(p[2]) ? p[2] : '', rp = p[3] != null && p[3] !== '' && isFinite(+p[3]) && +p[3] >= 0 && +p[3] <= MAX ? num(p[3]) : null;
      return { seed: /^[0-9a-z]{1,8}$/.test(p[0]) ? parseInt(p[0], 36) : 0, score: num(p[1]), key, title: key ? (Object.keys(results).find(k => results[k] === key) || '') : '', reply: rp, name: cleanName(p.slice(4).join('_')) };
    })();
    let cur = 0;
    function rng() {
      cur = IN && IN.seed ? IN.seed : 1 + Math.floor(Math.random() * 2e9);
      let a = cur >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    // 英語の文の型（{0} に名前・点数）。韓国語・タイ語は辞書の同じ見出しの訳を使う。名前は訳したあとに入れる（名前が辞書を通らない）
    const T = (s, ...a) => (XL && DICT[s] != null ? DICT[s] : s).replace(/\{(\d)\}/g, (_, n) => a[n]);
    const who = n => n ? (EN ? n : n + 'さん') : (EN ? T('Your friend') : '友達');
    const pt = v => EN ? T('{0} pts', v) : v + ' 点';
    const short = n => { const c = clip(n || '', 6); return c !== (n || '').trim() ? c + '…' : n; }; // ボタン・帯の 1 行に収める（長い名前は 6 文字で「…」）
    const game = () => { const m = document.querySelector('meta[property="og:title"]'); return t(m ? m.content : ''); }; // ゲームの題名（game.json の title）
    function link(o, name) {
      const key = results[o.title] || '', c = [o.seed ? (o.seed >>> 0).toString(36) : '', num(o.score), key, IN ? IN.score : '', name].join('_');
      const base = LOCAL ? new URL('./', location.href).href : url; // 手元で試すときは手元のゲームを指す
      // 称号のページ r/<キー>/c/ があればそこ（プレビューの題に称号が出る）、なければ c/。日本語のほかは言語のページ r/<キー>/<言語>/c/・c/<言語>/（en・ko・th）
      const lg = EN ? lang + '/' : '';
      return base + (key ? 'r/' + key + '/' + lg + 'c/' : 'c/' + lg) + '?c=' + encodeURIComponent(c);
    }
    // 送る：iPhone は「タップの直後」でないと共有の画面が開けないので、await の前に share を呼ぶ
    function send(o) {
      const name = cleanName(o.name), u = link(o, name), reply = IN ? 1 : 0, extra = { score: num(o.score), title: o.title || '', reply, named: name ? 1 : 0 };
      if (IN) extra.outcome = num(o.score) > IN.score ? 'win' : num(o.score) < IN.score ? 'lose' : 'draw';
      // 送り返す文は勝ち負けで変える（負けたのに「この点数に勝てる？」と聞かない）
      const my = num(o.score), r = IN ? (my > IN.score ? 'win' : my < IN.score ? 'lose' : 'draw') : '';
      const text = r === 'win' ? (EN ? T("I beat {0}'s {1} with {2} in {3}! Can you beat me now?", who(IN.name), pt(IN.score), pt(my), game()) : `${who(IN.name)}の ${pt(IN.score)}に ${pt(my)}で勝った！ この点数に勝てる？（${game()}）`)
        : r === 'lose' ? (EN ? T("I lost! {0}'s {1} is amazing (I got {2}). I'll be back! ({3})", who(IN.name), pt(IN.score), pt(my), game()) : `負けた！ ${who(IN.name)}の ${pt(IN.score)}すごい（わたしは ${pt(my)}）。また挑戦する！（${game()}）`)
        : r === 'draw' ? (EN ? T("A tie with {0} at {1}! Let's settle it. ({2})", who(IN.name), pt(my), game()) : `${who(IN.name)}と ${pt(my)}で引き分け！ 決着をつけよう（${game()}）`)
        : (EN ? T('I scored {0} in {1}. Can you beat me? Same challenge, your turn!', pt(num(o.score)), game()) : `${game()}で ${pt(num(o.score))}だった！ この点数に勝てる？ 同じお題で勝負しよう`);
      if (navigator.share) {
        navigator.share({ text, url: u }).then(() => ev('challenge_send', Object.assign({ method: 'share', result: 'shared' }, extra)),
          e => ev('challenge_send', Object.assign({ method: 'share', result: e && e.name === 'AbortError' ? 'canceled' : 'error' }, extra)));
        return u;
      }
      const done = ok => { ev('challenge_send', Object.assign({ method: 'copy', result: ok ? 'copied' : 'prompt' }, extra)); if (ok) toast(EN ? 'Link copied. Paste it to your friend!' : 'リンクをコピーしました。友達に貼って送ってね', 4000); else window.prompt(t(EN ? 'Send this link to your friend' : 'このリンクを友達に送ってね'), u); };
      try { navigator.clipboard.writeText(text + '\n' + u).then(() => done(true), () => done(false)); } catch (e) { done(false); }
      return u;
    }
    let css = false;
    function style() {
      if (css) return; css = true;
      const s = document.createElement('style');
      s.textContent = `.ugch-in{display:block;width:max-content;max-width:100%;box-sizing:border-box;margin:0 auto 10px;padding:9px 16px 10px;border-radius:16px;background:#2a1d15ee;color:#fff;text-align:center;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;box-shadow:0 4px 14px #0004;animation:ugchIn .5s cubic-bezier(.2,1.5,.4,1)}
.ugch-in .a{font-size:13px;font-weight:800;opacity:.85}.ugch-in .b{font-size:21px;font-weight:900;line-height:1.3;margin-top:2px}.ugch-in .b em{font-style:normal;color:#ffd23f}.ugch-in .c{font-size:12px;font-weight:700;opacity:.75;margin-top:2px}
.ugch-chip{display:block;width:max-content;max-width:100%;margin:5px 0 0 auto;padding:4px 10px;border-radius:99px;background:#2a1d15e0;color:#fff;font:800 12px/1.3 "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;box-shadow:0 2px 6px #0003;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ugch-chip b{color:#ffd23f}#step.hidden+.ugch-chip{display:none}
@keyframes ugchIn{from{opacity:0;transform:translateY(-10px) scale(.9)}}
.ugch-vs{margin:40px 0 0;padding:14px 12px 12px;border-radius:20px;background:#2a1d15;color:#fff;text-align:center;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;box-shadow:0 6px 18px #0003}
.ugch-vs .h{margin:0 0 8px;font-size:13px;font-weight:800;opacity:.75;letter-spacing:.08em}
.ugch-vs .rw{display:flex;align-items:center;gap:6px}.ugch-vs .p{flex:1;min-width:0;padding:8px 4px;border-radius:14px;background:#ffffff14}.ugch-vs .p.win{background:#ffd23f;color:#2a1d15}
.ugch-vs .n{font-size:14px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ugch-vs .s{font-size:40px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}.ugch-vs .s small{font-size:15px;margin-left:2px}
.ugch-vs .t{font-size:11px;font-weight:700;line-height:1.35;opacity:.8;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.ugch-vs .v{flex:none;font-size:18px;font-weight:900;color:#ffd23f}
.ugch-vs .r{margin:10px 0 0;font-size:18px;font-weight:900}
.ugch-vs .re{display:block;width:100%;margin:10px 0 0;border:0;border-radius:14px;padding:13px 10px;font:900 17px "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;color:#2a1d15;background:#ffd23f;box-shadow:0 4px 0 #b8900a;cursor:pointer}
.ugch-vs .re:active{transform:translateY(3px);box-shadow:0 1px 0 #b8900a}
.ugch-sd{margin:12px 0 0;padding:12px;border-radius:18px;background:#fff;box-shadow:0 2px 10px #0002;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;color:#2a1d15}
.ugch-vs+.ugch-sd{margin:10px 0 14px}
.ugch-sd .go{display:block;width:100%;border:0;border-radius:14px;padding:15px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:900 min(18px,4.7vw) "Hiragino Sans","Hiragino Kaku Gothic ProN",system-ui,sans-serif;color:#fff;background:linear-gradient(180deg,#06c755,#04a144);box-shadow:0 4px 0 #037a33;cursor:pointer}
.ugch-sd .go:active{transform:translateY(3px);box-shadow:0 1px 0 #037a33}
.ugch-sd .nt{margin:0 0 8px;font-size:12px;font-weight:700;color:#b8501a}.ugch-sd .nt:empty{display:none}
.ugch-sd label{display:flex;align-items:center;gap:8px;margin:0 0 9px;font-size:13px;font-weight:700;color:#6a5040}.ugch-sd input{flex:1;min-width:0;font:700 16px "Hiragino Sans",system-ui,sans-serif;padding:8px 10px;border:2px solid #e6dccf;border-radius:10px;color:#2a1d15;background:#fffaf2}`;
      document.head.appendChild(s);
    }
    const div = (cls, txt) => { const d = document.createElement('div'); d.className = cls; if (txt != null) d.textContent = txt; return d; };
    // タイトル画面：挑戦状が届いたことを出す（#intro の先頭。ない時はお知らせ）
    if (IN) {
      const show = () => {
        style(); const intro = document.getElementById('intro');
        const el = div('ugch-in'), b = div('b'), em = document.createElement('em'), R = IN.reply, rr = R == null ? '' : IN.score > R ? 'win' : IN.score < R ? 'lose' : 'draw';
        // 送り返されたリンク（返事）：自分が出した点数への、相手の結果を先に出す
        const a = div('a', R != null ? (EN ? T('✉ {0} answered your challenge', who(IN.name)) : `✉ ${who(IN.name)}からの返事`) : (EN ? T('✉ A challenge from {0}', who(IN.name)) : `✉ ${who(IN.name)}からの挑戦状`));
        em.textContent = pt(IN.score);
        // 「○○さんからの返事：○○さんは 17 点で負け（あなたは 95 点）」（誰が負けたのか分かるように、2 行目にも相手の名前）
        // （1 行目に収まるよう、自分の点数は 3 行目に回す）
        const yo = EN ? T('You: {0} ·', pt(R)) + ' ' : `あなたは ${pt(R)}・`, sb = EN ? '' : who(short(IN.name)) + 'は ';
        if (rr === 'lose') b.append(EN ? 'They lost with ' : sb, em, EN ? '' : 'で負け');
        else if (rr === 'draw') b.append(EN ? 'A tie at ' : sb, em, EN ? '' : 'で引き分け');
        else if (rr === 'win') b.append(EN ? 'They won with ' : sb, em, EN ? '' : 'で勝ち！');
        else b.append(em, EN ? ' — can you beat it?' : ' に勝てる？');
        a.setAttribute('translate', 'no'); b.setAttribute('translate', 'no'); el.append(a, b);
        const cl = rr === 'win' ? yo + (EN ? T('win it back: beat {0}', pt(IN.score)) : `${pt(IN.score)}に勝って取り返そう`) : rr ? yo + (EN ? T('play again and send another!') : 'もう一回遊んで、また送ろう')
          : IN.title ? (EN ? T('“{0}” · same challenge', t(IN.title)) : '『' + IN.title + '』・同じお題で勝負') : '';
        if (cl) { const c = div('c', cl); c.setAttribute('translate', 'no'); el.append(c); }
        if (intro) intro.insertBefore(el, intro.firstChild); else toast(a.textContent + '　' + b.textContent, 6000);
        // 遊んでいる間：工程の帯（#step）のすぐ下の右に、相手の点数を小さく出しておく（帯が隠れている間は出ない）
        const st = document.getElementById('step');
        if (st) { const ch = document.createElement('div'), bb = document.createElement('b'); ch.className = 'ugch-chip'; ch.setAttribute('translate', 'no'); bb.textContent = pt(IN.score);
          // 韓国語は「95점에 도전 중」と助詞を点数につける（空白を入れない）
          ch.append(EN ? T('✉ {0}:', who(IN.name)) + ' ' : `✉ ${who(IN.name)} `, bb, EN ? (lang === 'ko' || ZH ? '' : ' ') + T('to beat') : ' に挑戦中'); st.after(ch); }
      };
      document.body ? show() : addEventListener('DOMContentLoaded', show);
      // 開いた数は、同じ挑戦状につきタブごとに 1 回（読み直しで二重に数えない）
      const q = new URLSearchParams(location.search); let seen = false;
      try { const k = 'ugch:' + slug + ':' + q.get('c'); seen = !!sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); } catch (e) {}
      if (!seen) ev('challenge_open', { their: IN.score, title: IN.title, named: IN.name ? 1 : 0, reply: IN.reply == null ? 0 : 1, ref: q.get('ref') || (document.referrer ? new URL(document.referrer).hostname : 'direct') });
    }
    // 結果画面：挑戦状から来た人には比べるカード、全員に送る（送り返す）ボタン
    function result(o) {
      const at = o.at && o.at.nodeType ? o.at : document.querySelector(o.at || '#again'); if (!at) return;
      style(); const box = at.parentNode, me = { score: num(o.score), title: o.title || '', seed: o.seed != null ? o.seed : cur };
      box.querySelectorAll('.ugch-vs,.ugch-sd').forEach(e => e.remove());
      if (IN) {
        const d = me.score - IN.score, res = d > 0 ? 'win' : d < 0 ? 'lose' : 'draw', vs = div('ugch-vs'), rw = div('rw');
        const side = (n, sc, ti, win) => { const p = div('p' + (win ? ' win' : '')), s = div('s'), sm = document.createElement('small'); s.textContent = (win ? '👑' : '') + sc; sm.textContent = EN ? 'pts' : '点'; s.appendChild(sm);
          p.append(div('n', n), s); if (ti) p.append(div('t', EN ? Q(t(ti)) : '『' + ti + '』')); p.setAttribute('translate', 'no'); return p; };
        rw.append(side(who(IN.name), IN.score, IN.title, res === 'lose'), div('v', 'VS'), side(EN ? 'You' : 'あなた', me.score, me.title, res === 'win'));
        const gap = Math.round(Math.abs(d) * 10) / 10;
        vs.append(div('h', EN ? 'CHALLENGE RESULT' : '挑戦状の結果'), rw, div('r', res === 'win' ? (EN ? `You win by ${gap}! Send it back 🎉` : `${gap} 点差で勝ち！ 送り返そう 🎉`) : res === 'lose' ? (EN ? `${gap} short. One more try!` : `あと ${gap} 点！ もう一回いける`) : (EN ? 'A tie!' : '引き分け！')));
        // 負け・引き分けは、カードのすぐ下で「同じお題でもう一回」（ゲームの「もう一回」のボタン at を押したのと同じ。挑戦状と種はそのまま）
        if (res !== 'win') { const re = document.createElement('button'); re.className = 're'; re.type = 'button'; re.textContent = EN ? '↻ Try again (same challenge)' : '↻ 同じお題でもう一回';
          re.onclick = () => { ev('challenge_retry', { score: me.score, their: IN.score }); at.click(); }; vs.append(re); }
        box.insertBefore(vs, box.firstChild);
        // 点数（王冠・数字・単位）は 1 行に収める。375 幅で「👑100点」の王冠だけが上の行に回っていたので、はみ出す時だけ字を小さくする
        const fitS = () => vs.querySelectorAll('.s').forEach(s => { for (let f = parseFloat(getComputedStyle(s).fontSize); s.clientWidth && s.scrollWidth > s.clientWidth + 1 && f > 24; ) s.style.fontSize = (f -= 2) + 'px'; });
        fitS(); requestAnimationFrame(fitS); setTimeout(fitS, 800); // 結果画面が出てから（隠れている間は幅が 0 で測れない）
        ev('challenge_finish', { score: me.score, their: IN.score, result: res, title: me.title });
      }
      const sd = div('ugch-sd'), go = document.createElement('button'), lb = document.createElement('label'), inp = document.createElement('input');
      // ボタンは 1 行に収める（長い名前は 6 文字で「…」。iPhone SE で「送り返す」が 2 行に折れていた）
      const sn = IN && short(IN.name);
      go.className = 'go'; go.type = 'button'; go.textContent = IN ? (EN ? T('✉ Send it back to {0}', who(sn)) : `✉ ${who(sn)}に送り返す`) : (EN ? '✉ Challenge a friend' : '✉ 友達に挑戦状を送る');
      go.setAttribute('translate', 'no');
      inp.maxLength = lang === 'th' ? 40 : 10; /* タイ語は 16 文字まで。記号を重ねた 1 文字が 2〜3 字ぶん */ inp.autocomplete = 'nickname'; inp.placeholder = EN ? 'optional' : '入れなくてもOK';
      try { inp.value = cleanName(localStorage.getItem('ug:name')); } catch (e) {}
      lb.append(EN ? 'Your name' : 'あなたの名前', inp);
      // 使えない文字（絵文字・記号の一部）を落としたら、ひとこと出す
      // 知らせは、外した後の名前のままなら消さない（入れてすぐ「送る」を押すと、change で出した知らせを click の fix() が消していた）
      let shown = null; const nt = div('nt'), fix = () => { const v = inp.value, n = cleanName(v); if (filt(v) !== norm(v).replace(/\s+/g, ' ').trim()) { nt.textContent = EN ? 'Emoji and some symbols can’t be used, so they were removed.' : '絵文字や一部の記号は使えないので、外しました'; shown = n; } else if (v !== shown) nt.textContent = ''; inp.value = n; return n; };
      inp.addEventListener('change', fix);
      go.onclick = () => { const n = fix(); try { localStorage.setItem('ug:name', n); } catch (e) {} sfx('tap'); send(Object.assign({}, me, { name: n })); };
      sd.append(lb, nt, go); /* 名前の欄はボタンの上（入れる前に押してしまわないように） */ box.insertBefore(sd, IN ? box.querySelector('.ugch-vs').nextSibling : at); // 挑戦状から来た人は、比べるカードのすぐ下で送り返す
    }
    return { read: () => IN && Object.assign({}, IN), rng, seed: () => cur, link: (o, name) => link(o, cleanName(name)), send, result, cleanName, cleanTo: (v, n) => clip(filt(v).replace(/…/g, '').trim(), n) };
  })();

  // 右上の「？ 遊び方」と「ゲーム一覧」：遊び方は ugstudio.ooo の解説ページ（遊び方・採点・コツ）、一覧は UG Studio のトップ（料理ゲームもそこに並ぶ）へ。スマホ幅では上の工程の帯と重ならないよう、帯を少し下げる
  const GUIDES = { chahan: '/shota-cooking/chahan/guide/', jiro: '/games/jiro/', beer: '/games/beer/', coffee: '/games/coffee/', karaage: '/games/karaage/', pizza: '/games/pizza/', nikujaga: '/games/nikujaga/', donut: '/games/donut/', tonkatsu: '/games/tonkatsu/', sushi: '/games/sushi/', maratang: '/games/maratang/', frappe: '/games/frappe/' };
  // 結果カードの写真：料理（box：THREE.Box3）が w×h の枠にちょうど収まるよう、いまのカメラの向きのまま寄せて撮る。
  // 画面の切り出しではないので、縦長のスマホでも料理が切れない。T は three.js（ゲーム側の THREE）
  // お皿のあるゲームは、シール用に真上からお皿ごとも撮って、履歴の画像にする（2026-11-04 持ち主の提案。plans/2026-11-04-stickers/ExecPlan.md）。
  // 実物を比べて、真上のほうがきれいなゲームだけ。チャーハンの山やグラスのように高さが見せ場の物は入れない
  const REC_TOP = /^(tonkatsu|karaage|donut|nikujaga|takoyaki)$/;
  function shot(T, renderer, scene, cam, box, w, h, opt) {
    if (REC_ON && REC_TOP.test(slug)) try { recGiven = shotOne(T, renderer, scene, cam, box, 480, 480, { dir: [0, 1, .04], fov: 24, fill: .84, scale: 1 }); } catch (e) {}
    return shotOne(T, renderer, scene, cam, box, w, h, opt);
  }
  function shotOne(T, renderer, scene, cam, box, w, h, opt) {
    opt = opt || {}; const c = box.getCenter(new T.Vector3()), pc = cam.clone(); pc.aspect = w / h; if (opt.fov) pc.fov = opt.fov; pc.updateProjectionMatrix();
    // opt.dir：料理から見たカメラの向き（[x, y, z]）。なければ、いまのカメラの向き。opt.fov：画角（小さいほど望遠）。opt.fill：枠に対する大きさ（1 をこえると寄り）
    const dir = (opt.dir ? new T.Vector3(...opt.dir) : cam.position.clone().sub(c)).normalize(), P = [], fill = opt.fill || .9, tanY = Math.tan(pc.fov * Math.PI / 360);
    // 料理はたいてい丸い（皿・器・グラス）ので、箱の角ではなく、箱に入る円柱の上と下のふちで合わせる（角で合わせると、そのぶん小さく写る）
    { const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, rx = (box.max.x - box.min.x) / 2, rz = (box.max.z - box.min.z) / 2; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; for (const y of [box.min.y, box.max.y]) P.push(new T.Vector3(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz)); } }
    let tgt = c.clone(), d = box.getSize(new T.Vector3()).length() * 1.2 + .1;
    // 8 つの角を写して、かたよりを見てまん中に寄せ、はみ出しを見て距離を合わせる（くり返すと収まる）
    // 少しずつ動かす（一度に合わせようとすると、近づきすぎと離れすぎをくり返して収まらない）
    for (let it = 0; it < 40; it++) { pc.position.copy(tgt).addScaledVector(dir, d); pc.lookAt(tgt); pc.updateMatrixWorld(true);
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of P) { const q = p.clone().project(pc); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const right = new T.Vector3().setFromMatrixColumn(pc.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(pc.matrixWorld, 1);
      tgt.addScaledVector(right, (x0 + x1) / 2 * d * tanY * pc.aspect * .5).addScaledVector(up, (y0 + y1) / 2 * d * tanY * .5);
      d *= Math.min(1.15, Math.max(.9, Math.max((x1 - x0) / 2, (y1 - y0) / 2) / fill)); }
    const pr = renderer.getPixelRatio(), sz = renderer.getSize(new T.Vector2()), k = opt.scale || 1.5;
    renderer.setPixelRatio(1); renderer.setSize(w * k, h * k, false); renderer.render(scene, pc);
    const out = document.createElement('canvas'); out.width = w * k; out.height = h * k; out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false); renderer.render(scene, cam); return out;
  }

  // ---------- バージョンと更新の履歴（plans/2026-11-01-versions/ExecPlan.md） ----------
  // 同じフォルダの changelog.json（games/<slug>/changelog.json、新しい順）を読む。右上の「v1.3」を押すと履歴、前に遊んだ人が新しい版を開くと「アップデートしました」
  let LOG = null, VER = null;
  const vOlder = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false; };
  function verSheet(list, news) {
    if (document.querySelector('.ugver')) return;
    if (!document.getElementById('ugver-css')) {
      const css = document.createElement('style'); css.id = 'ugver-css';
      css.textContent = `.ugver{position:fixed;inset:0;z-index:99980;background:#0007;display:grid;place-items:center;padding:16px;font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;animation:ugverIn .25s ease}
.ugver .bx{background:#fffaf2;color:#2a1d15;border-radius:20px;padding:20px 18px 16px;width:min(400px,100%);max-height:84vh;overflow:auto;box-shadow:0 12px 40px #0005}
.ugver h3{margin:0 0 4px;font-size:20px;font-weight:900;text-align:center}.ugver .sub{margin:0 0 12px;text-align:center;font-size:13px;color:#8a6a4e;font-weight:700}
.ugver .e{margin:0 0 12px}.ugver .e b{display:inline-block;background:#2a1d15;color:#fff;border-radius:99px;padding:3px 10px;font-size:13px}.ugver .e span{font-size:12px;color:#8a6a4e;margin-left:8px;font-weight:700}
.ugver ul{margin:6px 0 0;padding:0 0 0 1.2em;font-size:14.5px;line-height:1.6;font-weight:700}.ugver li{margin:2px 0}
.ugver .ok{position:sticky;bottom:0;display:block;width:100%;margin-top:6px;box-shadow:0 -10px 12px #fffaf2;border:0;border-radius:14px;padding:14px;font:900 17px "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;color:#fff;background:#2a1d15}
@keyframes ugverIn{from{opacity:0}to{opacity:1}}`;
      document.head.appendChild(css);
    }
    const w = document.createElement('div'), bx = document.createElement('div'), h = document.createElement('h3'), sub = document.createElement('p'), ok = document.createElement('button');
    w.className = 'ugver'; bx.className = 'bx'; sub.className = 'sub'; ok.className = 'ok';
    h.textContent = news ? (EN ? 'Updated!' : 'アップデートしました') : (EN ? 'Update history' : '更新の履歴');
    sub.textContent = news ? (EN ? `Now v${VER}. Here's what's new.` : `v${VER} になりました。変わったところ`) : (EN ? `Current version: v${VER}` : `いまのバージョン：v${VER}`);
    bx.append(h, sub);
    for (const e of list) {
      const d = document.createElement('div'), b = document.createElement('b'), dt = document.createElement('span'), ul = document.createElement('ul');
      d.className = 'e'; b.textContent = 'v' + e.v; const m = String(e.date).match(/^\d+-(\d+)-(\d+)/); dt.textContent = m ? (EN ? `${+m[1]}/${+m[2]}` : `${+m[1]}月${+m[2]}日`) : e.date;
      for (const it of (EN && (e[lang] || e.en) && (e[lang] || e.en).length ? (e[lang] || e.en) : e.items)) { const li = document.createElement('li'); li.textContent = it; ul.appendChild(li); }
      d.append(b, dt, ul); bx.appendChild(d);
    }
    ok.textContent = news ? (EN ? 'Play' : '遊ぶ') : (EN ? 'Close' : '閉じる');
    const close = () => { w.remove(); try { localStorage.setItem(slug + ':seenVer', VER); } catch (e) {} };
    ok.addEventListener('click', close); w.addEventListener('click', e => { if (e.target === w) close(); });
    bx.appendChild(ok); w.appendChild(bx); document.body.appendChild(w);
  }
  // 前に遊んだ人（このゲームの記録がある人）にだけ、見ていない版の変更を出す。この仕組みより前から遊んでいる人（seenVer がない）は最新の版だけ。初めての人は出さずに覚える
  function verChip() {
    const nav = document.getElementById('ug-nav'); if (!nav || !VER || document.getElementById('ug-ver')) return;
    const v = document.createElement('a');
    v.id = 'ug-ver'; v.href = '#'; v.textContent = 'v' + VER; v.setAttribute('translate', 'no'); v.setAttribute('aria-label', (EN ? 'Version ' : 'バージョン ') + VER + (EN ? ' (update history)' : '（更新の履歴）'));
    v.addEventListener('click', e => { e.preventDefault(); verSheet(LOG, false); ev('ver_open', { v: VER }); });
    nav.insertBefore(v, document.getElementById('ug-home'));
  }
  function verLoad() {
    fetch('changelog.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(l => {
      if (!Array.isArray(l) || !l.length || !l[0].v) return;
      LOG = l; VER = String(l[0].v); verChip(); verNews();
    }).catch(() => {});
  }
  // 新しい版を開いた時の「アップデートしました」は、どのゲームでも出さない（2026-11-06 持ち主の方針）。見た版だけ覚えて、右上の「v1.x」を押せば履歴は見られる
  const VER_NEWS = false;
  function verNews() {
    if (!VER) return;
    if (!VER_NEWS) { try { localStorage.setItem(slug + ':seenVer', VER); } catch (e) {} return; }
    let seen = null, played = false;
    try { seen = localStorage.getItem(slug + ':seenVer'); for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(slug + ':') && k !== slug + ':seenVer') { played = true; break; } } } catch (e) { return; }
    if (seen && !vOlder(seen, VER)) return;
    const auto = /[?&](auto|from|c)=/.test(location.search); // 挑戦状（c=）から来た人にも出さない（挑戦状を先に見せる）
    if (!played || auto) { if (!auto) try { localStorage.setItem(slug + ':seenVer', VER); } catch (e) {} return; }
    const list = seen ? LOG.filter(e => vOlder(seen, e.v)) : LOG.slice(0, 1);
    if (!list.length) return;
    setTimeout(() => { verSheet(list, true); ev('ver_news', { v: VER, from: seen || '' }); }, 700);
  }

  function homeButton() {
    if (document.getElementById('ug-nav')) return;
    const st = document.createElement('style');
    st.textContent = '#ug-nav{position:fixed;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:55;display:flex;gap:6px}'
      + '#ug-nav a{font:800 13px/1 "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;color:#2a1d15;background:#fffaf2e6;border-radius:99px;padding:8px 12px;text-decoration:none;box-shadow:0 2px 8px #0003;-webkit-tap-highlight-color:transparent}'
      + '#ug-nav a:active{transform:translateY(1px)}'
      + '@media (max-width:620px){#topui{padding-top:36px}}';
    document.head.appendChild(st);
    const nav = document.createElement('nav');
    nav.id = 'ug-nav'; nav.setAttribute('aria-label', 'サイト');
    const top = LOCAL ? '/' : 'https://ugstudio.ooo/'; // 手元では手元のトップへ
    if (GUIDES[slug] && !EN) { // 解説ページは日本語だけ
      const g = document.createElement('a');
      g.id = 'ug-guide'; g.textContent = '？ 遊び方';
      g.href = (LOCAL ? '/' : 'https://ugstudio.ooo/') + GUIDES[slug].slice(1);
      g.addEventListener('click', () => ev('guide_click'));
      nav.appendChild(g);
    }
    const a = document.createElement('a');
    a.id = 'ug-home'; a.textContent = '☰ ゲーム一覧';
    a.href = top + '#kitchen';
    a.addEventListener('click', () => ev('home_click'));
    nav.appendChild(a);
    // 言語の切り替え（辞書のあるゲームだけ）。押すと ?lang= を付けて読み直す。日本語のブラウザで日本語のときは出さない（今までの画面のまま）
    // 日本語以外のときは「日本語」、日本語のときはブラウザの言語の名前（English・한국어・ไทย・简体中文・繁體中文）
    if (DICTS.en && (EN || NAVL !== 'ja')) {
      const to = EN ? 'ja' : has(NAVL) ? NAVL : 'en', l = document.createElement('a'), u = new URL(location.href);
      u.searchParams.set('lang', to); u.searchParams.delete('from'); l.href = u.href;
      l.id = 'ug-lang'; l.textContent = { ja: '日本語', en: 'English', ko: '한국어', th: 'ไทย', 'zh-hans': '简体中文', 'zh-hant': '繁體中文', id: 'Bahasa Indonesia' }[to]; l.setAttribute('translate', 'no'); l.lang = to;
      l.addEventListener('click', () => ev('lang_switch', { to }));
      nav.appendChild(l);
    }
    if (REC_ON && !EN && !nav.querySelector('#ug-lang') && rget('ug:acct', null)) { // 登録した人だけ（レベルは端末の記録から出す。そのために Firebase は読まない）
      // 日本語の時だけ（マイページが日本語だけなので）。言語のボタンが並ぶ時は幅が足りないので出さない
      const m = document.createElement('a'); m.id = 'ug-lv'; m.href = myUrl('nav'); m.setAttribute('aria-label', '遊んだ記録を見る（マイページ）');
      m.addEventListener('click', () => ev('mypage_entry', { place: 'nav' }));
      // 左上に置く（右上の並びの下だと、大きなタイトルの文字に重なる）。ベータ版は左上に β のボタンがあるので、その下。とても狭い画面では右上の並びに当たるので出さない
      // ベータ版では左上に β のボタンがあり、タイトルの文字に重なるので出さない（入口は結果画面から）
      st.textContent += `#ug-nav #ug-lv{position:fixed;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));white-space:nowrap${BETA ? ';display:none!important' : ''}}@media (max-width:359px){#ug-nav #ug-lv{display:none}}`;
      nav.appendChild(m); document.body.appendChild(nav); recNavLv(true); return;
    }
    document.body.appendChild(nav);
  }
  // 独立游戏页面：不注入站点主页导航、游戏列表、语言切换或版本按钮。

  // シェアのリンクから来た人（結果ページの「あなたも遊ぶ」は ?from=<称号のキー> を付ける）。ref は結果ページを開く前にいた所（X なら t.co）
  // 自社広告から来た人（?promo=<来たゲーム>.<場所>）。数えたら URL から消す（読み直し・シェアで二重に数えない）
  { const q = new URLSearchParams(location.search), pr = q.get('promo'); if (pr) { const [f, pl] = pr.split('.'); ev('promo_landing', { from: f, place: pl || '' }); q.delete('promo'); try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {} } }
  { const q = new URLSearchParams(location.search), from = q.get('from'); if (from) ev('share_landing', { key: from, ref: q.get('ref') || (document.referrer ? new URL(document.referrer).hostname : 'direct') }); }

  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  // 最初のタップで音を使えるようにする（iPhone は操作の中でしか音を鳴らせない）
  addEventListener('pointerdown', () => audio(), { once: true });
  return { slug, url, lang, myUrl, version: () => VER, t, missing: () => [...miss], isMobile, ev, load, save, resultUrl, share, saveImage, shareX, shareImage, openXApp, sfx, vibrate, confetti, flash, shake, toast, reveal, wait, promo, shot, betaHide, challenge, resultImage, record };
})();

// fluct のインタースティシャルを、ゲームを開いて最初に「始める」を押した時に出す（2026-11-10 の持ち主の依頼。トップの一覧からゲームへ行く時に出すのはやめた）。
// 広告を閉じてからゲームを始める：開始ボタン（START のセレクタ）への最初の押下を、ゲームより先に window の capture で止めておき、
// 広告が閉じられたら（5 秒たっても来なければ、そのまま）同じボタンに押下を送り直す。各ゲームのファイルは変えない。
// 出すのは、ゲームを開いて最初に「始める」を押した回数（全ゲーム合わせて端末ごと。ug:start-n）の 1 回目・6 回目・11 回目…（5 回に 1 回。初めて来た人にも出す。2026-11-10 の持ち主の依頼）。
// トップの一覧から来た時は、ゲームを開いた時に出す（下の「開いた時」。2026-11-10 持ち主：fluct の指示で、一覧を離れる前に出すのはだめ、行き先を開いた時ならよい）。そこで出した回は、最初の「始める」では出さず数えない。2 分の上限は見ない（持ち主の依頼）。出した時刻は ug:inter-at に書くので、トップの「戻った時」の広告が続けて出ることはない。fluct が自分で全画面の枠と × を出す。こちらは待つ間の小さな表示だけ。
// 押し直しは操作の外なので、iPhone ではゲームの音が鳴らなくなる。止めた押下の中で AudioContext を先に作って起こしておき、ゲームが作る時にそれを渡す。
// ugstudio.ooo の本番だけ（ベータ・?auto・手元では出さない。手元は ?adtest で仮の広告）。GA：fluct_fill・fluct_view・fluct_nofill・inter_skip（slot: inter, page: start）
// 広告でやめた人を見る（2026-11-10 の持ち主の依頼）：最初の「始める」で start_ad（出した）・start_noad（出さない回）・start_topad（トップで見てきた）のどれか 1 回、
// 広告のあとゲームに戻した時 inter_done（fill: 広告が来たか、ms: 押してから戻るまで）、広告の間にページを離れた時 inter_leave
(function () {
  const UGx = window.UG; if (!UGx) return;
  const q = new URLSearchParams(location.search), TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && q.has('adtest');
  if (window.UG_BETA || q.has('auto') || !(TEST || location.hostname === 'ugstudio.ooo')) return;
  // ゲームごとの「最初にゲームが始まる入口」（複数は , 区切り）。ここに無いゲームでは出さない
  // タイトル画面で最初に押すボタン（選ぶ画面へ進むだけのものも含む。ゲームの途中で同じボタンを使い回すゲームもあるが、止めるのはページで最初の 1 回だけ）
  const T = '#main';
  const START = {
    acai: T, beer: T, bento: T, chahan: T, cheesedog: T, coffee: T, crepe: T, donut: T, dubaimochi: T, frappe: T, karaage: T, maratang: T, nikujaga: T, sushi: T, takoyaki: T, tonkatsu: T,
    jiro: T, bread: T, pizza: T, chiiku: T, okashi: T, teishoku: T, fruitame: T, wagashi: T, creamsoda: T, nuigurumi: T, paki: T,
    burgershop: '#bnew,#bcont,#bcoop', kankoku: '#main,#sub', oshicam: '#go', oshihyo: '#goGroup,#goFree,#goSearch', diamond: '#start', gyoza: '#main,#sub', hanabi: '#start,#gGo',
    rollice: '#main,#freeBtn', tapioca: '#main,#free', xmastree: '#main,#sub2', yogurtice: '#start,#free,#pickb'
  };
  const SEL = START[UGx.slug] || ''; // 無いゲームでは「始める」の広告は出さない（開いた時の広告は出す）
  const SP = /iPhone|iPod|iPad|Android|Mobile/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const U = SP ? ['1000198954', '1000314561'] : ['1000198953', '1000314560'];
  const ga = (n, p) => { if (TEST) { (window.__adev = window.__adev || []).push([n, p]); return; } try { gtag('event', n, Object.assign({ game: UGx.slug, page: 'start', sp: SP ? 1 : 0 }, p)); } catch (e) {} };
  const EVERY = 5;
  // 最初の「始める」を 1 回数え、出す回なら true（数えられない端末では毎回出す）
  const turn = () => { try { const n = +(localStorage.getItem('ug:start-n') || 0) + 1; localStorage.setItem('ug:start-n', String(n)); return (n - 1) % EVERY === 0; } catch (e) { return true; } };

  // 音：ゲームが作る AudioContext を覚えておく。止めた押下の中で 1 つ作って起こし、次にゲームが作る時はそれを返す
  const AC0 = window.AudioContext || window.webkitAudioContext, ctxs = [];
  let spare = null;
  if (AC0) {
    const AC = function (opt) { if (spare && !opt) { const c = spare; spare = null; return c; } const c = opt ? new AC0(opt) : new AC0(); ctxs.push(c); return c; };
    AC.prototype = AC0.prototype; Object.setPrototypeOf(AC, AC0);
    try { if (window.AudioContext) window.AudioContext = AC; if (window.webkitAudioContext) window.webkitAudioContext = AC; } catch (e) {}
  }
  function wakeAudio() {
    for (const c of ctxs) try { if (c.state === 'suspended') c.resume(); } catch (e) {}
    if (!AC0 || spare) return;
    try { const c = new AC0(); ctxs.push(c); c.resume && c.resume(); const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); spare = c; } catch (e) {}
  }

  // fluct のスクリプトは開いた時に読んでおく（押してから読むと間に合わないことがある。広告はまだ頼まない）
  const lib = () => { if (TEST || document.querySelector('script[src="https://pdn.adingo.jp/p.js"]')) return; const sc = document.createElement('script'); sc.async = true; sc.src = 'https://pdn.adingo.jp/p.js'; document.body.appendChild(sc); };
  if (document.readyState === 'complete') lib(); else addEventListener('load', lib, { once: true });

  // 待つ間は画面を覆って押下を止めるだけ。文字は出さない（2026-11-11 持ち主：「広告のあとに始まります」の表示はだめ）
  function waitBox() {
    const d = document.createElement('div'); d.className = 'ug-interwait';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.35);pointer-events:auto';
    document.body.appendChild(d); return d;
  }

  // 広告を出し、閉じられたら（来なければ 5 秒で）done
  function show(done) {
    try { localStorage.setItem('ug:inter-at', String(Date.now())); } catch (e) {}
    const box = waitBox();
    const c = document.createElement('div'); c.className = 'fluct-unit-' + U[1] + '-1'; document.body.appendChild(c);
    const t0 = performance.now(); let shown = false, finished = false;
    const finish = () => { if (finished) return; finished = true; box.remove(); done(shown); };
    const frames = () => [...c.querySelectorAll('iframe')].filter(f => f.offsetHeight > 20);
    const wrap = () => { for (let e = c.parentElement; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return e; return null; };
    const gone = w => !w || !w.isConnected || !c.isConnected || getComputedStyle(w).display === 'none' || getComputedStyle(w).visibility === 'hidden' || !w.getClientRects().length || !frames().length;
    const fill = () => {
      if (shown) return; shown = true; mo.disconnect(); box.remove(); ga('fluct_fill', { slot: 'inter', ms: Math.round(performance.now() - t0) });
      if (TEST) { c.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.55)'; const x = document.createElement('button'); x.textContent = '×'; x.className = 'adint-test-x'; x.style.cssText = 'position:absolute;top:12px;right:12px;font-size:28px;width:48px;height:48px'; x.onclick = () => c.remove(); c.appendChild(x); }
      let tm = 0; const vo = new IntersectionObserver(es => { clearTimeout(tm); if (es[es.length - 1].intersectionRatio >= .5) tm = setTimeout(() => { ga('fluct_view', { slot: 'inter' }); vo.disconnect(); }, 1000); }, { threshold: [0, .5] });
      vo.observe(frames()[0] || c);
      const w = TEST ? c : wrap();
      const t = setInterval(() => { if (gone(w)) { clearInterval(t); finish(); } }, 300);
    };
    const mo = new MutationObserver(() => { if (frames().length) fill(); }); mo.observe(c, { childList: true, subtree: true, attributes: true });
    setTimeout(() => { if (shown) return; if (frames().length) return fill(); mo.disconnect(); ga('fluct_nofill', { slot: 'inter' }); ga('inter_skip', { why: 'start' }); c.remove(); finish(); }, 5000);
    if (TEST) { setTimeout(() => { const f = document.createElement('iframe'); f.width = 300; f.height = 250; f.style.border = '0'; f.srcdoc = '<body style="margin:0;background:#cde;font:700 14px sans-serif;display:grid;place-items:center">仮の広告 300×250</body>'; c.appendChild(f); }, q.has('adslow') ? 9000 : 600); return; }
    lib();
    // ここから下は fluct のタグのまま
    var fluctAdScript = window.fluctAdScript = window.fluctAdScript || {};
    fluctAdScript.cmd = fluctAdScript.cmd || [];
    fluctAdScript.cmd.push(function (cmd) {
      cmd.setGamTargetingMap('%%PATTERN:TARGETINGMAP%%');
      cmd.requestAdByGroup(U[0])
        .setGpid('%%ADUNIT%%')
        .display('.fluct-unit-' + U[1] + '-1', U[1]);
    });
  }

  // 開始ボタンへの最初の押下を止める。押下 1 回ぶん（押す〜離す〜click）をまとめて止め、広告のあとに送り直す
  // 止めるのは開始ボタンの中への押下だけ（広告の × などほかの所への押下は止めない。待つ間は待つ表示が画面を覆う）
  const TYPES = ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend', 'click'];
  let state = 'idle', el = null, touch = false, replaying = false; // idle → hold（止めている）→ done。開いた時の広告の間は arrive → done
  function onEv(e) {
    if (replaying || state === 'done' || !e.isTrusted) return;
    const t = e.target && e.target.closest && e.target.closest(SEL);
    if (state === 'idle') {
      if (!t || (e.type !== 'pointerdown' && e.type !== 'touchstart' && e.type !== 'mousedown' && e.type !== 'click')) return;
      if (t.disabled) return;
      if (!turn()) { state = 'done'; ga('start_noad', {}); return; } // 出さない回。このページではもう数えない
      state = 'hold'; el = t; touch = false; ga('start_ad', {}); const t0 = performance.now();
      show(filled => { state = 'done'; ga('inter_done', { fill: filled ? 1 : 0, ms: Math.round(performance.now() - t0) }); replay(); });
    }
    if (state !== 'hold' || !el || !t || t !== el) return;
    if (e.type.startsWith('touch') || e.pointerType === 'touch') touch = true;
    wakeAudio(); // iPhone は touchend・click でないと音を起こせないことがあるので、止めた押下のたびに起こす
    e.stopImmediatePropagation(); if (e.cancelable && e.type !== 'touchstart') e.preventDefault();
  }
  if (SEL) for (const ty of TYPES) addEventListener(ty, onEv, { capture: true, passive: false });
  // 開いた時：トップの一覧でこのゲームを押して来た時は、ページを開いたらすぐ出す（2026-11-10 持ち主：fluct の指示。一覧を離れる前に出すのはだめ、行き先を開いた時はよい）。
  // 印はトップが押した時に sessionStorage の ug:inter-go に書く（{ p: 行き先のパス, t: 押した時刻 }）。1 分より古い印・ほかのゲームの印は使わない。
  // 2 分に 1 回まで（ug:inter-at。トップの広告と合わせて数える。前にトップで出していた時と同じ）。出したら最初の「始める」では出さず、5 回に 1 回の数にも入れない。
  // 待つ間は待つ表示が画面を覆うので、広告の前にゲームが始まることはない。GA：arrive_ad（出した）・arrive_done（閉じた）・inter_leave（phase: arrive）
  (() => {
    let g = null; try { g = JSON.parse(sessionStorage.getItem('ug:inter-go') || 'null'); sessionStorage.removeItem('ug:inter-go'); } catch (e) {}
    if (!g || !g.p || !location.pathname.startsWith(g.p) || !(Date.now() - g.t < 60 * 1000)) return;
    try { if (Date.now() - +(localStorage.getItem('ug:inter-at') || 0) < 2 * 60 * 1000) return; } catch (e) {}
    state = 'arrive'; ga('arrive_ad', {});
    const go = () => { const t0 = performance.now(); show(filled => { state = 'done'; ga('arrive_done', { fill: filled ? 1 : 0, ms: Math.round(performance.now() - t0) }); }); };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go, { once: true }); else go();
  })();
  // 広告（や待つ表示）の間にページを離れた（広告でやめた人の目安。iPhone はタブを閉じても来ないことがあるので、割合は 1 − inter_done ÷ start_ad で見る）
  addEventListener('pagehide', () => { if (state === 'hold' || state === 'arrive') ga('inter_leave', { phase: state === 'arrive' ? 'arrive' : document.querySelector('.ug-interwait') ? 'wait' : 'ad', transport_type: 'beacon' }); });
  // ブラウザが本物の押下で送る順に送る：pointerdown →（touchstart）→ mousedown → pointerup →（touchend）→ mouseup → click
  // ゲームが touchstart・touchend を取り消したら（preventDefault）、ブラウザと同じく mouse と click は送らない
  function replay() {
    const t = el; el = null; if (!t || !t.isConnected) return;
    const r = t.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window, button: 0 };
    const P = (ty, down) => window.PointerEvent ? t.dispatchEvent(new PointerEvent(ty, Object.assign({ pointerId: 1, pointerType: touch ? 'touch' : 'mouse', isPrimary: true, buttons: down ? 1 : 0 }, base))) : true;
    const M = (ty, down) => t.dispatchEvent(new MouseEvent(ty, Object.assign({ buttons: down ? 1 : 0 }, base)));
    replaying = true;
    try {
      // pointerdown の取り消しは mousedown・mouseup だけを止める。touch の取り消しは click も止める
      const mouse = P('pointerdown', true);
      let tok = !touch || touchEv(t, 'touchstart', x, y);
      if (mouse && tok) M('mousedown', true);
      P('pointerup', false);
      if (touch && !touchEv(t, 'touchend', x, y)) tok = false;
      if (mouse && tok) M('mouseup', false);
      if (tok) t.click();
    } finally { replaying = false; }
  }
  // 戻り値：取り消されなかったら true（TouchEvent が作れない端末では true）
  function touchEv(t, ty, x, y) {
    try { const tc = new Touch({ identifier: 1, target: t, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY }); return t.dispatchEvent(new TouchEvent(ty, { bubbles: true, cancelable: true, composed: true, touches: ty === 'touchstart' ? [tc] : [], targetTouches: ty === 'touchstart' ? [tc] : [], changedTouches: [tc] })); } catch (e) { return true; }
  }
})();
