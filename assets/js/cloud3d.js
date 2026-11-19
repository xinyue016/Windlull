/* 首页 Three.js 体积云 */
(() => {
  'use strict';
  const boot = () => {
  const THREE = window.THREE;
  const mount = document.getElementById('cloud3dLayer');
  if (!THREE || !mount) return;

  const body = document.body;

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

    scene.add(group);
    clouds.push(group);
    return group;
  };

  makeCloud(-5.0, 2.55, -1.8, 1.03, 0.11, 18);
  makeCloud(2.9, 3.12, -3.1, 0.82, 0.075, 37);
  makeCloud(-0.7, 0.95, -0.65, 0.66, 0.09, 73);
  makeCloud(5.4, 1.45, -2.4, 0.72, 0.065, 109);

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
