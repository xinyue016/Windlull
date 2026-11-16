/* 首页可点击的 Three.js 体积云 */
(() => {
  'use strict';
  const boot = () => {
  const THREE = window.THREE;
  const mount = document.getElementById('cloud3dLayer');
  if (!THREE || !mount) return;

  const comfortQuotes = [
    '你不需要每一刻都表现得很好，能走到这里已经很不容易。',
    '情绪不是你需要立刻修好的故障，它只是来提醒你：有些感受值得被看见。',
    '今天如果只完成了一件小事，也算认真生活过了。',
    '允许自己慢一点，世界不会因为你停下来呼吸一会儿就把你落下。',
    '你已经撑过了很多不知道该怎么办的时刻，这次也可以一点点来。',
    '不必急着变好，先让自己被好好接住。',
    '有些答案不是想出来的，是在休息、散步和被理解里慢慢长出来的。',
    '你可以一边难过，一边继续喜欢今天的晚霞。',
    '感觉累的时候，休息不是偷懒，是在为心留出恢复的空间。',
    '不是所有情绪都需要解释，有些只需要有人陪它待一会儿。',
    '如果今天没有力气向前走，原地站一会儿也没关系。',
    '你值得被温柔对待，尤其是在你自己觉得不够好的时候。',
    '今天的你，不需要和任何人比较进度。',
    '请把对别人的耐心，也分一点给自己。',
    '不开心并不代表你做错了什么，它也可能只是你太认真地在感受生活。',
    '把今天的难过交给今晚的云，明天再决定要不要带走。',
    '你可以拒绝那些让你一直消耗自己的事情。',
    '偶尔迷路，也是在认识新的方向。',
    '世界偶尔很吵，记得给自己留一小块安静的地方。',
    '不用马上振作，我就在这里陪你待一会儿。'
  ];

  const body = document.body;
  const quoteCard = document.getElementById('cloudQuoteCard');
  const quoteText = document.getElementById('cloudQuoteText');
  const closeQuote = document.getElementById('closeCloudQuote');
  let lastQuoteIndex = -1;

  const showComfortQuote = () => {
    if (!quoteCard || !quoteText) return;
    let index = Math.floor(Math.random() * comfortQuotes.length);
    if (comfortQuotes.length > 1 && index === lastQuoteIndex) index = (index + 1) % comfortQuotes.length;
    lastQuoteIndex = index;
    quoteText.textContent = comfortQuotes[index];
    quoteCard.classList.add('is-visible');
    quoteCard.setAttribute('aria-hidden', 'false');
  };

  const hideComfortQuote = () => {
    if (!quoteCard) return;
    quoteCard.classList.remove('is-visible');
    quoteCard.setAttribute('aria-hidden', 'true');
  };

  if (closeQuote) closeQuote.addEventListener('click', hideComfortQuote);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth <= 700 ? 1.35 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.pointerEvents = 'none';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 80);
  camera.position.set(0, 0.8, 12);
  camera.lookAt(0, 1.25, 0);

  const makePuffTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 384, 384);
    ctx.save();
    ctx.filter = 'blur(18px)';
    const blobs = [
      [165, 184, 78, 0.58], [222, 172, 88, 0.54], [132, 212, 74, 0.48],
      [256, 220, 62, 0.42], [196, 228, 92, 0.5], [292, 202, 48, 0.3],
      [100, 195, 48, 0.28], [218, 145, 54, 0.32]
    ];
    blobs.forEach((blob) => {
      const gradient = ctx.createRadialGradient(blob[0], blob[1], 0, blob[0], blob[1], blob[2]);
      gradient.addColorStop(0, 'rgba(255,255,255,' + blob[3] + ')');
      gradient.addColorStop(0.52, 'rgba(251,253,255,' + blob[3] * 0.72 + ')');
      gradient.addColorStop(1, 'rgba(242,247,250,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(blob[0], blob[1], blob[2], 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  };

  const puffTexture = makePuffTexture();
  const whiteMaterial = new THREE.SpriteMaterial({
    map: puffTexture,
    color: '#ffffff',
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });
  const shadeMaterial = new THREE.SpriteMaterial({
    map: puffTexture,
    color: '#c8d6e1',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });
  const warmMaterial = new THREE.SpriteMaterial({
    map: puffTexture,
    color: '#ffe9d2',
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });

  const clouds = [];
  const hitboxes = [];

  const makeCloud = (x, y, z, scale, speed, seed) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.userData.speed = speed;
    group.userData.drift = Math.random() * Math.PI * 2;

    let randomState = seed;
    const random = () => {
      randomState = (randomState * 1664525 + 1013904223) % 4294967296;
      return randomState / 4294967296;
    };

    for (let i = 0; i < 34; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const px = Math.cos(angle) * radius * 2.25;
      const py = Math.sin(angle) * radius * 0.53 + random() * 0.22;
      const pz = (random() - 0.5) * 0.9;
      const size = 1.15 + random() * 1.55;
      const material = py < -0.05 ? shadeMaterial.clone() : (random() > 0.82 ? warmMaterial.clone() : whiteMaterial.clone());
      material.opacity *= 0.68 + random() * 0.42;
      const sprite = new THREE.Sprite(material);
      sprite.position.set(px, py, pz);
      sprite.scale.set(size, size * (0.48 + random() * 0.12), 1);
      group.add(sprite);
    }

    for (let i = 0; i < 7; i += 1) {
      const wisp = new THREE.Sprite(whiteMaterial.clone());
      wisp.material.opacity = 0.06 + random() * 0.05;
      wisp.position.set((random() - 0.5) * 5.0, 0.18 + random() * 0.32, (random() - 0.5) * 0.9);
      wisp.scale.set(2.8 + random() * 2.2, 0.36 + random() * 0.22, 1);
      group.add(wisp);
    }

    const hitbox = new THREE.Mesh(
      new THREE.SphereGeometry(2.55, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitbox.position.y = 0.12;
    hitbox.userData.isCloud = true;
    group.add(hitbox);
    hitboxes.push(hitbox);

    scene.add(group);
    clouds.push(group);
    return group;
  };

  makeCloud(-5.0, 2.55, -1.8, 1.03, 0.11, 18);
  makeCloud(2.9, 3.12, -3.1, 0.82, 0.075, 37);
  makeCloud(-0.7, 0.95, -0.65, 0.66, 0.09, 73);
  makeCloud(5.4, 1.45, -2.4, 0.72, 0.065, 109);

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let active = !body.classList.contains('night-mode');
  let raf = 0;
  let last = performance.now();
  let pointerX = 0;
  let pointerY = 0;

  const resize = () => {
    const rect = mount.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(mount);
  resize();

  let lastRender = 0;
  const animate = (now) => {
    if (!active) return;
    raf = requestAnimationFrame(animate);
    if (window.innerWidth <= 700 && now - lastRender < 32) return;
    lastRender = now;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;

    clouds.forEach((cloud, index) => {
      cloud.position.x += cloud.userData.speed * delta;
      if (cloud.position.x > 7.3) cloud.position.x = -7.3;
      cloud.position.y += Math.sin(time * 0.18 + index) * 0.00045;
      cloud.rotation.z = Math.sin(time * 0.12 + index * 0.7) * 0.006;
    });

    camera.position.x += (pointerX * 0.33 - camera.position.x) * 0.018;
    camera.position.y += ((0.8 - pointerY * 0.18) - camera.position.y) * 0.018;
    camera.lookAt(0, 1.2, 0);
    renderer.render(scene, camera);
  };

  const start = () => {
    if (active) return;
    active = true;
    mount.style.display = '';
    last = performance.now();
    raf = requestAnimationFrame(animate);
  };

  const stop = () => {
    active = false;
    cancelAnimationFrame(raf);
    mount.style.display = 'none';
  };

  if (active) {
    last = performance.now();
    raf = requestAnimationFrame(animate);
  } else {
    mount.style.display = 'none';
  }

  const observer = new MutationObserver(() => {
    if (body.classList.contains('night-mode')) stop();
    else start();
  });
  observer.observe(body, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX / window.innerWidth * 2 - 1;
    pointerY = event.clientY / window.innerHeight * 2 - 1;
  });

  document.addEventListener('click', (event) => {
    if (!active) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, [role="button"], .emotion-feature, .side-rail, .agent-panel, .modal, .cloud-quote-card')) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(hitboxes, false);
    if (hits.length) showComfortQuote();
  });
  };

  const scheduleBoot = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(boot, { timeout: 1400 });
    } else {
      window.setTimeout(boot, 650);
    }
  };
  if (document.readyState === 'complete') scheduleBoot();
  else document.addEventListener('DOMContentLoaded', scheduleBoot, { once: true });
})();
